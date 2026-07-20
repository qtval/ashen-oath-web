import { access, readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultPanelReference = "../assets/panels/checkpoint-rain-v1.png";
const maximumRuntimeStates = 50_000;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSupportedStateValue(value) {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stateKey(nodeId, values) {
  const orderedValues = Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );
  return `${nodeId}\u0000${JSON.stringify(orderedValues)}`;
}

function requirementsMatch(values, requirements, alternatives) {
  const requiredStateMatches = !requirements
    || Object.entries(requirements).every(([key, expected]) => values[key] === expected);
  const alternativeStateMatches = !alternatives
    || alternatives.some((requirement) => Object.entries(requirement).every(
      ([key, expected]) => values[key] === expected,
    ));
  return requiredStateMatches && alternativeStateMatches;
}

function applyEffects(values, effects, trackedKeys) {
  const nextValues = { ...values };

  for (const [key, value] of Object.entries(effects || {})) {
    if (!trackedKeys.has(key)) continue;
    nextValues[key] = typeof value === "number"
      ? (Number(nextValues[key]) || 0) + value
      : value;
  }

  return nextValues;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resolvePanelPath(reference, rootPath) {
  if (!hasText(reference) || /^[a-z][a-z\d+.-]*:/i.test(reference) || reference.startsWith("//")) {
    return null;
  }

  const cleanReference = reference.split(/[?#]/, 1)[0];
  const resolvedPath = resolve(rootPath, "web", cleanReference);
  const projectRelativePath = relative(rootPath, resolvedPath);

  if (projectRelativePath.startsWith("..") || isAbsolute(projectRelativePath)) return null;
  return resolvedPath;
}

function resolveProjectReference(reference, basePath, rootPath) {
  if (!hasText(reference) || /^[a-z][a-z\d+.-]*:/i.test(reference) || reference.startsWith("//")) {
    return null;
  }

  const cleanReference = reference.split(/[?#]/, 1)[0];
  const resolvedPath = resolve(basePath, cleanReference);
  const projectRelativePath = relative(rootPath, resolvedPath);

  if (projectRelativePath.startsWith("..") || isAbsolute(projectRelativePath)) return null;
  return resolvedPath;
}

function validateStateSchema(schema, chapterTitle, addError) {
  const definitions = new Map();
  const legacyKeys = new Set();

  if (!isPlainObject(schema)) {
    addError("INVALID_STATE_SCHEMA", "State schema must contain a JSON object.");
    return { definitions, legacyKeys };
  }

  if (schema.schema_version !== 1) {
    addError("INVALID_STATE_SCHEMA_VERSION", "State schema schema_version must be 1.");
  }
  if (!hasText(schema.chapter) || schema.chapter !== chapterTitle) {
    addError(
      "STATE_SCHEMA_CHAPTER_MISMATCH",
      `State schema chapter must match story chapter "${chapterTitle}".`,
    );
  }

  for (const [groupName, isLegacy] of [["states", false], ["legacy_states", true]]) {
    const group = schema[groupName];
    if (!isPlainObject(group)) {
      addError("INVALID_STATE_SCHEMA_GROUP", `State schema ${groupName} must be an object.`);
      continue;
    }

    for (const [key, definition] of Object.entries(group)) {
      const location = `state schema ${groupName}.${key}`;
      if (!hasText(key)) {
        addError("INVALID_SCHEMA_STATE_KEY", `${location} has an empty key.`);
        continue;
      }
      if (definitions.has(key)) {
        addError(
          "DUPLICATE_SCHEMA_STATE_KEY",
          `${location} duplicates a state key declared in another schema group.`,
        );
        continue;
      }
      if (!isPlainObject(definition)) {
        addError("INVALID_STATE_DEFINITION", `${location} must be an object.`);
        continue;
      }

      const supportedTypes = new Set(["boolean", "enum", "number", "string"]);
      if (!supportedTypes.has(definition.type)) {
        addError(
          "INVALID_SCHEMA_STATE_TYPE",
          `${location}.type must be boolean, enum, number, or string.`,
        );
      }
      if (!hasText(definition.description)) {
        addError("MISSING_STATE_DESCRIPTION", `${location} needs a non-empty description.`);
      }

      if (definition.type === "number" && definition.operation !== "increment") {
        addError(
          "INVALID_NUMBER_OPERATION",
          `${location}.operation must be "increment" because numeric effects are additive.`,
        );
      }
      if (definition.type === "enum") {
        if (!Array.isArray(definition.values) || definition.values.length === 0) {
          addError("MISSING_ENUM_VALUES", `${location}.values must contain allowed strings.`);
        } else {
          const uniqueValues = new Set();
          for (const value of definition.values) {
            if (!hasText(value)) {
              addError("INVALID_ENUM_SCHEMA_VALUE", `${location}.values must contain non-empty strings.`);
            } else if (uniqueValues.has(value)) {
              addError("DUPLICATE_ENUM_SCHEMA_VALUE", `${location}.values repeats "${value}".`);
            }
            uniqueValues.add(value);
          }
        }
      }

      definitions.set(key, { ...definition, legacy: isLegacy });
      if (isLegacy) legacyKeys.add(key);
    }
  }

  if (!Array.isArray(schema.reconvergence_invariants)) {
    addError(
      "INVALID_RECONVERGENCE_INVARIANTS",
      "State schema reconvergence_invariants must be an array.",
    );
  } else {
    const invariantIds = new Set();
    for (const [index, invariant] of schema.reconvergence_invariants.entries()) {
      const location = `reconvergence invariant ${index + 1}`;
      if (!isPlainObject(invariant)) {
        addError("INVALID_RECONVERGENCE_INVARIANT", `${location} must be an object.`);
        continue;
      }
      if (!hasText(invariant.id)) {
        addError("MISSING_INVARIANT_ID", `${location} needs a non-empty id.`);
      } else if (invariantIds.has(invariant.id)) {
        addError("DUPLICATE_INVARIANT_ID", `${location} repeats id "${invariant.id}".`);
      } else {
        invariantIds.add(invariant.id);
      }
      if (!hasText(invariant.scene)) {
        addError("MISSING_INVARIANT_SCENE", `${location} needs a beat-sheet scene id.`);
      }
      if (!hasText(invariant.description)) {
        addError("MISSING_INVARIANT_DESCRIPTION", `${location} needs a non-empty description.`);
      }
      if (!Array.isArray(invariant.preserve) || invariant.preserve.length === 0) {
        addError("MISSING_INVARIANT_STATES", `${location}.preserve must list state keys.`);
        continue;
      }

      const preservedKeys = new Set();
      for (const key of invariant.preserve) {
        if (!hasText(key) || !definitions.has(key)) {
          addError(
            "UNKNOWN_INVARIANT_STATE_KEY",
            `${location}.preserve references unknown state key "${key}".`,
          );
        } else if (preservedKeys.has(key)) {
          addError(
            "DUPLICATE_INVARIANT_STATE_KEY",
            `${location}.preserve repeats state key "${key}".`,
          );
        }
        preservedKeys.add(key);
      }
    }
  }

  return { definitions, legacyKeys };
}

function validateStateValueAgainstSchema(
  key,
  value,
  location,
  kind,
  schemaInfo,
  usedLegacyKeys,
  addError,
) {
  const definition = schemaInfo.definitions.get(key);
  if (!definition) {
    addError("UNKNOWN_STATE_KEY", `${location} ${kind} uses unknown state key "${key}".`);
    return false;
  }
  if (definition.legacy) usedLegacyKeys.add(key);

  let valueIsValid = true;
  if (definition.type === "boolean") valueIsValid = typeof value === "boolean";
  else if (definition.type === "number") valueIsValid = typeof value === "number" && Number.isFinite(value);
  else if (definition.type === "string") valueIsValid = typeof value === "string";
  else if (definition.type === "enum") valueIsValid = definition.values?.includes(value) === true;

  if (!valueIsValid) {
    if (definition.type === "enum") {
      addError(
        "INVALID_ENUM_STATE_VALUE",
        `${location} ${kind}.${key} must be one of: ${definition.values?.join(", ")}.`,
      );
    } else {
      addError(
        "INVALID_TYPED_STATE_VALUE",
        `${location} ${kind}.${key} must be a ${definition.type}.`,
      );
    }
  }

  return valueIsValid;
}

function validateStateMap(value, location, kind, addError) {
  if (!isPlainObject(value)) {
    addError("INVALID_STATE_MAP", `${location} ${kind} must be an object.`);
    return false;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    addError("EMPTY_STATE_MAP", `${location} ${kind} must not be empty.`);
    return false;
  }

  let valid = true;
  for (const [key, stateValue] of entries) {
    if (!hasText(key)) {
      addError("INVALID_STATE_KEY", `${location} ${kind} contains an empty state key.`);
      valid = false;
    }
    if (!isSupportedStateValue(stateValue)) {
      addError(
        "INVALID_STATE_VALUE",
        `${location} ${kind}.${key} must be a string, finite number, boolean, or null.`,
      );
      valid = false;
    }
  }

  return valid;
}

function validateChronicle(chronicle, nodeById, schemaInfo, usedLegacyKeys, addError) {
  if (chronicle === undefined) return;
  if (!isPlainObject(chronicle)) {
    addError("INVALID_CHRONICLE", "Chronicle must be an object.");
    return;
  }
  if (!hasText(chronicle.empty_text)) {
    addError("MISSING_CHRONICLE_EMPTY_TEXT", "Chronicle needs non-empty empty_text.");
  }
  if (!Array.isArray(chronicle.sections) || chronicle.sections.length === 0) {
    addError("MISSING_CHRONICLE_SECTIONS", "Chronicle sections must be a non-empty array.");
    return;
  }

  const sectionIds = new Set();
  const entryIds = new Set();
  chronicle.sections.forEach((section, sectionIndex) => {
    const sectionLabel = `chronicle section ${sectionIndex + 1}`;
    if (!isPlainObject(section)) {
      addError("INVALID_CHRONICLE_SECTION", `${sectionLabel} must be an object.`);
      return;
    }
    if (!hasText(section.id)) {
      addError("MISSING_CHRONICLE_SECTION_ID", `${sectionLabel} needs a non-empty id.`);
    } else if (sectionIds.has(section.id)) {
      addError("DUPLICATE_CHRONICLE_SECTION_ID", `${sectionLabel} repeats id "${section.id}".`);
    } else {
      sectionIds.add(section.id);
    }
    if (!hasText(section.title)) {
      addError("MISSING_CHRONICLE_SECTION_TITLE", `${sectionLabel} needs a non-empty title.`);
    }
    if (!Array.isArray(section.entries) || section.entries.length === 0) {
      addError("MISSING_CHRONICLE_ENTRIES", `${sectionLabel} entries must be a non-empty array.`);
      return;
    }

    section.entries.forEach((entry, entryIndex) => {
      const entryLabel = `${sectionLabel}, entry ${entryIndex + 1}`;
      if (!isPlainObject(entry)) {
        addError("INVALID_CHRONICLE_ENTRY", `${entryLabel} must be an object.`);
        return;
      }
      if (!hasText(entry.id)) {
        addError("MISSING_CHRONICLE_ENTRY_ID", `${entryLabel} needs a non-empty id.`);
      } else if (entryIds.has(entry.id)) {
        addError("DUPLICATE_CHRONICLE_ENTRY_ID", `${entryLabel} repeats id "${entry.id}".`);
      } else {
        entryIds.add(entry.id);
      }
      if (!hasText(entry.text)) {
        addError("MISSING_CHRONICLE_ENTRY_TEXT", `${entryLabel} needs non-empty text.`);
      }

      if (entry.available_from !== undefined) {
        if (!Array.isArray(entry.available_from) || entry.available_from.length === 0) {
          addError(
            "INVALID_CHRONICLE_VISITS",
            `${entryLabel} available_from must be a non-empty array of node ids.`,
          );
        } else {
          const visitedIds = new Set();
          for (const nodeId of entry.available_from) {
            if (!hasText(nodeId) || !nodeById.has(nodeId)) {
              addError(
                "UNKNOWN_CHRONICLE_NODE",
                `${entryLabel} available_from references unknown node "${nodeId}".`,
              );
            } else if (visitedIds.has(nodeId)) {
              addError(
                "DUPLICATE_CHRONICLE_NODE",
                `${entryLabel} available_from repeats node "${nodeId}".`,
              );
            }
            visitedIds.add(nodeId);
          }
        }
      }

      for (const requirementKind of ["requires", "requires_any"]) {
        const requirement = entry[requirementKind];
        if (requirement === undefined) continue;
        const alternatives = requirementKind === "requires_any" ? requirement : [requirement];
        if (!Array.isArray(alternatives) || alternatives.length === 0) {
          addError(
            "INVALID_CHRONICLE_REQUIREMENTS",
            `${entryLabel} ${requirementKind} must contain state requirements.`,
          );
          continue;
        }
        alternatives.forEach((stateMap, alternativeIndex) => {
          const kind = requirementKind === "requires"
            ? requirementKind
            : `${requirementKind}[${alternativeIndex}]`;
          const valid = validateStateMap(stateMap, entryLabel, kind, addError);
          if (valid && schemaInfo) {
            for (const [key, value] of Object.entries(stateMap)) {
              validateStateValueAgainstSchema(
                key,
                value,
                entryLabel,
                kind,
                schemaInfo,
                usedLegacyKeys,
                addError,
              );
            }
          }
        });
      }
    });
  });
}

export async function validateStoryData(story, options = {}) {
  const rootPath = options.projectRootPath || projectRoot;
  const sourceLabel = options.sourceLabel || "story";
  const fileExists = options.fileExists || pathExists;
  const errors = [];
  const warnings = [];
  const addError = (code, message) => errors.push({ code, message });

  if (!isPlainObject(story)) {
    addError("INVALID_STORY", `${sourceLabel} must contain a JSON object.`);
    return { errors, warnings, summary: null };
  }

  if (!hasText(story.chapter)) {
    addError("MISSING_CHAPTER_TITLE", `${sourceLabel} must define a non-empty chapter title.`);
  }

  const schemaInfo = options.stateSchema
    ? validateStateSchema(options.stateSchema, story.chapter, addError)
    : null;
  const usedLegacyKeys = new Set();

  if (!Array.isArray(story.nodes) || story.nodes.length === 0) {
    addError("MISSING_NODES", `${sourceLabel} must define at least one story node.`);
    return { errors, warnings, summary: null };
  }

  const nodeById = new Map();
  const nodeChoices = new Map();
  const requirementChoices = [];
  const requiredStateKeys = new Set();
  const explicitPanelReferences = [];
  let choiceCount = 0;
  let endingCount = 0;

  story.nodes.forEach((node, nodeIndex) => {
    const fallbackNodeLabel = `node ${nodeIndex + 1}`;
    if (!isPlainObject(node)) {
      addError("INVALID_NODE", `${fallbackNodeLabel} must be an object.`);
      return;
    }

    const nodeLabel = hasText(node.id) ? `node "${node.id}"` : fallbackNodeLabel;
    if (!hasText(node.id)) {
      addError("MISSING_NODE_ID", `${fallbackNodeLabel} is missing a non-empty id.`);
    } else if (nodeById.has(node.id)) {
      addError("DUPLICATE_NODE_ID", `${nodeLabel} duplicates an earlier node id.`);
    } else {
      nodeById.set(node.id, node);
    }

    if (!hasText(node.panel_description)) {
      addError("MISSING_PANEL_DESCRIPTION", `${nodeLabel} needs a non-empty panel_description.`);
    }
    if (typeof node.speaker !== "string") {
      addError("INVALID_SPEAKER", `${nodeLabel} speaker must be a string.`);
    }
    if (!hasText(node.text)) {
      addError("MISSING_NODE_TEXT", `${nodeLabel} needs non-empty text.`);
    }
    if (!Array.isArray(node.choices)) {
      addError("INVALID_CHOICES", `${nodeLabel} choices must be an array.`);
      return;
    }

    const isEnding = node.ending !== undefined;
    if (isEnding) {
      endingCount += 1;
      if (!hasText(node.ending)) {
        addError("INVALID_ENDING", `${nodeLabel} ending must be a non-empty string.`);
      }
      if (node.choices.length > 0) {
        addError("ENDING_HAS_CHOICES", `${nodeLabel} is an ending and must not have choices.`);
      }
    } else if (node.choices.length === 0) {
      addError("DEAD_END_NODE", `${nodeLabel} is not an ending and must provide at least one choice.`);
    }

    if (node.panel_image !== undefined) {
      if (!hasText(node.panel_image)) {
        addError("INVALID_PANEL_REFERENCE", `${nodeLabel} panel_image must be a non-empty local path.`);
      } else {
        explicitPanelReferences.push({ nodeLabel, reference: node.panel_image });
      }
    }

    if (node.conditional_text !== undefined) {
      if (!Array.isArray(node.conditional_text) || node.conditional_text.length === 0) {
        addError(
          "INVALID_CONDITIONAL_TEXT",
          `${nodeLabel} conditional_text must be a non-empty array.`,
        );
      } else {
        node.conditional_text.forEach((fragment, fragmentIndex) => {
          const fragmentLabel = `${nodeLabel}, conditional text ${fragmentIndex + 1}`;
          if (!isPlainObject(fragment)) {
            addError("INVALID_CONDITIONAL_FRAGMENT", `${fragmentLabel} must be an object.`);
            return;
          }
          if (!hasText(fragment.group)) {
            addError("MISSING_CONDITIONAL_GROUP", `${fragmentLabel} needs a non-empty group.`);
          }
          if (!hasText(fragment.text)) {
            addError("MISSING_CONDITIONAL_TEXT", `${fragmentLabel} needs non-empty text.`);
          }
          if (fragment.requires === undefined && fragment.requires_any === undefined) {
            addError(
              "MISSING_CONDITIONAL_REQUIREMENT",
              `${fragmentLabel} needs requires or requires_any.`,
            );
          }

          if (fragment.requires !== undefined) {
            const valid = validateStateMap(
              fragment.requires,
              fragmentLabel,
              "requires",
              addError,
            );
            if (valid && schemaInfo) {
              for (const [key, value] of Object.entries(fragment.requires)) {
                validateStateValueAgainstSchema(
                  key,
                  value,
                  fragmentLabel,
                  "requires",
                  schemaInfo,
                  usedLegacyKeys,
                  addError,
                );
              }
            }
          }

          if (fragment.requires_any !== undefined) {
            if (!Array.isArray(fragment.requires_any) || fragment.requires_any.length === 0) {
              addError(
                "INVALID_REQUIREMENT_ALTERNATIVES",
                `${fragmentLabel} requires_any must be a non-empty array of state maps.`,
              );
            } else {
              fragment.requires_any.forEach((alternative, alternativeIndex) => {
                const alternativeKind = `requires_any[${alternativeIndex}]`;
                const valid = validateStateMap(
                  alternative,
                  fragmentLabel,
                  alternativeKind,
                  addError,
                );
                if (valid && schemaInfo) {
                  for (const [key, value] of Object.entries(alternative)) {
                    validateStateValueAgainstSchema(
                      key,
                      value,
                      fragmentLabel,
                      alternativeKind,
                      schemaInfo,
                      usedLegacyKeys,
                      addError,
                    );
                  }
                }
              });
            }
          }
        });
      }
    }

    const validChoices = [];
    node.choices.forEach((choice, choiceIndex) => {
      choiceCount += 1;
      const choiceLabel = `${nodeLabel}, choice ${choiceIndex + 1}`;
      if (!isPlainObject(choice)) {
        addError("INVALID_CHOICE", `${choiceLabel} must be an object.`);
        return;
      }

      let choiceIsValid = true;
      if (!hasText(choice.text)) {
        addError("MISSING_CHOICE_TEXT", `${choiceLabel} needs non-empty text.`);
        choiceIsValid = false;
      }
      if (!hasText(choice.next)) {
        addError("MISSING_CHOICE_DESTINATION", `${choiceLabel} needs a non-empty next node id.`);
        choiceIsValid = false;
      }

      let requirementsAreValid = true;
      let hasRequirements = false;
      if (choice.requires !== undefined) {
        hasRequirements = true;
        requirementsAreValid = validateStateMap(choice.requires, choiceLabel, "requires", addError);
        if (requirementsAreValid && schemaInfo) {
          for (const [key, value] of Object.entries(choice.requires)) {
            requirementsAreValid = validateStateValueAgainstSchema(
              key,
              value,
              choiceLabel,
              "requires",
              schemaInfo,
              usedLegacyKeys,
              addError,
            ) && requirementsAreValid;
          }
        }
        if (isPlainObject(choice.requires)) {
          Object.keys(choice.requires).forEach((key) => requiredStateKeys.add(key));
        }
      }

      if (choice.requires_any !== undefined) {
        hasRequirements = true;
        if (!Array.isArray(choice.requires_any) || choice.requires_any.length === 0) {
          addError(
            "INVALID_REQUIREMENT_ALTERNATIVES",
            `${choiceLabel} requires_any must be a non-empty array of state maps.`,
          );
          requirementsAreValid = false;
        } else {
          for (const [alternativeIndex, alternative] of choice.requires_any.entries()) {
            const alternativeKind = `requires_any[${alternativeIndex}]`;
            let alternativeIsValid = validateStateMap(
              alternative,
              choiceLabel,
              alternativeKind,
              addError,
            );
            if (alternativeIsValid && schemaInfo) {
              for (const [key, value] of Object.entries(alternative)) {
                alternativeIsValid = validateStateValueAgainstSchema(
                  key,
                  value,
                  choiceLabel,
                  alternativeKind,
                  schemaInfo,
                  usedLegacyKeys,
                  addError,
                ) && alternativeIsValid;
              }
            }
            if (isPlainObject(alternative)) {
              Object.keys(alternative).forEach((key) => requiredStateKeys.add(key));
            }
            requirementsAreValid = alternativeIsValid && requirementsAreValid;
          }
        }
      }

      if (hasRequirements) {
        requirementChoices.push({
          id: `${node.id || nodeIndex}:${choiceIndex}`,
          nodeId: node.id,
          choiceIndex,
          choiceLabel,
          valid: requirementsAreValid,
        });
      }

      let effectsAreValid = true;
      if (choice.effects !== undefined) {
        effectsAreValid = validateStateMap(choice.effects, choiceLabel, "effects", addError);
        if (effectsAreValid && schemaInfo) {
          for (const [key, value] of Object.entries(choice.effects)) {
            effectsAreValid = validateStateValueAgainstSchema(
              key,
              value,
              choiceLabel,
              "effects",
              schemaInfo,
              usedLegacyKeys,
              addError,
            ) && effectsAreValid;
          }
        }
      }

      validChoices.push({
        choice,
        choiceIndex,
        runtimeValid: choiceIsValid && requirementsAreValid && effectsAreValid,
      });
    });

    if (hasText(node.id) && !nodeChoices.has(node.id)) nodeChoices.set(node.id, validChoices);
  });

  validateChronicle(story.chronicle, nodeById, schemaInfo, usedLegacyKeys, addError);

  for (const [nodeId, choices] of nodeChoices) {
    for (const { choice, choiceIndex } of choices) {
      if (hasText(choice?.next) && !nodeById.has(choice.next)) {
        addError(
          "BROKEN_CHOICE_DESTINATION",
          `node "${nodeId}", choice ${choiceIndex + 1} points to missing node "${choice.next}".`,
        );
      }
    }
  }

  const fallbackPanelPath = resolvePanelPath(defaultPanelReference, rootPath);
  if (!fallbackPanelPath || !await fileExists(fallbackPanelPath)) {
    addError(
      "MISSING_DEFAULT_PANEL",
      `Default panel reference "${defaultPanelReference}" does not resolve to an existing project file.`,
    );
  }

  for (const { nodeLabel, reference } of explicitPanelReferences) {
    const panelPath = resolvePanelPath(reference, rootPath);
    if (!panelPath) {
      addError(
        "INVALID_PANEL_REFERENCE",
        `${nodeLabel} panel_image "${reference}" must resolve to a local file inside the project.`,
      );
    } else if (!await fileExists(panelPath)) {
      addError(
        "MISSING_PANEL_FILE",
        `${nodeLabel} panel_image "${reference}" does not exist.`,
      );
    }
  }

  const entryId = story.nodes[0]?.id;
  if (!hasText(entryId) || !nodeById.has(entryId)) {
    addError("INVALID_ENTRY_NODE", `${sourceLabel} first node must have a unique, non-empty id.`);
  }

  const structurallyReachable = new Set();
  if (nodeById.has(entryId)) {
    const queue = [entryId];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (structurallyReachable.has(nodeId)) continue;
      structurallyReachable.add(nodeId);
      for (const { choice } of nodeChoices.get(nodeId) || []) {
        if (nodeById.has(choice?.next)) queue.push(choice.next);
      }
    }
  }

  for (const nodeId of nodeById.keys()) {
    if (!structurallyReachable.has(nodeId)) {
      addError("UNREACHABLE_NODE", `node "${nodeId}" cannot be reached from the first node.`);
    }
  }

  const hasBlockingGraphErrors = errors.some(({ code }) => [
    "BROKEN_CHOICE_DESTINATION",
    "DUPLICATE_NODE_ID",
    "INVALID_ENTRY_NODE",
    "INVALID_NODE",
    "INVALID_CHOICES",
    "MISSING_NODE_ID",
  ].includes(code));

  let runtimeStateCount = 0;
  if (!hasBlockingGraphErrors && nodeById.has(entryId)) {
    const initialKey = stateKey(entryId, {});
    const runtimeStates = new Map([[initialKey, { nodeId: entryId, values: {} }]]);
    const runtimeEdges = new Map();
    const reverseEdges = new Map();
    const runtimeReachableNodes = new Set();
    const availableRequirementChoices = new Set();
    const deadEndNodes = new Set();
    const endingStateKeys = new Set();
    const queue = [initialKey];
    let explorationComplete = true;

    while (queue.length > 0) {
      const currentKey = queue.shift();
      const currentState = runtimeStates.get(currentKey);
      const node = nodeById.get(currentState.nodeId);
      runtimeReachableNodes.add(currentState.nodeId);

      if (node.ending !== undefined) {
        endingStateKeys.add(currentKey);
        runtimeEdges.set(currentKey, new Set());
        continue;
      }

      const nextKeys = new Set();
      for (const choiceRecord of nodeChoices.get(currentState.nodeId) || []) {
        const { choice, choiceIndex, runtimeValid } = choiceRecord;
        if (!runtimeValid || !nodeById.has(choice.next)) continue;
        if (!requirementsMatch(currentState.values, choice.requires, choice.requires_any)) continue;

        if (choice.requires !== undefined || choice.requires_any !== undefined) {
          availableRequirementChoices.add(`${currentState.nodeId}:${choiceIndex}`);
        }

        const nextValues = applyEffects(currentState.values, choice.effects, requiredStateKeys);
        const nextKey = stateKey(choice.next, nextValues);
        nextKeys.add(nextKey);
        if (!reverseEdges.has(nextKey)) reverseEdges.set(nextKey, new Set());
        reverseEdges.get(nextKey).add(currentKey);

        if (!runtimeStates.has(nextKey)) {
          if (runtimeStates.size >= maximumRuntimeStates) {
            addError(
              "RUNTIME_STATE_LIMIT",
              `Runtime exploration exceeded ${maximumRuntimeStates} states; check for unbounded effect cycles.`,
            );
            explorationComplete = false;
            queue.length = 0;
            break;
          }
          runtimeStates.set(nextKey, { nodeId: choice.next, values: nextValues });
          queue.push(nextKey);
        }
      }

      runtimeEdges.set(currentKey, nextKeys);
      if (nextKeys.size === 0) deadEndNodes.add(currentState.nodeId);
    }

    runtimeStateCount = runtimeStates.size;

    for (const requirementChoice of requirementChoices) {
      if (
        requirementChoice.valid
        && runtimeReachableNodes.has(requirementChoice.nodeId)
        && !availableRequirementChoices.has(requirementChoice.id)
      ) {
        addError(
          "UNSATISFIABLE_REQUIREMENT",
          `${requirementChoice.choiceLabel} requires a state that is never available there.`,
        );
      }
    }

    for (const nodeId of nodeById.keys()) {
      if (structurallyReachable.has(nodeId) && !runtimeReachableNodes.has(nodeId)) {
        addError(
          "STATE_UNREACHABLE_NODE",
          `node "${nodeId}" is connected structurally but unreachable with the available effects and requirements.`,
        );
      }
    }

    for (const nodeId of deadEndNodes) {
      addError(
        "RUNTIME_DEAD_END",
        `node "${nodeId}" can be reached in a state where no choice is available and it is not an ending.`,
      );
    }

    if (explorationComplete) {
      if (endingStateKeys.size === 0) {
        addError("NO_REACHABLE_ENDING", `${sourceLabel} has no ending reachable during play.`);
      }

      const statesThatReachAnEnding = new Set(endingStateKeys);
      const reverseQueue = [...endingStateKeys];
      while (reverseQueue.length > 0) {
        const currentKey = reverseQueue.shift();
        for (const parentKey of reverseEdges.get(currentKey) || []) {
          if (statesThatReachAnEnding.has(parentKey)) continue;
          statesThatReachAnEnding.add(parentKey);
          reverseQueue.push(parentKey);
        }
      }

      const nonTerminatingNodes = new Set();
      for (const [key, runtimeState] of runtimeStates) {
        if (!statesThatReachAnEnding.has(key)) nonTerminatingNodes.add(runtimeState.nodeId);
      }
      if (nonTerminatingNodes.size > 0) {
        addError(
          "NON_TERMINATING_ROUTE",
          `Reachable states at ${[...nonTerminatingNodes].map((id) => `"${id}"`).join(", ")} cannot reach an ending.`,
        );
      }
    }
  }

  if (usedLegacyKeys.size > 0) {
    warnings.push({
      code: "LEGACY_STATE_KEYS",
      message: `Prototype story still uses legacy state keys: ${[...usedLegacyKeys].sort().join(", ")}.`,
    });
  }

  return {
    errors,
    warnings,
    summary: {
      chapter: story.chapter,
      choices: choiceCount,
      endings: endingCount,
      explicitPanels: explicitPanelReferences.length,
      nodes: story.nodes.length,
      runtimeStates: runtimeStateCount,
      stateKeys: schemaInfo?.definitions.size || 0,
    },
  };
}

export async function validateStoryFile(storyPath, options = {}) {
  const rootPath = options.projectRootPath || projectRoot;
  const sourceLabel = relative(rootPath, storyPath).replaceAll("\\", "/");
  let story;

  try {
    story = JSON.parse(await readFile(storyPath, "utf8"));
  } catch (error) {
    return {
      errors: [{ code: "INVALID_JSON", message: `${sourceLabel} could not be parsed: ${error.message}` }],
      warnings: [],
      summary: null,
    };
  }

  const schemaErrors = [];
  let stateSchema;
  if (!hasText(story.state_schema)) {
    schemaErrors.push({
      code: "MISSING_STATE_SCHEMA_REFERENCE",
      message: `${sourceLabel} must define a state_schema path.`,
    });
  } else {
    const schemaPath = resolveProjectReference(story.state_schema, dirname(storyPath), rootPath);
    if (!schemaPath) {
      schemaErrors.push({
        code: "INVALID_STATE_SCHEMA_REFERENCE",
        message: `${sourceLabel} state_schema must resolve to a local file inside the project.`,
      });
    } else {
      try {
        stateSchema = JSON.parse(await readFile(schemaPath, "utf8"));
      } catch (error) {
        schemaErrors.push({
          code: "STATE_SCHEMA_LOAD_ERROR",
          message: `${sourceLabel} state_schema could not be loaded: ${error.message}`,
        });
      }
    }
  }

  const result = await validateStoryData(story, {
    ...options,
    sourceLabel,
    stateSchema,
  });
  result.errors.unshift(...schemaErrors);
  return result;
}

async function storyPathsFromArguments(arguments_) {
  if (arguments_.length > 0) return arguments_.map((argument) => resolve(projectRoot, argument));

  const chapterDirectory = resolve(projectRoot, "data", "chapters");
  return (await readdir(chapterDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => resolve(chapterDirectory, entry.name))
    .sort();
}

async function main() {
  const storyPaths = await storyPathsFromArguments(process.argv.slice(2));
  if (storyPaths.length === 0) {
    console.error("Story validation failed: no chapter JSON files were found.");
    process.exitCode = 1;
    return;
  }

  let failureCount = 0;
  for (const storyPath of storyPaths) {
    const sourceLabel = relative(projectRoot, storyPath).replaceAll("\\", "/");
    const result = await validateStoryFile(storyPath, { projectRootPath: projectRoot });
    result.warnings.forEach(({ code, message }) => console.warn(`- [${code}] ${message}`));
    if (result.errors.length > 0) {
      failureCount += 1;
      console.error(`${sourceLabel}: validation failed`);
      result.errors.forEach(({ code, message }) => console.error(`- [${code}] ${message}`));
      continue;
    }

    const { choices, endings, explicitPanels, nodes, runtimeStates, stateKeys } = result.summary;
    console.log(
      `${sourceLabel}: passed (${nodes} nodes, ${choices} choices, ${endings} endings, `
      + `${runtimeStates} reachable control states, ${stateKeys} schema keys, `
      + `${explicitPanels} explicit panel images)`,
    );
  }

  if (failureCount > 0) {
    console.error(`Story validation failed: ${failureCount} chapter file(s) contain errors.`);
    process.exitCode = 1;
  } else {
    console.log(`Story validation passed: ${storyPaths.length} chapter file(s) checked.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
