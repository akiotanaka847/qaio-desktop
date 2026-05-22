import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleDashed, ExternalLink, Terminal } from "lucide-react";
import { Spinner, Button } from "@qaio-ai/core";
import { tauriProvider, tauriSystem, type ProviderStatus } from "../../lib/tauri";
import type { ProviderInfo } from "../../lib/providers";

interface SetupGuidanceProps {
  provider: ProviderInfo;
  status: ProviderStatus | undefined;
  isSelected: boolean;
  onRefresh: () => void;
}

export function SetupGuidance({ provider, status, isSelected, onRefresh }: SetupGuidanceProps) {
  const { t } = useTranslation("providers");
  const installed = status?.cli_installed ?? false;
  const authenticated = status?.authenticated ?? false;
  const [loginLaunched, setLoginLaunched] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoginError(null);
    try {
      await tauriProvider.launchLogin(provider.id);
      setLoginLaunched(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[provider-picker] launchLogin(${provider.id}) failed:`, msg);
      setLoginError(msg);
    }
  };

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

      {installed && !authenticated && !loginLaunched && (
        <Button onClick={handleSignIn} className="rounded-full" size="sm">
          {t("setup.signInWith", { provider: provider.name })}
        </Button>
      )}

      {installed && !authenticated && loginLaunched && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" />
            <span>{t("setup.waiting")}</span>
          </div>
          <button onClick={handleSignIn}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
            {t("setup.openBrowserAgain")}
          </button>
        </div>
      )}

      {loginError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
          <div className="font-medium mb-0.5">{t("setup.launchErrorTitle", { cli: provider.cliName })}</div>
          <div className="text-destructive/80">{loginError}</div>
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
