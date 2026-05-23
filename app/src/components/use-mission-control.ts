import { useState, useMemo, useRef, createElement } from "react";
import type { KanbanItem } from "@qaio-ai/board";
import type { FeedItem } from "@qaio-ai/chat";
import { useFeedStore } from "../stores/feeds";
import {
  getSessionStatusKey,
  isActiveSessionStatus,
  useSessionStatusStore,
} from "../stores/session-status";
import { useAllConversations } from "../hooks/queries";
import type { Agent } from "../lib/types";
import { AgentCardAvatar } from "./shell/agent-card-avatar";
import { useMissionActions } from "./use-mission-actions";

export function useMissionControl(agents: Agent[]) {
  const allItems = useFeedStore((s) => s.items);
  const agentPaths = useMemo(() => agents.map((a) => a.folderPath), [agents]);
  const feedItems = useMemo(() => {
    const out: Record<string, FeedItem[]> = {};
    for (const ap of agentPaths) {
      const bucket = allItems[ap];
      if (!bucket) continue;
      for (const [sk, items] of Object.entries(bucket)) {
        out[sk] = items;
      }
    }
    return out;
  }, [allItems, agentPaths]);
  const sessionStatuses = useSessionStatusStore((s) => s.statuses);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const pathMapRef = useRef<Record<string, string>>({});

  const paths = useMemo(() => agents.map((a) => a.folderPath), [agents]);
  const { data: convos, isFetched } = useAllConversations(paths);

  const agentColorMap = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const a of agents) m[a.folderPath] = a.color;
    return m;
  }, [agents]);

  const items: KanbanItem[] = useMemo(() => {
    if (!convos) return [];
    const map: Record<string, string> = {};
    const result = convos
      .filter((c) => c.type === "activity" && c.status)
      .map((c) => {
        map[c.id] = c.agent_path;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          group: c.agent_name,
          icon: createElement(AgentCardAvatar, { color: agentColorMap[c.agent_path] }),
          status: c.status!,
          updatedAt: c.updated_at ?? new Date().toISOString(),
          metadata: { agentPath: c.agent_path, sessionKey: c.session_key },
        };
      });
    pathMapRef.current = map;
    return result;
  }, [convos, agentColorMap]);

  const actions = useMissionActions(pathMapRef, selectedId, setSelectedId, setLoading);

  const effectiveLoading = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [sessionKey, value] of Object.entries(loading)) {
      if (!value) continue;
      const activityId = sessionKey.replace("activity-", "");
      const agentPath = pathMapRef.current[activityId];
      const status = agentPath
        ? sessionStatuses[getSessionStatusKey(agentPath, sessionKey)]
        : undefined;
      if (!status || isActiveSessionStatus(status)) {
        out[sessionKey] = true;
      }
    }
    for (const item of items) {
      const sessionKey = (item.metadata?.sessionKey as string | undefined) ?? `activity-${item.id}`;
      const agentPath = pathMapRef.current[item.id];
      const status = agentPath
        ? sessionStatuses[getSessionStatusKey(agentPath, sessionKey)]
        : undefined;
      if (item.status === "running" || isActiveSessionStatus(status)) {
        out[sessionKey] = true;
      }
    }
    return out;
  }, [items, loading, sessionStatuses]);

  return {
    items,
    selectedId,
    setSelectedId,
    loading: effectiveLoading,
    isLoaded: isFetched,
    feedItems,
    ...actions,
  };
}
