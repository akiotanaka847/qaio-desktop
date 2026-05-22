import { useCallback, useMemo, useState } from "react";
import type { FeedItem } from "@qaio-ai/chat";
import { useFeedStore } from "../../stores/feeds";
import { useDraftStore } from "../../stores/drafts";
import {
  getSessionStatusKey,
  isActiveSessionStatus,
  useSessionStatusStore,
} from "../../stores/session-status";
import type { Activity } from "../../data/activity";

// Stable empty reference so the feed store selector doesn't return a new
// object every render when this agent has no feeds yet.
const EMPTY_FEED_BUCKET: Record<string, never> = Object.freeze({});

/**
 * Feed items, drafts, loading state, and history loading for a single
 * agent's board tab.
 */
export function useBoardFeed(path: string, rawItems: Activity[] | undefined) {
  const feedBucket = useFeedStore((s) => s.items[path]);
  const feedItems = feedBucket ?? EMPTY_FEED_BUCKET;

  // Draft persistence
  const rawDrafts = useDraftStore((s) => s.drafts);
  const boardDrafts = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawDrafts)) {
      if (v.text) out[k] = v.text;
    }
    return out;
  }, [rawDrafts]);

  const handleDraftChange = useCallback(
    (sessionKey: string, text: string) => {
      useDraftStore.getState().setDraftText(sessionKey, text);
    },
    [],
  );

  const pushFeedItem = useFeedStore((s) => s.pushFeedItem);
  const setFeed = useFeedStore((s) => s.setFeed);

  const handleHistoryLoaded = useCallback(
    (sessionKey: string, items: FeedItem[]) => {
      const current = useFeedStore.getState().items[path]?.[sessionKey] ?? [];
      const serverIds = new Set(items.map((it) => JSON.stringify(it)));
      const tail = current.filter((it) => !serverIds.has(JSON.stringify(it)));
      setFeed(path, sessionKey, [...items, ...tail]);
    },
    [path, setFeed],
  );

  // Loading state
  const [loadingState, setLoading] = useState<Record<string, boolean>>({});
  const sessionStatuses = useSessionStatusStore((s) => s.statuses);

  const effectiveLoading = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(loadingState)) {
      if (!value) continue;
      const knownStatus = sessionStatuses[getSessionStatusKey(path, key)];
      if (!knownStatus || isActiveSessionStatus(knownStatus)) {
        out[key] = true;
      }
    }
    for (const a of rawItems ?? []) {
      const key = a.session_key ?? `activity-${a.id}`;
      const status = sessionStatuses[getSessionStatusKey(path, key)];
      if (isActiveSessionStatus(status)) out[key] = true;
      if (a.status === "running") out[key] = true;
    }
    return out;
  }, [loadingState, rawItems, sessionStatuses, path]);

  return {
    feedItems,
    boardDrafts,
    handleDraftChange,
    pushFeedItem,
    handleHistoryLoaded,
    effectiveLoading,
    setLoading,
  };
}
