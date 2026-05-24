/**
 * RoutinesGrid — list view of routines, with an empty state and primary CTA.
 *
 * The parent tab already labels this surface "Routines", so this view skips
 * a redundant page header and goes straight to a meta row + the list.
 */
import {
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  Button,
} from "@qaio-ai/core"
import { Plus } from "lucide-react"
import type { Routine, RoutineRun } from "./types"
import { RoutineRow } from "./routine-row"
import type { RoutineRowLabels } from "./routine-row"

/**
 * Optional translated labels. English defaults so existing callers still
 * work. Consumers pass `t()` results for localization — `ui/` stays
 * i18n-agnostic per the library-boundary rule.
 */
export interface RoutinesGridLabels {
  loading?: string
  emptyTitle?: string
  emptyDescription?: string
  descriptionShort?: string
  newRoutine?: string
}

const DEFAULT_LABELS: Required<RoutinesGridLabels> = {
  loading: "Loading…",
  emptyTitle: "Set it and forget it",
  emptyDescription:
    "Routines fire on a schedule and only ping you when something actually needs attention.",
  descriptionShort:
    "Recurring tasks that fire on schedule and only ping you when something needs attention.",
  newRoutine: "New routine",
}

export interface RoutinesGridProps {
  routines: Routine[]
  /** Most recent run per routine, keyed by routine ID. */
  lastRuns?: Record<string, RoutineRun>
  /** Total run counts per routine, keyed by routine ID. */
  runCounts?: Record<string, number>
  /** Account-default IANA timezone — passed to rows for "next run" preview. */
  accountTimezone: string
  loading?: boolean
  onSelect: (routineId: string) => void
  onCreate?: () => void
  onToggle?: (routineId: string, enabled: boolean) => void
  labels?: RoutinesGridLabels
  rowLabels?: RoutineRowLabels
}

export function RoutinesGrid({
  routines,
  lastRuns = {},
  runCounts = {},
  accountTimezone,
  loading,
  onSelect,
  onCreate,
  onToggle,
  labels,
  rowLabels,
}: RoutinesGridProps) {
  const l = { ...DEFAULT_LABELS, ...labels }
  // Sort: enabled first, then alphabetical
  const sorted = [...routines].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  if (loading && routines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">
          {l.loading}
        </p>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-background">
        <div className="mx-auto max-w-md flex flex-col items-center gap-6 text-center pt-24 px-6">
          <EmptyHeader>
            <EmptyTitle>{l.emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {l.emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="size-4" />
              {l.newRoutine}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-7">
        {/* Description + CTA. No page title — tab handles it. */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <p className="text-xs text-muted-foreground max-w-md">
            {l.descriptionShort}
          </p>
          {onCreate && (
            <Button size="sm" onClick={onCreate} className="shrink-0">
              <Plus className="size-3.5" />
              {l.newRoutine}
            </Button>
          )}
        </div>

        {/* 2-column card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((routine) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              lastRun={lastRuns[routine.id]}
              runCount={runCounts[routine.id] ?? 0}
              accountTimezone={accountTimezone}
              onClick={() => onSelect(routine.id)}
              onToggle={
                onToggle ? (enabled) => onToggle(routine.id, enabled) : undefined
              }
              labels={rowLabels}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
