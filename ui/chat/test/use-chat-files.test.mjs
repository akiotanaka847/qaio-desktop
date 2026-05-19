import test from "node:test";
import assert from "node:assert/strict";
import { mergeUniqueFiles } from "../src/use-file-drop-zone.ts";

// Minimal File-like objects for testing. The dedup key is name::size::lastModified.
function fakeFile(name, size = 100, lastModified = 1000) {
  return { name, size, lastModified };
}

test("mergeUniqueFiles appends new files", () => {
  const existing = [fakeFile("a.png")];
  const incoming = [fakeFile("b.png")];
  const result = mergeUniqueFiles(existing, incoming);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "a.png");
  assert.equal(result[1].name, "b.png");
});

test("mergeUniqueFiles deduplicates by name+size+lastModified", () => {
  const existing = [fakeFile("a.png", 100, 1000)];
  const incoming = [fakeFile("a.png", 100, 1000)];
  const result = mergeUniqueFiles(existing, incoming);
  assert.equal(result.length, 1);
});

test("mergeUniqueFiles allows same name with different size", () => {
  const existing = [fakeFile("a.png", 100, 1000)];
  const incoming = [fakeFile("a.png", 200, 1000)];
  const result = mergeUniqueFiles(existing, incoming);
  assert.equal(result.length, 2);
});

test("mergeUniqueFiles allows same name with different lastModified", () => {
  const existing = [fakeFile("a.png", 100, 1000)];
  const incoming = [fakeFile("a.png", 100, 2000)];
  const result = mergeUniqueFiles(existing, incoming);
  assert.equal(result.length, 2);
});

test("mergeUniqueFiles deduplicates within incoming batch", () => {
  const existing = [];
  const incoming = [fakeFile("a.png"), fakeFile("a.png")];
  const result = mergeUniqueFiles(existing, incoming);
  assert.equal(result.length, 1);
});

test("mergeUniqueFiles preserves order (existing first, then incoming)", () => {
  const existing = [fakeFile("first.png")];
  const incoming = [fakeFile("second.png"), fakeFile("third.png")];
  const result = mergeUniqueFiles(existing, incoming);
  assert.deepEqual(
    result.map((f) => f.name),
    ["first.png", "second.png", "third.png"],
  );
});

// Test the paste extraction pattern used in useChatFiles.handlePaste.
// The logic: iterate clipboardData.items, collect kind==="file" entries.
test("paste extraction collects file items from clipboard data", () => {
  const pngBlob = fakeFile("screenshot.png", 5000, Date.now());
  const items = [
    { kind: "string", getAsFile: () => null },
    { kind: "file", getAsFile: () => pngBlob },
    { kind: "file", getAsFile: () => null }, // getAsFile can return null
  ];

  // Replicate the extraction logic from handlePaste
  const pasted = [];
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) pasted.push(file);
    }
  }

  assert.equal(pasted.length, 1);
  assert.equal(pasted[0].name, "screenshot.png");
});

test("paste extraction returns empty array when no file items", () => {
  const items = [
    { kind: "string", getAsFile: () => null },
    { kind: "string", getAsFile: () => null },
  ];

  const pasted = [];
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) pasted.push(file);
    }
  }

  assert.equal(pasted.length, 0);
});

test("paste extraction handles multiple pasted images", () => {
  const png = fakeFile("image.png", 3000, Date.now());
  const jpg = fakeFile("photo.jpg", 8000, Date.now());
  const items = [
    { kind: "file", getAsFile: () => png },
    { kind: "file", getAsFile: () => jpg },
  ];

  const pasted = [];
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) pasted.push(file);
    }
  }

  assert.equal(pasted.length, 2);
  assert.equal(pasted[0].name, "image.png");
  assert.equal(pasted[1].name, "photo.jpg");
});
