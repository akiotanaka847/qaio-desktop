import { useCallback } from "react";
import {
  ChatPanel,
  UserAttachmentMessage,
} from "@qaio-ai/chat";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@qaio-ai/core";
import {
  ComposioLinkCard,
} from "../composio-link-card";
import type { TabProps } from "../../lib/types";
import { QaioThinkingIndicator } from "../shell/experience-card";
import { ChatModelSelector } from "../chat-model-selector";
import { ProviderReconnectCard } from "../shell/provider-reconnect-card";
import { ToolRuntimeErrorCard } from "../shell/tool-runtime-error-card";
import { isToolRuntimeErrorMessage } from "../tool-runtime-feed";
import { isProviderAuthMessage } from "./provider-auth-feed";
import { useChatTabState } from "./use-chat-tab-state";
import { ChatProgressPanel } from "./chat-progress-panel";

export default function ChatTab(props: TabProps) {
  const s = useChatTabState(props);

  const renderLink = useCallback(
    ({ href, onOpen }: { href: string; onOpen: () => void }) => {
      const toolkit = s.parseComposioToolkitFromHref(href);
      if (!toolkit) return undefined;
      return (
        <ComposioLinkCard
          toolkit={toolkit}
          isConnected={s.connectedSet.has(toolkit)}
          onOpen={onOpen}
        />
      );
    },
    [s.connectedSet, s.parseComposioToolkitFromHref],
  );

  const showProgress = s.visibleFeedItems.length > 0;

  return (
    <div className="h-full w-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
      <ChatPanel
        sessionKey={s.sessionKey}
        feedItems={s.visibleFeedItems}
        isLoading={s.isLoading || s.isSessionActive}
        onSend={s.messageQueue.sendOrQueue}
        onStop={s.handleStop}
        onOpenLink={s.handleOpenLink}
        renderLink={renderLink}
        isSpecialTool={s.isSpecialTool}
        renderToolResult={s.renderToolResult}
        processLabels={s.processLabels}
        getThinkingMessage={s.getThinkingMessage}
        renderTurnSummary={s.renderTurnSummary}
        renderSystemMessage={(msg) => {
          if (isToolRuntimeErrorMessage(msg)) {
            return (
              <ToolRuntimeErrorCard
                error={msg.runtimeError}
                onRetry={() =>
                  s.messageQueue.sendOrQueue(s.t("toolRuntimeError.retryPrompt"), [])
                }
              />
            );
          }
          if (isProviderAuthMessage(msg.content)) return null;
          if (s.authSignalKey && msg.content.startsWith("Session error:")) return null;
          return undefined;
        }}
        renderUserMessage={(msg) => {
          const invocation = s.decodeAttachmentMessage(msg.content);
          if (!invocation) return undefined;
          return (
            <UserAttachmentMessage
              invocation={invocation}
              labels={s.attachmentLabels}
            />
          );
        }}
        afterMessages={
          <ProviderReconnectCard
            providerId={s.authSignalKey ? s.model.effectiveProvider : undefined}
            signalKey={s.authSignalKey ?? undefined}
          />
        }
        thinkingIndicator={<QaioThinkingIndicator />}
        placeholder={s.t("composer.placeholder")}
        value={s.composerText}
        onValueChange={s.setComposerText}
        attachments={s.composerFiles}
        onAttachmentsChange={s.setComposerFiles}
        onNotice={s.handleNotice}
        prepareAttachments={s.attachmentValidation.prepareAttachments}
        onAttachmentRejections={s.attachmentValidation.onAttachmentRejections}
        queuedMessages={s.messageQueue.queuedMessages}
        onRemoveQueuedMessage={s.messageQueue.removeQueuedMessage}
        queuedLabels={s.queuedLabels}
        footer={
          <ChatModelSelector
            provider={s.model.effectiveProvider}
            model={s.model.effectiveModel}
            onSelect={s.model.handleModelSelect}
            lockedProvider={s.visibleFeedItems.length > 0 ? s.model.effectiveProvider : null}
          />
        }
        emptyState={
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyTitle>{s.t("empty.title")}</EmptyTitle>
              <EmptyDescription>
                {s.t("empty.description")}
              </EmptyDescription>
            </EmptyHeader>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                s.t("empty.suggestion1", "What can you do?"),
                s.t("empty.suggestion2", "Help me get started"),
                s.t("empty.suggestion3", "Show me examples"),
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => s.messageQueue.sendOrQueue(label, [])}
                  className="px-4 py-1.5 rounded-full text-xs font-medium border border-border/60 bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </Empty>
        }
      />
      {s.attachmentValidation.dialog}
      </div>
      {showProgress && (
        <ChatProgressPanel
          feedItems={s.visibleFeedItems}
          isActive={s.isLoading || s.isSessionActive}
        />
      )}
    </div>
  );
}
