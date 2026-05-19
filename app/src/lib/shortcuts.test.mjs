import test from "node:test";
import assert from "node:assert/strict";
import { SHORTCUTS, groupedShortcuts } from "./shortcuts.ts";

test("has unique IDs", () => {
  const ids = SHORTCUTS.map((s) => s.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, "duplicate shortcut IDs found");
});

test("has unique label keys", () => {
  const keys = SHORTCUTS.map((s) => s.labelKey);
  const unique = new Set(keys);
  assert.equal(keys.length, unique.size, "duplicate label keys found");
});

test("every shortcut has a non-empty display array", () => {
  for (const s of SHORTCUTS) {
    assert.ok(s.display.length > 0, `${s.id} has empty display`);
  }
});

test("every shortcut has a valid category", () => {
  const valid = new Set(["navigation", "actions", "general"]);
  for (const s of SHORTCUTS) {
    assert.ok(valid.has(s.category), `${s.id} has invalid category: ${s.category}`);
  }
});

test("match is a function for every shortcut", () => {
  for (const s of SHORTCUTS) {
    assert.equal(typeof s.match, "function", `${s.id} match is not a function`);
  }
});

test("groupedShortcuts returns all three categories", () => {
  const groups = groupedShortcuts();
  assert.ok("navigation" in groups);
  assert.ok("actions" in groups);
  assert.ok("general" in groups);
});

test("groupedShortcuts total count matches SHORTCUTS length", () => {
  const groups = groupedShortcuts();
  const total =
    groups.navigation.length + groups.actions.length + groups.general.length;
  assert.equal(total, SHORTCUTS.length);
});

// Match tests use a fake KeyboardEvent-like object.
function fakeEvent(overrides) {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

test("? triggers show-shortcuts without modifier", () => {
  const s = SHORTCUTS.find((s) => s.id === "show-shortcuts");
  assert.ok(s);
  assert.ok(s.match(fakeEvent({ key: "?" })));
  // Should NOT match when the platform modifier is held.
  // In Node.js (no navigator) isMac=false so mod checks ctrlKey.
  assert.ok(!s.match(fakeEvent({ key: "?", ctrlKey: true })));
});

test("Escape triggers close-panel", () => {
  const s = SHORTCUTS.find((s) => s.id === "close-panel");
  assert.ok(s);
  assert.ok(s.match(fakeEvent({ key: "Escape" })));
});

test("mod+N triggers new-mission", () => {
  const s = SHORTCUTS.find((s) => s.id === "new-mission");
  assert.ok(s);
  // On macOS metaKey is the modifier; on other platforms ctrlKey.
  // The module detects platform at load time. At least one must match.
  const mac = s.match(fakeEvent({ key: "n", metaKey: true }));
  const win = s.match(fakeEvent({ key: "n", ctrlKey: true }));
  assert.ok(mac || win, "new-mission should match mod+n");
});

test("mod+Shift+N triggers new-agent", () => {
  const s = SHORTCUTS.find((s) => s.id === "new-agent");
  assert.ok(s);
  const mac = s.match(fakeEvent({ key: "N", metaKey: true, shiftKey: true }));
  const win = s.match(fakeEvent({ key: "N", ctrlKey: true, shiftKey: true }));
  assert.ok(mac || win, "new-agent should match mod+shift+n");
});

test("mod+[ and mod+] trigger agent cycling", () => {
  const prev = SHORTCUTS.find((s) => s.id === "prev-agent");
  const next = SHORTCUTS.find((s) => s.id === "next-agent");
  assert.ok(prev);
  assert.ok(next);
  const prevMac = prev.match(fakeEvent({ key: "[", metaKey: true }));
  const prevWin = prev.match(fakeEvent({ key: "[", ctrlKey: true }));
  assert.ok(prevMac || prevWin);
  const nextMac = next.match(fakeEvent({ key: "]", metaKey: true }));
  const nextWin = next.match(fakeEvent({ key: "]", ctrlKey: true }));
  assert.ok(nextMac || nextWin);
});
