import { useState, useEffect, useCallback, useRef } from "react";
import { Spinner } from "@qaio-ai/core";
import { tauriProvider, type ProviderStatus } from "../../lib/tauri";
import { PROVIDERS } from "../../lib/providers";
import { analytics } from "../../lib/analytics";
import { ProviderCard } from "./provider-card";
import { SetupGuidance } from "./provider-setup-guidance";

interface Props {
  value: string | null;
  model?: string | null;
  onSelect: (provider: string, model: string) => void;
}

export function ProviderPicker({ value, model: controlledModel, onSelect }: Props) {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [models, setModels] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const p of PROVIDERS) defaults[p.id] = p.defaultModel;
    if (controlledModel && value) defaults[value] = controlledModel;
    return defaults;
  });

  const prevStatuses = useRef<Record<string, ProviderStatus>>({});
  const loadStatuses = useCallback(async () => {
    const [openai, anthropic, gemini] = await Promise.all([
      tauriProvider.checkStatus("openai"),
      tauriProvider.checkStatus("anthropic"),
      tauriProvider.checkStatus("gemini"),
    ]);
    const next: Record<string, ProviderStatus> = { openai, anthropic, gemini };
    for (const id of ["openai", "anthropic", "gemini"] as const) {
      const wasConnected = prevStatuses.current[id]?.cli_installed && prevStatuses.current[id]?.authenticated;
      const isConnected = next[id]?.cli_installed && next[id]?.authenticated;
      if (!wasConnected && isConnected) {
        analytics.track("provider_configured", { provider: id });
      }
    }
    prevStatuses.current = next;
    setStatuses(next);
    setLoading(false);
  }, []);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const shouldPoll = expanded && !(statuses[expanded]?.cli_installed && statuses[expanded]?.authenticated);
    if (shouldPoll) {
      pollRef.current = setInterval(loadStatuses, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [expanded, statuses, loadStatuses]);

  const handleRefresh = async () => {
    setLoading(true);
    await loadStatuses();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map((prov) => {
          const status = statuses[prov.id];
          const connected = (status?.cli_installed && status?.authenticated) ?? false;
          const isSelected = value === prov.id;
          const isExpanded = expanded === prov.id;
          return (
            <ProviderCard
              key={prov.id}
              provider={prov} connected={connected} selected={isSelected} expanded={isExpanded}
              selectedModel={models[prov.id] ?? prov.defaultModel}
              onModelChange={(m) => {
                setModels((prev) => ({ ...prev, [prov.id]: m }));
                if (isSelected) onSelect(prov.id, m);
              }}
              onSelect={() => onSelect(prov.id, models[prov.id] ?? prov.defaultModel)}
              onSignedOut={async () => { await loadStatuses(); setExpanded(prov.id); }}
              onExpand={() => setExpanded(connected ? null : isExpanded ? null : prov.id)}
            />
          );
        })}
      </div>

      {expanded && !(statuses[expanded]?.cli_installed && statuses[expanded]?.authenticated) && (
        <SetupGuidance
          key={expanded}
          provider={PROVIDERS.find((p) => p.id === expanded)!}
          status={statuses[expanded]}
          isSelected={value === expanded}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
