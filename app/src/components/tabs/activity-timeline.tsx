import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@qaio-ai/core";
import type { Activity } from "../../data/activity";

interface ActivityTimelineProps {
  items: Activity[];
  agentName: string;
}

type DayGroup = { label: string; entries: Activity[] };

function statusDotColor(status: string): string {
  if (status === "running" || status === "planning" || status === "implementing")
    return "bg-accent";
  if (status === "done" || status === "cancelled") return "bg-green-500";
  return "bg-orange-400";
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayLabel(iso: string | undefined, t: (k: string) => string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return t("timeline.today");
  if (diff === 1) return t("timeline.yesterday");
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function groupByDay(
  items: Activity[],
  t: (k: string) => string,
): DayGroup[] {
  const map = new Map<string, Activity[]>();
  for (const item of items) {
    const key = dayLabel(item.updated_at, t);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([label, entries]) => ({
    label,
    entries,
  }));
}

export function ActivityTimeline({ items, agentName }: ActivityTimelineProps) {
  const { t } = useTranslation("events");

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
      ),
    [items],
  );

  const groups = useMemo(() => groupByDay(sorted, t), [sorted, t]);

  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TimelineHeader agentName={agentName} />
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-3xl mx-auto">
          {groups.map((group) => (
            <div key={group.label}>
              {group.entries.map((item) => (
                <TimelineEntry
                  key={item.id}
                  item={item}
                  dayLabel={group.label}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineHeader({ agentName }: { agentName: string }) {
  const { t } = useTranslation("events");
  return (
    <div className="flex items-center justify-between px-6 pt-4 pb-2">
      <h2 className="text-sm font-semibold text-foreground">
        {t("timeline.title", { name: agentName })}
      </h2>
      <button
        type="button"
        className="text-xs text-accent hover:text-accent/80 font-medium"
      >
        {t("timeline.export")}
      </button>
    </div>
  );
}

function TimelineEntry({
  item,
  dayLabel,
}: {
  item: Activity;
  dayLabel: string;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-b-0">
      <div className="w-12 shrink-0 text-right pt-0.5">
        <p className="text-sm font-medium text-foreground leading-tight">
          {formatTime(item.updated_at)}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {dayLabel}
        </p>
      </div>

      <div className="relative flex flex-col items-center pt-1.5">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotColor(item.status)}`}
        />
        <div className="w-px flex-1 bg-border mt-1.5" />
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <p className="text-sm font-medium text-foreground leading-snug">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}
