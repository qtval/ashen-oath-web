import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateStoryData } from "./validate-story.mjs";

const testProjectRoot = resolve("story-validator-test-project");
const panelDescription = "A rain-dark road beneath a timber gate.";

function node(id, choices, extra = {}) {
  return {
    id,
    panel_description: panelDescription,
    speaker: "",
    text: `Story node ${id}.`,
    choices,
    ...extra,
  };
}

function schema(chapter, states, options = {}) {
  return {
    schema_version: 1,
    chapter,
    states,
    legacy_states: options.legacyStates || {},
    reconvergence_invariants: options.invariants || [],
  };
}

async function validate(story, options = {}) {
  return validateStoryData(story, {
    fileExists: async (path) => !options.missingSuffix || !path.endsWith(options.missingSuffix),
    projectRootPath: testProjectRoot,
    sourceLabel: "test story",
    stateSchema: options.stateSchema,
  });
}

function errorCodes(result) {
  return new Set(result.errors.map(({ code }) => code));
}

async function loadChapterOne() {
  const chapter = JSON.parse(await readFile(
    new URL("../data/chapters/chapter_01.json", import.meta.url),
    "utf8",
  ));
  const stateSchema = JSON.parse(await readFile(
    new URL("../data/schemas/chapter_01_state.json", import.meta.url),
    "utf8",
  ));
  return { chapter, stateSchema };
}

function statesArrivingAt(chapter, targetNodeId) {
  const nodes = new Map(chapter.nodes.map((storyNode) => [storyNode.id, storyNode]));
  const queue = [{ nodeId: chapter.nodes[0].id, values: {} }];
  const arrivals = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.nodeId === targetNodeId) {
      arrivals.push(current.values);
      continue;
    }

    const storyNode = nodes.get(current.nodeId);
    assert(storyNode, `Route points to missing node ${current.nodeId}.`);
    for (const choice of storyNode.choices) {
      const requiredStateMatches = !choice.requires || Object.entries(choice.requires).every(
        ([key, expected]) => current.values[key] === expected,
      );
      const alternativeStateMatches = !choice.requires_any || choice.requires_any.some(
        (requirements) => Object.entries(requirements).every(
          ([key, expected]) => current.values[key] === expected,
        ),
      );
      const available = requiredStateMatches && alternativeStateMatches;
      if (!available) continue;

      const values = { ...current.values };
      for (const [key, value] of Object.entries(choice.effects || {})) {
        values[key] = typeof value === "number"
          ? (Number(values[key]) || 0) + value
          : value;
      }
      queue.push({ nodeId: choice.next, values });
    }
  }

  return arrivals;
}

function choiceIsAvailable(choice, values) {
  const requiredStateMatches = !choice.requires || Object.entries(choice.requires).every(
    ([key, expected]) => values[key] === expected,
  );
  const alternativeStateMatches = !choice.requires_any || choice.requires_any.some(
    (requirements) => Object.entries(requirements).every(
      ([key, expected]) => values[key] === expected,
    ),
  );
  return requiredStateMatches && alternativeStateMatches;
}

