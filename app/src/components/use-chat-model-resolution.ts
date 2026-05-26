import { useCallback, useEffect, useState } from "react";
import { useWorkspaceStore } from "../stores/workspaces";
import { tauriConfig } from "../lib/tauri";
import { getDefaultModel, validEffortOrDefault, type EffortLevel } from "../lib/providers";

/**
 * Resolves the effective provider + model + effort for a chat session by
 * cascading: workspace defaults -> agent config -> per-chat override.
 */
export function useChatModelResolution(path: string | null) {
  const workspace = useWorkspaceStore((s) => s.current);
  const wsProvider = workspace?.provider ?? "anthropic";
  const wsModel = workspace?.model ?? getDefaultModel(wsProvider);

  const [agentProvider, setAgentProvider] = useState<string | null>(null);
  const [agentModel, setAgentModel] = useState<string | null>(null);
  const [agentEffort, setAgentEffort] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setAgentProvider(null);
      setAgentModel(null);
      setAgentEffort(null);
      return;
    }
    tauriConfig
      .read(path)
      .then((cfg) => {
        setAgentProvider((cfg.provider as string) ?? null);
        setAgentModel((cfg.model as string) ?? null);
        setAgentEffort((cfg.effort as string) ?? null);
      })
      .catch(() => {});
  }, [path]);

  const [chatProvider, setChatProvider] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState<string | null>(null);
  const [chatEffort, setChatEffort] = useState<EffortLevel | null>(null);
  useEffect(() => {
    setChatProvider(null);
    setChatModel(null);
    setChatEffort(null);
  }, [path]);

  const effectiveProvider = chatProvider ?? agentProvider ?? wsProvider;
  const effectiveModel = chatModel ?? agentModel ?? wsModel;
  const effectiveEffort = validEffortOrDefault(
    effectiveProvider,
    effectiveModel,
    chatEffort ?? agentEffort,
  );

  const handleModelSelect = useCallback((prov: string, mod: string) => {
    setChatProvider(prov);
    setChatModel(mod);
  }, []);

  const handleEffortSelect = useCallback((effort: EffortLevel) => {
    setChatEffort(effort);
  }, []);

  return {
    effectiveProvider,
    effectiveModel,
    effectiveEffort,
    chatProvider,
    chatModel,
    chatEffort,
    handleModelSelect,
    handleEffortSelect,
  };
}
