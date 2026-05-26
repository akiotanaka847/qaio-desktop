import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@qaio-ai/core";
import { tauriProvider, type ProviderStatus } from "../lib/tauri";
import { PROVIDERS, getProvider, getModel } from "../lib/providers";
import { ProviderModelGroup, ProviderIcon } from "./chat-model-selector-parts";

interface ChatModelSelectorProps {
  /** Current provider id (from workspace/agent config). */
  provider: string;
  /** Current model id. */
  model: string;
  /** Called when user picks a provider + model. */
  onSelect: (provider: string, model: string) => void;
  /**
   * When set, the provider is locked (conversation already started).
   * The user can still switch models within this provider, but not
   * change to a different provider.
   */
  lockedProvider?: string | null;
}

export function ChatModelSelector({ provider, model, onSelect, lockedProvider }: ChatModelSelectorProps) {
  const { t } = useTranslation("chat");
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});

  const loadStatuses = useCallback(async () => {
    const [openai, anthropic, gemini] = await Promise.all([
      tauriProvider.checkStatus("openai"),
      tauriProvider.checkStatus("anthropic"),
      tauriProvider.checkStatus("gemini"),
    ]);
    setStatuses({ openai, anthropic, gemini });
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const currentProvider = getProvider(provider);
  const currentModel = getModel(provider, model);
  const displayLabel = currentModel?.label ?? currentProvider?.subtitle ?? t("modelSelector.selectModel");

  return (
    // Stop pointer events from bubbling — prevents the board detail panel
    // from interpreting dropdown clicks as "click outside -> close panel".
    <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ProviderIcon providerId={provider} className="size-3.5" />
            <span>{displayLabel}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {PROVIDERS.map((prov, idx) => {
            const status = statuses[prov.id];
            const connected = (status?.cli_installed && status?.authenticated) ?? false;
            // Hide disconnected providers that aren't active
            if (!connected && prov.id !== provider) return null;
            // When provider is locked, only show the locked provider's models
            if (lockedProvider && prov.id !== lockedProvider) return null;
            return (
              <ProviderModelGroup
                key={prov.id}
                provider={prov}
                connected={connected}
                isActiveProvider={prov.id === provider}
                activeModel={prov.id === provider ? model : null}
                onSelect={onSelect}
                showSeparator={idx > 0 && !lockedProvider}
              />
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
