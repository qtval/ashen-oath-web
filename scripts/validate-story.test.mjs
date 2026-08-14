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

function statesArrivingAt(chapter, targetNodeId, options = {}) {
  const nodes = new Map(chapter.nodes.map((storyNode) => [storyNode.id, storyNode]));
  const queue = [{ nodeId: chapter.nodes[0].id, values: {} }];
  const arrivals = [];
  const visited = new Set();
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    if (options.deduplicate) {
      const orderedValues = Object.fromEntries(
        Object.entries(current.values).sort(([left], [right]) => left.localeCompare(right)),
      );
      const signature = JSON.stringify([current.nodeId, orderedValues]);
      if (visited.has(signature)) continue;
      visited.add(signature);
    }
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

function applyChoiceEffects(values, effects = {}) {
  const nextValues = { ...values };
  for (const [key, value] of Object.entries(effects)) {
    nextValues[key] = typeof value === "number"
      ? (Number(nextValues[key]) || 0) + value
      : value;
  }
  return nextValues;
}

function chronicleEntryIds(chapter, current) {
  const visitedNodes = new Set([
    current.nodeId,
    ...(current.history || []).flatMap(({ from, to }) => [from, to]),
  ]);
  return chapter.chronicle.sections.flatMap((section) => section.entries
    .filter((entry) => {
      const visitMatches = !entry.available_from
        || entry.available_from.some((nodeId) => visitedNodes.has(nodeId));
      return visitMatches && choiceIsAvailable(entry, current.values || {});
    })
    .map(({ id }) => id));
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

test("accepts state-aware ending text with validated requirement groups", async () => {
  const stateSchema = schema("Remembered Ending", {
    cost: {
      type: "enum",
      values: ["mercy", "pursuit"],
      description: "The cost remembered by the ending.",
    },
  });
  const story = {
    chapter: "Remembered Ending",
    nodes: [
      node("start", [{ text: "Pay the cost.", next: "ending", effects: { cost: "pursuit" } }]),
      node("ending", [], {
        ending: "THE END",
        conditional_text: [{
          group: "cost",
          text: "The pursuit begins.",
          requires: { cost: "pursuit" },
        }],
      }),
    ],
  };

  const result = await validate(story, { stateSchema });
  assert.deepEqual(result.errors, []);
});

test("reports malformed state-aware ending text", async () => {
  const story = {
    chapter: "Malformed Ending",
    nodes: [
      node("start", [{ text: "Finish.", next: "ending" }]),
      node("ending", [], {
        ending: "THE END",
        conditional_text: [
          { group: "", text: "", requires_any: [] },
          { group: "cost", text: "An unconditioned cost." },
        ],
      }),
    ],
  };

  const codes = errorCodes(await validate(story));
  assert(codes.has("MISSING_CONDITIONAL_GROUP"));
  assert(codes.has("MISSING_CONDITIONAL_TEXT"));
  assert(codes.has("INVALID_REQUIREMENT_ALTERNATIVES"));
  assert(codes.has("MISSING_CONDITIONAL_REQUIREMENT"));
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

test("validates Chronicle entry ids, visit gates, and state requirements", async () => {
  const story = {
    chapter: "Chronicle Test",
    chronicle: {
      empty_text: "Nothing known.",
      sections: [{
        id: "facts",
        title: "Facts",
        entries: [{
          id: "known-key",
          text: "The key opens the gate.",
          available_from: ["ending"],
          requires: { has_key: true },
        }],
      }],
    },
    nodes: [
      node("start", [{ text: "Take the key.", next: "ending", effects: { has_key: true } }]),
      node("ending", [], { ending: "THE END" }),
    ],
  };
  const validResult = await validate(story, {
    stateSchema: schema("Chronicle Test", {
      has_key: { type: "boolean", description: "Whether the key is held." },
    }),
  });
  assert.deepEqual(validResult.errors, []);

  story.chronicle.sections[0].entries.push({
    id: "known-key",
    text: "Broken entry.",
    available_from: ["missing-node"],
    requires: { hidden_score: 3 },
  });
  const invalidCodes = errorCodes(await validate(story, {
    stateSchema: schema("Chronicle Test", {
      has_key: { type: "boolean", description: "Whether the key is held." },
    }),
  }));
  assert(invalidCodes.has("DUPLICATE_CHRONICLE_ENTRY_ID"));
  assert(invalidCodes.has("UNKNOWN_CHRONICLE_NODE"));
  assert(invalidCodes.has("UNKNOWN_STATE_KEY"));
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

test("Chapter One Chronicle reveals only route-known facts", async () => {
  const { chapter } = await loadChapterOne();
  const initialEntries = chronicleEntryIds(chapter, {
    nodeId: "ch01_carrion_road",
    values: {},
  });
  assert.deepEqual(initialEntries, ["garren", "orl", "orl-packet", "checkpoint"]);

  const tavinEntries = chronicleEntryIds(chapter, {
    nodeId: "ch01_first_gate",
    history: [
      { from: "ch01_carrion_road", to: "ch01_axle_hand" },
      { from: "ch01_axle_hand", to: "ch01_first_gate" },
    ],
    values: { tavin_status: "hidden" },
  });
  assert(tavinEntries.includes("tavin"));
  assert(tavinEntries.includes("tavin-hidden"));
  assert(!tavinEntries.includes("tavin-captured"));
  assert(tavinEntries.includes("meret"), "Meret unlocks when Garren enters her gate scene.");

  const bindingEntries = chronicleEntryIds(chapter, {
    nodeId: "ch01_merets_room_merchant",
    history: [{ from: "ch01_false_floor", to: "ch01_merets_room_merchant" }],
    values: { sella_promise: "binding" },
  });
  assert(bindingEntries.includes("sella-binding"));
  assert(!bindingEntries.includes("sella-kept"));
  assert(!bindingEntries.includes("sella-broken"));

  const forbiddenKeys = new Set([
    "tavin_trust",
    "tavin_fear",
    "meret_trust",
    "meret_suspicion",
    "sella_trust",
    "civilian_pressure",
  ]);
  for (const entry of chapter.chronicle.sections.flatMap(({ entries }) => entries)) {
    const requirementMaps = [entry.requires, ...(entry.requires_any || [])].filter(Boolean);
    for (const stateMap of requirementMaps) {
      for (const key of Object.keys(stateMap)) {
        assert(!forbiddenKeys.has(key), `${entry.id} must not expose hidden score ${key}.`);
      }
    }
    assert.doesNotMatch(entry.text, /\b(?:trust score|score|state flag|route id)\b/i);
  }
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
  for (const values of lockdownArrivals) {
    assert.equal(
      values.tavin_can_leave,
      values.tavin_status === "hidden" || values.tavin_status === "bargaining",
      `Opening status ${values.tavin_status} has the wrong physical escape access.`,
    );
  }
  assert.deepEqual(
    new Set(lockdownArrivals.map(({ sella_promise: value }) => value)),
    new Set(["none", "wagon_passage", "packet_collateral"]),
  );
  assert.deepEqual(
    new Set(lockdownArrivals.map(({ public_method: value }) => value)),
    new Set(["restraint", "deception", "coercion"]),
  );
});

test("Chapter One shared opening explains its people, evidence, and immediate stakes", async () => {
  const { chapter } = await loadChapterOne();
  const nodes = new Map(chapter.nodes.map((storyNode) => [storyNode.id, storyNode]));
  const opening = nodes.get("ch01_carrion_road");
  const tavin = nodes.get("ch01_axle_hand");
  const lockdown = nodes.get("ch01_bell_and_bar");
  const searchTable = nodes.get("ch01_search_table");

  assert.match(opening.text, /wants to cross without attention/);
  assert.match(opening.text, /Captain Orl, an officer from his regiment/);
  assert.match(opening.text, /Crown deliberately sacrificed their men at Red Hollow/);
  assert.match(tavin.text, /kept the signal fires at Red Hollow/);
  assert.match(tavin.text, /Crown calls me a deserter because I ran/);
  assert.deepEqual(
    new Set(tavin.choices.map(({ text }) => text)),
    new Set([
      "Call Captain Meret's soldiers and surrender Tavin.",
      "Hide Tavin beneath the wagon's false floor.",
      "Refuse him and leave him in the refugee crowd.",
      "Demand his full account before hiding him.",
    ]),
  );

  for (const firstGateId of [
    "ch01_first_gate_captured",
    "ch01_first_gate",
    "ch01_first_gate_abandoned",
    "ch01_first_gate_bargaining",
  ]) {
    const firstGate = nodes.get(firstGateId);
    assert.match(firstGate.text, /regiment's former interrogator/);
    assert(firstGate.choices.some(({ text }) => text.includes("discharge papers")));
    assert(firstGate.choices.some(({ text }) => text.includes("Lie that Orl's packet")));
    assert(firstGate.choices.some(({ text }) => text.includes("warrant named Orl's unopened packet")));
  }

  for (const wheelId of [
    "ch01_wheel_in_mud_captured",
    "ch01_wheel_in_mud",
    "ch01_wheel_in_mud_abandoned",
    "ch01_wheel_in_mud_bargaining",
  ]) {
    const wheel = nodes.get(wheelId);
    assert.match(wheel.text, /Three (?:refugees|others)/);
    assert(wheel.choices.some(({ text }) => text.includes("hidden passengers through the gate")));
    assert(wheel.choices.some(({ text }) => text.includes("unless Sella cooperates")));
    assert(wheel.choices.some(({ text }) => text.includes("evidence packet as collateral")));
  }

  assert.match(lockdown.text, /names three targets/);
  assert.match(lockdown.text, /Tavin, Orl's packet, and the regiment's old supply ledgers/);
  assert.match(searchTable.text, /pressure-copy—the faint duplicate/);
  assert.match(searchTable.text, /refusing Garren's regiment permission to retreat/);
  assert.match(searchTable.text, /choose whom or what to investigate first/);
});

test("Chapter One makes the renewed-war pressure concrete before investigation", async () => {
  const { chapter } = await loadChapterOne();
  const lockdown = chapter.nodes.find(({ id }) => id === "ch01_bell_and_bar");
  const pressureBeat = chapter.nodes.find(({ id }) => id === "ch01_names_for_the_truce");

  assert(lockdown, "The lockdown scene must exist.");
  assert(pressureBeat, "The world-pressure scene must exist.");
  assert(lockdown.choices.every(({ next }) => next === pressureBeat.id));
  assert.match(pressureBeat.text, /Chancellor/);
  assert.match(pressureBeat.text, /refugee families from Bracken lands/);
  assert.match(pressureBeat.text, /march their soldiers within a day/);
  assert.match(pressureBeat.text, /hostages/);
  assert.match(pressureBeat.panel_description, /reprisal roll/);
  assert.deepEqual(
    new Set(pressureBeat.choices.map(({ effects }) => effects.march_families_warned)),
    new Set([false, true]),
  );
  assert(pressureBeat.choices.every(({ next }) => next === "ch01_old_questions"));
});

test("Chapter One pays off the clerk approach and gates public warrant destruction", async () => {
  const { chapter } = await loadChapterOne();
  const nodes = new Map(chapter.nodes.map((storyNode) => [storyNode.id, storyNode]));
  const overlook = nodes.get("ch01_muddy_overlook");
  const clerkChoice = overlook.choices.find(({ text }) => text.includes("carbon copy"));
  assert.equal(clerkChoice.effects.clerk_order_copy, true);

  const lockdown = nodes.get("ch01_bell_and_bar");
  assert(lockdown.conditional_text.some(
    ({ requires, text }) => requires?.clerk_order_copy === true && text.includes("burn every proof"),
  ));

  const crisis = nodes.get("ch01_clear_the_road");
  const publicDestruction = crisis.choices.find(({ next }) => next === "ch01_clear_the_road_warrant");
  assert(choiceIsAvailable(publicDestruction, { clerk_order_copy: true, search_warrant_status: "unseen" }));
  assert(!choiceIsAvailable(publicDestruction, { clerk_order_copy: false, search_warrant_status: "unseen" }));
  assert(choiceIsAvailable(publicDestruction, { clerk_order_copy: false, search_warrant_status: "copied" }));
});

test("Chapter One confronts Garren with the cost of his interrogation work", async () => {
  const { chapter } = await loadChapterOne();
  const reckoning = chapter.nodes.find(({ id }) => id === "ch01_old_questions");

  assert(reckoning, "The interrogation reckoning must exist before investigation.");
  assert.match(reckoning.panel_description, /registration bench/);
  assert.match(reckoning.panel_description, /travel slate/);
  assert.match(reckoning.text, /Perrin Dask/);
  assert.match(reckoning.text, /two nights/);
  assert.match(reckoning.text, /brother/);
  assert.match(reckoning.text, /daughter/);
  assert.match(reckoning.text, /Bracken hostage list/);
  assert.match(reckoning.text, /open a door/);
  assert.deepEqual(
    new Set(reckoning.choices.map(({ effects }) => effects.interrogation_response)),
    new Set(["clerk_broken", "method_shared"]),
  );
  assert(reckoning.choices.every(({ next }) => next === "ch01_search_table"));
});

test("Chapter One investigation routes preserve exact evidence gaps at assembly", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const assemblyInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_three_hands",
  );
  const assemblyArrivals = statesArrivingAt(chapter, "ch01_three_hands");

  assert(assemblyInvariant, "The evidence-assembly invariant must remain declared.");
  assert.equal(assemblyArrivals.length, 116100);
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
      assert.notEqual(values.tavin_status, "abandoned");
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

    if (values.tavin_status === "abandoned") {
      assert.notEqual(values.evidence_distribution, "consolidated_tavin");
      assert.notEqual(values.orl_packet_status, "with_tavin");
    }
  }

  const searchTable = chapter.nodes.find(({ id }) => id === "ch01_search_table");
  const witnessChoice = searchTable.choices.find(({ next }) => next === "ch01_twelve_minutes");
  assert.equal(choiceIsAvailable(witnessChoice, { tavin_status: "abandoned" }), false);
  assert.equal(choiceIsAvailable(witnessChoice, { tavin_status: "captured" }), true);

  const recordsTestimony = chapter.nodes.find(
    ({ id }) => id === "ch01_twelve_minutes_records",
  );
  for (const tavin_status of ["captured", "hidden", "abandoned", "bargaining"]) {
    const contactFragments = recordsTestimony.conditional_text.filter(
      (fragment) => choiceIsAvailable(fragment, { tavin_status }),
    );
    assert.equal(contactFragments.length, 1, `Records route needs one ${tavin_status} contact beat.`);
  }

  const witnessTestimony = chapter.nodes.find(({ id }) => id === "ch01_twelve_minutes");
  for (const tavin_status of ["captured", "hidden", "bargaining"]) {
    const contactFragments = witnessTestimony.conditional_text.filter(
      (fragment) => choiceIsAvailable(fragment, { tavin_status }),
    );
    assert.equal(contactFragments.length, 1, `Witness route needs one ${tavin_status} contact beat.`);
  }
});

test("Chapter One crisis preserves custody and pays a remembered civilian cost", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const crisisInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_clear_the_road",
  );
  const crisisArrivals = statesArrivingAt(chapter, "ch01_clear_the_road");

  assert(crisisInvariant, "The checkpoint-crisis invariant must remain declared.");
  assert.equal(crisisArrivals.length, 116100);
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
  const culvertChoice = crisisNode.choices.find(
    ({ next }) => next === "ch01_clear_the_road_tavin",
  );
  assert.equal(culvertChoice.requires.approach_intel, "ditch");
  assert.equal(culvertChoice.requires.tavin_can_leave, true);

  for (const values of crisisArrivals) {
    assert.equal(
      choiceIsAvailable(culvertChoice, values),
      values.approach_intel === "ditch" && values.tavin_can_leave === true,
    );
    const positionFragments = crisisNode.conditional_text.filter(
      (fragment) => fragment.group === "tavin_position" && choiceIsAvailable(fragment, values),
    );
    assert.equal(positionFragments.length, 1, `Crisis needs one ${values.tavin_status} position beat.`);
    const pressureFragments = crisisNode.conditional_text.filter(
      (fragment) => fragment.group === "reprisal_pressure" && choiceIsAvailable(fragment, values),
    );
    assert.equal(pressureFragments.length, 1, "Crisis must remember whether the families were warned.");
    const reckoningFragments = crisisNode.conditional_text.filter(
      (fragment) => fragment.group === "interrogator_reckoning" && choiceIsAvailable(fragment, values),
    );
    assert.equal(reckoningFragments.length, 1, "Crisis must remember Garren's answer to Dask.");
  }

  for (const outcomeId of [
    "ch01_clear_the_road_meret",
    "ch01_clear_the_road_tavin",
    "ch01_clear_the_road_sella",
    "ch01_clear_the_road_warrant",
  ]) {
    const outcomeNode = chapter.nodes.find(({ id }) => id === outcomeId);
    for (const march_families_warned of [false, true]) {
      const aftermathFragments = outcomeNode.conditional_text.filter(
        (fragment) => choiceIsAvailable(fragment, { march_families_warned }),
      );
      assert.equal(aftermathFragments.length, 1, `${outcomeId} needs one reprisal aftermath.`);
    }
  }
});

test("Chapter One keeps Sella's renewed bargain binding until passage is fulfilled", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const nodes = new Map(chapter.nodes.map((storyNode) => [storyNode.id, storyNode]));
  const promiseValues = stateSchema.states.sella_promise.values;

  assert(promiseValues.includes("binding"));
  for (const nodeId of ["ch01_false_floor", "ch01_false_floor_witness"]) {
    const renewalChoice = nodes.get(nodeId).choices.find(
      ({ text }) => text === "Accept her terms and renew the bargain.",
    );
    assert(renewalChoice, `${nodeId} must offer the renewed bargain.`);
    assert.equal(renewalChoice.effects.sella_promise, "binding");
  }

  const preCrisisPromises = new Set(
    statesArrivingAt(chapter, "ch01_clear_the_road", { deduplicate: true })
      .map(({ sella_promise }) => sella_promise),
  );
  assert(preCrisisPromises.has("binding"));
  assert(!preCrisisPromises.has("kept"), "No route may keep Sella's promise before passage occurs.");

  const choicesThatKeepPromise = chapter.nodes.flatMap((storyNode) => storyNode.choices
    .filter(({ effects }) => effects?.sella_promise === "kept")
    .map(({ text }) => [storyNode.id, text]));
  assert.deepEqual(choicesThatKeepPromise, [[
    "ch01_clear_the_road",
    "Call in Sella's bargain and drive her wagon through the crowd.",
  ]]);

  const merchantEndingChoice = nodes.get("ch01_open_gate_oath").choices.find(
    ({ next }) => next === "ch01_ending_merchants_price",
  );
  assert(choiceIsAvailable(merchantEndingChoice, { sella_promise: "binding" }));

  for (const endingId of [
    "ch01_ending_quiet_record",
    "ch01_ending_debt_in_rain",
    "ch01_ending_fire_keeps",
  ]) {
    const bindingFragments = nodes.get(endingId).conditional_text.filter(
      (fragment) => fragment.group === "sella_terms"
        && choiceIsAvailable(fragment, { sella_promise: "binding" }),
    );
    assert.equal(bindingFragments.length, 1, `${endingId} must remember one binding bargain.`);
    assert.match(bindingFragments[0].text, /unpaid/);
  }

  const merchantBindingFragments = nodes.get("ch01_ending_merchants_price").conditional_text.filter(
    (fragment) => fragment.group === "sella_terms"
      && choiceIsAvailable(fragment, { sella_promise: "binding" }),
  );
  assert.equal(merchantBindingFragments.length, 1);
  assert.match(merchantBindingFragments[0].text, /call the bargain paid/);
});

test("Chapter One final oath gates custodians without removing the fire ending", async () => {
  const { chapter, stateSchema } = await loadChapterOne();
  const endingInvariant = stateSchema.reconvergence_invariants.find(
    ({ scene }) => scene === "ch01_open_gate_oath",
  );
  const oathNode = chapter.nodes.find(({ id }) => id === "ch01_open_gate_oath");
  const oathArrivals = statesArrivingAt(chapter, "ch01_open_gate_oath", { deduplicate: true });
  const tavinEndingChoice = oathNode.choices.find(
    ({ next }) => next === "ch01_ending_debt_in_rain",
  );

  assert(endingInvariant, "The final-oath invariant must remain declared.");
  assert(oathNode, "The final oath must exist.");
  assert(oathArrivals.length > 0);
  assert.deepEqual(
    new Set(oathArrivals.map(({ civilian_cost: value }) => value)),
    new Set(["refugees_detained", "soldier_refusal", "refugees_injured", "gate_riot"]),
  );

  const endingExpectations = new Map([
    ["ch01_ending_quiet_record", {
      identity: "sanctioned_accomplice",
      groups: new Set(["evidence_custody", "meret_terms", "tavin_fate", "sella_terms", "civilian_cost"]),
    }],
    ["ch01_ending_debt_in_rain", {
      identity: "hunted_witness_keeper",
      groups: new Set(["evidence_custody", "route_gap", "testimony", "sella_terms", "civilian_cost"]),
    }],
    ["ch01_ending_merchants_price", {
      identity: "broker_network_debtor",
      groups: new Set(["evidence_custody", "route_gap", "sella_terms", "tavin_fate", "civilian_cost"]),
    }],
    ["ch01_ending_fire_keeps", {
      identity: "crown_marked_destroyer",
      groups: new Set(["evidence_custody", "testimony", "sella_terms", "tavin_fate", "civilian_cost"]),
    }],
  ]);
  const checkedEndingStates = new Set();

  for (const values of oathArrivals) {
    for (const key of endingInvariant.preserve) {
      assert(Object.hasOwn(values, key), `Final oath lost required state ${key}.`);
    }
    const availableDestinations = new Set(
      oathNode.choices
        .filter((choice) => choiceIsAvailable(choice, values))
        .map(({ next }) => next),
    );
    assert(
      availableDestinations.has("ch01_ending_fire_keeps"),
      "Destroying the case must remain the fallback ending.",
    );
    if (availableDestinations.has("ch01_ending_debt_in_rain")) {
      assert.equal(values.tavin_can_leave, true);
      assert(!new Set(["captured", "abandoned", "missing"]).has(values.tavin_status));
    }
    if (values.evidence_distribution === "split") {
      const splitDestinations = new Set([
        "ch01_ending_quiet_record",
        "ch01_ending_merchants_price",
        "ch01_ending_fire_keeps",
      ]);
      if (choiceIsAvailable(tavinEndingChoice, values)) {
        splitDestinations.add("ch01_ending_debt_in_rain");
      }
      assert.deepEqual(availableDestinations, splitDestinations);
    }

    const reckoningFragments = oathNode.conditional_text.filter(
      (fragment) => fragment.group === "interrogator_reckoning" && choiceIsAvailable(fragment, values),
    );
    assert.equal(reckoningFragments.length, 1, "Final oath must remember Garren's answer to Dask.");

    for (const choice of oathNode.choices.filter((item) => choiceIsAvailable(item, values))) {
      const endingNode = chapter.nodes.find(({ id }) => id === choice.next);
      const expectation = endingExpectations.get(choice.next);
      assert(endingNode, `Ending ${choice.next} must exist.`);
      assert(expectation, `Ending ${choice.next} must declare its expected consequence groups.`);

      const endingValues = applyChoiceEffects(values, choice.effects);
      assert.equal(endingValues.chapter_two_identity, expectation.identity);
      const fragmentKeys = new Set(
        endingNode.conditional_text.flatMap((fragment) => [
          ...Object.keys(fragment.requires || {}),
          ...(fragment.requires_any || []).flatMap((requirements) => Object.keys(requirements)),
        ]),
      );
      const endingSignature = JSON.stringify([
        choice.next,
        ...[...fragmentKeys].sort().map((key) => [key, endingValues[key]]),
      ]);
      if (checkedEndingStates.has(endingSignature)) continue;
      checkedEndingStates.add(endingSignature);

      const matchedFragments = endingNode.conditional_text.filter(
        (fragment) => choiceIsAvailable(fragment, endingValues),
      );
      const groupCounts = matchedFragments.reduce((counts, { group }) => {
        counts.set(group, (counts.get(group) || 0) + 1);
        return counts;
      }, new Map());
      assert.deepEqual(new Set(groupCounts.keys()), expectation.groups);
      for (const [group, count] of groupCounts) {
        assert.equal(count, 1, `${choice.next} matched ${count} fragments in group ${group}.`);
      }
    }
  }

  assert.equal(tavinEndingChoice.requires.tavin_can_leave, true);
  assert.equal(choiceIsAvailable(tavinEndingChoice, {
    tavin_status: "abandoned",
    tavin_can_leave: false,
    evidence_distribution: "consolidated_tavin",
    orl_packet_status: "with_tavin",
    tavin_testimony: "reliable",
  }), false, "Proof custody must not restore an abandoned Tavin.");
  assert.equal(choiceIsAvailable(tavinEndingChoice, {
    tavin_status: "captured",
    tavin_can_leave: false,
    evidence_distribution: "consolidated_tavin",
    orl_packet_status: "with_tavin",
    tavin_testimony: "formal",
  }), false, "Proof custody must not release a captured Tavin.");
  assert(checkedEndingStates.size > 0);
});
