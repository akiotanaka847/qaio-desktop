import { useMemo } from "react";
import type { RoutineFormData, RoutineRun } from "@qaio-ai/routines";

export const EMPTY_FORM: RoutineFormData = {
  name: "",
  description: "",
  prompt: "",
  schedule: "0 9 * * *",
  suppress_when_silent: true,
  timezone: null,
};

export function formMatchesRoutine(
  form: RoutineFormData,
  source: RoutineFormData,
): boolean {
  return (
    form.name === source.name &&
    form.description === source.description &&
    form.prompt === source.prompt &&
    form.schedule === source.schedule &&
    form.suppress_when_silent === source.suppress_when_silent &&
    (form.timezone ?? null) === (source.timezone ?? null)
  );
}

/** Derive last-run-per-routine and run-count-per-routine from the flat runs array. */
export function useRunStats(allRuns: RoutineRun[] | undefined) {
  const lastRuns = useMemo(() => {
    if (!allRuns) return {};
    const map: Record<string, RoutineRun> = {};
    for (const run of allRuns) {
      const existing = map[run.routine_id];
      if (!existing || new Date(run.started_at) > new Date(existing.started_at)) {
        map[run.routine_id] = run;
      }
    }
    return map;
  }, [allRuns]);

  const runCounts = useMemo(() => {
    if (!allRuns) return {};
    const counts: Record<string, number> = {};
    for (const run of allRuns) {
      counts[run.routine_id] = (counts[run.routine_id] ?? 0) + 1;
    }
    return counts;
  }, [allRuns]);

  return { lastRuns, runCounts };
}
