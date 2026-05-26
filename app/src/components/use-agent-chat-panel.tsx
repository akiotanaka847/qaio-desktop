/** Per-agent chat panel hook: model resolution + skill composer + renderers → AIBoard props. */
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@qaio-ai/core";
import { Play } from "lucide-react";
import {
  decodeAttachmentMessage,
  UserAttachmentMessage,
  type UserAttachmentMessageLabels,
} from "@qaio-ai/chat";

import { useFeedStore } from "../stores/feeds";
import { useConnectedToolkits, useConnections } from "../hooks/queries";
import { tauriChat } from "../lib/tauri";
import { humanizeSkillName } from "../lib/humanize-skill-name";
import { useFileToolRenderer } from "../hooks/use-file-tool-renderer";
import { ComposioLinkCard, parseComposioToolkitFromHref } from "./composio-link-card";
import { ComposioSigninCard, isComposioSigninHref } from "./composio-signin-card";
import { ChatModelSelector } from "./chat-model-selector";
import { ChatEffortSelector } from "./chat-effort-selector";
import { decodeSkillMessage } from "../lib/skill-message";
import { SkillCard } from "./skill-card";
import { UserSkillMessage } from "./user-skill-message";
import { ProviderReconnectCard } from "./shell/provider-reconnect-card";
import { ToolRuntimeErrorCard } from "./shell/tool-runtime-error-card";
import { isToolRuntimeErrorMessage } from "./tool-runtime-feed";
import { useChatDisplayLabels } from "./use-chat-display-labels";
import {
  filterProviderAuthFeedItems,
  isProviderAuthMessage,
  providerAuthSignalKey,
} from "./tabs/provider-auth-feed";
import { useChatModelResolution } from "./use-chat-model-resolution";
import { useSkillComposer } from "./use-skill-composer";

import type { AIBoardProps } from "@qaio-ai/board";
import type { ChatMessage, FeedItem } from "@qaio-ai/chat";
import type { Agent, AgentDefinition } from "../lib/types";

interface UseAgentChatPanelArgs {
  agent: Agent | null;
  agentDef: AgentDefinition | null;
  selectedSessionKey: string | null;
  onSelectSession?: (id: string) => void;
}

