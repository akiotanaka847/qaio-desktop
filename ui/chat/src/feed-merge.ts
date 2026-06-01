import type { FeedItem } from "./types";

/**
 * Smart-merge a new FeedItem into an existing feed array.
 *
 * Handles streaming replacement logic:
 * - `thinking_streaming` replaces previous `thinking_streaming`
 * - `thinking` (final) replaces last `thinking_streaming`
 * - `assistant_text_streaming` replaces previous `assistant_text_streaming`
 * - `assistant_text` (final) replaces last `assistant_text_streaming`
 * - Everything else is appended.
 *
 * Use this in your Zustand/Redux store to avoid duplicating merge logic.
 */
export function mergeFeedItem(items: FeedItem[], item: FeedItem): FeedItem[] {
  const last = items[items.length - 1];

  if (item.feed_type === "thinking_streaming") {
    return replaceLast(items, item, (existing) => existing.feed_type === "thinking_streaming");
  }

  if (item.feed_type === "thinking") {
    return replaceLast(items, item, (existing) => existing.feed_type === "thinking_streaming");
  }

  if (item.feed_type === "assistant_text_streaming") {
    return replaceLast(
      items,
      item,
      (existing) => existing.feed_type === "assistant_text_streaming",
    );
  }

  if (item.feed_type === "assistant_text") {
    return replaceLast(
      items,
      item,
      (existing) => existing.feed_type === "assistant_text_streaming",
    );
  }

  // tool_call with real input replaces the immediate null-input notification
  // (the Rust parser emits two tool_calls per tool: one on content_block_start
  // with null input, one on content_block_stop with the real input)
  if (item.feed_type === "tool_call" && last?.feed_type === "tool_call") {
    if (last.data.name === item.data.name && last.data.input == null) {
      return [...items.slice(0, -1), item];
    }
  }

  // Deduplicate user_messages. Desktop pushes an optimistic user_message
  // the instant the user hits send, and the engine also persists +
  // broadcasts the same text via a FeedItem event. With some providers
  // (agy) the engine broadcast arrives AFTER assistant_text because the
  // session ID is extracted post-exit. We scan the full 10-item window
  // without an assistant_text boundary — the window size alone prevents
  // false dedup across distant turns.
  if (item.feed_type === "user_message") {
    const lookback = Math.max(0, items.length - 10);
    for (let i = items.length - 1; i >= lookback; i--) {
      const existing = items[i];
      if (existing.feed_type === "user_message" && existing.data === item.data) {
        return items;
      }
    }
  }

  return [...items, item];
}

function replaceLast(
  items: FeedItem[],
  item: FeedItem,
  predicate: (item: FeedItem) => boolean,
): FeedItem[] {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return [
        ...items.slice(0, index),
        item,
        ...items.slice(index + 1),
      ];
    }
  }
  return [...items, item];
}
