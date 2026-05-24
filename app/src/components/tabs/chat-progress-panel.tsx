import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Circle, Loader } from "lucide-react";
import type { FeedItem } from "@qaio-ai/chat";

interface ChatProgressPanelProps {
  feedItems: FeedItem[];
  isActive: boolean;
}

interface ProgressStep {
  id: string;
  label: string;
  detail?: string;
  status: "done" | "active" | "pending";
}

function extractSteps(items: FeedItem[], isActive: boolean): ProgressStep[] {
  const steps: ProgressStep[] = [];
  let toolIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.feed_type !== "tool_call") continue;
    toolIndex++;
    const name = item.data.name;
    const hasResult = items
      .slice(i + 1)
      .some((f) => f.feed_type === "tool_result");
    const isLast = !items.slice(i + 1).some((f) => f.feed_type === "tool_call");
    steps.push({
      id: `step-${toolIndex}`,
      label: humanizeToolName(name),
      status: hasResult ? "done" : isLast && isActive ? "active" : "pending",
    });
  }

  return steps;
}

function humanizeToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function ChatProgressPanel({
  feedItems,
  isActive,
}: ChatProgressPanelProps) {
  const { t } = useTranslation("chat");
  const steps = useMemo(
    () => extractSteps(feedItems, isActive),
    [feedItems, isActive],
  );

  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.status === "done").length;

  return (
    <div className="w-64 shrink-0 border-l border-border bg-card/50 h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {t("progress.title")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("progress.counter", { done: doneCount, total: steps.length })}
        </span>
      </div>
      <div className="px-4 pb-4">
        {steps.map((step, i) => (
          <StepRow key={step.id} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

function StepRow({ step, isLast }: { step: ProgressStep; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepIcon status={step.status} />
        {!isLast && (
          <div
            className={`w-px flex-1 min-h-4 ${
              step.status === "done" ? "bg-accent" : "bg-border"
            }`}
          />
        )}
      </div>
      <div className="pb-4 min-w-0">
        <p
          className={`text-xs leading-snug ${
            step.status === "done"
              ? "text-accent font-medium"
              : step.status === "active"
                ? "text-foreground font-medium"
                : "text-muted-foreground"
          }`}
        >
          {step.label}
        </p>
        {step.detail && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: ProgressStep["status"] }) {
  if (status === "done") {
    return (
      <div className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
        <Check className="w-3 h-3" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
        <Loader className="w-3 h-3 animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
      <Circle className="w-2.5 h-2.5 text-muted-foreground" />
    </div>
  );
}
