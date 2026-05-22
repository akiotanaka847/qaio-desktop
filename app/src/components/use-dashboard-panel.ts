import { useCallback, useMemo } from "react";
import type { KanbanItem } from "@qaio-ai/board";
import { useAgentCatalogStore } from "../stores/agent-catalog";
import { useSessionMessageQueue } from "../hooks/use-session-message-queue";
import { useAgentChatPanel } from "./use-agent-chat-panel";
import { useAttachmentRejectionDialog } from "./attachment-rejection-dialog";
import type { Agent } from "../lib/types";

interface UseDashboardPanelOptions {
  agents: Agent[];
  selectedItem: KanbanItem | null;
  pendingAgent: Agent | null;
  selectedSessionKey: string | null;
  loading: Record<string, boolean>;
  onSendMessage: (sessionKey: string, text: string, files: File[]) => Promise<void>;
  onSelectId: (id: string) => void;
}

/**
 * Wires the agent chat panel, message queue, composer submit, and
 * attachment validation for the Mission Control right panel.
 *
 * Extracted from Dashboard to keep it under the 200-line limit.
 */
export function useDashboardPanel({
  agents,
  selectedItem,
  pendingAgent,
  selectedSessionKey,
  loading,
  onSendMessage,
  onSelectId,
}: UseDashboardPanelOptions) {
  const getAgentDef = useAgentCatalogStore((s) => s.getById);

  // Resolve which agent scopes the panel
  const activeAgent = useMemo<Agent | null>(() => {
    if (selectedItem) {
      const path = selectedItem.metadata?.agentPath as string | undefined;
      return agents.find((a) => a.folderPath === path) ?? null;
    }
    return pendingAgent;
  }, [selectedItem, pendingAgent, agents]);

  const activeAgentDef = activeAgent ? getAgentDef(activeAgent.configId) ?? null : null;

  const onActionCreated = useCallback(
    (id: string) => onSelectId(id),
    [onSelectId],
  );

  const panel = useAgentChatPanel({
    agent: activeAgent,
    agentDef: activeAgentDef,
    selectedSessionKey,
    onSelectSession: onActionCreated,
  });

  const attachmentValidation = useAttachmentRejectionDialog();

  const selectedAgentPath = selectedItem?.metadata?.agentPath as string | undefined;
  const selectedSessionActive = selectedSessionKey
    ? (loading[selectedSessionKey] ?? false)
    : false;

  const sendSelectedNow = useCallback(
    async (text: string, files: File[]) => {
      if (!selectedSessionKey) return;
      await onSendMessage(selectedSessionKey, text, files);
    },
    [onSendMessage, selectedSessionKey],
  );

  const messageQueue = useSessionMessageQueue({
    agentPath: selectedAgentPath ?? null,
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
      await onSendMessage(sessionKey, text, files);
    },
    [onSendMessage, selectedSessionKey, messageQueue.sendOrQueue],
  );

  const handleComposerSubmit = useCallback<NonNullable<typeof panel.onComposerSubmit>>(
    async (ctx) => {
      if (ctx.sessionKey && ctx.sessionKey === selectedSessionKey && selectedSessionActive) {
        messageQueue.queueMessage(ctx.text, ctx.files);
        return true;
      }
      return (await panel.onComposerSubmit?.(ctx)) ?? false;
    },
    [selectedSessionKey, selectedSessionActive, messageQueue.queueMessage, panel.onComposerSubmit],
  );

  const queuedMessages = useMemo(
    () => selectedSessionKey ? { [selectedSessionKey]: messageQueue.queuedMessages } : {},
    [selectedSessionKey, messageQueue.queuedMessages],
  );

  return {
    activeAgent,
    panel,
    attachmentValidation,
    handleSendMessage,
    handleComposerSubmit,
    queuedMessages,
    removeQueuedMessage: messageQueue.removeQueuedMessage,
  };
}
