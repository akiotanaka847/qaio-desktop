import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@qaio-ai/core";

interface DashboardHeroProps {
  pendingCount: number;
  runningAgents: number;
  onNewTask: () => void;
}

function getGreetingKey(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatDate(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(): string {
  const now = new Date();
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function DashboardHero({
  pendingCount,
  runningAgents,
  onNewTask,
}: DashboardHeroProps) {
  const { t, i18n } = useTranslation("dashboard");
  const greetingKey = useMemo(getGreetingKey, []);
  const dateStr = useMemo(() => formatDate(i18n.language), [i18n.language]);
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  const tasksStr = t("hero.pendingTasks", { count: pendingCount });
  const agentsStr = t("hero.agentsWorking", { count: runningAgents });

  return (
    <div className="bg-card rounded-2xl p-7 border border-border flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {t(`greeting.${greetingKey}`)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-[380px] leading-relaxed">
          <Trans
            i18nKey="hero.summary"
            ns="dashboard"
            values={{ tasks: tasksStr, agents: agentsStr }}
            components={{ strong: <strong className="text-accent font-semibold" /> }}
          />
        </p>
        <Button
          className="mt-4 rounded-xl bg-primary text-primary-foreground"
          onClick={onNewTask}
        >
          <Plus className="h-4 w-4" />
          {t("hero.newTask")}
        </Button>
      </div>
      <div className="text-right shrink-0 ml-6">
        <div className="text-sm text-muted-foreground capitalize">{dateStr}</div>
        <div className="text-4xl font-extrabold text-foreground tracking-tighter mt-0.5">
          {time}
        </div>
      </div>
    </div>
  );
}
