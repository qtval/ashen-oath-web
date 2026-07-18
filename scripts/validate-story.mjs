import { access, readFile, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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

function requirementsMatch(values, requirements) {
  return !requirements
    || Object.entries(requirements).every(([key, expected]) => values[key] === expected);
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
      if (choice.requires !== undefined) {
        requirementsAreValid = validateStateMap(choice.requires, choiceLabel, "requires", addError);
        if (isPlainObject(choice.requires)) {
          Object.keys(choice.requires).forEach((key) => requiredStateKeys.add(key));
        }
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
      }

      validChoices.push({
        choice,
        choiceIndex,
        runtimeValid: choiceIsValid && requirementsAreValid && effectsAreValid,
      });
    });

    if (hasText(node.id) && !nodeChoices.has(node.id)) nodeChoices.set(node.id, validChoices);
  });

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
        if (!requirementsMatch(currentState.values, choice.requires)) continue;

        if (choice.requires !== undefined) {
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
    },
  };
}

export async function validateStoryFile(storyPath, options = {}) {
  const sourceLabel = relative(options.projectRootPath || projectRoot, storyPath).replaceAll("\\", "/");
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

  return validateStoryData(story, {
    ...options,
    sourceLabel,
  });
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
    if (result.errors.length > 0) {
      failureCount += 1;
      console.error(`${sourceLabel}: validation failed`);
      result.errors.forEach(({ code, message }) => console.error(`- [${code}] ${message}`));
      continue;
    }

    const { choices, endings, explicitPanels, nodes, runtimeStates } = result.summary;
    console.log(
      `${sourceLabel}: passed (${nodes} nodes, ${choices} choices, ${endings} endings, `
      + `${runtimeStates} reachable control states, ${explicitPanels} explicit panel images)`,
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
