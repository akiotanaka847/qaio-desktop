import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedItem } from "@qaio-ai/chat";
import {
  useConnectedToolkits,
  useConnections,
} from "../../../hooks/queries";
import { tauriAgent, tauriChat, tauriSystem } from "../../../lib/tauri";
import { createMission } from "../../../lib/create-mission";
import { useSessionMessageQueue } from "../../../hooks/use-session-message-queue";
import { useQueuedMessageLabels } from "../../use-queued-message-labels";
import {
  appendTutorialSection,
  stripTutorialSection,
} from "../tutorial-system-prompt";
import { useFeedStore } from "../../../stores/feeds";
import { useSessionStatus, isActiveSessionStatus } from "../../../stores/session-status";
import { useChatDisplayLabels } from "../../use-chat-display-labels";
import {
  ComposioLinkCard,
  parseComposioToolkitFromHref,
} from "../../composio-link-card";
import {
  ComposioSigninCard,
  isComposioSigninHref,
} from "../../composio-signin-card";
import type { Agent } from "../../../lib/types";

const TUTORIAL_END_MARKER = "[TUTORIAL_COMPLETE]";

interface UseTryMissionArgs {
  agent: Agent;
  provider: string;
  model: string;
}

export function useTryMission({ agent, provider, model }: UseTryMissionArgs) {
  const { t } = useTranslation(["setup", "chat"]);
  const agentPath = agent.folderPath;

  const [missionSessionKey, setMissionSessionKey] = useState<string | null>(null);
  const sessionKeyForHooks = missionSessionKey ?? "";
  const feedItems = useFeedStore((s) => s.items[agentPath]?.[sessionKeyForHooks]);
  const pushFeedItem = useFeedStore((s) => s.pushFeedItem);
  const sessionStatus = useSessionStatus(agentPath, sessionKeyForHooks);
  const isActive = isActiveSessionStatus(sessionStatus);
  const { processLabels, getThinkingMessage } = useChatDisplayLabels();

  const [composerText, setComposerText] = useState("");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [pickedAny, setPickedAny] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: composioStatus } = useConnections();
  const isSignedIn = composioStatus?.status === "ok";
  const { data: connectedList } = useConnectedToolkits(isSignedIn);
  const connectedSet = useMemo(() => new Set(connectedList ?? []), [connectedList]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await tauriAgent.readFile(agentPath, "CLAUDE.md");
        const updated = appendTutorialSection(current);
        if (cancelled || updated === current) return;
        await tauriAgent.writeFile(agentPath, "CLAUDE.md", updated);
      } catch (e) {
        console.error("[try] could not append tutorial section:", e);
      }
    })();
    return () => {
      cancelled = true;
      void (async () => {
        try {
          const current = await tauriAgent.readFile(agentPath, "CLAUDE.md");
          const stripped = stripTutorialSection(current);
          if (stripped === current) return;
          await tauriAgent.writeFile(agentPath, "CLAUDE.md", stripped);
        } catch (e) {
          console.error("[try] could not strip tutorial section:", e);
        }
      })();
    };
  }, [agentPath]);

  const tutorialDone = useMemo(() => {
    return (feedItems ?? []).some(
      (item) => item.feed_type === "assistant_text" && typeof item.data === "string" && item.data.includes(TUTORIAL_END_MARKER),
    );
  }, [feedItems]);

  const handleOpenLink = useCallback((url: string) => {
    tauriSystem.openUrl(url).catch(console.error);
  }, []);

  const renderLink = useCallback(
    ({ href, onOpen }: { href: string; onOpen: () => void }) => {
      if (isComposioSigninHref(href)) return <ComposioSigninCard />;
      const toolkit = parseComposioToolkitFromHref(href);
      if (!toolkit) return undefined;
      return <ComposioLinkCard toolkit={toolkit} isConnected={connectedSet.has(toolkit)} onOpen={onOpen} />;
    },
    [connectedSet],
  );

  const transformContent = useCallback((content: string) => {
    if (!content.includes(TUTORIAL_END_MARKER)) return { content };
    return { content: content.replace(TUTORIAL_END_MARKER, "").trim() };
  }, []);

  const sendNow = useCallback(
    async (text: string, _files: File[]) => {
      const trimmed = text.trim();
      if (!trimmed || !missionSessionKey) return;
      pushFeedItem(agentPath, missionSessionKey, { feed_type: "user_message", data: trimmed });
      try {
        await tauriChat.send(agentPath, trimmed, missionSessionKey, { providerOverride: provider, modelOverride: model });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [agentPath, missionSessionKey, provider, model, pushFeedItem],
  );

  const messageQueue = useSessionMessageQueue({ agentPath, sessionKey: missionSessionKey, isActive, sendNow });
  const queuedLabels = useQueuedMessageLabels();

  const handleSend = useCallback(
    async (text: string, files: File[]) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setComposerText("");
      setComposerFiles([]);
      await messageQueue.sendOrQueue(trimmed, files);
    },
    [messageQueue],
  );

  const handleStop = useCallback(() => {
    if (!missionSessionKey) return;
    tauriChat.stop(agentPath, missionSessionKey).catch(console.error);
  }, [agentPath, missionSessionKey]);

  const handlePick = useCallback(
    async (chipLabel: string) => {
      if (pickedAny) return;
      setPickedAny(true);
      try {
        const result = await createMission(
          { id: agent.id, name: agent.name, color: agent.color, folderPath: agent.folderPath },
          chipLabel,
          { title: chipLabel, providerOverride: provider, modelOverride: model },
        );
        setMissionSessionKey(result.sessionKey);
      } catch (e) {
        setPickedAny(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [agent.id, agent.name, agent.color, agent.folderPath, provider, model, pickedAny],
  );

  const visibleFeed = (feedItems ?? []) as FeedItem[];

  return {
    t, missionSessionKey, isActive, processLabels, getThinkingMessage,
    composerText, setComposerText, composerFiles, setComposerFiles,
    pickedAny, error, tutorialDone, visibleFeed,
    handleOpenLink, renderLink, transformContent, handleSend, handleStop, handlePick,
    messageQueue, queuedLabels,
  };
}
