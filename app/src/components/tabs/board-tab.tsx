import { useCallback } from "react";
import { AIBoard } from "@qaio-ai/board";
import type { KanbanItem } from "@qaio-ai/board";
import { Terminal, GitBranch } from "lucide-react";

import { useDetailPanelContainer } from "../shell/detail-panel-context";
import { QaioThinkingIndicator } from "../shell/experience-card";
import { AgentCardAvatar } from "../shell/agent-card-avatar";
import { AgentPanelAvatar } from "../shell/agent-panel-avatar";
import { MissionBoardEmptyState } from "../mission-board-empty-state";
import type { TabProps } from "../../lib/types";
import { useBoardTabState } from "./use-board-tab-state";

export default function BoardTab(props: TabProps) {
  const s = useBoardTabState(props);
  const panelContainer = useDetailPanelContainer();

  const cardActions = useCallback((item: KanbanItem) => {
    const wtPath = item.metadata?.worktreePath as string | undefined;
    if (!wtPath) return undefined;
    return (
      <button onClick={(e) => { e.stopPropagation(); s.handleRunInTerminal(item); }}
        className="flex items-center gap-0.5 h-5 px-1.5 rounded-full bg-secondary text-foreground text-[10px] font-medium hover:bg-accent transition-colors duration-200"
        title={s.t("cardActions.openTerminal")}>
        <Terminal className="size-2.5" />{s.t("cardActions.run")}
      </button>
    );
  }, [s.handleRunInTerminal, s.t]);

  const panelActions = useCallback((item: KanbanItem) => {
    const wtPath = item.metadata?.worktreePath as string | undefined;
    if (!wtPath) return undefined;
    const label = wtPath.split("/").pop() ?? wtPath;
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 h-5 px-1.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-medium truncate max-w-[160px]" title={wtPath}>
          <GitBranch className="size-2.5 shrink-0" />{label}
        </span>
        <button onClick={() => s.handleRunInTerminal(item)}
          className="flex items-center gap-0.5 h-5 px-1.5 rounded-full bg-secondary text-foreground text-[10px] font-medium hover:bg-accent transition-colors duration-200"
          title={s.t("cardActions.openTerminal")}>
          <Terminal className="size-2.5" />{s.t("cardActions.run")}
        </button>
      </div>
    );
  }, [s.handleRunInTerminal, s.t]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <AIBoard
          items={s.missionSearch.items} columns={s.boardColumns}
          selectedId={s.selectedId} onSelect={s.setSelectedId}
          panelContainer={panelContainer}
          feedItems={s.feed.feedItems} isLoading={s.feed.effectiveLoading}
          sessionKeyFor={s.sessionKeyFor}
          onDelete={s.handleDelete} onApprove={s.handleApprove}
          onRename={s.handleRename}
          onCreateConversation={s.messaging.handleCreateConversation}
          onSendMessage={s.messaging.handleSendMessage}
          queuedMessages={s.messaging.queuedMessages}
          onRemoveQueuedMessage={(_, id) => s.messaging.messageQueue.removeQueuedMessage(id)}
          queuedLabels={s.queuedLabels}
          onLoadHistory={s.loadHistory} onHistoryLoaded={s.feed.handleHistoryLoaded}
          onNewPanelOpenerReady={s.handleOpenerReady}
          emptyState={
            <MissionBoardEmptyState isSearch={s.missionSearch.hasQuery} isSearchingText={s.missionSearch.isSearchingText}
              labels={{ emptyTitle: s.t("empty.title"), emptyDescription: s.t("empty.description"), newMission: s.t("empty.newMission"),
                searchEmptyTitle: s.t("search.emptyTitle"), searchEmptyDescription: s.t("search.emptyDescription"),
                searchSearchingTitle: s.t("search.searchingTitle"), searchSearchingDescription: s.t("search.searchingDescription"),
                clearSearch: s.t("search.clearCta") }}
              onNewMission={s.openDefaultMission} onClearSearch={() => s.setAgentMissionSearchQuery(s.path, "")} />
          }
          onPanelOpenChange={s.setMissionPanelOpen} onStopSession={s.handleStopSession}
          drafts={s.feed.boardDrafts} onDraftChange={s.feed.handleDraftChange}
          onNotice={s.handleNotice} prepareAttachments={s.attachmentValidation.prepareAttachments}
          onAttachmentRejections={s.attachmentValidation.onAttachmentRejections}
          onOpenLink={s.handleOpenLink}
          actions={s.agentModes ? cardActions : undefined} panelActions={panelActions}
          cardAvatar={<AgentCardAvatar color={s.agent.color} />}
          runningStatuses={["running", "planning", "implementing", "testing", "review_plan", "review_impl"]}
          approveStatuses={["needs_plan_approval", "needs_impl_approval", "needs_you"]}
          thinkingIndicator={<QaioThinkingIndicator />}
          panelAgentName={s.agent.name}
          panelAvatar={<AgentPanelAvatar color={s.agent.color} running={s.isSelectedRunning} />}
          cardLabels={s.cardLabels}
          chatEmptyState={s.panel.chatEmptyState} composerHeader={s.panel.composerHeader}
          canSendEmpty={s.panel.canSendEmpty} onComposerSubmit={s.handleComposerSubmit}
          footer={s.panel.footer} renderUserMessage={s.panel.renderUserMessage}
          renderSystemMessage={s.panel.renderSystemMessage} mapFeedItems={s.panel.mapFeedItems}
          afterMessages={s.panel.afterMessages} isSpecialTool={s.panel.isSpecialTool}
          renderToolResult={s.panel.renderToolResult} processLabels={s.panel.processLabels}
          getThinkingMessage={s.panel.getThinkingMessage} renderTurnSummary={s.panel.renderTurnSummary}
          renderLink={s.panel.renderLink}
        />
      </div>
      {s.panel.pickerDialog}
      {s.attachmentValidation.dialog}
    </div>
  );
}
