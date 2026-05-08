import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAgentStore } from "../stores/agents";
import { tauriActivity } from "../lib/tauri";
import { queryKeys } from "../lib/query-keys";
import { resolveAgentColor } from "@qaio-ai/core";
import type { Activity } from "../data/activity";
import { QaioLogo } from "./shell/experience-card";

interface AgentStats {
  name: string;
  color: string;
  total: number;
  done: number;
  running: number;
  needsApproval: number;
}

const RUNNING_STATUSES = new Set([
  "running", "planning", "implementing", "testing",
  "review_plan", "review_impl", "requirements",
]);
const APPROVAL_STATUSES = new Set([
  "needs_you", "needs_plan_approval", "needs_impl_approval",
]);
const DONE_STATUSES = new Set(["done", "cancelled"]);

const STATUS_LABELS: Record<string, string> = {
  requirements: "Backlog",
  planning: "Planning",
  review_plan: "Review Plan",
  implementing: "Implementing",
  review_impl: "Review Impl",
  testing: "Testing",
  done: "Done",
  cancelled: "Cancelled",
  running: "In Progress",
  needs_you: "Needs You",
  needs_plan_approval: "Plan Approval",
  needs_impl_approval: "Impl Approval",
};

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function HorizontalBar({ data }: { data: AgentStats[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.map((agent) => (
        <div key={agent.name} className="flex items-center gap-3">
          <div className="w-24 flex items-center gap-2 justify-end">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: agent.color }}
            />
            <span className="text-xs font-medium text-foreground truncate">
              {agent.name}
            </span>
          </div>
          <div className="flex-1 flex h-7 rounded-md overflow-hidden bg-secondary/50">
            {agent.done > 0 && (
              <div
                className="h-full bg-success transition-all duration-700 ease-out"
                style={{ width: `${(agent.done / maxVal) * 100}%` }}
              />
            )}
            {agent.running > 0 && (
              <div
                className="h-full bg-accent transition-all duration-700 ease-out"
                style={{ width: `${(agent.running / maxVal) * 100}%` }}
              />
            )}
            {agent.needsApproval > 0 && (
              <div
                className="h-full bg-warning transition-all duration-700 ease-out"
                style={{ width: `${(agent.needsApproval / maxVal) * 100}%` }}
              />
            )}
          </div>
          <span className="w-8 text-xs font-bold tabular-nums text-foreground text-right">
            {agent.total}
          </span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ done, running, pending, total }: { done: number; running: number; pending: number; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const r = 54;
  const c = 2 * Math.PI * r;
  const doneP = (done / total) * c;
  const runP = (running / total) * c;
  const pendP = (pending / total) * c;

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-secondary" />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke="var(--color-success)" strokeWidth="12"
            strokeDasharray={`${doneP} ${c - doneP}`}
            strokeDashoffset={c / 4}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke="var(--color-accent)" strokeWidth="12"
            strokeDasharray={`${runP} ${c - runP}`}
            strokeDashoffset={c / 4 - doneP}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke="var(--color-warning)" strokeWidth="12"
            strokeDasharray={`${pendP} ${c - pendP}`}
            strokeDashoffset={c / 4 - doneP - runP}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">total</span>
        </div>
      </div>
    </div>
  );
}

function StatusGrid({ counts }: { counts: [string, number][] }) {
  if (counts.length === 0) return <p className="text-xs text-muted-foreground">No tasks yet</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {counts.map(([status, count]) => (
        <div key={status} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
          <span className="text-sm font-bold tabular-nums text-foreground">{count}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard() {
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
        result.push({
          activity: item,
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
        });
      }
    }
    return result;
  }, [agents, activityQueries]);

  const agentStats = useMemo<AgentStats[]>(() => {
    const map = new Map<string, AgentStats>();
    for (const { agentId, agentName, agentColor, activity } of allItems) {
      if (!map.has(agentId)) {
        map.set(agentId, {
          name: agentName,
          color: resolveAgentColor(agentColor),
          total: 0,
          done: 0,
          running: 0,
          needsApproval: 0,
        });
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

  const totalTasks = allItems.length;
  const doneTasks = allItems.filter((i) => DONE_STATUSES.has(i.activity.status)).length;
  const runningTasks = allItems.filter((i) => RUNNING_STATUSES.has(i.activity.status)).length;
  const approvalTasks = allItems.filter((i) => APPROVAL_STATUSES.has(i.activity.status)).length;

  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <QaioLogo size={48} className="mx-auto opacity-20" />
          <p className="text-sm text-muted-foreground">Create an agent to start seeing analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <QaioLogo size={24} />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
            <p className="text-xs text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? "s" : ""} · {totalTasks} task{totalTasks !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total" value={totalTasks} />
          <StatCard label="Completed" value={doneTasks} color="var(--color-success)" />
          <StatCard label="In Progress" value={runningTasks} color="var(--color-accent)" />
          <StatCard label="Pending Review" value={approvalTasks} color="var(--color-warning)" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-5 gap-4">
          {/* Donut */}
          <div className="col-span-2 rounded-xl border border-border/60 bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Completion Rate</h2>
            <DonutChart done={doneTasks} running={runningTasks} pending={approvalTasks} total={totalTasks} />
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-success" /> Done
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-accent" /> Active
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-warning" /> Review
              </span>
            </div>
          </div>

          {/* Status grid */}
          <div className="col-span-3 rounded-xl border border-border/60 bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">By Status</h2>
            <StatusGrid counts={statusCounts} />
          </div>
        </div>

        {/* Bar chart per agent */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Tasks by Agent</h2>
          {agentStats.length > 0 ? (
            <HorizontalBar data={agentStats} />
          ) : (
            <p className="text-xs text-muted-foreground">No tasks yet</p>
          )}
        </div>

        {/* Agent table */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Agent Details</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</th>
                <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Done</th>
                <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active</th>
                <th className="text-right py-2 pl-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Review</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.map((agent) => (
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
      </div>
    </div>
  );
}
