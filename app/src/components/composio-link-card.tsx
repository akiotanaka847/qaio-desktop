import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useComposioApps } from "../hooks/queries";
import { useComposioConnectionWatcher } from "../hooks/use-composio-connection-watcher";
import { useComposioRefetchOnReturn } from "../hooks/use-composio-refetch-on-return";
import {
  normalizeToolkitSlug,
  normalizeToolkitSlugs,
} from "../lib/composio-toolkits";
import { queryKeys } from "../lib/query-keys";
import { useUIStore } from "../stores/ui";

/**
 * After clicking Connect, how long we show the spinner before flipping
 * to a manual "I've connected" button. Short enough that a stuck card
 * recovers quickly; long enough for the typical OAuth round-trip.
 */
const OPENING_GRACE_MS = 6_000;

type Phase = "idle" | "opening" | "verify" | "verifying";

interface ComposioLinkCardProps {
  toolkit: string;
  isConnected: boolean;
  onOpen: () => void;
}

/**
 * Rich inline card rendered in place of plain markdown links when the
 * agent outputs a Composio connect URL tagged with
 * `#qaio_toolkit=<slug>`. Shows the app's logo + name and reflects
 * live connection state.
 */
export function ComposioLinkCard({
  toolkit,
  isConnected,
  onOpen,
}: ComposioLinkCardProps) {
  const { t } = useTranslation("chat");
  const [phase, setPhase] = useState<Phase>("idle");
  const graceTimer = useRef<number | null>(null);
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const { data: apiApps } = useComposioApps();
  const markWaitingForAuth = useComposioRefetchOnReturn();
  useComposioConnectionWatcher(isConnected);

  useEffect(() => {
    if (isConnected) {
      setPhase("idle");
      if (graceTimer.current !== null) {
        window.clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
    }
  }, [isConnected]);

  useEffect(() => {
    return () => {
      if (graceTimer.current !== null) {
        window.clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
    };
  }, []);

  const app = (() => {
    const fromApi = apiApps?.find((a) => a.toolkit === toolkit);
    if (fromApi) {
      return {
        toolkit: fromApi.toolkit,
        name: fromApi.name,
        description: fromApi.description,
        logoUrl: fromApi.logo_url || fallbackLogo(fromApi.toolkit),
      };
    }
    return {
      toolkit,
      name: toolkit,
      description: t("composio.integration"),
      logoUrl: fallbackLogo(toolkit),
    };
  })();

  const handleConnect = useCallback(() => {
    setPhase("opening");
    markWaitingForAuth(toolkit);
    onOpen();
    if (graceTimer.current !== null) window.clearTimeout(graceTimer.current);
    graceTimer.current = window.setTimeout(() => {
      setPhase((p) => (p === "opening" ? "verify" : p));
      graceTimer.current = null;
    }, OPENING_GRACE_MS);
  }, [onOpen, markWaitingForAuth, toolkit]);

  const handleVerify = useCallback(async () => {
    setPhase("verifying");
    await qc.cancelQueries({ queryKey: queryKeys.connectedToolkits() });
    await qc.refetchQueries({
      queryKey: queryKeys.connectedToolkits(),
      type: "active",
    });
    const target = normalizeToolkitSlug(toolkit);
    const fresh = normalizeToolkitSlugs(
      qc.getQueryData<string[]>(queryKeys.connectedToolkits()) ?? [],
    );
    const connected = fresh.includes(target);
    if (connected) {
      addToast({
        title: t("composio.verifiedToast", { name: app.name }),
        variant: "success",
      });
    } else {
      addToast({
        title: t("composio.notVerified"),
        variant: "info",
      });
      setPhase("verify");
    }
  }, [qc, toolkit, addToast, t, app.name]);

  const renderRightSlot = () => {
    if (isConnected) {
      return (
        <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium shrink-0">
          <Check className="size-3" />
          {t("composio.connected")}
        </span>
      );
    }
    if (phase === "opening") {
      return (
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-foreground text-background text-xs font-medium opacity-50 shrink-0"
        >
          <Loader2 className="size-3 animate-spin" />
        </button>
      );
    }
    if (phase === "verify" || phase === "verifying") {
      return (
        <button
          type="button"
          onClick={phase === "verifying" ? undefined : handleVerify}
          disabled={phase === "verifying"}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-border bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors duration-200 disabled:opacity-50 shrink-0"
        >
          {phase === "verifying" ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              {t("composio.verifying")}
            </>
          ) : (
            <>
              <RefreshCw className="size-3" />
              {t("composio.verify")}
            </>
          )}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleConnect}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors duration-200 shrink-0"
      >
        {t("composio.connect")}
        <ExternalLink className="size-3" />
      </button>
    );
  };

  return (
    <span className="not-prose inline-flex my-1 max-w-full align-middle">
      <span className="inline-flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/60 bg-card min-w-0">
        <AppLogo app={app} />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[13px] font-medium text-foreground truncate">
            {app.name}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {isConnected ? t("composio.alreadyConnected") : app.description}
          </span>
        </span>
        {renderRightSlot()}
      </span>
    </span>
  );
}

function AppLogo({ app }: { app: { name: string; logoUrl: string } }) {
  const [imgError, setImgError] = useState(false);
  const initial = app.name.charAt(0).toUpperCase();
  if (imgError) {
    return (
      <span className="size-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">
          {initial}
        </span>
      </span>
    );
  }
  return (
    <img
      src={app.logoUrl}
      alt={app.name}
      className="size-8 rounded-lg object-contain shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

/**
 * Parse a Composio redirect URL for the `#qaio_toolkit=<slug>`
 * fragment that agents append per the system prompt.
 */
export function parseComposioToolkitFromHref(href: string): string | null {
  try {
    const url = new URL(href);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const slug = params.get("qaio_toolkit");
    return slug && slug.length > 0 ? slug : null;
  } catch {
    return null;
  }
}

function fallbackLogo(toolkit: string): string {
  return `https://www.google.com/s2/favicons?domain=${toolkit}.com&sz=128`;
}