export function useAgentChatPanel({
  agent, agentDef, selectedSessionKey, onSelectSession,
}: UseAgentChatPanelArgs) {
  const { t } = useTranslation(["board", "chat"]);
  const { processLabels, getThinkingMessage } = useChatDisplayLabels();
  const path = agent?.folderPath ?? null;

  const model = useChatModelResolution(path);
  const skill = useSkillComposer({
    agent, agentDef, path, selectedSessionKey,
    chatProvider: model.chatProvider, chatModel: model.chatModel, chatEffort: model.chatEffort,
    onSelectSession,
  });

  // Composio link card support
  const { data: composioStatus } = useConnections();
  const { data: connectedList } = useConnectedToolkits(composioStatus?.status === "ok");
  const connectedSet = useMemo(() => new Set(connectedList ?? []), [connectedList]);
  const renderLink = useCallback(
    ({ href, onOpen }: { href: string; onOpen: () => void }) => {
      if (isComposioSigninHref(href)) return <ComposioSigninCard />;
      const toolkit = parseComposioToolkitFromHref(href);
      if (!toolkit) return undefined;
      return <ComposioLinkCard toolkit={toolkit} isConnected={connectedSet.has(toolkit)} onOpen={onOpen} />;
    },
    [connectedSet],
  );

  const { isSpecialTool, renderToolResult, renderTurnSummary } = useFileToolRenderer(path ?? "");
  const pushFeedItem = useFeedStore((s) => s.pushFeedItem);

  const attachmentLabels = useMemo<UserAttachmentMessageLabels>(
    () => ({ attachmentCount: (count) => t("attachmentMessage.count", { count }) }),
    [t],
  );

  const renderUserMessage = useCallback(
    (msg: { content: string }) => {
      const invocation = decodeSkillMessage(msg.content);
      if (invocation) return <UserSkillMessage invocation={invocation} attachmentLabels={attachmentLabels} />;
      const attachmentInvocation = decodeAttachmentMessage(msg.content);
      if (!attachmentInvocation) return undefined;
      return <UserAttachmentMessage invocation={attachmentInvocation} labels={attachmentLabels} />;
    },
    [attachmentLabels],
  );

  const renderSystemMessage = useCallback(
    (msg: ChatMessage) => {
      if (isToolRuntimeErrorMessage(msg)) {
        return (
          <ToolRuntimeErrorCard error={msg.runtimeError} onRetry={async () => {
            if (!path || !selectedSessionKey) return;
            const text = t("chat:toolRuntimeError.retryPrompt");
            await tauriChat.send(path, text, selectedSessionKey, {
              providerOverride: model.chatProvider ?? undefined,
              modelOverride: model.chatModel ?? undefined,
              effortOverride: model.chatEffort ?? undefined,
            });
            pushFeedItem(path, selectedSessionKey, { feed_type: "user_message", data: text });
          }} />
        );
      }
      if (isProviderAuthMessage(msg.content)) return null;
      return undefined;
    },
    [model.chatEffort, model.chatModel, model.chatProvider, path, pushFeedItem, selectedSessionKey, t],
  );

  const mapFeedItems = useCallback(
    ({ items }: { sessionKey: string; items: FeedItem[] }) => filterProviderAuthFeedItems(items),
    [],
  );
  const afterMessages = useCallback(
    ({ feedItems }: { sessionKey: string; feedItems: FeedItem[] }) => {
      const signalKey = providerAuthSignalKey(feedItems);
      return <ProviderReconnectCard providerId={signalKey ? model.effectiveProvider : undefined} signalKey={signalKey ?? undefined} />;
    },
    [model.effectiveProvider],
  );

  const chatEmptyState = useMemo<AIBoardProps["chatEmptyState"]>(() => {
    if (!agent) return undefined;
    if (skill.activeSkill) return null;
    return (send: (text: string) => void) => (
      <div className="self-stretch w-full h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-6 pt-6 pb-4 flex flex-col gap-3">
          <div className="text-center mb-1">
            <h3 className="text-base font-semibold text-foreground">{t("chatEmpty.heading")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t("chatEmpty.subheading")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {[t("chatEmpty.suggestion1", "What can you do?"), t("chatEmpty.suggestion2", "Help me get started")].map((s) => (
              <button key={s} type="button" onClick={() => send(s)}
                className="px-4 py-1.5 rounded-full text-xs font-medium border border-border/60 bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors">
                {s}
              </button>
            ))}
          </div>
          {skill.emptySkillShowcase.map((s) => (
            <SkillCard key={s.name} image={s.image} title={humanizeSkillName(s.name)}
              description={s.description} integrations={s.integrations} onClick={() => skill.applySkill(s)} />
          ))}
          {skill.moreSkillsCount > 0 && (
            <Button size="sm" className="self-center mt-1 rounded-full gap-1.5" onClick={() => skill.setPickerOpen(true)}>
              <Play className="size-3 fill-current" />
              {t("chatEmpty.seeMore", { count: skill.moreSkillsCount })}
            </Button>
          )}
        </div>
      </div>
    );
  }, [agent, skill.activeSkill, skill.emptySkillShowcase, skill.moreSkillsCount, t, skill.applySkill, skill.setPickerOpen]);

  const footer = useMemo<AIBoardProps["footer"]>(() => {
    if (!agent) return undefined;
    return ({ hasMessages }) => (
      <div className="flex items-center gap-2 w-full">
        <button type="button" onClick={() => skill.setPickerOpen(true)} data-keep-panel-open
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Play className="size-3 fill-current" />{t("composerSkill.browse")}
        </button>
        <ChatModelSelector provider={model.effectiveProvider} model={model.effectiveModel}
          onSelect={model.handleModelSelect} lockedProvider={hasMessages ? model.effectiveProvider : null} />
        <ChatEffortSelector provider={model.effectiveProvider} model={model.effectiveModel}
          effort={model.effectiveEffort} onSelect={model.handleEffortSelect} />
      </div>
    );
  }, [agent, t, model.effectiveProvider, model.effectiveModel, model.effectiveEffort, model.handleModelSelect, model.handleEffortSelect, skill.setPickerOpen]);

  return {
    chatEmptyState,
    composerHeader: skill.composerHeader,
    canSendEmpty: skill.canSendEmpty,
    onComposerSubmit: skill.onComposerSubmit,
    footer,
    renderUserMessage,
    isSpecialTool,
    renderToolResult,
    processLabels,
    getThinkingMessage,
    renderTurnSummary,
    renderSystemMessage,
    mapFeedItems,
    afterMessages,
    renderLink,
    pickerDialog: skill.pickerDialog,
    effectiveProvider: model.effectiveProvider,
    effectiveModel: model.effectiveModel,
    chatProvider: model.chatProvider,
    chatModel: model.chatModel,
    chatEffort: model.chatEffort,
  };
}
