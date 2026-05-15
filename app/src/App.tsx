import "./styles/globals.css";
import type { Toast } from "@qaio-ai/core";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { tauriSystem, tauriWorkspaces } from "./lib/tauri";
import { useQaioInit } from "./hooks/use-qaio-init";
import { useSessionEvents } from "./hooks/use-session-events";
import { useAgentInvalidation } from "./hooks/use-agent-invalidation";
import { useAnalyticsSubscriber } from "./hooks/use-analytics-subscriber";
import { useWorkspaceStore } from "./stores/workspaces";
import { useAgentStore } from "./stores/agents";
import { useUIStore } from "./stores/ui";
import { useConnections, useComposioApps } from "./hooks/queries";
import { analytics } from "./lib/analytics";
import { loadTheme } from "./lib/theme";
import { isAuthConfigured } from "./lib/supabase";
import { installDeepLinkListener } from "./lib/auth";
import { useSession } from "./hooks/use-session";
import { SignInScreen } from "./components/auth/sign-in-screen";
import { WorkspaceShell } from "./components/shell/workspace-shell";
import {
  createPersonalAssistantForWorkspace,
} from "./components/onboarding/create-personal-assistant";
import { SetupTutorial } from "./components/onboarding/setup-tutorial";
import {
  buildAssistantInstructions,
  defaultAssistantSetup,
} from "./components/onboarding/personal-assistant-artifacts";
import { shouldAllowNativeContextMenu } from "./lib/context-menu";

export default function App() {
  useQaioInit();
  useSessionEvents();
  useAgentInvalidation();
  useAnalyticsSubscriber();
  // Prefetch Composio data on launch so the integrations tab opens instantly.
  useConnections();
  useComposioApps();

  // Track active installs once per day. This is the canonical DAU/WAU/MAU
  // signal; launch counts are intentionally not captured.
  useEffect(() => {
    analytics.init().then(({ isNew }) => {
      analytics.trackActive();
      if (isNew) analytics.track("install_created");
    });
    loadTheme();
  }, []);

  // Supabase auth (PR 2): listen for Google OAuth deep-link callbacks.
  // No-op when auth isn't configured (SUPABASE_URL empty in local dev).
  useEffect(() => {
    if (!isAuthConfigured()) return;
    return installDeepLinkListener();
  }, []);

  const { data: session, isLoading: sessionLoading } = useSession();

  // Identify / alias the user in PostHog on sign-in; reset on sign-out.
  // Runs AFTER analytics.init() has claimed the install_id as distinct_id,
  // so `alias(userId, profile)` correctly merges prior anonymous history.
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    const userEmail = session?.user?.email ?? null;
    if (userId && userId !== prevUserIdRef.current) {
      analytics.alias(userId, { email: userEmail });
      prevUserIdRef.current = userId;
    } else if (!userId && prevUserIdRef.current) {
      analytics.reset();
      prevUserIdRef.current = null;
    }
  }, [session]);

  // Intercept all link clicks and open in system browser
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      e.preventDefault();
      tauriSystem.openUrl(href);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Suppress the native WebView context menu (Reload / Back / Forward) in
  // production builds — it's a developer affordance that shouldn't be exposed
  // to end users. Left enabled in dev so Inspect Element still works.
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const handler = (e: MouseEvent) => {
      if (shouldAllowNativeContextMenu(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  const { t } = useTranslation(["shell", "setup"]);
  const wsLoading = useWorkspaceStore((s) => s.loading);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const agentLoading = useAgentStore((s) => s.loading);
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  const mappedToasts: Toast[] = toasts.map((t) => ({
    id: t.id,
    message: t.description ? `${t.title} ${t.description}` : t.title,
    variant: t.variant ?? "info",
    action: t.action,
  }));

  const needsSetup = !wsLoading && !agentLoading && workspaces.length === 0;

  const handleSetupComplete = async (opts: {
    name: string;
    color: string;
    provider: string;
    model: string;
  }) => {
    const setup = defaultAssistantSetup({
      workspaceName: t("setup:tutorial.defaults.workspaceName"),
      assistantName: opts.name,
      focus: t("setup:tutorial.defaults.focus"),
      approvalRule: t("setup:tutorial.defaults.approvalRule"),
    });
    setup.color = opts.color;
    const ws = await tauriWorkspaces.create(
      setup.workspaceName.trim(),
      opts.provider,
      opts.model,
    );
    analytics.track("workspace_created", { provider: opts.provider, source: "setup-tutorial" });
    const agent = await createPersonalAssistantForWorkspace(ws.id, {
      name: setup.assistantName.trim(),
      instructions: buildAssistantInstructions(setup, t("setup:tutorial.defaults.firstWorkflow")),
      color: setup.color,
      provider: opts.provider,
      model: opts.model,
    });
    await useWorkspaceStore.getState().loadWorkspaces();
    useWorkspaceStore.getState().setCurrent(ws);
    await useAgentStore.getState().loadAgents(ws.id);
    const refreshed =
      useAgentStore.getState().agents.find((a) => a.id === agent.id) ?? agent;
    useAgentStore.getState().setCurrent(refreshed);
  };

  if (isAuthConfigured() && sessionLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground text-sm">{t("shell:engineGate.starting")}</p>
      </div>
    );
  }
  if (isAuthConfigured() && !session) {
    return <SignInScreen />;
  }

  if (agentLoading || wsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground text-sm">{t("shell:engineGate.starting")}</p>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupTutorial onComplete={handleSetupComplete} />;
  }

  return (
    <WorkspaceShell
      toasts={mappedToasts}
      onDismissToast={dismissToast}
    />
  );
}
