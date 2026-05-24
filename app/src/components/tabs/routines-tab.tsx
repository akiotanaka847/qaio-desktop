import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RoutinesGrid, RoutineEditor } from "@qaio-ai/routines";
import type { RoutineFormData } from "@qaio-ai/routines";
import {
  useRoutines,
  useRoutineRuns,
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useRunRoutineNow,
} from "../../hooks/queries";
import { useTimezonePreference } from "../../hooks/use-timezone-preference";
import type { TabProps } from "../../lib/types";
import { EMPTY_FORM, formMatchesRoutine, useRunStats } from "./routines-tab-utils";

type View = { type: "grid" } | { type: "editor"; editId?: string };

export default function RoutinesTab({ agent }: TabProps) {
  const { t } = useTranslation("routines");
  const path = agent.folderPath;
  const tz = useTimezonePreference();

  const { data: routines, isLoading } = useRoutines(path);
  const { data: allRuns } = useRoutineRuns(path);
  const createRoutine = useCreateRoutine(path);
  const updateRoutine = useUpdateRoutine(path);
  const deleteRoutine = useDeleteRoutine(path);
  const runNow = useRunRoutineNow(path);

  const [view, setView] = useState<View>({ type: "grid" });
  const [form, setForm] = useState<RoutineFormData>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<RoutineFormData>(EMPTY_FORM);

  const { lastRuns, runCounts } = useRunStats(allRuns);

  const handleCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setBaseline(EMPTY_FORM);
    setView({ type: "editor" });
  }, []);

  const openEditor = useCallback(
    (routineId: string) => {
      const r = routines?.find((x) => x.id === routineId);
      if (!r) return;
      const next: RoutineFormData = {
        name: r.name,
        description: r.description,
        prompt: r.prompt,
        schedule: r.schedule,
        suppress_when_silent: r.suppress_when_silent,
        timezone: r.timezone ?? null,
      };
      setForm(next);
      setBaseline(next);
      setView({ type: "editor", editId: routineId });
    },
    [routines],
  );

  const handleSubmit = useCallback(async () => {
    if (view.type !== "editor") return;
    if (view.editId) {
      const updated = await updateRoutine.mutateAsync({
        routineId: view.editId,
        updates: form,
      });
      setBaseline({
        name: updated.name,
        description: updated.description,
        prompt: updated.prompt,
        schedule: updated.schedule,
        suppress_when_silent: updated.suppress_when_silent,
        timezone: updated.timezone ?? null,
      });
    } else {
      await createRoutine.mutateAsync(form);
      setView({ type: "grid" });
    }
  }, [view, form, createRoutine, updateRoutine]);

  const handleToggle = useCallback(
    async (routineId: string, enabled: boolean) => {
      await updateRoutine.mutateAsync({ routineId, updates: { enabled } });
    },
    [updateRoutine],
  );

  const handleDelete = useCallback(
    async (routineId: string) => {
      await deleteRoutine.mutateAsync(routineId);
      setView({ type: "grid" });
    },
    [deleteRoutine],
  );

  const handleRunNow = useCallback(
    (routineId: string) => {
      runNow.mutate(routineId);
    },
    [runNow],
  );

  if (!tz.loaded || !tz.timezone) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">{t("loading")}</p>
      </div>
    );
  }

  if (view.type === "editor") {
    const editing = view.editId
      ? routines?.find((r) => r.id === view.editId)
      : undefined;
    const editingRuns = view.editId
      ? (allRuns ?? []).filter((r) => r.routine_id === view.editId)
      : [];

    return (
      <RoutineEditor
        value={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onBack={() => setView({ type: "grid" })}
        onSubmit={handleSubmit}
        routine={editing}
        runs={editingRuns}
        onRunNow={editing ? () => handleRunNow(editing.id) : undefined}
        onToggle={
          editing ? (enabled) => handleToggle(editing.id, enabled) : undefined
        }
        onDelete={editing ? () => handleDelete(editing.id) : undefined}
        accountTimezone={tz.timezone}
        hasChanges={!formMatchesRoutine(form, baseline)}
      />
    );
  }

  return (
    <RoutinesGrid
      routines={routines ?? []}
      lastRuns={lastRuns}
      runCounts={runCounts}
      accountTimezone={tz.timezone}
      loading={isLoading}
      onSelect={openEditor}
      onCreate={handleCreate}
      onToggle={handleToggle}
      labels={{
        loading: t("loading"),
        emptyTitle: t("grid.emptyTitle"),
        emptyDescription: t("grid.emptyDescription"),
        descriptionShort: t("grid.descriptionShort"),
        newRoutine: t("grid.newRoutine"),
      }}
      rowLabels={{
        last: t("row.last"),
        runs: t("row.runs"),
        next: t("row.next"),
        disabled: t("row.disabled"),
      }}
    />
  );
}
