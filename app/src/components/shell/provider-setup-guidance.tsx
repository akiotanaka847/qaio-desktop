import { useTranslation } from "react-i18next";
import { Check, CircleDashed, ExternalLink, Terminal, X } from "lucide-react";
import { Spinner, Button } from "@qaio-ai/core";
import { tauriSystem, type ProviderStatus } from "../../lib/tauri";
import type { ProviderInfo } from "../../lib/providers";

interface SetupGuidanceProps {
  provider: ProviderInfo;
  status: ProviderStatus | undefined;
  isSelected: boolean;
  loginPending: boolean;
  onRefresh: () => void;
  onLaunchLogin: () => void;
  onCancel: () => void;
}

export function SetupGuidance({
  provider, status, isSelected, loginPending,
  onRefresh, onLaunchLogin, onCancel,
}: SetupGuidanceProps) {
  const { t } = useTranslation("providers");
  const installed = status?.cli_installed ?? false;
  const authenticated = status?.authenticated ?? false;

  return (
    <div className="rounded-xl border border-black/[0.08] bg-secondary/50 p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{t("setup.headline", { provider: provider.name })}</p>

      <div className="space-y-2">
        <StatusRow ok={installed} okLabel={t("setup.cliInstalled", { cli: provider.cliName })} notOkLabel={t("setup.cliNotFound", { cli: provider.cliName })} />
        <StatusRow ok={authenticated} okLabel={t("setup.signedIn")} notOkLabel={t("setup.notSignedIn")} />
      </div>

      {!installed && (
        <div className="flex items-start gap-2 text-sm">
          <Terminal className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-muted-foreground">
            {t("setup.installHint", { cli: provider.cliName })}{" "}
            <button onClick={() => tauriSystem.openUrl(provider.installUrl)}
              className="text-foreground underline underline-offset-2 font-medium">
              {t("setup.installGuide")}
              <ExternalLink className="inline h-3 w-3 ml-0.5 -mt-0.5" />
            </button>
          </div>
        </div>
      )}

      {installed && !authenticated && !loginPending && (
        <Button onClick={onLaunchLogin} className="rounded-full" size="sm">
          {t("setup.signInWith", { provider: provider.name })}
        </Button>
      )}

      {installed && !authenticated && loginPending && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" />
            <span>{t("setup.waiting")}</span>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              {t("card.cancel")}
            </button>
          </div>
          <button onClick={onLaunchLogin}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
            {t("setup.openBrowserAgain")}
          </button>
        </div>
      )}

      {!installed && (
        <button onClick={onRefresh}
          className="inline-flex items-center gap-1 h-7 px-3 rounded-full border border-border bg-background text-foreground text-xs font-medium hover:bg-secondary transition-colors">
          {t("setup.installedCheckAgain")}
        </button>
      )}

      {isSelected && (
        <p className="text-xs text-muted-foreground">{t("setup.canContinueHint")}</p>
      )}
    </div>
  );
}

function StatusRow({ ok, okLabel, notOkLabel }: { ok: boolean; okLabel: string; notOkLabel: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-3.5 w-3.5 text-success shrink-0" />
      ) : (
        <CircleDashed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {ok ? okLabel : notOkLabel}
      </span>
    </div>
  );
}
