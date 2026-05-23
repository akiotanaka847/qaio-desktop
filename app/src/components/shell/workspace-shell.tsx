import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  ToastContainer,
  cn,
  type Toast,
} from "@qaio-ai/core";
import { TabBar } from "@qaio-ai/layout";
import { useActivity } from "../../hooks/queries";
import { useAgentCatalogStore } from "../../stores/agent-catalog";
import { useAgentStore } from "../../stores/agents";
import { useUIStore } from "../../stores/ui";
import { AgentRenderer } from "./experience-renderer";
import { Dashboard } from "../dashboard";
import { IntegrationsView } from "../tabs/integrations-view";
import { SettingsView } from "../settings/settings-view";
import { AnalyticsDashboard } from "../analytics-dashboard";
import { Sidebar } from "./sidebar";
import { CreateAgentDialog } from "./create-workspace-dialog";
import { AgentUpdateBanner } from "./agent-update-banner";
import { DetailPanelProvider } from "./detail-panel-context";
import { TabBarActions } from "./tab-bar-actions";
import { UiTour } from "./ui-tour";
import { useUiTourSteps } from "./use-ui-tour-steps";
import { useKeyboardShortcuts } from "../../hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsDialog } from "../keyboard-shortcuts-dialog";

interface WorkspaceShellProps {
  toasts: Toast[];
  onDismissToast: (id: string) => void;
}

export function WorkspaceShell({ toasts, onDismissToast }: WorkspaceShellProps) {
  const { t } = useTranslation(["agents", "shell", "board"]);
  const currentAgent = useAgentStore((s) => s.current);
  const getById = useAgentCatalogStore((s) => s.getById);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const missionPanelOpen = useUIStore((s) => s.missionPanelOpen);
  const setCreateAgentDialogOpen = useUIStore((s) => s.setCreateAgentDialogOpen);
  const uiTourActive = useUIStore((s) => s.uiTourActive);
  const setUiTourActive = useUIStore((s) => s.setUiTourActive);
  const [panelContainer, setPanelContainer] = useState<HTMLDivElement | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useKeyboardShortcuts(showShortcuts);
  const agentDef = currentAgent ? getById(currentAgent.configId) : undefined;
  const tabs = agentDef?.config.tabs ?? [];
  const hasActivityTab = tabs.some((tab) => tab.id === "activity");
  const { data: activities } = useActivity(currentAgent?.folderPath);
  const needsYouCount = (activities ?? []).filter((a) => a.status === "needs_you").length;
  const isAgentView =
    viewMode !== "dashboard" && viewMode !== "analytics" && viewMode !== "connections" && viewMode !== "settings";
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const firstAgentTab = agentDef?.config.defaultTab ?? tabs[0]?.id ?? "activity";
  // Map a desired tab id to one this agent actually has, falling back to its
  // default. Keeps the tour from spotlighting an absent tab on agents that
  // don't expose every built-in.
  const tabOr = (id: string) => (tabIds.has(id) ? id : firstAgentTab);
  const tourSteps = useUiTourSteps(firstAgentTab, tabOr);

  useEffect(() => {
    if (isAgentView && tabs.length > 0 && !tabs.some((tab) => tab.id === viewMode)) {
      setViewMode(agentDef?.config.defaultTab ?? tabs[0].id);
    }
  }, [agentDef, isAgentView, setViewMode, tabs, viewMode]);

  return (
    <DetailPanelProvider value={panelContainer}>
      <div
        className={cn(
          "flex h-screen bg-background text-foreground",
          uiTourActive && "pointer-events-none [&_*]:select-none",
        )}
      >
        <Sidebar>
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <main
              data-tour-target="main"
              className="flex min-w-0 flex-1 flex-col overflow-hidden"
            >
              {viewMode === "dashboard" ? (
                <Dashboard />
              ) : viewMode === "analytics" ? (
                <AnalyticsDashboard />
              ) : viewMode === "connections" ? (
                <IntegrationsView title={t("shell:sidebar.integrations")} />
              ) : viewMode === "settings" ? (
                <SettingsView />
              ) : currentAgent && agentDef && tabs.length > 0 && isAgentView ? (
                <>
                  <div data-tour-target="tabs">
                  <TabBar
                    title={currentAgent.name}
                    tabs={tabs.map((tab) => ({
                      id: tab.id,
                      label: t(`agents:tabLabels.${tab.id}`, { defaultValue: tab.label }),
                      badge: tab.badge === "activity" ? needsYouCount : undefined,
                      disabled: tab.disabled,
                      chip: tab.chip,
                    }))}
                    activeTab={viewMode}
                    onTabChange={setViewMode}
                    actions={
                      <TabBarActions agent={currentAgent} hasActivityTab={hasActivityTab} />
                    }
                  />
                  </div>
                  <main className="min-h-0 flex-1 overflow-hidden">
                    <AgentRenderer
                      agentDef={agentDef}
                      agent={currentAgent}
                      tabs={tabs}
                      activeTabId={viewMode}
                    />
                  </main>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyTitle>{t("agents:empty.title")}</EmptyTitle>
                      <EmptyDescription>{t("agents:empty.description")}</EmptyDescription>
                    </EmptyHeader>
                    <Button
                      className="mt-4 rounded-full"
                      onClick={() => setCreateAgentDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      {t("shell:newAgent.dialogTitle")}
                    </Button>
                  </Empty>
                </div>
              )}
            </main>
            {missionPanelOpen && (
              <div
                ref={setPanelContainer}
                className="h-full overflow-hidden border-l border-border"
                style={{ width: "45%", minWidth: 380 }}
              />
            )}
          </div>
        </Sidebar>
        <CreateAgentDialog />
        <AgentUpdateBanner />
        <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
      </div>
      {uiTourActive && (
        <UiTour
          steps={tourSteps}
          onDismiss={() => {
            setUiTourActive(false);
            setCreateAgentDialogOpen(false);
          }}
        />
      )}
    </DetailPanelProvider>
  );
}
