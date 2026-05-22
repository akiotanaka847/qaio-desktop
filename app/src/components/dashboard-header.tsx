import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity, AlertCircle, CheckCircle2, Loader, Users } from "lucide-react";
import type { Agent } from "../lib/types";
import type { AgentActivitySummary } from "./shell/agent-activity-summary-model";

interface DashboardHeaderProps {
  agents: Agent[];
  summaries: Record<string, AgentActivitySummary>;
  totalItems: number;
  doneItems: number;
}

function getGreetingKey(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function DashboardHeader({
  agents,
  summaries,
  totalItems,
  doneItems,
}: DashboardHeaderProps) {
  const { t } = useTranslation("dashboard");
  const greetingKey = useMemo(getGreetingKey, []);

  const { running, needsYou } = useMemo(() => {
    let running = 0;
    let needsYou = 0;
    for (const s of Object.values(summaries)) {
      running += s.runningCount;
      needsYou += s.needsYouCount;
    }
    return { running, needsYou };
  }, [summaries]);

  const active = totalItems - doneItems;

  return (
    <div className="shrink-0 px-5 pt-5 pb-2">
      <h1 className="text-2xl font-semibold text-foreground tracking-tight">
        {t(`greeting.${greetingKey}`)}
      </h1>

      <div className="mt-3 flex items-center gap-6">
        <StatPill
          icon={<Activity className="size-3.5" />}
          value={active}
          label={t("stats.activeTasksLabel")}
          accent={active > 0}
        />
        <StatPill
          icon={<Loader className="size-3.5" />}
          value={running}
          label={t("stats.runningLabel")}
          accent={running > 0}
        />
        <StatPill
          icon={<AlertCircle className="size-3.5" />}
          value={needsYou}
          label={t("stats.needsYouLabel")}
          accent={needsYou > 0}
          warn
        />
        <StatPill
          icon={<Users className="size-3.5" />}
          value={agents.length}
          label={t("stats.agentsLabel")}
        />
        <StatPill
          icon={<CheckCircle2 className="size-3.5" />}
          value={doneItems}
          label={t("stats.completedLabel")}
        />
      </div>
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const color = warn && accent
    ? "text-warning"
    : accent
      ? "text-accent"
      : "text-muted-foreground";

  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
