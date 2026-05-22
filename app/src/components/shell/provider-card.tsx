import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleDashed, ChevronDown, LogOut } from "lucide-react";
import {
  Spinner,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  Button,
} from "@qaio-ai/core";
import { tauriProvider } from "../../lib/tauri";
import type { ProviderInfo } from "../../lib/providers";
import { ClaudeLogo, OpenAILogo, GeminiLogo } from "./provider-logos";

interface ProviderCardProps {
  provider: ProviderInfo;
  connected: boolean;
  selected: boolean;
  expanded: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onSelect: () => void;
  onExpand: () => void;
  onSignedOut: () => void | Promise<void>;
}

export function ProviderCard({
  provider, connected, selected, expanded, selectedModel,
  onModelChange, onSelect, onExpand, onSignedOut,
}: ProviderCardProps) {
  const { t } = useTranslation("providers");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSignOutError(null);
    setSigningOut(true);
    try {
      await tauriProvider.launchLogout(provider.id);
      await onSignedOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[provider-picker] launchLogout(${provider.id}) failed:`, msg);
      setSignOutError(msg);
    } finally {
      setSigningOut(false);
    }
  };

  const handleClick = () => {
    onSelect();
    onExpand();
  };

  const selectedModelObj = provider.models.find((m) => m.id === selectedModel) ?? provider.models[0];

  return (
    <div
      role="button" tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      aria-label={connected ? t("card.ariaLabelConnected", { name: provider.name }) : t("card.ariaLabelNotConnected", { name: provider.name })}
      aria-pressed={selected}
      className={`
        relative rounded-xl p-5 transition-all flex flex-col items-center gap-3 cursor-pointer
        outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${selected ? "border-2 border-foreground bg-secondary"
          : connected ? "border border-black/[0.08] hover:border-black/[0.15] hover:bg-accent"
            : "border border-black/[0.05] opacity-75 hover:opacity-100"}
        ${expanded && !connected ? "border-black/[0.15] bg-accent/50" : ""}
      `}
    >
      {selected && (
        <div className="absolute top-3 right-3">
          <Check className="h-4 w-4 text-foreground" strokeWidth={2.5} />
        </div>
      )}

      <div className="h-10 w-10 flex items-center justify-center">
        {provider.id === "anthropic" ? <ClaudeLogo /> : provider.id === "gemini" ? <GeminiLogo /> : <OpenAILogo />}
      </div>

      <div className="text-center">
        <div className="text-sm font-medium text-foreground">{provider.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{provider.subtitle}</div>
      </div>

      <div className="flex items-center gap-1.5 text-xs" aria-live="polite">
        {connected ? (
          <>
            <Check className="h-3 w-3 text-success" />
            <span className="text-success font-medium">{t("card.connected")}</span>
          </>
        ) : (
          <>
            <CircleDashed className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{t("card.notConnected")}</span>
          </>
        )}
      </div>

      {(selected || connected) && (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full h-8 gap-1.5 text-xs">
                {selectedModelObj.label}
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64 overscroll-contain"
              style={{ maxHeight: "min(22rem, var(--radix-dropdown-menu-content-available-height, 22rem))" }}>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {t("card.modelDropdownLabel")}
              </DropdownMenuLabel>
              {provider.models.map((m) => {
                const isActive = m.id === selectedModel;
                return (
                  <DropdownMenuItem key={m.id}
                    onClick={() => { onModelChange(m.id); if (!selected && connected) onSelect(); }}
                    className="flex items-start gap-2.5 py-2">
                    <div className="w-4 shrink-0 mt-0.5 flex justify-center">
                      {isActive && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground leading-snug">{m.description}</div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{provider.cost}</p>

      {connected && (
        <div className="w-full" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={handleSignOut} disabled={signingOut}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {signingOut ? (
              <><Spinner className="h-3 w-3" />{t("card.signingOut")}</>
            ) : (
              <><LogOut className="h-3 w-3" />{t("card.signOut")}</>
            )}
          </button>
          {signOutError && (
            <p className="mt-1.5 text-xs text-destructive">
              {t("card.signOutError", { provider: provider.name })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
