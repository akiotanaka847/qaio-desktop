import type { KanbanColumnConfig } from "@qaio-ai/board";

interface MissionBoardColumnLabels {
  backlog: string;
  inProgress: string;
  review: string;
  done: string;
  newMission: string;
}

export function buildMissionBoardColumns(
  labels: MissionBoardColumnLabels,
  onNewMission: () => void,
): KanbanColumnConfig[] {
  return [
    {
      id: "backlog",
      label: labels.backlog,
      statuses: ["requirements"],
      onAdd: onNewMission,
      addLabel: labels.newMission,
    },
    {
      id: "in_progress",
      label: labels.inProgress,
      statuses: ["running", "planning", "implementing", "testing", "review_plan", "review_impl"],
    },
    {
      id: "review",
      label: labels.review,
      statuses: ["needs_you", "needs_plan_approval", "needs_impl_approval"],
    },
    {
      id: "done",
      label: labels.done,
      statuses: ["done", "cancelled"],
    },
  ];
}
