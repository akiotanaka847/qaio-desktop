import { useTranslation } from "react-i18next";
import { QaioAvatar, resolveAgentColor } from "@qaio-ai/core";
import type { Agent } from "../lib/types";
import type { AgentActivitySummary } from "./shell/agent-activity-summary-model";

interface DashboardTeamStripProps {
  agents: Agent[];
  summaries: Record<string, AgentActivitySummary>;
  onAgentClick: (agent: Agent) => void;
}

export function DashboardTeamStrip({
  agents,
  summaries,
  onAgentClick,
}: DashboardTeamStripProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-foreground">
          {t("team.title")}
        </span>
      </div>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(agents.length, 4)}, 1fr)`,
        }}
      >
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            summary={summaries[agent.id]}
            onClick={() => onAgentClick(agent)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  summary,
  onClick,
}: {
  agent: Agent;
  summary: AgentActivitySummary | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const isWorking = (summary?.runningCount ?? 0) > 0;
  const color = resolveAgentColor(agent.color);
  const pending = summary?.needsYouCount ?? 0;
  const running = summary?.runningCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden bg-card rounded-xl p-4 border border-border
        text-left transition-all hover:border-accent/20 hover:shadow-sm cursor-pointer"
    >
      {isWorking && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px] bg-accent"
          style={{
            animation: "dashboard-progress 2s ease-in-out infinite",
          }}
        />
      )}
      <div className="flex items-center gap-2 mb-2.5">
        <QaioAvatar
          color={color}
          diameter={32}
          running={isWorking}
        />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">
            {agent.name}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="w-[5px] h-[5px] rounded-full shrink-0"
              style={{
                backgroundColor: isWorking
                  ? "var(--qaio-accent, #4CAF7D)"
                  : "var(--qaio-muted-fg, #C8D3DF)",
              }}
            />
            <span
              className={`text-[10px] ${isWorking ? "text-accent" : "text-muted-foreground"}`}
            >
              {isWorking ? t("team.working") : t("team.idle")}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <div>
          <div className="text-[15px] font-bold text-foreground">{pending}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {t("team.pending")}
          </div>
        </div>
        <div>
          <div className="text-[15px] font-bold text-foreground">{running}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {t("team.today")}
          </div>
        </div>
      </div>
    </button>
  );
}
