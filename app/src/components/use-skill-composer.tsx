import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { AIBoardProps } from "@qaio-ai/board";

import { useFeedStore } from "../stores/feeds";
import { useSkills } from "../hooks/queries";
import {
  tauriAttachments,
  tauriChat,
  tauriConfig,
  tauriShell,
  tauriWorktree,
  withAttachmentPaths,
} from "../lib/tauri";
import { createMission } from "../lib/create-mission";
import { queryKeys } from "../lib/query-keys";
import { humanizeSkillName } from "../lib/humanize-skill-name";
import { analytics } from "../lib/analytics";
import {
  buildSkillClaudePrompt,
  encodeSkillMessage,
} from "../lib/skill-message";
import { attachmentReferences } from "../lib/attachment-message";
import { NewMissionPickerDialog } from "./new-mission-picker-dialog";
import { SelectedSkillChip } from "./selected-skill-chip";
import type { Agent, AgentDefinition, SkillSummary } from "../lib/types";

interface UseSkillComposerArgs {
  agent: Agent | null;
  agentDef: AgentDefinition | null;
  path: string | null;
  selectedSessionKey: string | null;
  chatProvider: string | null;
  chatModel: string | null;
  chatEffort: string | null;
  onSelectSession?: (id: string) => void;
}

export function useSkillComposer({
  agent, agentDef, path, selectedSessionKey,
  chatProvider, chatModel, chatEffort, onSelectSession,
}: UseSkillComposerArgs) {
  const { t } = useTranslation(["board", "chat"]);
  const queryClient = useQueryClient();
  const pushFeedItem = useFeedStore((s) => s.pushFeedItem);
  const agentModes = agentDef?.config.agents;

  const { data: allSkills } = useSkills(path ?? undefined);
  const emptySkillShowcase = useMemo(() => {
    const skills = allSkills ?? [];
    const featured = skills.filter((s) => s.featured);
    return (featured.length > 0 ? featured : skills).slice(0, 3);
  }, [allSkills]);
  const moreSkillsCount = Math.max(0, (allSkills?.length ?? 0) - emptySkillShowcase.length);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSkill, setActiveSkill] = useState<SkillSummary | null>(null);
  useEffect(() => { setActiveSkill(null); }, [path, selectedSessionKey]);

  const onSelectSessionRef = useRef(onSelectSession);
  useEffect(() => { onSelectSessionRef.current = onSelectSession; }, [onSelectSession]);

  const handleSkillComposerSubmit = useCallback<NonNullable<AIBoardProps["onComposerSubmit"]>>(
    async ({ sessionKey, text, files }) => {
      const skill = activeSkill;
      if (!skill || !agent || !path) return false;
      const claudePrompt = buildSkillClaudePrompt(skill, text);
      const encoded = encodeSkillMessage(skill, text, claudePrompt);
      const friendlyTitle = humanizeSkillName(skill.name);

      if (sessionKey) {
        const scopeId = sessionKey;
        const attachmentPaths = await tauriAttachments.save(scopeId, files);
        const prompt = withAttachmentPaths(claudePrompt, attachmentPaths);
        const encodedWithAttachments = encodeSkillMessage(skill, text, prompt, attachmentReferences(files, attachmentPaths));
        const mode = agentModes?.find((m) => m.id === undefined);
        await tauriChat.send(path, encodedWithAttachments, sessionKey, {
          mode: mode?.promptFile,
          providerOverride: chatProvider ?? undefined,
          modelOverride: chatModel ?? undefined,
          effortOverride: chatEffort ?? undefined,
        });
        pushFeedItem(path, sessionKey, { feed_type: "user_message", data: encodedWithAttachments });
      } else {
        const agentMode = agentModes?.[0]?.id;
        const mode = agentModes?.find((m) => m.id === agentMode);
        let encodedUserMessage = encoded;
        let worktreePath: string | undefined;
        try {
          const cfg = await tauriConfig.read(path);
          if (cfg.worktreeMode) {
            const slug = crypto.randomUUID().slice(0, 8);
            const wt = await tauriWorktree.create(path, slug);
            worktreePath = wt.path;
            const installCmd = cfg.installCommand as string | undefined;
            if (installCmd && worktreePath) {
              tauriShell.run(worktreePath, installCmd).catch(console.error);
            }
          }
        } catch { /* config may not exist yet */ }

        const { conversationId, sessionKey } = await createMission(
          { id: agent.id, name: agent.name, color: agent.color, folderPath: path },
          encoded,
          {
            agentMode, worktreePath,
            promptFile: mode?.promptFile,
            providerOverride: chatProvider ?? undefined,
            modelOverride: chatModel ?? undefined,
            effortOverride: chatEffort ?? undefined,
            buildPrompt: async (activityId) => {
              const paths = await tauriAttachments.save(`activity-${activityId}`, files);
              const prompt = withAttachmentPaths(claudePrompt, paths);
              encodedUserMessage = encodeSkillMessage(skill, text, prompt, attachmentReferences(files, paths));
              return encodedUserMessage;
            },
            title: friendlyTitle,
          },
        );
        pushFeedItem(path, sessionKey, { feed_type: "user_message", data: encodedUserMessage });
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(path) });
        analytics.track("mission_created", { agent_mode: agentMode ?? "default" });
        onSelectSessionRef.current?.(conversationId);
      }
      setActiveSkill(null);
      return true;
    },
    [activeSkill, agent, path, agentModes, chatProvider, chatModel, chatEffort, pushFeedItem, queryClient, t],
  );

  const applySkill = useCallback((skill: SkillSummary) => setActiveSkill(skill), []);

  const composerHeader = useMemo<AIBoardProps["composerHeader"]>(() => {
    if (!agent || !activeSkill) return undefined;
    return <SelectedSkillChip skill={activeSkill} onCancel={() => setActiveSkill(null)} />;
  }, [agent, activeSkill]);

  const pickerDialog: ReactNode = agent ? (
    <NewMissionPickerDialog
      open={pickerOpen} onOpenChange={setPickerOpen}
      lockedAgent={agent} hideBlank
      onSkill={(_agentPath, skillName) => {
        const skill = (allSkills ?? []).find((s) => s.name === skillName);
        if (skill) applySkill(skill);
      }}
    />
  ) : null;

  return {
    activeSkill, allSkills, emptySkillShowcase, moreSkillsCount,
    applySkill, setPickerOpen,
    canSendEmpty: activeSkill != null,
    onComposerSubmit: handleSkillComposerSubmit,
    composerHeader, pickerDialog,
  };
}
