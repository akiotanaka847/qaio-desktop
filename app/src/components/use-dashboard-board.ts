import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewPanelOpener } from "@qaio-ai/board";
import { tauriChat } from "../lib/tauri";
import { useMissionControl } from "./use-mission-control";
import { useMissionSearch } from "./use-mission-search";
import type { Agent } from "../lib/types";

interface UseDashboardBoardOptions {
  agents: Agent[];
  missionPanelOpen: boolean;
  addToast: (t: { title: string; description?: string; variant?: "error" | "success" | "info" }) => void;
  searchErrorTitle: string;
  searchErrorDescription: string;
}

/**
 * Board-level state: filtering, search, mission control, auto-open
 * empty-board logic, session stop.
 *
 * Extracted from Dashboard to keep it under the 200-line limit.
 */
export function useDashboardBoard({
  agents,
  missionPanelOpen,
  addToast,
  searchErrorTitle,
  searchErrorDescription,
}: UseDashboardBoardOptions) {
  const [filterPath, setFilterPath] = useState("");
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [newPanelOpenerReady, setNewPanelOpenerReady] = useState(false);
  const [pendingAgent, setPendingAgent] = useState<Agent | null>(null);
  const openerRef = useRef<NewPanelOpener | null>(null);
  const emptyAutoOpenKeyRef = useRef<string | null>(null);
  const openNewMission = useCallback(() => setAgentPickerOpen(true), []);

  const mc = useMissionControl(agents);

  const handlePickAgent = useCallback(
    (agent: Agent, options?: { focusComposer?: boolean }) => {
      setPendingAgent(agent);
      mc.setSelectedId(null);
      openerRef.current?.({ focusComposer: options?.focusComposer ?? true });
    },
    [mc.setSelectedId],
  );

  const handleOpenerReady = useCallback((opener: NewPanelOpener) => {
    openerRef.current = opener;
    setNewPanelOpenerReady(true);
  }, []);

  const handleStopSession = useCallback(
    (sessionKey: string) => {
      const activityId = sessionKey.replace("activity-", "");
      const item = mc.items.find((i) => i.id === activityId);
      const agentPath = item?.metadata?.agentPath as string | undefined;
      if (!agentPath) return;
      tauriChat.stop(agentPath, sessionKey).catch(console.error);
    },
    [mc.items],
  );

  const colorByPath = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const a of agents) map[a.folderPath] = a.color;
    return map;
  }, [agents]);

  const agentFilteredItems = useMemo(() => {
    const base = filterPath
      ? mc.items.filter((i) => i.metadata?.agentPath === filterPath)
      : mc.items;
    return base;
  }, [mc.items, filterPath]);

  const visibleAgents = useMemo(
    () => (filterPath ? agents.filter((a) => a.folderPath === filterPath) : agents),
    [agents, filterPath],
  );

  const handleMissionSearchError = useCallback(() => {
    addToast({ title: searchErrorTitle, description: searchErrorDescription, variant: "error" });
  }, [addToast, searchErrorTitle, searchErrorDescription]);

  const missionSearch = useMissionSearch({
    items: agentFilteredItems,
    query: missionSearchQuery,
    loadHistory: mc.loadHistory,
    onHistoryLoadError: handleMissionSearchError,
  });

  // Auto-open new mission panel when board is empty
  useEffect(() => {
    if (!mc.isLoaded || missionSearch.hasQuery) return;
    const emptyKey = filterPath || "all";
    if (agentFilteredItems.length > 0) {
      if (emptyAutoOpenKeyRef.current === emptyKey) emptyAutoOpenKeyRef.current = null;
      return;
    }
    if (!newPanelOpenerReady || missionPanelOpen || agentPickerOpen) return;
    if (emptyAutoOpenKeyRef.current === emptyKey) return;
    emptyAutoOpenKeyRef.current = emptyKey;
    if (visibleAgents.length === 1) {
      handlePickAgent(visibleAgents[0], { focusComposer: false });
    } else if (visibleAgents.length > 1) {
      setAgentPickerOpen(true);
    }
  }, [
    agentPickerOpen, filterPath, agentFilteredItems.length,
    handlePickAgent, mc.isLoaded, missionSearch.hasQuery,
    missionPanelOpen, newPanelOpenerReady, visibleAgents,
  ]);

  const selectedItem = mc.selectedId
    ? mc.items.find((i) => i.id === mc.selectedId) ?? null
    : null;

  const selectedSessionKey = selectedItem
    ? (selectedItem.metadata?.sessionKey as string | undefined) ?? `activity-${selectedItem.id}`
    : null;

  return {
    mc,
    filterPath,
    setFilterPath,
    missionSearchQuery,
    setMissionSearchQuery,
    agentPickerOpen,
    setAgentPickerOpen,
    pendingAgent,
    colorByPath,
    agentFilteredItems,
    missionSearch,
    selectedItem,
    selectedSessionKey,
    openNewMission,
    handlePickAgent,
    handleOpenerReady,
    handleStopSession,
  };
}
