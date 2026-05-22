import { useTranslation } from "react-i18next";
import { AIBoard } from "@qaio-ai/board";
import type { KanbanColumnConfig } from "@qaio-ai/board";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  Button,
} from "@qaio-ai/core";
import { Plus } from "lucide-react";
import { useAgentStore } from "../stores/agents";
import { useUIStore } from "../stores/ui";
import { AgentPickerDialog } from "./agent-picker-dialog";
import { useQueuedMessageLabels } from "./use-queued-message-labels";
import { useDetailPanelContainer } from "./shell/detail-panel-context";
import { QaioThinkingIndicator } from "./shell/experience-card";
import { AgentCardAvatar } from "./shell/agent-card-avatar";
import { AgentPanelAvatar } from "./shell/agent-panel-avatar";
import { MissionControlToolbar } from "./mission-control-toolbar";
import { MissionBoardEmptyState } from "./mission-board-empty-state";
import { buildMissionBoardColumns } from "./mission-board-columns";
import { DashboardHeader } from "./dashboard-header";
import { useAgentActivitySummaries } from "./shell/use-agent-activity-summaries";
import { useDashboardPanel } from "./use-dashboard-panel";
import { useDashboardBoard } from "./use-dashboard-board";

export function Dashboard() {
  const { t } = useTranslation(["dashboard", "board", "common"]);
  const queuedLabels = useQueuedMessageLabels();
  const cardLabels = {
    approve: t("board:cardActions.approve"),
    approveTooltip: t("board:cardActions.approveTooltip"),
    renameTooltip: t("board:cardActions.renameTooltip"),
    deleteTooltip: t("board:cardActions.deleteTooltip"),
    deleteTitle: (name: string) => t("board:deleteCard.titleWithName", { name }),
    deleteDescription: t("board:deleteCard.description"),
  };
  const panelContainer = useDetailPanelContainer();
  const agents = useAgentStore((s) => s.agents);
  const activitySummaries = useAgentActivitySummaries(agents);
  const setDialogOpen = useUIStore((s) => s.setCreateAgentDialogOpen);
  const setMissionPanelOpen = useUIStore((s) => s.setMissionPanelOpen);
  const missionPanelOpen = useUIStore((s) => s.missionPanelOpen);
  const addToast = useUIStore((s) => s.addToast);

  const board = useDashboardBoard({
    agents,
    missionPanelOpen,
    addToast,
    searchErrorTitle: t("dashboard:search.historyErrorTitle"),
    searchErrorDescription: t("dashboard:search.historyErrorDescription"),
  });

  const MC_COLUMNS: KanbanColumnConfig[] = buildMissionBoardColumns(
    {
      backlog: t("dashboard:columns.backlog", "Backlog"),
      inProgress: t("dashboard:columns.inProgress", "In Progress"),
      review: t("dashboard:columns.review", "Review"),
      done: t("dashboard:columns.done"),
      newMission: t("dashboard:empty.newMission"),
    },
    board.openNewMission,
  );

  const dp = useDashboardPanel({
    agents,
    selectedItem: board.selectedItem,
    pendingAgent: board.pendingAgent,
    selectedSessionKey: board.selectedSessionKey,
    loading: board.mc.loading,
    onSendMessage: board.mc.handleSendMessage,
    onSelectId: board.mc.setSelectedId,
  });

  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyTitle>{t("dashboard:noAgents.title")}</EmptyTitle>
            <EmptyDescription>{t("dashboard:noAgents.description")}</EmptyDescription>
          </EmptyHeader>
          <Button className="mt-4 rounded-full" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard:noAgents.cta")}
          </Button>
        </Empty>
      </div>
    );
  }

  const doneItems = board.mc.items.filter((i) => i.status === "done" || i.status === "cancelled").length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <DashboardHeader agents={agents} summaries={activitySummaries} totalItems={board.mc.items.length} doneItems={doneItems} />
      <MissionControlToolbar
        agents={agents} filterPath={board.filterPath} search={board.missionSearchQuery}
        isSearchingText={board.missionSearch.isSearchingText}
        onFilterPathChange={board.setFilterPath} onSearchChange={board.setMissionSearchQuery}
        onNewMission={board.openNewMission}
      />
      <div className="flex-1 min-h-0">
        <AIBoard
          items={board.missionSearch.items.map((item) => ({
            ...item,
            icon: <AgentCardAvatar color={board.colorByPath[item.metadata?.agentPath as string]} />,
          }))}
          columns={MC_COLUMNS}
          selectedId={board.mc.selectedId} onSelect={board.mc.setSelectedId}
          feedItems={board.mc.feedItems} isLoading={board.mc.loading}
          onDelete={board.mc.handleDelete} onApprove={board.mc.handleApprove} onRename={board.mc.handleRename}
          onSendMessage={dp.handleSendMessage}
          queuedMessages={dp.queuedMessages}
          onRemoveQueuedMessage={(_, id) => dp.removeQueuedMessage(id)}
          queuedLabels={queuedLabels}
          onLoadHistory={board.mc.loadHistory} onHistoryLoaded={board.mc.handleHistoryLoaded}
          onNewPanelOpenerReady={board.handleOpenerReady}
          emptyState={
            <MissionBoardEmptyState
              isSearch={board.missionSearch.hasQuery} isSearchingText={board.missionSearch.isSearchingText}
              labels={{
                emptyTitle: t("dashboard:empty.boardTitle"), emptyDescription: t("dashboard:empty.boardDescription"),
                newMission: t("dashboard:empty.newMission"), searchEmptyTitle: t("dashboard:search.emptyTitle"),
                searchEmptyDescription: t("dashboard:search.emptyDescription"),
                searchSearchingTitle: t("dashboard:search.searchingTitle"),
                searchSearchingDescription: t("dashboard:search.searchingDescription"),
                clearSearch: t("dashboard:search.clearCta"),
              }}
              onNewMission={board.openNewMission}
              onClearSearch={() => board.setMissionSearchQuery("")}
            />
          }
          panelContainer={panelContainer} onPanelOpenChange={setMissionPanelOpen}
          onStopSession={board.handleStopSession}
          prepareAttachments={dp.attachmentValidation.prepareAttachments}
          onAttachmentRejections={dp.attachmentValidation.onAttachmentRejections}
          panelAgentName={dp.activeAgent?.name ?? board.selectedItem?.subtitle}
          panelAvatar={<AgentPanelAvatar color={dp.activeAgent?.color} running={board.selectedItem?.status === "running"} />}
          runningStatuses={["running", "planning", "implementing", "testing", "review_plan", "review_impl"]}
          approveStatuses={["needs_plan_approval", "needs_impl_approval", "needs_you"]}
          thinkingIndicator={<QaioThinkingIndicator />}
          cardLabels={cardLabels}
          chatEmptyState={dp.panel.chatEmptyState} composerHeader={dp.panel.composerHeader}
          canSendEmpty={dp.panel.canSendEmpty} onComposerSubmit={dp.handleComposerSubmit}
          footer={dp.panel.footer} renderUserMessage={dp.panel.renderUserMessage}
          renderSystemMessage={dp.panel.renderSystemMessage} mapFeedItems={dp.panel.mapFeedItems}
          afterMessages={dp.panel.afterMessages} isSpecialTool={dp.panel.isSpecialTool}
          renderToolResult={dp.panel.renderToolResult} processLabels={dp.panel.processLabels}
          getThinkingMessage={dp.panel.getThinkingMessage} renderTurnSummary={dp.panel.renderTurnSummary}
          renderLink={dp.panel.renderLink}
        />
      </div>
      {dp.panel.pickerDialog}
      {dp.attachmentValidation.dialog}
      <AgentPickerDialog open={board.agentPickerOpen} onOpenChange={board.setAgentPickerOpen} agents={agents} onPick={board.handlePickAgent} />
    </div>
  );
}
