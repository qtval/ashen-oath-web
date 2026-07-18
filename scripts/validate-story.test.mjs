import assert from "node:assert/strict";
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

async function validate(story, missingSuffix = null) {
  return validateStoryData(story, {
    fileExists: async (path) => !missingSuffix || !path.endsWith(missingSuffix),
    projectRootPath: testProjectRoot,
    sourceLabel: "test story",
  });
}

function errorCodes(result) {
  return new Set(result.errors.map(({ code }) => code));
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

  const result = await validate(story);
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.nodes, 3);
  assert.equal(result.summary.endings, 1);
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

  const codes = errorCodes(await validate(story, "missing-panel.png"));
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
