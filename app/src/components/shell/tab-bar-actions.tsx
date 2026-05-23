import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";
import { Button } from "@qaio-ai/core";
import { useUIStore } from "../../stores/ui";
import { MissionSearchInput } from "../mission-search-input";
import { QaioLogo } from "./experience-card";
import type { Agent } from "../../lib/types";

interface TabBarActionsProps {
  agent: Agent;
  hasActivityTab: boolean;
}

export function TabBarActions({ agent, hasActivityTab }: TabBarActionsProps) {
  const { t } = useTranslation(["shell", "board"]);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const onStartMission = useUIStore((s) => s.onStartMission);
  const boardActions = useUIStore((s) => s.boardActions);
  const setUiTourActive = useUIStore((s) => s.setUiTourActive);
  const agentMissionSearchQuery = useUIStore(
    (s) => s.agentMissionSearchQueries[agent.folderPath] ?? "",
  );
  const agentMissionSearchLoading = useUIStore(
    (s) => s.agentMissionSearchLoading[agent.folderPath] ?? false,
  );
  const setAgentMissionSearchQuery = useUIStore((s) => s.setAgentMissionSearchQuery);

  return (
    <div data-keep-panel-open className="flex items-center gap-2">
      {hasActivityTab && (
        <MissionSearchInput
          value={agentMissionSearchQuery}
          isSearchingText={agentMissionSearchLoading}
          labels={{
            placeholder: t("board:search.placeholder"),
            clear: t("board:search.clear"),
            searchingText: t("board:search.searchingText"),
          }}
          className="relative w-[240px]"
          onChange={(value) => {
            setAgentMissionSearchQuery(agent.folderPath, value);
            if (viewMode !== "activity") setViewMode("activity");
          }}
        />
      )}
      <Button
        data-tour-target="appTour"
        variant="ghost"
        className="rounded-full"
        onClick={() => setUiTourActive(true)}
      >
        {t("shell:tabActions.startTour")}
        <Compass className="size-4" />
      </Button>
      {onStartMission && (
        <Button
          data-tour-target="newMission"
          onClick={() => {
            setViewMode("activity");
            setTimeout(() => {
              useUIStore.getState().onStartMission?.();
            }, 50);
          }}
        >
          <QaioLogo size={16} />
          {t("shell:tabActions.newMission")}
        </Button>
      )}
      {boardActions.map((action) => (
        <Button
          key={action.id}
          variant="secondary"
          onClick={() => {
            setViewMode("activity");
            setTimeout(() => action.onClick(), 50);
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
