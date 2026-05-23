import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui";
import type { UiTourStep } from "./ui-tour";

/**
 * Builds the ordered list of coachmark steps for the workspace tour.
 * Each step maps to a `[data-tour-target]` attribute in the DOM.
 */
export function useUiTourSteps(
  firstAgentTab: string,
  tabOr: (id: string) => string,
): UiTourStep[] {
  const { t } = useTranslation("shell");
  const setViewMode = useUIStore((s) => s.setViewMode);
  const setCreateAgentDialogOpen = useUIStore((s) => s.setCreateAgentDialogOpen);

  return useMemo(
    () => [
      {
        title: t("uiTour.steps.assistant.title"),
        body: t("uiTour.steps.assistant.body"),
        targetSelector: "[data-tour-target='agents']",
        onEnter: () => setViewMode(firstAgentTab),
      },
      {
        title: t("uiTour.steps.board.title"),
        body: t("uiTour.steps.board.body"),
        targetSelector: "[data-tour-target='main']",
        onEnter: () => setViewMode(firstAgentTab),
      },
      {
        title: t("uiTour.steps.newMission.title"),
        body: t("uiTour.steps.newMission.body"),
        targetSelector: "[data-tour-target='newMission']",
        onEnter: () => setViewMode(firstAgentTab),
      },
      {
        title: t("uiTour.steps.tabActivity.title"),
        body: t("uiTour.steps.tabActivity.body"),
        targetSelector: "[data-tour-target='tab-activity']",
        onEnter: () => setViewMode(tabOr("activity")),
      },
      {
        title: t("uiTour.steps.tabRoutines.title"),
        body: t("uiTour.steps.tabRoutines.body"),
        targetSelector: "[data-tour-target='tab-routines']",
        onEnter: () => setViewMode(tabOr("routines")),
      },
      {
        title: t("uiTour.steps.tabFiles.title"),
        body: t("uiTour.steps.tabFiles.body"),
        targetSelector: "[data-tour-target='tab-files']",
        onEnter: () => setViewMode(tabOr("files")),
      },
      {
        title: t("uiTour.steps.tabJobDescription.title"),
        body: t("uiTour.steps.tabJobDescription.body"),
        targetSelector: "[data-tour-target='tab-job-description']",
        onEnter: () => setViewMode(tabOr("job-description")),
      },
      {
        title: t("uiTour.steps.missionControl.title"),
        body: t("uiTour.steps.missionControl.body"),
        targetSelector: "[data-tour-target='nav-dashboard']",
        onEnter: () => setViewMode("dashboard"),
      },
      {
        title: t("uiTour.steps.integrations.title"),
        body: t("uiTour.steps.integrations.body"),
        targetSelector: "[data-tour-target='nav-connections']",
        onEnter: () => setViewMode("connections"),
      },
      {
        title: t("uiTour.steps.appTour.title"),
        body: t("uiTour.steps.appTour.body"),
        targetSelector: "[data-tour-target='appTour']",
        onEnter: () => {
          setCreateAgentDialogOpen(false);
          setViewMode(firstAgentTab);
        },
      },
      {
        title: t("uiTour.steps.newAgent.title"),
        body: t("uiTour.steps.newAgent.body"),
        targetSelector: "[data-tour-target='newAgent']",
        onEnter: () => {
          setCreateAgentDialogOpen(false);
          setViewMode(firstAgentTab);
        },
      },
      {
        title: t("uiTour.steps.agentStore.title"),
        body: t("uiTour.steps.agentStore.body"),
        targetSelector: "[data-tour-target='agentStore']",
        spotlightPadding: 4,
        placement: "viewport-right" as const,
        onEnter: () => setCreateAgentDialogOpen(true),
      },
      {
        title: t("uiTour.steps.outro.title"),
        body: t("uiTour.steps.outro.body"),
        confirmLabel: t("uiTour.steps.outro.confirm"),
        onEnter: () => setCreateAgentDialogOpen(false),
      },
    ],
    [t, setViewMode, setCreateAgentDialogOpen, firstAgentTab, tabOr],
  );
}
