import { useEffect, useCallback, useRef } from "react";
import { SHORTCUTS } from "../lib/shortcuts";
import { useAgentStore } from "../stores/agents";
import { useAgentCatalogStore } from "../stores/agent-catalog";
import { useUIStore } from "../stores/ui";

/**
 * Mounts a global `keydown` listener that matches against the shortcut
 * registry and dispatches the corresponding UI action.
 *
 * Skips shortcuts when the active element is an input, textarea, or
 * contenteditable (so typing in forms doesn't fire navigation).
 * Exception: Escape always fires.
 */
export function useKeyboardShortcuts(
  onShowShortcuts: () => void,
) {
  const onShowRef = useRef(onShowShortcuts);
  onShowRef.current = onShowShortcuts;

  const handler = useCallback((e: KeyboardEvent) => {
    // Let inputs keep their own key handling (except Escape).
    if (isEditableTarget(e.target) && e.key !== "Escape") return;

    for (const shortcut of SHORTCUTS) {
      if (!shortcut.match(e)) continue;

      e.preventDefault();
      dispatch(shortcut.id, onShowRef.current);
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function dispatch(id: string, onShowShortcuts: () => void) {
  const ui = useUIStore.getState();
  const agentStore = useAgentStore.getState();
  const catalogStore = useAgentCatalogStore.getState();

  switch (id) {
    case "go-dashboard":
      ui.setViewMode("dashboard");
      break;

    case "go-settings":
      ui.setViewMode("settings");
      break;

    case "prev-agent":
    case "next-agent":
      cycleAgent(id === "next-agent" ? 1 : -1, agentStore, catalogStore);
      break;

    case "new-mission": {
      const startMission = useUIStore.getState().onStartMission;
      if (startMission) {
        ui.setViewMode("activity");
        setTimeout(startMission, 50);
      }
      break;
    }

    case "new-agent":
      ui.setCreateAgentDialogOpen(true);
      break;

    case "search": {
      // Focus the first visible search input on the page.
      const el = document.querySelector<HTMLInputElement>(
        "input[type='text'], input[type='search'], input:not([type])",
      );
      el?.focus();
      break;
    }

    case "show-shortcuts":
      onShowShortcuts();
      break;

    case "close-panel":
      if (ui.missionPanelOpen) {
        ui.setMissionPanelOpen(false);
      } else if (ui.createAgentDialogOpen) {
        ui.setCreateAgentDialogOpen(false);
      }
      break;
  }
}

function cycleAgent(
  direction: 1 | -1,
  agentStore: ReturnType<typeof useAgentStore.getState>,
  catalogStore: ReturnType<typeof useAgentCatalogStore.getState>,
) {
  const { agents, current, setCurrent } = agentStore;
  if (agents.length === 0) return;

  const idx = current ? agents.findIndex((a) => a.id === current.id) : -1;
  const next = (idx + direction + agents.length) % agents.length;
  const agent = agents[next];
  setCurrent(agent);

  const def = catalogStore.getById(agent.configId);
  const tab = def?.config.defaultTab ?? "chat";
  useUIStore.getState().setViewMode(tab);
}
