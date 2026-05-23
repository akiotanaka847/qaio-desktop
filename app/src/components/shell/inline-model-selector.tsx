import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@qaio-ai/core";
import { tauriProvider, type ProviderStatus } from "../../lib/tauri";
import { PROVIDERS, getProvider, getModel } from "../../lib/providers";
import { ProviderIcon } from "./provider-icon";

interface InlineModelSelectorProps {
  provider: string;
  model: string;
  onSelect: (provider: string, model: string) => void;
}

/** Bigger model selector for the agent creation dialog. */
export function InlineModelSelector({ provider, model, onSelect }: InlineModelSelectorProps) {
  const { t } = useTranslation("providers");
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [open, setOpen] = useState(false);

  const loadStatuses = useCallback(async () => {
    const [openai, anthropic] = await Promise.all([
      tauriProvider.checkStatus("openai"),
      tauriProvider.checkStatus("anthropic"),
    ]);
    setStatuses({ openai, anthropic });
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const currentProvider = getProvider(provider);
  const currentModel = getModel(provider, model);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left",
          open
            ? "border-foreground/20 bg-secondary"
            : "border-border hover:border-foreground/15 hover:bg-accent/50",
        )}
      >
        <ProviderIcon providerId={provider} className="size-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{currentModel?.label ?? model}</div>
          <div className="text-xs text-muted-foreground">{currentProvider?.name}</div>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 space-y-0.5">
          {PROVIDERS.map((prov) => {
            const status = statuses[prov.id];
            const connected = (status?.cli_installed && status?.authenticated) ?? false;
            if (!connected && prov.id !== provider) return null;
            return (
              <div key={prov.id}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                  <ProviderIcon providerId={prov.id} className="size-3.5" />
                  {prov.name}
                  {!connected && (
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">{t("card.notConnected")}</span>
                  )}
                </div>
                {prov.models.map((m) => {
                  const isActive = prov.id === provider && m.id === model;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!connected}
                      onClick={() => {
                        onSelect(prov.id, m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                        isActive ? "bg-accent" : "hover:bg-accent/50",
                        !connected && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="w-4 shrink-0 mt-0.5 flex justify-center">
                        {isActive && <Check className="h-3.5 w-3.5 text-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{m.label}</div>
                        <div className="text-xs text-muted-foreground leading-snug">{m.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
