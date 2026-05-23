import { useCallback, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { KanbanItem } from "@qaio-ai/board";
import type { FeedItem } from "@qaio-ai/chat";
import { useFeedStore } from "../stores/feeds";
import { tauriActivity, tauriChat, tauriAttachments } from "../lib/tauri";
import { buildAttachmentPrompt } from "../lib/attachment-message";

/**
 * CRUD and messaging actions for mission control items.
 * Extracted from `useMissionControl` to keep file sizes under 200 lines.
 */
export function useMissionActions(
  pathMapRef: MutableRefObject<Record<string, string>>,
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  setLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const { t } = useTranslation("chat");
  const pushFeedItem = useFeedStore((s) => s.pushFeedItem);
  const setFeed = useFeedStore((s) => s.setFeed);

  const loadHistory = useCallback(
    async (sessionKey: string): Promise<FeedItem[]> => {
      const activityId = sessionKey.replace("activity-", "");
      const agentPath = pathMapRef.current[activityId];
      if (!agentPath) return [];
      return (await tauriChat.loadHistory(agentPath, sessionKey)) as FeedItem[];
    },
    [pathMapRef],
  );

  const handleDelete = useCallback(
    async (item: KanbanItem) => {
      const agentPath = pathMapRef.current[item.id];
      if (!agentPath) return;
      await tauriActivity.delete(agentPath, item.id);
      await tauriAttachments.delete(`activity-${item.id}`).catch(() => {});
      if (selectedId === item.id) setSelectedId(null);
    },
    [pathMapRef, selectedId, setSelectedId],
  );

  const handleApprove = useCallback(
    async (item: KanbanItem) => {
      const agentPath = pathMapRef.current[item.id];
      if (!agentPath) return;
      await tauriActivity.update(agentPath, item.id, { status: "done" });
    },
    [pathMapRef],
  );

  const handleRename = useCallback(
    async (item: KanbanItem, newTitle: string) => {
      const agentPath = pathMapRef.current[item.id];
      if (!agentPath) return;
      await tauriActivity.update(agentPath, item.id, { title: newTitle });
    },
    [pathMapRef],
  );

  const handleHistoryLoaded = useCallback(
    (sessionKey: string, history: FeedItem[]) => {
      const activityId = sessionKey.replace("activity-", "");
      const agentPath = pathMapRef.current[activityId];
      if (!agentPath) return;
      const current = useFeedStore.getState().items[agentPath]?.[sessionKey] ?? [];
      const serverIds = new Set(history.map((it) => JSON.stringify(it)));
      const tail = current.filter((it) => !serverIds.has(JSON.stringify(it)));
      setFeed(agentPath, sessionKey, [...history, ...tail]);
    },
    [pathMapRef, setFeed],
  );

  const handleSendMessage = useCallback(
    async (sessionKey: string, text: string, files: File[]) => {
      const activityId = sessionKey.replace("activity-", "");
      const agentPath = pathMapRef.current[activityId];
      if (!agentPath) return;
      try {
        const paths = await tauriAttachments.save(`activity-${activityId}`, files);
        const prompt = buildAttachmentPrompt(text, files, paths);
        await tauriChat.send(agentPath, prompt, sessionKey);
        pushFeedItem(agentPath, sessionKey, { feed_type: "user_message", data: prompt });
        setLoading((prev) => ({ ...prev, [sessionKey]: true }));
      } catch (err) {
        setLoading((prev) => ({ ...prev, [sessionKey]: false }));
        pushFeedItem(agentPath, sessionKey, {
          feed_type: "system_message",
          data: t("errors.sessionStart", { error: String(err) }),
        });
        throw err;
      }
    },
    [pathMapRef, pushFeedItem, setLoading, t],
  );

  const handleCreate = useCallback(
    async (agentPath: string, text: string) => {
      const title = text.length > 80 ? text.slice(0, 77) + "..." : text;
      const item = await tauriActivity.create(agentPath, title, text);
      const sessionKey = `activity-${item.id}`;
      pushFeedItem(agentPath, sessionKey, { feed_type: "user_message", data: text });
      setLoading((prev) => ({ ...prev, [sessionKey]: true }));
      await tauriActivity.update(agentPath, item.id, { status: "running" });
      tauriChat.send(agentPath, text, sessionKey);
      setSelectedId(item.id);
    },
    [pushFeedItem, setLoading, setSelectedId],
  );

  return {
    loadHistory,
    handleDelete,
    handleApprove,
    handleRename,
    handleHistoryLoaded,
    handleSendMessage,
    handleCreate,
  };
}
