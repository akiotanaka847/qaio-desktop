export interface KanbanCardLabels {
  /** @deprecated kept for backward-compat. Was the visible Approve pill text;
   *  the action is now an icon-only button with `approveTooltip`. */
  approve?: string
  approveTooltip?: string
  renameTooltip?: string
  deleteTooltip?: string
  /** Delete confirm title, `{name}` substituted with `item.title`. */
  deleteTitle?: (name: string) => string
  deleteDescription?: string
  /** Shown when agent is actively working (e.g. "Agent working"). */
  agentWorking?: string
}

export const DEFAULT_CARD_LABELS: Required<KanbanCardLabels> = {
  approve: "Move to done",
  approveTooltip: "Move to done",
  renameTooltip: "Change title",
  deleteTooltip: "Delete",
  deleteTitle: (name) => `Delete "${name}"?`,
  deleteDescription: "This item and its history will be permanently removed.",
  agentWorking: "Agent working",
}
