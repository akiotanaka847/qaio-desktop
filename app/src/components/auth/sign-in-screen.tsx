import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@qaio-ai/core";
import { QaioLogo } from "../shell/experience-card";
import { onAuthError, signInWithGoogle } from "../../lib/auth";
import { logger } from "../../lib/logger";

// Microsoft sign-in is temporarily disabled in the UI while the Azure
// App Registration + Supabase azure-provider settings are sorted out.
// The handler in `auth.ts` (`signInWithMicrosoft`) stays exported so
// re-enabling is a one-line revert here.
type Provider = "google";

/**
 * Full-screen sign-in overlay. Rendered by App.tsx when Supabase is
 * configured but no session is present. Keeps copy product-benefit-focused
 * — the audience is non-technical, so no mention of OAuth / tokens / APIs.
 *
 * Re-click semantics: the loading spinner is only on while the system
 * browser is being opened (a few ms). After that, the user is free to
 * click any provider again — useful when they land on the wrong browser
 * profile and need to retry. The PKCE flow is regenerated each click.
 */
export function SignInScreen() {
  const { t } = useTranslation("auth");
  const [pending, setPending] = useState<Provider | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Surface OAuth errors that happen AFTER the browser hands off (provider
  // rejection, code-exchange failure, identity already linked to another
  // user). Without this the user only saw the "kick off" failure path and
  // every post-callback failure was invisible.
  useEffect(() => {
    return onAuthError((message) => {
      setPending(null);
      setErrorKey(resolveAuthErrorKey(message));
    });
  }, []);

  const handleSignIn = (provider: Provider) => async () => {
    setPending(provider);
    setErrorKey(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      logger.error(`[auth] ${provider} sign-in failed: ${e}`);
      setErrorKey(resolveAuthErrorKey(String(e)));
    } finally {
      // Re-enable the button immediately once the browser is open. The
      // SignInScreen itself unmounts when the deep-link callback flips the
      // session, so we don't need a "waiting for callback" loading state.
      setPending(null);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <QaioLogo size={48} />
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{t("welcome.title")}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("welcome.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Button
            onClick={handleSignIn("google")}
            disabled={pending !== null}
            className="w-full rounded-full h-11 flex items-center justify-center gap-2"
          >
            <GoogleIcon />
            {pending === "google" ? t("google.pending") : t("google.label")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t("retryHint")}
        </p>

        {errorKey && (
          <p className="text-xs text-destructive text-center">
            {errorKey.startsWith("fallback:")
              ? t("errors.fallback", { detail: errorKey.slice(9, 229) })
              : t(`errors.${errorKey}` as "errors.identityConflict")}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Map raw provider / Supabase error strings to an i18n-resolved message.
 * Uses the `auth:errors.*` namespace keys. Falls back to showing a
 * trimmed version of the raw error so the user has something to copy.
 */
function resolveAuthErrorKey(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("identity") && msg.includes("already")) return "identityConflict";
  if (msg.includes("aadsts50020") || msg.includes("does not exist in tenant")) return "tenantMismatch";
  if (msg.includes("aadsts700016") || msg.includes("application with identifier")) return "appNotConfigured";
  if (msg.includes("aadsts65001") || msg.includes("consent")) return "adminConsent";
  if (msg.includes("redirect") && msg.includes("invalid")) return "redirectInvalid";
  if (msg.includes("provider") && msg.includes("not enabled")) return "providerDisabled";
  if (msg.includes("authorization code")) return "codeExchange";
  return `fallback:${raw}`;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

