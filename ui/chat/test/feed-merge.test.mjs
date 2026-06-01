import test from "node:test";
import assert from "node:assert/strict";
import { mergeFeedItem } from "../src/feed-merge.ts";

test("assistant final replaces streaming text before queued user message", () => {
  const queued = [
    { feed_type: "user_message", data: "first" },
    { feed_type: "assistant_text_streaming", data: "work" },
    { feed_type: "user_message", data: "second" },
  ];

  const merged = mergeFeedItem(queued, {
    feed_type: "assistant_text",
    data: "work done",
  });

  assert.deepEqual(merged, [
    { feed_type: "user_message", data: "first" },
    { feed_type: "assistant_text", data: "work done" },
    { feed_type: "user_message", data: "second" },
  ]);
});

test("streaming updates replace existing stream before queued user message", () => {
  const queued = [
    { feed_type: "user_message", data: "first" },
    { feed_type: "assistant_text_streaming", data: "w" },
    { feed_type: "user_message", data: "second" },
  ];

  const merged = mergeFeedItem(queued, {
    feed_type: "assistant_text_streaming",
    data: "work",
  });

  assert.deepEqual(merged, [
    { feed_type: "user_message", data: "first" },
    { feed_type: "assistant_text_streaming", data: "work" },
    { feed_type: "user_message", data: "second" },
  ]);
});

test("dedup user_message when streaming items sit between optimistic and engine broadcast", () => {
  // Simulates: optimistic push → typing indicator → engine broadcasts same user_message
  const feed = [
    { feed_type: "user_message", data: "hello" },
    { feed_type: "assistant_text_streaming", data: "" },
  ];
  const merged = mergeFeedItem(feed, { feed_type: "user_message", data: "hello" });
  // Should NOT duplicate — the identical user_message is 2 items back
  assert.deepEqual(merged, feed);
});

test("dedup user_message when only streaming separates them", () => {
  const feed = [
    { feed_type: "user_message", data: "test" },
    { feed_type: "assistant_text_streaming", data: "thinking..." },
    { feed_type: "assistant_text_streaming", data: "thinking more..." },
  ];
  const merged = mergeFeedItem(feed, { feed_type: "user_message", data: "test" });
  assert.deepEqual(merged, feed);
});

test("dedup user_message even after assistant_text (agy broadcasts post-exit)", () => {
  // agy extracts conversation ID from log after process exits, so the
  // engine's user_message broadcast arrives AFTER assistant_text.
  const feed = [
    { feed_type: "user_message", data: "hello" },
    { feed_type: "assistant_text", data: "hi there" },
  ];
  const merged = mergeFeedItem(feed, { feed_type: "user_message", data: "hello" });
  // Should dedup — same text within the 10-item lookback window
  assert.deepEqual(merged, feed);
});

test("does not dedup user_message beyond lookback window", () => {
  // Pad with enough items to push the original beyond the 10-item window
  const feed = [
    { feed_type: "user_message", data: "old" },
    ...Array.from({ length: 10 }, (_, i) => ({
      feed_type: "assistant_text",
      data: `response ${i}`,
    })),
  ];
  const merged = mergeFeedItem(feed, { feed_type: "user_message", data: "old" });
  // Should append — original is 11 items back, outside the window
  assert.equal(merged.length, 12);
});

test("allows different user_messages in same turn", () => {
  const feed = [
    { feed_type: "user_message", data: "first message" },
    { feed_type: "assistant_text_streaming", data: "" },
  ];
  const merged = mergeFeedItem(feed, { feed_type: "user_message", data: "different message" });
  assert.equal(merged.length, 3);
});
