import type { Routine } from "@qaio-ai/routines";
import { cronToPreset, presetSummary, cronToOptions } from "@qaio-ai/routines";

interface ProfileSidebarProps {
  routines: Routine[];
  activityCount: number;
  labels: {
    performance: string;
    totalTasks: string;
    activeRoutines: string;
  };
}

function scheduleSummary(cron: string): string {
  const preset = cronToPreset(cron);
  if (!preset) return cron;
  const options = cronToOptions(cron);
  return presetSummary(preset, {
    time: options.time ?? "09:00",
    dayOfWeek: options.dayOfWeek ?? 1,
    dayOfMonth: options.dayOfMonth ?? 1,
  });
}

export function ProfileSidebar({ routines, activityCount, labels }: ProfileSidebarProps) {
  const activeRoutines = routines.filter((r) => r.enabled);

  return (
    <div className="space-y-5">
      {/* Performance stats */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{labels.performance}</h3>
        <div className="grid grid-cols-2 gap-4">
          <StatBlock value={activityCount} label={labels.totalTasks} />
        </div>
      </div>

      {/* Active routines */}
      {activeRoutines.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{labels.activeRoutines}</h3>
          <div className="space-y-3">
            {activeRoutines.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3">
                <span className="text-sm text-foreground font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {scheduleSummary(r.schedule)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  );
}
