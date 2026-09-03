import test from "node:test";
import assert from "node:assert/strict";
import { messageCopyText } from "../src/message-copy.ts";

test("plain text copies as-is, trimmed", () => {
  assert.equal(messageCopyText("  Hello there\n"), "Hello there");
});

test("assistant markdown passes through untouched", () => {
  const md = "Here is the fix:\n\n```rust\nlet x = 1;\n```";
  assert.equal(messageCopyText(md), md);
});

test("an upload copies the user's words, not the injected paths", () => {
  // Persisted shape from knowledge-base/skills.md: marker, the user's
  // text, then a model-facing block repeating absolute paths.
  const body =
    '<!--qaio:attachments {"message":"Summarize this","files":[{"name":"brief.pdf","path":"/Users/me/brief.pdf"}]}-->\n\nSummarize this\n\n[User attached these files. Read them with the Read tool if needed:\n- /Users/me/brief.pdf]';

  const copied = messageCopyText(body);

  assert.equal(copied, "Summarize this");
  assert.ok(!copied.includes("/Users/me/brief.pdf"), "must not leak paths");
  assert.ok(!copied.includes("qaio:attachments"), "must not leak the marker");
});

test("a Skill copies its name, filled fields, and the user's note", () => {
  const body =
    '<!--qaio:skill {"skill":"research-company","displayName":"Research a company","image":null,"description":"Deep dive","integrations":["tavily"],"fields":[{"label":"Company","value":"Acme"},{"label":"Region","value":"  "}],"message":"Focus on pricing."}-->\n\nUse the research-company skill.\n\nFocus on pricing.';

  const copied = messageCopyText(body);

  assert.equal(copied, "Research a company\nCompany: Acme\n\nFocus on pricing.");
  assert.ok(!copied.includes("Region"), "blank fields are dropped");
  assert.ok(
    !copied.includes("Use the research-company skill."),
    "the model-facing instruction is not the user's words",
  );
});

test("a Skill sent with no note copies just its name and fields", () => {
  const body =
    '<!--qaio:skill {"skill":"daily-brief","displayName":"Daily brief","image":null,"description":"","integrations":[],"fields":[],"message":""}-->\n\nUse the daily-brief skill.';

  assert.equal(messageCopyText(body), "Daily brief");
});

test("an empty message yields nothing to copy", () => {
  assert.equal(messageCopyText("   \n  "), "");
});