test("accepts a state-gated route that reaches an ending", async () => {
  const story = {
    chapter: "Test Chapter",
    nodes: [
      node("start", [{ text: "Take the key.", next: "gate", effects: { has_key: true } }]),
      node("gate", [{ text: "Open the gate.", next: "ending", requires: { has_key: true } }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };

  const result = await validate(story, {
    stateSchema: schema("Test Chapter", {
      has_key: { type: "boolean", description: "Whether the key was taken." },
    }),
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.nodes, 3);
  assert.equal(result.summary.endings, 1);
  assert.equal(result.summary.stateKeys, 1);
});

test("accepts a choice when any alternative requirement group matches", async () => {
  const stateSchema = schema("Alternative Routes", {
    route: {
      type: "enum",
      values: ["records", "witness"],
      description: "The selected route.",
    },
  });
  const story = {
    chapter: "Alternative Routes",
    nodes: [
      node("start", [
        { text: "Take records.", next: "gate", effects: { route: "records" } },
        { text: "Take a witness.", next: "gate", effects: { route: "witness" } },
      ]),
      node("gate", [{
        text: "Continue either route.",
        next: "ending",
        requires_any: [{ route: "records" }, { route: "witness" }],
      }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };

  const result = await validate(story, { stateSchema });
  assert.deepEqual(result.errors, []);
});

test("reports missing and duplicate ids, broken links, and unreachable nodes", async () => {
  const story = {
    chapter: "Broken Structure",
    nodes: [
      node("start", [{ text: "Nowhere.", next: "missing" }]),
      node("start", [], { ending: "DUPLICATE" }),
      node("orphan", [], { ending: "ORPHAN" }),
      { panel_description: panelDescription, speaker: "", text: "No id.", choices: [] },
    ],
  };

  const codes = errorCodes(await validate(story));
  assert(codes.has("MISSING_NODE_ID"));
  assert(codes.has("DUPLICATE_NODE_ID"));
  assert(codes.has("BROKEN_CHOICE_DESTINATION"));
  assert(codes.has("UNREACHABLE_NODE"));
});

test("reports invalid and unsatisfiable requirements", async () => {
  const invalidStory = {
    chapter: "Invalid Requirement",
    nodes: [
      node("start", [{ text: "Impossible.", next: "ending", requires: { key: { nested: true } } }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };
  assert(errorCodes(await validate(invalidStory)).has("INVALID_STATE_VALUE"));

  const invalidAlternativesStory = {
    chapter: "Invalid Alternatives",
    nodes: [
      node("start", [{ text: "Impossible.", next: "ending", requires_any: [] }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };
  assert(
    errorCodes(await validate(invalidAlternativesStory)).has("INVALID_REQUIREMENT_ALTERNATIVES"),
  );

  const unsatisfiedStory = {
    chapter: "Unsatisfied Requirement",
    nodes: [
      node("start", [{ text: "Still impossible.", next: "ending", requires: { has_key: true } }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };
  const codes = errorCodes(await validate(unsatisfiedStory));
  assert(codes.has("UNSATISFIABLE_REQUIREMENT"));
  assert(codes.has("RUNTIME_DEAD_END"));
  assert(codes.has("STATE_UNREACHABLE_NODE"));
});

test("reports missing explicit panel files", async () => {
  const story = {
    chapter: "Missing Art",
    nodes: [
      node("start", [{ text: "Finish.", next: "ending" }], {
        panel_image: "../assets/panels/missing-panel.png",
      }),
      node("ending", [], { ending: "THE END" }),
    ],
  };

  const codes = errorCodes(await validate(story, { missingSuffix: "missing-panel.png" }));
  assert(codes.has("MISSING_PANEL_FILE"));
});

test("reports reachable routes that cannot reach an ending", async () => {
  const story = {
    chapter: "Endless Road",
    nodes: [
      node("start", [{ text: "Enter the loop.", next: "loop" }]),
      node("loop", [{ text: "Keep walking.", next: "loop" }]),
    ],
  };

  const codes = errorCodes(await validate(story));
  assert(codes.has("NO_REACHABLE_ENDING"));
  assert(codes.has("NON_TERMINATING_ROUTE"));
});

test("rejects unknown state keys and values outside declared types or enums", async () => {
  const stateSchema = schema("Strict State", {
    route: {
      type: "enum",
      values: ["records", "witness"],
      description: "Selected investigation route.",
    },
    trust: {
      type: "number",
      operation: "increment",
      description: "Accumulated trust.",
    },
  });
  const story = {
    chapter: "Strict State",
    nodes: [
      node("start", [{
        text: "Break the schema.",
        next: "ending",
        effects: { route: "merchant", trust: true, typo_key: false },
      }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };

  const codes = errorCodes(await validate(story, { stateSchema }));
  assert(codes.has("UNKNOWN_STATE_KEY"));
  assert(codes.has("INVALID_ENUM_STATE_VALUE"));
  assert(codes.has("INVALID_TYPED_STATE_VALUE"));
});

test("validates reconvergence declarations against known state keys", async () => {
  const stateSchema = schema("Invariant State", {
    trust: {
      type: "number",
      operation: "increment",
      description: "Accumulated trust.",
    },
  }, {
    invariants: [{
      id: "preserve_unknown",
      scene: "scene_reconverge",
      preserve: ["trust", "missing_key"],
      description: "A deliberately invalid invariant.",
    }],
  });
  const story = {
    chapter: "Invariant State",
    nodes: [
      node("start", [{ text: "Finish.", next: "ending" }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };

  const codes = errorCodes(await validate(story, { stateSchema }));
  assert(codes.has("UNKNOWN_INVARIANT_STATE_KEY"));
});

test("accepts legacy keys but reports them for migration", async () => {
  const stateSchema = schema("Legacy State", {}, {
    legacyStates: {
      old_flag: { type: "boolean", description: "Temporary prototype flag." },
    },
  });
  const story = {
    chapter: "Legacy State",
    nodes: [
      node("start", [{ text: "Use the old flag.", next: "ending", effects: { old_flag: true } }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };

  const result = await validate(story, { stateSchema });
  assert.deepEqual(result.errors, []);
  assert(result.warnings.some(({ code }) => code === "LEGACY_STATE_KEYS"));
});

test("Chapter One opening preserves every lockdown invariant across all branches", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const lockdownInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_bell_and_bar",
  );
  const lockdownArrivals = statesArrivingAt(chapter, "ch01_bell_and_bar");

  assert(lockdownInvariant, "The lockdown invariant must remain declared in the state schema.");
  assert.equal(lockdownArrivals.length, 108);
  for (const values of lockdownArrivals) {
    for (const key of lockdownInvariant.preserve) {
      assert(Object.hasOwn(values, key), `Lockdown route lost required state ${key}.`);
    }
  }

  assert.deepEqual(
    new Set(lockdownArrivals.map(({ approach_intel: value }) => value)),
    new Set(["none", "ditch", "clerk"]),
  );
  assert.deepEqual(
    new Set(lockdownArrivals.map(({ tavin_status: value }) => value)),
    new Set(["captured", "hidden", "abandoned", "bargaining"]),
  );
  assert.deepEqual(
    new Set(lockdownArrivals.map(({ sella_promise: value }) => value)),
    new Set(["none", "wagon_passage", "packet_collateral"]),
  );
  assert.deepEqual(
    new Set(lockdownArrivals.map(({ public_method: value }) => value)),
    new Set(["restraint", "deception", "coercion"]),
  );
});

test("Chapter One investigation routes preserve exact evidence gaps at assembly", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const assemblyInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_three_hands",
  );
  const assemblyArrivals = statesArrivingAt(chapter, "ch01_three_hands");

  assert(assemblyInvariant, "The evidence-assembly invariant must remain declared.");
  assert.equal(assemblyArrivals.length, 32400);
  assert.deepEqual(
    new Set(assemblyArrivals.map(({ investigation_route: value }) => value)),
    new Set(["records", "witness", "merchant", "authority"]),
  );

  for (const values of assemblyArrivals) {
    for (const key of assemblyInvariant.preserve) {
      assert(Object.hasOwn(values, key), `Evidence assembly lost required state ${key}.`);
    }
    assert.notEqual(values.evidence_distribution, "unassembled");

    if (values.investigation_route === "records") {
      assert.notEqual(values.ration_folio_status, "unseen");
      assert.notEqual(values.tavin_testimony, "unheard");
      assert.equal(values.courier_strap_status, "hidden_with_sella");
      assert.equal(values.search_warrant_status, "unseen");
      assert.equal(values.sella_tip_known, false);
    } else if (values.investigation_route === "witness") {
      assert.equal(values.ration_folio_status, "unseen");
      assert.notEqual(values.tavin_testimony, "unheard");
      assert.equal(values.search_warrant_status, "unseen");
      assert.equal(values.sella_tip_known, true);
    } else if (values.investigation_route === "merchant") {
      assert.equal(values.ration_folio_status, "unseen");
      assert.equal(values.tavin_testimony, "unheard");
      assert.notEqual(values.search_warrant_status, "unseen");
      assert.equal(values.sella_tip_known, true);
    } else if (values.investigation_route === "authority") {
      assert.notEqual(values.ration_folio_status, "unseen");
      assert.equal(values.tavin_testimony, "unheard");
      assert.equal(values.courier_strap_status, "hidden_with_sella");
      assert.notEqual(values.search_warrant_status, "unseen");
      assert.equal(values.sella_tip_known, false);
    }
  }
});

test("Chapter One crisis preserves custody and pays a remembered civilian cost", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const crisisInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_clear_the_road",
  );
  const crisisArrivals = statesArrivingAt(chapter, "ch01_clear_the_road");

  assert(crisisInvariant, "The checkpoint-crisis invariant must remain declared.");
  assert.equal(crisisArrivals.length, 32400);
  assert.deepEqual(
    new Set(crisisArrivals.map(({ evidence_distribution: value }) => value)),
    new Set(["consolidated_meret", "consolidated_tavin", "consolidated_sella", "split", "decoy"]),
  );

  for (const values of crisisArrivals) {
    for (const key of crisisInvariant.preserve) {
      assert(Object.hasOwn(values, key), `Checkpoint crisis lost required state ${key}.`);
    }
    assert.equal(values.civilian_cost, "none");
  }

  const crisisNode = chapter.nodes.find(({ id }) => id === "ch01_clear_the_road");
  assert(crisisNode, "The checkpoint crisis must exist.");
  assert.deepEqual(
    new Set(crisisNode.choices.map(({ effects }) => effects.civilian_cost)),
    new Set(["refugees_detained", "soldier_refusal", "refugees_injured", "gate_riot"]),
  );
  assert.equal(
    crisisNode.choices.find(({ next }) => next === "ch01_clear_the_road_tavin")
      .requires.approach_intel,
    "ditch",
  );
});

test("Chapter One final oath gates custodians without removing the fire ending", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const endingInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_open_gate_oath",
  );
  const oathNode = chapter.nodes.find(({ id }) => id === "ch01_open_gate_oath");
  const oathArrivals = statesArrivingAt(chapter, "ch01_open_gate_oath");

  assert(endingInvariant, "The final-oath invariant must remain declared.");
  assert(oathNode, "The final oath must exist.");
  assert(oathArrivals.length > 0);
  assert.deepEqual(
    new Set(oathArrivals.map(({ civilian_cost: value }) => value)),
    new Set(["refugees_detained", "soldier_refusal", "refugees_injured", "gate_riot"]),
  );

  for (const values of oathArrivals) {
    for (const key of endingInvariant.preserve) {
      assert(Object.hasOwn(values, key), `Final oath lost required state ${key}.`);
    }
    const availableDestinations = new Set(
      oathNode.choices
        .filter((choice) => choiceIsAvailable(choice, values))
        .map(({ next }) => next),
    );
    assert(availableDestinations.has("ash_ending"), "Destroying the case must remain the fallback ending.");
    if (values.evidence_distribution === "split") {
      assert.deepEqual(
        availableDestinations,
        new Set(["authority_ending", "free_ending", "merchant_ending", "ash_ending"]),
      );
    }
  }
});
