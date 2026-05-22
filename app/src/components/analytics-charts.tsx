interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

export function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

interface AgentBarData {
  name: string;
  color: string;
  total: number;
  done: number;
  running: number;
  needsApproval: number;
}

export function HorizontalBar({ data }: { data: AgentBarData[] }) {
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

interface DonutChartProps {
  done: number;
  running: number;
  pending: number;
  total: number;
  noDataLabel: string;
}

export function DonutChart({ done, running, pending, total, noDataLabel }: DonutChartProps) {
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs text-muted-foreground">{noDataLabel}</p>
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

interface StatusGridProps {
  counts: [string, number][];
  statusLabels: Record<string, string>;
  noTasksLabel: string;
}

export function StatusGrid({ counts, statusLabels, noTasksLabel }: StatusGridProps) {
  if (counts.length === 0) return <p className="text-xs text-muted-foreground">{noTasksLabel}</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {counts.map(([status, count]) => (
        <div key={status} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">{statusLabels[status] ?? status}</span>
          <span className="text-sm font-bold tabular-nums text-foreground">{count}</span>
        </div>
      ))}
    </div>
  );
}
