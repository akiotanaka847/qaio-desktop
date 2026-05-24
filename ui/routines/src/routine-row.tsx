/**
 * RoutineRow — a card in the 2-column routines grid.
 *
 * Shows name, schedule, description, toggle, execution stats, and next run.
 */
import { cn, Switch } from "@qaio-ai/core"
import type { Routine, RoutineRun } from "./types"
import { cronToPreset, presetSummary, cronToOptions } from "./schedule-cron-utils"
import { nextFire, describeNextFire } from "./next-fire"
import { useNow } from "./use-now"

/**
 * Optional translated labels. English defaults so existing callers still
 * work. Consumers pass `t()` results for localization.
 */
export interface RoutineRowLabels {
  last?: string
  runs?: string
  next?: string
  disabled?: string
}

const DEFAULT_ROW_LABELS: Required<RoutineRowLabels> = {
  last: "Last",
  runs: "Runs",
  next: "Next",
  disabled: "Disabled",
}

export interface RoutineRowProps {
  routine: Routine
  lastRun?: RoutineRun
  runCount?: number
  /** IANA tz of the user's account preference, used when routine has no override. */
  accountTimezone: string
  onClick?: () => void
  onToggle?: (enabled: boolean) => void
  labels?: RoutineRowLabels
}

function scheduleSummary(cron: string): string {
  const preset = cronToPreset(cron)
  if (!preset) return cron
  const options = cronToOptions(cron)
  return presetSummary(preset, {
    time: options.time ?? "09:00",
    dayOfWeek: options.dayOfWeek ?? 1,
    dayOfMonth: options.dayOfMonth ?? 1,
  })
}

function lastRunLabel(lastRun: RoutineRun | undefined, now: Date): string | null {
  if (!lastRun) return null
  const date = new Date(lastRun.started_at)
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString([], { day: "numeric", month: "short" })
}

export function RoutineRow({
  routine,
  lastRun,
  runCount = 0,
  accountTimezone,
  onClick,
  onToggle,
  labels,
}: RoutineRowProps) {
  const rl = { ...DEFAULT_ROW_LABELS, ...labels }
  const now = useNow(60_000)
  const tz = routine.timezone ?? accountTimezone
  const next = routine.enabled ? nextFire(routine.schedule, tz, now) : null
  const nextDescr = next ? describeNextFire(next, tz, now) : null
  const lastLabel = lastRunLabel(lastRun, now)

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        "group relative rounded-xl border border-border/60 bg-card p-4 cursor-pointer",
        "transition-all duration-200",
        "hover:shadow-[0_4px_12px_rgba(27,42,74,0.08)] hover:border-border",
        !routine.enabled && "opacity-55",
      )}
    >
      {/* Header: title + toggle */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {routine.name || "Untitled"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scheduleSummary(routine.schedule)}
          </p>
        </div>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
            <Switch
              checked={routine.enabled}
              onCheckedChange={(checked) => onToggle(checked)}
              aria-label={routine.enabled ? "Pause routine" : "Resume routine"}
            />
          </div>
        )}
      </div>

      {/* Description */}
      {routine.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
          {routine.description}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        {lastLabel && (
          <span>
            {rl.last}: <strong className="font-semibold text-foreground">{lastLabel}</strong>
          </span>
        )}
        {runCount > 0 && (
          <span>
            {rl.runs}: <strong className="font-semibold text-foreground">{runCount}</strong>
          </span>
        )}
      </div>

      {/* Next run / disabled label */}
      <div className="mt-1">
        {routine.enabled && nextDescr ? (
          <p className="text-[11px] text-accent font-medium">
            {rl.next}: {nextDescr.relative}
          </p>
        ) : !routine.enabled ? (
          <p className="text-[11px] text-muted-foreground">{rl.disabled}</p>
        ) : null}
      </div>
    </div>
  )
}
