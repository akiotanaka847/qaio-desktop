import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { decodeAttachmentMessage } from "@qaio-ai/chat";
import type { FeedItem } from "@qaio-ai/chat";
import { useFeedStore } from "../../stores/feeds";
import { useUIStore } from "../../stores/ui";
import { useDraftStore, useDraftText, useDraftFiles } from "../../stores/drafts";
import { isActiveSessionStatus, useSessionStatus } from "../../stores/session-status";
import { useSessionMessageQueue } from "../../hooks/use-session-message-queue";
import { tauriChat, tauriAttachments, tauriSystem } from "../../lib/tauri";
import { buildAttachmentPrompt } from "../../lib/attachment-message";
import { useFileToolRenderer } from "../../hooks/use-file-tool-renderer";
import { useConnectedToolkits, useConnections } from "../../hooks/queries";
import { parseComposioToolkitFromHref } from "../composio-link-card";
import { analytics } from "../../lib/analytics";
import { useQueuedMessageLabels } from "../use-queued-message-labels";
import { useChatDisplayLabels } from "../use-chat-display-labels";
import { useChatModelResolution } from "../use-chat-model-resolution";
import { useAttachmentRejectionDialog } from "../attachment-rejection-dialog";
import {
  filterProviderAuthFeedItems,
  providerAuthSignalKey,
} from "./provider-auth-feed";
import type { TabProps } from "../../lib/types";

export function useChatTabState({ agent }: TabProps) {
  const { t } = useTranslation("chat");
  const queuedLabels = useQueuedMessageLabels();
  const attachmentLabels = useMemo(
    () => ({ attachmentCount: (count: number) => t("attachmentMessage.count", { count }) }),
    [t],
  );
  const { processLabels, getThinkingMessage } = useChatDisplayLabels();
  const attachmentValidation = useAttachmentRejectionDialog();
  const { isSpecialTool, renderToolResult, renderTurnSummary } = useFileToolRenderer(agent.folderPath);

  const sessionKey = `chat-${agent.id}`;
  const agentPath = agent.folderPath;
  const attachmentScope = `agent-${agent.id}`;
  const feedItems = useFeedStore((s) => s.items[agentPath]?.[sessionKey]);
  const pushFeedItem = useFeedStore((s) => s.pushFeedItem);
  const setFeed = useFeedStore((s) => s.setFeed);
  const clearFeed = useFeedStore((s) => s.clearFeed);
  const addToast = useUIStore((s) => s.addToast);
  const handleNotice = useCallback((message: string) => addToast({ title: message }), [addToast]);

  const [isLoading, setIsLoading] = useState(false);
  const sessionStatus = useSessionStatus(agentPath, sessionKey);
  const isSessionActive = isActiveSessionStatus(sessionStatus);
  const composerText = useDraftText(sessionKey);
  const composerFiles = useDraftFiles(sessionKey);
  const setComposerText = useCallback(
    (text: string) => useDraftStore.getState().setDraftText(sessionKey, text),
    [sessionKey],
  );
  const setComposerFiles = useCallback(
    (files: File[]) => useDraftStore.getState().setDraftFiles(sessionKey, files),
    [sessionKey],
  );
  const sendingRef = useRef(false);
  const loadedRef = useRef<string | null>(null);

  const model = useChatModelResolution(agentPath);
  const authSignalKey = useMemo(() => providerAuthSignalKey(feedItems ?? []), [feedItems]);
  const visibleFeedItems = useMemo(() => filterProviderAuthFeedItems(feedItems ?? []), [feedItems]);

  useEffect(() => {
    if (loadedRef.current === agent.id) return;
    loadedRef.current = agent.id;
    clearFeed(agentPath, sessionKey);
    tauriChat.loadHistory(agentPath, sessionKey).then((rows) => {
      if (rows.length > 0) setFeed(agentPath, sessionKey, rows as FeedItem[]);
    });
  }, [agent.id, sessionKey, agentPath, setFeed, clearFeed]);

  const handleStop = useCallback(() => {
    tauriChat.stop(agentPath, sessionKey).catch(console.error);
  }, [agentPath, sessionKey]);

  useEffect(() => {
    if (sessionStatus === "completed" || sessionStatus === "error") setIsLoading(false);
  }, [sessionStatus]);

  const handleOpenLink = useCallback((url: string) => { tauriSystem.openUrl(url).catch(console.error); }, []);

  const { data: composioStatus } = useConnections();
  const isSignedIn = composioStatus?.status === "ok";
  const { data: connectedList } = useConnectedToolkits(isSignedIn);
  const connectedSet = useMemo(() => new Set(connectedList ?? []), [connectedList]);

  const sendNow = useCallback(
    async (text: string, files: File[]) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setIsLoading(true);
      let started = false;
      try {
        const paths = await tauriAttachments.save(attachmentScope, files);
        const prompt = buildAttachmentPrompt(text, files, paths);
        await tauriChat.send(agentPath, prompt, sessionKey, {
          providerOverride: model.chatProvider ?? undefined,
          modelOverride: model.chatModel ?? undefined,
        });
        started = true;
        pushFeedItem(agentPath, sessionKey, { feed_type: "user_message", data: prompt });
        analytics.track("chat_message_sent");
        setComposerText("");
        setComposerFiles([]);
      } catch (err) {
        setIsLoading(false);
        pushFeedItem(agentPath, sessionKey, {
          feed_type: "system_message",
          data: t("errors.sessionStart", { error: String(err) }),
        });
        throw err;
      } finally {
        if (!started) setIsLoading(false);
        sendingRef.current = false;
      }
    },
    [agentPath, sessionKey, attachmentScope, pushFeedItem, setComposerText, setComposerFiles, model.chatProvider, model.chatModel, t],
  );

  const handleQueued = useCallback(() => {
    setComposerText("");
    setComposerFiles([]);
  }, [setComposerText, setComposerFiles]);
  const messageQueue = useSessionMessageQueue({
    agentPath, sessionKey,
    isActive: isLoading || isSessionActive,
    sendNow, onQueued: handleQueued,
  });

  return {
    t, sessionKey, agentPath, model, attachmentLabels, processLabels, getThinkingMessage,
    attachmentValidation, isSpecialTool, renderToolResult, renderTurnSummary,
    visibleFeedItems, isLoading, isSessionActive, authSignalKey,
    composerText, setComposerText, composerFiles, setComposerFiles,
    handleStop, handleOpenLink, handleNotice, connectedSet, messageQueue, queuedLabels,
    decodeAttachmentMessage, parseComposioToolkitFromHref,
  };
}
