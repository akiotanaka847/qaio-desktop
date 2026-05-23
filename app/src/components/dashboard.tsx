import { useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  Button,
} from "@qaio-ai/core";
import { Plus } from "lucide-react";
import { useAgentStore } from "../stores/agents";
import { useAgentCatalogStore } from "../stores/agent-catalog";
import { useUIStore } from "../stores/ui";
import { useAgentActivitySummaries } from "./shell/use-agent-activity-summaries";
import { useAllConversations } from "../hooks/queries";
import { DashboardHero } from "./dashboard-hero";
import { DashboardStats } from "./dashboard-stats";
import { DashboardTeamStrip } from "./dashboard-team-strip";
import { DashboardActivityFeed } from "./dashboard-activity-feed";
import { AgentPickerDialog } from "./agent-picker-dialog";
import type { Agent } from "../lib/types";

export function Dashboard() {
  const { t } = useTranslation("dashboard");
  const agents = useAgentStore((s) => s.agents);
  const setCurrentAgent = useAgentStore((s) => s.setCurrent);
  const getById = useAgentCatalogStore((s) => s.getById);
  const setDialogOpen = useUIStore((s) => s.setCreateAgentDialogOpen);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const summaries = useAgentActivitySummaries(agents);

  const paths = useMemo(() => agents.map((a) => a.folderPath), [agents]);
  const { data: convos } = useAllConversations(paths);

  const counts = useMemo(() => {
    if (!convos) return { pending: 0, running: 0, completed: 0, needsYou: 0 };
    let pending = 0;
    let running = 0;
    let completed = 0;
    let needsYou = 0;
    for (const c of convos) {
      if (c.type !== "activity" || !c.status) continue;
      if (c.status === "done" || c.status === "cancelled") completed++;
      else if (c.status === "running" || c.status === "planning" || c.status === "implementing") running++;
      else if (c.status === "needs_you" || c.status === "needs_plan_approval" || c.status === "needs_impl_approval") needsYou++;
      else pending++;
    }
    pending += running + needsYou;
    return { pending, running, completed, needsYou };
  }, [convos]);

  const runningAgents = useMemo(() => {
    let count = 0;
    for (const s of Object.values(summaries)) {
      if (s.runningCount > 0) count++;
    }
    return count;
  }, [summaries]);

  const handleAgentClick = useCallback(
    (agent: Agent) => {
      setCurrentAgent(agent);
      const def = getById(agent.configId);
      const tab = def?.config.defaultTab ?? "chat";
      setViewMode(tab);
    },
    [setCurrentAgent, getById, setViewMode],
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyTitle>{t("noAgents.title")}</EmptyTitle>
            <EmptyDescription>{t("noAgents.description")}</EmptyDescription>
          </EmptyHeader>
          <Button className="mt-4 rounded-full" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("noAgents.cta")}
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 flex flex-col gap-5 max-w-[1200px]">
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
          <DashboardHero
            pendingCount={counts.pending}
            runningAgents={runningAgents}
            onNewTask={() => setPickerOpen(true)}
          />
          <DashboardStats
            completed={counts.completed}
            inProgress={counts.running}
            needsYou={counts.needsYou}
            agentCount={agents.length}
          />
        </div>
        <DashboardTeamStrip
          agents={agents}
          summaries={summaries}
          onAgentClick={handleAgentClick}
        />
        <DashboardActivityFeed agents={agents} />
      </div>
      <AgentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        agents={agents}
        onPick={(agent) => {
          setPickerOpen(false);
          handleAgentClick(agent);
        }}
      />
    </div>
  );
}
