import test from "node:test";
import assert from "node:assert/strict";
import {
  getEffortLevels,
  validEffortOrDefault,
  DEFAULT_EFFORT,
} from "./providers.ts";

test("sonnet accepts low/medium/high/max but not xhigh", () => {
  const levels = getEffortLevels("anthropic", "sonnet");
  assert.ok(levels.includes("low"));
  assert.ok(levels.includes("medium"));
  assert.ok(levels.includes("high"));
  assert.ok(levels.includes("max"));
  assert.ok(!levels.includes("xhigh"));
});

test("opus accepts all five effort levels", () => {
  const levels = getEffortLevels("anthropic", "opus");
  assert.deepEqual([...levels], ["low", "medium", "high", "xhigh", "max"]);
});

test("codex models accept xhigh but not max", () => {
  const levels = getEffortLevels("openai", "gpt-5.4");
  assert.ok(levels.includes("xhigh"));
  assert.ok(!levels.includes("max"));
});

test("gemini models have no effort levels", () => {
  assert.equal(getEffortLevels("gemini", "gemini-2.5-pro").length, 0);
  assert.equal(getEffortLevels("gemini", "gemini-2.5-flash").length, 0);
});

test("validEffortOrDefault returns null for gemini", () => {
  assert.equal(validEffortOrDefault("gemini", "gemini-2.5-flash", "high"), null);
});

test("validEffortOrDefault returns default for invalid effort", () => {
  assert.equal(validEffortOrDefault("anthropic", "sonnet", "xhigh"), DEFAULT_EFFORT);
});

test("validEffortOrDefault passes through valid effort", () => {
  assert.equal(validEffortOrDefault("anthropic", "sonnet", "max"), "max");
  assert.equal(validEffortOrDefault("openai", "gpt-5.4", "xhigh"), "xhigh");
});

test("validEffortOrDefault returns default when effort is null", () => {
  assert.equal(validEffortOrDefault("anthropic", "sonnet", null), DEFAULT_EFFORT);
  assert.equal(validEffortOrDefault("anthropic", "sonnet", undefined), DEFAULT_EFFORT);
});
