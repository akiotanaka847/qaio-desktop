import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Download, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { QaioLogo } from "../shell/experience-card";

export function LoadingState() {
  const { t } = useTranslation("integrations");
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (barRef.current) barRef.current.style.width = "100%";
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <QaioLogo size={40} className="animate-pulse" />
      <div className="space-y-1.5 text-center">
        <h2 className="text-sm font-semibold text-foreground">
          {t("loading.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("loading.body")}
        </p>
      </div>
      <div className="w-40 h-[2px] rounded-full bg-border overflow-hidden">
        <div
          ref={barRef}
          className="h-full bg-foreground/40 rounded-full"
          style={{ width: "0%", transition: "width 5s linear" }}
        />
      </div>
    </div>
  );
}

export function NotInstalledState({
  onInstall,
  installing,
}: {
  onInstall: () => void;
  installing: boolean;
}) {
  const { t } = useTranslation("integrations");
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Download className="size-5 text-accent" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-sm font-semibold text-foreground">
            {t("notInstalled.title")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("notInstalled.body")}
          </p>
        </div>
        <button
          onClick={onInstall}
          disabled={installing}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors duration-200 disabled:opacity-60"
        >
          {installing ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              {t("notInstalled.installing")}
            </>
          ) : (
            <>
              <Download className="size-3" />
              {t("notInstalled.install")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function NeedsAuthState({ onAuth }: { onAuth: () => void }) {
  const { t } = useTranslation("integrations");
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center">
          <ExternalLink className="size-5 text-accent" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-sm font-semibold text-foreground">
            {t("needsAuth.title")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("needsAuth.body")}
          </p>
        </div>
        <button
          onClick={onAuth}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors duration-200"
        >
          {t("needsAuth.signIn")}
        </button>
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  onReconnect,
}: {
  message: string;
  onRetry: () => void;
  onReconnect: () => void;
}) {
  const { t } = useTranslation("integrations");
  return (
    <div className="rounded-xl border border-destructive/20 bg-card p-6">
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="size-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="size-5 text-destructive" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-sm font-semibold text-foreground">
            {t("error.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors duration-200"
          >
            <RefreshCw className="size-3" />
            {t("error.retry")}
          </button>
          <button
            onClick={onReconnect}
            className="inline-flex items-center gap-1 h-8 px-4 rounded-full border border-border bg-background text-foreground text-xs font-medium hover:bg-secondary transition-colors duration-200"
          >
            {t("error.openDashboard")}
            <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
