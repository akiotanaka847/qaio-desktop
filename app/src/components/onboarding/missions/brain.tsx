import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@qaio-ai/core";
import { tauriProvider, type ProviderStatus } from "../../../lib/tauri";
import { PROVIDERS } from "../../../lib/providers";
import { BrainProviderCard } from "./brain-provider-card";

interface BrainMissionProps {
  provider: string | null;
  onSelect: (provider: string, model: string) => void;
  onContinue: () => Promise<void> | void;
}

export function BrainMission({
  provider,
  onSelect,
  onContinue,
}: BrainMissionProps) {
  const { t } = useTranslation(["setup", "providers", "common"]);
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const results = await Promise.all(
      PROVIDERS.map((p) => tauriProvider.checkStatus(p.id)),
    );
    const next: Record<string, ProviderStatus> = {};
    PROVIDERS.forEach((p, i) => { next[p.id] = results[i]; });
    setStatuses(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while a disconnected provider is selected so the screen unblocks the
  // moment the user finishes the browser sign-in flow.
  useEffect(() => {
    if (!provider) return;
    const status = statuses[provider];
    const connected = !!status?.cli_installed && !!status?.authenticated;
    if (connected) return;
    const id = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(id);
  }, [provider, refresh, statuses]);

  const selectedConnected =
    !!provider && !!statuses[provider]?.cli_installed && !!statuses[provider]?.authenticated;

  const handleContinue = async () => {
    if (!selectedConnected) return;
    setSubmitting(true);
    try {
      await onContinue();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROVIDERS.map((prov) => (
          <BrainProviderCard
            key={prov.id}
            provider={prov}
            status={statuses[prov.id]}
            loading={loading}
            selected={provider === prov.id}
            onSelect={(modelId) => onSelect(prov.id, modelId)}
            onRefresh={refresh}
            costLabel={prov.cost}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          className="rounded-full"
          disabled={!selectedConnected || submitting}
          onClick={() => void handleContinue()}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {submitting
            ? t("setup:tutorial.missions.brain.creating")
            : t("setup:tutorial.missions.brain.continue")}
        </Button>
      </div>
      {selectedConnected && !submitting && (
        <p className="text-xs text-muted-foreground">
          {t("setup:tutorial.missions.brain.continueHint")}
        </p>
      )}
    </div>
  );
}
