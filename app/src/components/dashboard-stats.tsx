import { useTranslation } from "react-i18next";

interface DashboardStatsProps {
  completed: number;
  inProgress: number;
  needsYou: number;
  agentCount: number;
}

function StatBox({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="text-center p-2.5 bg-background rounded-lg">
      <div className={`text-2xl font-extrabold tracking-tighter ${color}`}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}

export function DashboardStats({
  completed,
  inProgress,
  needsYou,
  agentCount,
}: DashboardStatsProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {t("weekly.title")}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <StatBox
          value={completed}
          label={t("weekly.completed")}
          color="text-accent"
        />
        <StatBox
          value={inProgress}
          label={t("weekly.inProgress")}
          color="text-foreground"
        />
        <StatBox
          value={needsYou}
          label={t("weekly.needsYou")}
          color="text-warning"
        />
        <StatBox
          value={agentCount}
          label={t("weekly.agents")}
          color="text-muted-foreground"
        />
      </div>
    </div>
  );
}
