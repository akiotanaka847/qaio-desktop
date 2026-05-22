import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { tauriChat, tauriAttachments, tauriConfig, tauriWorktree, tauriShell } from "../../lib/tauri";
import { createMission } from "../../lib/create-mission";
import { formatVisibleMessageText } from "../../lib/queued-chat";
import { buildAttachmentPrompt } from "../../lib/attachment-message";
import { queryKeys } from "../../lib/query-keys";
import { analytics } from "../../lib/analytics";
import { useSessionMessageQueue } from "../../hooks/use-session-message-queue";
import type { FeedItem } from "@qaio-ai/chat";
import type { Activity } from "../../data/activity";

interface AgentMode {
  id: string;
  name: string;
  createLabel?: string;
  promptFile?: string;
}

interface UseBoardMessagingOptions {
  path: string;
  agentId: string;
  agentName: string;
  agentColor?: string;
  agentModes?: AgentMode[];
  rawItems: Activity[] | undefined;
  chatProvider: string | null;
  chatModel: string | null;
  pendingAgentMode: string | null;
  selectedSessionKey: string | null;
  effectiveLoading: Record<string, boolean>;
  pushFeedItem: (path: string, key: string, item: FeedItem) => void;
  setLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPendingAgentMode: (mode: string | null) => void;
}

/**
 * Conversation creation, message sending, message queue, and composer
 * submit for a single agent's board tab.
 */
export function useBoardMessaging({
  path, agentId, agentName, agentColor, agentModes, rawItems,
  chatProvider, chatModel, pendingAgentMode, selectedSessionKey,
  effectiveLoading, pushFeedItem, setLoading, setPendingAgentMode,
}: UseBoardMessagingOptions) {
  const { t } = useTranslation("chat");
  const queryClient = useQueryClient();

  const handleCreateConversation = useCallback(
    async (text: string, files: File[]) => {
      const agentMode = pendingAgentMode ?? agentModes?.[0]?.id;
      const mode = agentModes?.find((m) => m.id === agentMode);

      let worktreePath: string | undefined;
      try {
        const cfg = await tauriConfig.read(path);
        if (cfg.worktreeMode) {
          const slug = crypto.randomUUID().slice(0, 8);
          const wt = await tauriWorktree.create(path, slug);
          worktreePath = wt.path;
          const installCmd = cfg.installCommand as string | undefined;
          if (installCmd && worktreePath) {
            tauriShell.run(worktreePath, installCmd).catch(console.error);
          }
        }
      } catch { /* config may not exist yet */ }

      const visible = formatVisibleMessageText(
        text, files,
        (names) => t("queue.attached", { names }),
      );
      let userMessage = text;
      const { conversationId, sessionKey } = await createMission(
        { id: agentId, name: agentName, color: agentColor, folderPath: path },
        text,
        {
          agentMode,
          worktreePath,
          promptFile: mode?.promptFile,
          providerOverride: chatProvider ?? undefined,
          modelOverride: chatModel ?? undefined,
          titleText: visible,
          buildPrompt: async (activityId) => {
            const saved = await tauriAttachments.save(`activity-${activityId}`, files);
            userMessage = buildAttachmentPrompt(text, files, saved);
            return userMessage;
          },
        },
      );
      pushFeedItem(path, sessionKey, { feed_type: "user_message", data: userMessage });
      setLoading((prev) => ({ ...prev, [sessionKey]: true }));
      setPendingAgentMode(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(path) });
      analytics.track("mission_created", { agent_mode: agentMode ?? "default" });
      return conversationId;
    },
    [path, agentId, agentName, agentColor, pushFeedItem, pendingAgentMode, agentModes, chatProvider, chatModel, queryClient, t, setLoading, setPendingAgentMode],
  );

  const sendMessageNow = useCallback(
    async (sessionKey: string, text: string, files: File[]) => {
      const activity = (rawItems ?? []).find(
        (a) => (a.session_key ?? `activity-${a.id}`) === sessionKey,
      );
      const scopeId = activity ? `activity-${activity.id}` : sessionKey;
      try {
        const paths = await tauriAttachments.save(scopeId, files);
        const prompt = buildAttachmentPrompt(text, files, paths);
        const mode = agentModes?.find((m) => m.id === activity?.agent);
        await tauriChat.send(path, prompt, sessionKey, {
          mode: mode?.promptFile,
          workingDirOverride: activity?.worktree_path ?? undefined,
          providerOverride: chatProvider ?? undefined,
          modelOverride: chatModel ?? undefined,
        });
        pushFeedItem(path, sessionKey, { feed_type: "user_message", data: prompt });
        setLoading((prev) => ({ ...prev, [sessionKey]: true }));
      } catch (err) {
        setLoading((prev) => ({ ...prev, [sessionKey]: false }));
        pushFeedItem(path, sessionKey, {
          feed_type: "system_message",
          data: t("errors.sessionStart", { error: String(err) }),
        });
        throw err;
      }
    },
    [path, pushFeedItem, rawItems, agentModes, chatProvider, chatModel, t, setLoading],
  );

  const selectedSessionActive = selectedSessionKey
    ? (effectiveLoading[selectedSessionKey] ?? false)
    : false;

  const sendSelectedNow = useCallback(
    async (text: string, files: File[]) => {
      if (!selectedSessionKey) return;
      await sendMessageNow(selectedSessionKey, text, files);
    },
    [selectedSessionKey, sendMessageNow],
  );

  const messageQueue = useSessionMessageQueue({
    agentPath: path,
    sessionKey: selectedSessionKey,
    isActive: selectedSessionActive,
    sendNow: sendSelectedNow,
  });

  const handleSendMessage = useCallback(
    async (sessionKey: string, text: string, files: File[]) => {
      if (sessionKey === selectedSessionKey) {
        await messageQueue.sendOrQueue(text, files);
        return;
      }
      await sendMessageNow(sessionKey, text, files);
    },
    [selectedSessionKey, messageQueue.sendOrQueue, sendMessageNow],
  );

  const queuedMessages = useMemo(
    () => selectedSessionKey ? { [selectedSessionKey]: messageQueue.queuedMessages } : {},
    [selectedSessionKey, messageQueue.queuedMessages],
  );

  return {
    handleCreateConversation,
    sendMessageNow,
    handleSendMessage,
    selectedSessionActive,
    messageQueue,
    queuedMessages,
  };
}
