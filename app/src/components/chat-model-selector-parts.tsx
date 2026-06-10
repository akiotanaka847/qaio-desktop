import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@qaio-ai/core";
import type { ProviderInfo } from "../lib/providers";
import { ProviderLogo } from "./shell/provider-logos";

interface ProviderModelGroupProps {
  provider: ProviderInfo;
  connected: boolean;
  isActiveProvider: boolean;
  activeModel: string | null;
  onSelect: (provider: string, model: string) => void;
  showSeparator: boolean;
}

export function ProviderModelGroup({
  provider,
  connected,
  isActiveProvider,
  activeModel,
  onSelect,
  showSeparator,
}: ProviderModelGroupProps) {
  const { t } = useTranslation("chat");
  return (
    <>
      {showSeparator && <DropdownMenuSeparator />}
      <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
        <ProviderLogo providerId={provider.id} className="size-3.5" />
        {provider.name}
        {!connected && (
          <span className="text-[10px] text-muted-foreground/60 ml-auto">{t("modelSelector.notConnected")}</span>
        )}
      </DropdownMenuLabel>
      {provider.models.map((m) => {
        const isActive = isActiveProvider && m.id === activeModel;
        return (
          <DropdownMenuItem
            key={m.id}
            disabled={!connected}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(provider.id, m.id);
            }}
            className="flex items-start gap-2.5 py-1.5"
          >
            <div className="w-4 shrink-0 mt-0.5 flex justify-center">
              {isActive && <Check className="h-3.5 w-3.5 text-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm">{m.label}</div>
              <div className="text-xs text-muted-foreground leading-snug">{m.description}</div>
            </div>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

