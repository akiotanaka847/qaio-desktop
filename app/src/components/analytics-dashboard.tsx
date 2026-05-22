import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import { useAgentStore } from "../stores/agents";
import { tauriActivity } from "../lib/tauri";
import { queryKeys } from "../lib/query-keys";
import { resolveAgentColor } from "@qaio-ai/core";
import type { Activity } from "../data/activity";
import { QaioLogo } from "./shell/experience-card";
import { StatCard, HorizontalBar, DonutChart, StatusGrid } from "./analytics-charts";
import {
  RUNNING_STATUSES,
  APPROVAL_STATUSES,
  DONE_STATUSES,
  type AgentStats,
  type StatusKey,
} from "./analytics-constants";

export function AnalyticsDashboard() {
  const { t } = useTranslation("analytics");
  const agents = useAgentStore((s) => s.agents);

  const activityQueries = useQueries({
    queries: agents.map((agent) => ({
      queryKey: queryKeys.activity(agent.folderPath),
      queryFn: () => tauriActivity.list(agent.folderPath),
    })),
  });

  const allItems = useMemo(() => {
    const result: { activity: Activity; agentId: string; agentName: string; agentColor?: string }[] = [];
    for (let i = 0; i < agents.length; i++) {
      const data = activityQueries[i]?.data;
      if (!data) continue;
      const agent = agents[i];
      for (const item of data) {
        result.push({ activity: item, agentId: agent.id, agentName: agent.name, agentColor: agent.color });
      }
    }
    return result;
  }, [agents, activityQueries]);

  const agentStats = useMemo<AgentStats[]>(() => {
    const map = new Map<string, AgentStats>();
    for (const { agentId, agentName, agentColor, activity } of allItems) {
      if (!map.has(agentId)) {
        map.set(agentId, { name: agentName, color: resolveAgentColor(agentColor), total: 0, done: 0, running: 0, needsApproval: 0 });
      }
      const s = map.get(agentId)!;
      s.total++;
      if (DONE_STATUSES.has(activity.status)) s.done++;
      else if (APPROVAL_STATUSES.has(activity.status)) s.needsApproval++;
      else s.running++;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [allItems]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { activity } of allItems) {
      map[activity.status] = (map[activity.status] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [allItems]);

  const statusLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const key of Object.keys(statusCounts.reduce((acc, [k]) => ({ ...acc, [k]: true }), {}))) {
      labels[key] = t(`status.${key as StatusKey}`);
    }
    return labels;
  }, [statusCounts, t]);

  const totalTasks = allItems.length;
  const doneTasks = allItems.filter((i) => DONE_STATUSES.has(i.activity.status)).length;
  const runningTasks = allItems.filter((i) => RUNNING_STATUSES.has(i.activity.status)).length;
  const approvalTasks = allItems.filter((i) => APPROVAL_STATUSES.has(i.activity.status)).length;

  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <QaioLogo size={48} className="mx-auto opacity-20" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <QaioLogo size={24} />
          <div>
            <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("subtitle", { count: agents.length, tasks: totalTasks })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <StatCard label={t("kpi.total")} value={totalTasks} />
          <StatCard label={t("kpi.completed")} value={doneTasks} color="var(--color-success)" />
          <StatCard label={t("kpi.inProgress")} value={runningTasks} color="var(--color-accent)" />
          <StatCard label={t("kpi.pendingReview")} value={approvalTasks} color="var(--color-warning)" />
        </div>

        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 rounded-xl border border-border/60 bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("charts.completionRate")}</h2>
            <DonutChart done={doneTasks} running={runningTasks} pending={approvalTasks} total={totalTasks} noDataLabel={t("charts.noData")} />
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-success" /> {t("legend.done")}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-accent" /> {t("legend.active")}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-warning" /> {t("legend.review")}
              </span>
            </div>
          </div>
          <div className="col-span-3 rounded-xl border border-border/60 bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("charts.byStatus")}</h2>
            <StatusGrid counts={statusCounts} statusLabels={statusLabels} noTasksLabel={t("charts.noTasks")} />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("charts.tasksByAgent")}</h2>
          {agentStats.length > 0 ? (
            <HorizontalBar data={agentStats} />
          ) : (
            <p className="text-xs text-muted-foreground">{t("charts.noTasks")}</p>
          )}
        </div>

        <AnalyticsAgentTable stats={agentStats} />
      </div>
    </div>
  );
}

function AnalyticsAgentTable({ stats }: { stats: AgentStats[] }) {
  const { t } = useTranslation("analytics");

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("charts.agentDetails")}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("table.agent")}</th>
            <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("table.total")}</th>
            <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("table.done")}</th>
            <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("table.active")}</th>
            <th className="text-right py-2 pl-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("table.review")}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((agent) => (
            <tr key={agent.name} className="border-b border-border/20 last:border-0">
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: agent.color }} />
                  <span className="font-medium text-foreground">{agent.name}</span>
                </div>
              </td>
              <td className="text-right py-2.5 px-3 font-bold tabular-nums text-foreground">{agent.total}</td>
              <td className="text-right py-2.5 px-3 tabular-nums text-success font-semibold">{agent.done}</td>
              <td className="text-right py-2.5 px-3 tabular-nums text-accent-foreground font-semibold">{agent.running}</td>
              <td className="text-right py-2.5 pl-3 tabular-nums text-warning font-semibold">{agent.needsApproval}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
