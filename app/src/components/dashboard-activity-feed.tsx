import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader, AlertCircle } from "lucide-react";
import { useAllConversations } from "../hooks/queries";
import type { Agent } from "../lib/types";

interface DashboardActivityFeedProps {
  agents: Agent[];
}

interface ActivityEntry {
  id: string;
  title: string;
  agentName: string;
  status: string;
  updatedAt: string;
}

function statusIcon(status: string) {
  if (status === "done" || status === "cancelled") {
    return (
      <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (status === "running" || status === "planning" || status === "implementing") {
    return (
      <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <Loader className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
      <AlertCircle className="w-3.5 h-3.5" />
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function DashboardActivityFeed({ agents }: DashboardActivityFeedProps) {
  const { t } = useTranslation("dashboard");
  const paths = useMemo(() => agents.map((a) => a.folderPath), [agents]);
  const { data: convos } = useAllConversations(paths);

  const recentEntries: ActivityEntry[] = useMemo(() => {
    if (!convos) return [];
    return convos
      .filter((c) => c.type === "activity" && c.updated_at)
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.title,
        agentName: c.agent_name,
        status: c.status ?? "done",
        updatedAt: c.updated_at ?? new Date().toISOString(),
      }));
  }, [convos]);

  const isActive = (s: string) =>
    s === "running" || s === "planning" || s === "implementing";

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-foreground">
          {t("activity.title")}
        </span>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {recentEntries.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            {t("activity.empty")}
          </div>
        ) : (
          recentEntries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-2.5 px-4 py-3 border-b border-border last:border-b-0 ${
                isActive(entry.status) ? "bg-accent/[0.03]" : ""
              }`}
            >
              {isActive(entry.status) && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-2" />
              )}
              {!isActive(entry.status) && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2 opacity-0" />
              )}
              {statusIcon(entry.status)}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/80 leading-snug">
                  <strong className="font-semibold text-foreground">
                    {entry.agentName}
                  </strong>{" "}
                  {entry.title}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                {t("activity.timeAgo", { time: timeAgo(entry.updatedAt) })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
