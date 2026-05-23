import { ArrowRight } from "lucide-react";
import { ChatPanel } from "@qaio-ai/chat";
import { Button, QaioAvatar, cn, resolveAgentColor } from "@qaio-ai/core";
import type { Agent } from "../../../lib/types";
import type { MissionMeta } from "../mission-frame";
import { MissionWithChatFrame } from "../mission-with-chat-frame";
import { useTryMission } from "./use-try-mission";

interface FrameLabels {
  brandLabel: string;
  counterLabel: string;
  upNextLabel: string;
}

interface TryMissionProps {
  meta: MissionMeta;
  frame: FrameLabels;
  agent: Agent;
  assistantColor: string;
  provider: string;
  model: string;
  onContinue: () => void;
}

export function TryMission({ meta, frame, agent, assistantColor, provider, model, onContinue }: TryMissionProps) {
  const s = useTryMission({ agent, provider, model });
  const missionTitle = s.t("setup:tutorial.missions.try.skill.title");

  return (
    <MissionWithChatFrame
      meta={meta}
      {...frame}
      left={
        <div className="flex flex-1 flex-col gap-4">
          {s.tutorialDone ? (
            <div className="card-running-glow rounded-xl p-4">
              <p className="text-sm font-medium text-foreground">{s.t("setup:tutorial.missions.try.doneTitle")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.t("setup:tutorial.missions.try.doneBody")}</p>
              <Button className="mt-3 rounded-full" onClick={onContinue}>
                {s.t("setup:tutorial.missions.try.continueChip")}
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-black/5 bg-secondary/40 p-4">
                <p className="text-sm font-medium">{s.t("setup:tutorial.missions.try.tipTitle")}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.t("setup:tutorial.missions.try.tipBody")}</p>
              </div>
              {s.pickedAny && (
                <div className="rounded-xl border border-black/5 bg-secondary/40 p-4">
                  <p className="text-sm font-medium">{s.t("setup:tutorial.missions.try.workingTitle")}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{s.t("setup:tutorial.missions.try.workingBody")}</p>
                </div>
              )}
            </>
          )}
          {s.error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{s.error}</p>
          )}
        </div>
      }
      right={
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-black/5 pb-4">
            <QaioAvatar color={resolveAgentColor(assistantColor)} diameter={32} running={s.isActive} />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-sm font-medium">{agent.name}</p>
              {s.pickedAny && <p className="truncate text-xs text-muted-foreground">{missionTitle}</p>}
            </div>
          </header>
          {s.missionSessionKey ? (
            <div className="flex min-h-0 flex-1 flex-col pt-4">
              <ChatPanel
                sessionKey={s.missionSessionKey}
                feedItems={s.visibleFeed}
                onSend={s.handleSend}
                onStop={s.isActive ? s.handleStop : undefined}
                isLoading={s.isActive}
                placeholder={s.t("setup:tutorial.missions.try.placeholder")}
                processLabels={s.processLabels}
                getThinkingMessage={s.getThinkingMessage}
                renderLink={s.renderLink}
                onOpenLink={s.handleOpenLink}
                transformContent={s.transformContent}
                value={s.composerText}
                onValueChange={s.setComposerText}
                attachments={s.composerFiles}
                onAttachmentsChange={s.setComposerFiles}
                queuedMessages={s.messageQueue.queuedMessages}
                onRemoveQueuedMessage={s.messageQueue.removeQueuedMessage}
                queuedLabels={s.queuedLabels}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
              <p className="text-sm text-muted-foreground">{s.t("setup:tutorial.missions.try.composerHint")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  s.t("setup:tutorial.missions.try.quickChip1"),
                  s.t("setup:tutorial.missions.try.quickChip2"),
                  s.t("setup:tutorial.missions.try.chip"),
                ].map((label) => (
                  <button key={label} type="button" onClick={() => void s.handlePick(label)} disabled={s.pickedAny}
                    className={cn("h-9 rounded-full border border-border/60 bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground hover:border-accent disabled:cursor-not-allowed disabled:opacity-50")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
