import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button, Spinner } from "@qaio-ai/core";
import { useUIStore } from "../../stores/ui";
import { tauriProvider } from "../../lib/tauri";
import { getProvider } from "../../lib/providers";
import { ProviderLogo } from "./provider-logos";

export function AuthReconnectBanner() {
  const { t } = useTranslation(["shell", "common"]);
  const authRequired = useUIStore((s) => s.authRequired);
  const setAuthRequired = useUIStore((s) => s.setAuthRequired);
  const [loginLaunched, setLoginLaunched] = useState(false);

  const provider = authRequired ? getProvider(authRequired) : null;

  // Auto-poll to detect when re-auth succeeds
  useEffect(() => {
    if (!authRequired) return;
    const interval = setInterval(async () => {
      try {
        const status = await tauriProvider.checkStatus(authRequired);
        if (status.cli_installed && status.authenticated) {
          setAuthRequired(null);
          setLoginLaunched(false);
        }
      } catch {
        // ignore check failures
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [authRequired, setAuthRequired]);

  const handleSignIn = useCallback(async () => {
    if (!authRequired) return;
    try {
      await tauriProvider.launchLogin(authRequired);
      setLoginLaunched(true);
    } catch {
      // CLI not available — shouldn't happen if we got here
    }
  }, [authRequired]);

  if (!authRequired || !provider) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-r from-secondary via-white to-secondary p-5">
        {/* Subtle gradient accent line at top */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

        <div className="flex items-start gap-4">
          {/* Provider logo */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <ProviderLogo providerId={authRequired} className="h-7 w-7" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-sm font-semibold text-foreground">
                {t("shell:authReconnect.heading")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("shell:authReconnect.body", { provider: provider.name })}
            </p>

            {!loginLaunched ? (
              <Button
                onClick={handleSignIn}
                className="rounded-full"
                size="sm"
              >
                {t("shell:authReconnect.signInWith", { provider: provider.name })}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" />
                  <span>{t("shell:authReconnect.waiting")}</span>
                </div>
                <button
                  onClick={handleSignIn}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {t("common:actions.tryAgain")}
                </button>
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={() => setAuthRequired(null)}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("common:actions.dismiss")}
          >
            {t("common:actions.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
