import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { KanbanItem, NewPanelOpener } from "@qaio-ai/board";
import type { FeedItem } from "@qaio-ai/chat";

import { useUIStore } from "../../stores/ui";
import { useActivity, useDeleteActivity, useUpdateActivity } from "../../hooks/queries";
import { useAgentChatPanel } from "../use-agent-chat-panel";
import { tauriActivity, tauriChat, tauriPreferences, tauriConfig, tauriTerminal, tauriSystem } from "../../lib/tauri";
import type { TabProps } from "../../lib/types";
import { useQueuedMessageLabels } from "../use-queued-message-labels";
import { useMissionSearch } from "../use-mission-search";
import { useAttachmentRejectionDialog } from "../attachment-rejection-dialog";
import { buildMissionBoardColumns } from "../mission-board-columns";
import { useBoardFeed } from "./use-board-feed";
import { useBoardMessaging } from "./use-board-messaging";

/**
 * All state, effects, and callbacks for BoardTab.
 * BoardTab itself becomes a thin renderer of <AIBoard>.
 */
export function useBoardTabState({ agent, agentDef }: TabProps) {
  const { t } = useTranslation(["board", "dashboard", "chat"]);
  const queuedLabels = useQueuedMessageLabels();
  const cardLabels = {
    approve: t("board:cardActions.approve"),
    approveTooltip: t("board:cardActions.approveTooltip"),
    renameTooltip: t("board:cardActions.renameTooltip"),
    deleteTooltip: t("board:cardActions.deleteTooltip"),
    deleteTitle: (name: string) => t("board:deleteCard.titleWithName", { name }),
    deleteDescription: t("board:deleteCard.description"),
    agentWorking: t("board:cardActions.agentWorking"),
  };
  const path = agent.folderPath;
  const agentModes = agentDef.config.agents;
  const [pendingAgentMode, setPendingAgentMode] = useState<string | null>(null);
  const { data: rawItems } = useActivity(path);
  const deleteActivity = useDeleteActivity(path);
  const updateActivity = useUpdateActivity(path);
  const setOnStartMission = useUIStore((s) => s.setOnStartMission);
  const setBoardActions = useUIStore((s) => s.setBoardActions);
  const missionSearchQuery = useUIStore((s) => s.agentMissionSearchQueries[path] ?? "");
  const setAgentMissionSearchQuery = useUIStore((s) => s.setAgentMissionSearchQuery);
  const setAgentMissionSearchLoading = useUIStore((s) => s.setAgentMissionSearchLoading);
  const setMissionPanelOpen = useUIStore((s) => s.setMissionPanelOpen);
  const missionPanelOpen = useUIStore((s) => s.missionPanelOpen);
  const addToast = useUIStore((s) => s.addToast);
  const attachmentValidation = useAttachmentRejectionDialog();
  const handleNotice = useCallback((message: string) => addToast({ title: message }), [addToast]);
  const handleOpenLink = useCallback((url: string) => { tauriSystem.openUrl(url).catch(console.error); }, []);

  const openerRef = useRef<NewPanelOpener | null>(null);
  const emptyAutoOpenKeyRef = useRef<string | null>(null);
  const [newPanelOpenerReady, setNewPanelOpenerReady] = useState(false);
  const openDefaultMission = useCallback(() => {
    if (agentModes?.length) setPendingAgentMode(agentModes[0].id);
    openerRef.current?.({ focusComposer: true });
  }, [agentModes]);
  const boardColumns = buildMissionBoardColumns(
    {
      backlog: t("dashboard:columns.backlog", "Backlog"),
      inProgress: t("dashboard:columns.inProgress", "In Progress"),
      review: t("dashboard:columns.review", "Review"),
      done: t("dashboard:columns.done"),
      newMission: t("empty.newMission"),
    },
    openDefaultMission,
  );

  const items: KanbanItem[] = useMemo(
    () => (rawItems ?? []).map((task) => {
      const mode = agentModes?.find((m) => m.id === task.agent);
      return {
        id: task.id, title: task.title, description: task.description,
        status: task.status, updatedAt: task.updated_at ?? new Date().toISOString(),
        group: agent.name,
        tags: mode ? [mode.name] : (task.routine_id ? [t("board:tags.routine")] : undefined),
        metadata: {
          ...(task.session_key ? { sessionKey: task.session_key } : {}),
          ...(task.routine_id ? { routineId: task.routine_id } : {}),
          ...(task.agent ? { agent: task.agent } : {}),
          ...(task.worktree_path ? { worktreePath: task.worktree_path } : {}),
        },
      };
    }),
    [agent.name, agentModes, rawItems, t],
  );

  const pendingId = useUIStore((s) => s.activityPanelId);
  const clearPending = useUIStore((s) => s.setActivityPanelId);
  const [selectedId, setSelectedId] = useState<string | null>(pendingId);
  useEffect(() => {
    if (pendingId) {
      if (!selectedId && !missionPanelOpen) setSelectedId(pendingId);
      clearPending(null);
    }
  }, [pendingId, clearPending, selectedId, missionPanelOpen]);

  const selectedSessionKey = useMemo(() => {
    if (!selectedId) return null;
    const item = (rawItems ?? []).find((a) => a.id === selectedId);
    return item?.session_key ?? `activity-${selectedId}`;
  }, [selectedId, rawItems]);

  const panel = useAgentChatPanel({ agent, agentDef, selectedSessionKey, onSelectSession: setSelectedId });
  const feed = useBoardFeed(path, rawItems);
  const messaging = useBoardMessaging({
    path, agentId: agent.id, agentName: agent.name, agentColor: agent.color,
    agentModes, rawItems, chatProvider: panel.chatProvider, chatModel: panel.chatModel,
    pendingAgentMode, selectedSessionKey, effectiveLoading: feed.effectiveLoading,
    pushFeedItem: feed.pushFeedItem, setLoading: feed.setLoading, setPendingAgentMode,
  });

  const handleOpenerReady = useCallback(
    (opener: NewPanelOpener) => {
      openerRef.current = opener;
      setNewPanelOpenerReady(true);
      setOnStartMission(openDefaultMission);
      if (agentModes && agentModes.length > 1) {
        setBoardActions(agentModes.slice(1).map((mode) => ({
          id: mode.id, label: mode.createLabel,
          onClick: () => { setPendingAgentMode(mode.id); opener({ focusComposer: true }); },
        })));
      }
    },
    [setOnStartMission, setBoardActions, agentModes, openDefaultMission],
  );

  const loadHistory = useCallback(
    async (sessionKey: string) => await tauriChat.loadHistory(path, sessionKey) as FeedItem[],
    [path],
  );
  const handleMissionSearchError = useCallback(() => {
    addToast({ title: t("search.historyErrorTitle"), description: t("search.historyErrorDescription"), variant: "error" });
  }, [addToast, t]);
  const missionSearch = useMissionSearch({ items, query: missionSearchQuery, loadHistory, onHistoryLoadError: handleMissionSearchError });

  useEffect(() => { setAgentMissionSearchLoading(path, missionSearch.isSearchingText); return () => setAgentMissionSearchLoading(path, false); }, [missionSearch.isSearchingText, path, setAgentMissionSearchLoading]);

  useEffect(() => {
    if (!rawItems || missionSearch.hasQuery) return;
    if (rawItems.length > 0) { if (emptyAutoOpenKeyRef.current === path) emptyAutoOpenKeyRef.current = null; return; }
    if (!newPanelOpenerReady || missionPanelOpen || selectedId) return;
    if (emptyAutoOpenKeyRef.current === path) return;
    emptyAutoOpenKeyRef.current = path;
    if (agentModes?.length) setPendingAgentMode(agentModes[0].id);
    openerRef.current?.();
  }, [agentModes, missionPanelOpen, missionSearch.hasQuery, newPanelOpenerReady, path, rawItems, selectedId]);

  useEffect(() => () => { setOnStartMission(null); setBoardActions([]); }, [setOnStartMission, setBoardActions]);

  const handleDelete = useCallback(async (item: KanbanItem) => { await deleteActivity.mutateAsync(item.id); if (selectedId === item.id) setSelectedId(null); }, [deleteActivity, selectedId]);
  const handleApprove = useCallback(async (item: KanbanItem) => { await updateActivity.mutateAsync({ activityId: item.id, update: { status: "done" } }); }, [updateActivity]);
  const sessionKeyFor = useCallback((activityId: string) => { const item = (rawItems ?? []).find((a) => a.id === activityId); return item?.session_key ?? `activity-${activityId}`; }, [rawItems]);
  const handleStopSession = useCallback((sessionKey: string) => { tauriChat.stop(path, sessionKey).catch(console.error); }, [path]);

  const handleComposerSubmit = useCallback<NonNullable<typeof panel.onComposerSubmit>>(
    async (ctx) => {
      if (ctx.sessionKey && ctx.sessionKey === selectedSessionKey && messaging.selectedSessionActive) {
        messaging.messageQueue.queueMessage(ctx.text, ctx.files);
        return true;
      }
      return (await panel.onComposerSubmit?.(ctx)) ?? false;
    },
    [selectedSessionKey, messaging.selectedSessionActive, messaging.messageQueue.queueMessage, panel.onComposerSubmit],
  );

  const handleRunInTerminal = useCallback(async (item: KanbanItem) => {
    const wtPath = item.metadata?.worktreePath as string | undefined;
    if (!wtPath) return;
    let devCmd: string | undefined;
    try { const cfg = await tauriConfig.read(path); devCmd = cfg.devCommand as string | undefined; } catch { /* ignore */ }
    const terminal = await tauriPreferences.get("terminal") ?? undefined;
    tauriTerminal.open(wtPath, devCmd, terminal).catch(console.error);
  }, [path]);

  const handleRename = useCallback(
    (item: KanbanItem, newTitle: string) => { tauriActivity.update(path, item.id, { title: newTitle }).catch(console.error); },
    [path],
  );

  const isSelectedRunning = useMemo(
    () => (rawItems ?? []).some((a) => a.id === selectedId && a.status === "running"),
    [rawItems, selectedId],
  );

  return {
    path, agent, agentModes, rawItems, selectedId, setSelectedId, selectedSessionKey,
    boardColumns, queuedLabels, cardLabels, missionSearch, openDefaultMission,
    setAgentMissionSearchQuery, setMissionPanelOpen,
    feed, messaging, panel, attachmentValidation,
    handleOpenerReady, handleDelete, handleApprove, handleRename,
    handleStopSession, handleComposerSubmit, handleRunInTerminal,
    handleNotice, handleOpenLink, sessionKeyFor, isSelectedRunning,
    loadHistory, t,
  };
}
