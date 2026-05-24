import { useEffect, useState } from "react";
import { getFileIcon } from "@qaio-ai/agent";
import type { FileEntry } from "../../lib/types";
import { cn } from "@qaio-ai/core";
import { fileTypeLabel, formatFileSize, relativeDate } from "./files-tab-utils";

function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Background tint per file category for the icon container. */
function iconBg(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "pdf") return "bg-orange-50";
  if (["xls", "xlsx", "csv", "numbers", "ods"].includes(e)) return "bg-blue-50";
  if (["ppt", "pptx", "key", "odp"].includes(e)) return "bg-rose-50";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(e)) return "bg-emerald-50";
  return "bg-stone-50";
}

interface FilesTabRowProps {
  file: FileEntry;
  agentInitials?: string;
  onOpen?: (file: FileEntry) => void;
  dateLabels: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    yesterday: string;
  };
}

export function FilesTabRow({ file, agentInitials, onOpen, dateLabels }: FilesTabRowProps) {
  const now = useNow(60_000);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(file)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(file);
        }
      }}
      className={cn(
        "flex items-center gap-4 px-5 py-3.5 cursor-pointer",
        "transition-colors duration-150 hover:bg-secondary/50",
        "border-b border-border/40 last:border-b-0",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "size-10 rounded-lg flex items-center justify-center shrink-0",
          "[&_svg]:size-6",
          iconBg(file.extension),
        )}
      >
        {getFileIcon(file.extension)}
      </div>

      {/* Name */}
      <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
        {file.name}
      </p>

      {/* Type + Size */}
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {fileTypeLabel(file.extension)}, {formatFileSize(file.size)}
      </span>

      {/* Agent avatar */}
      {agentInitials && (
        <span className="size-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
          {agentInitials}
        </span>
      )}

      {/* Relative date */}
      <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right shrink-0">
        {relativeDate(file.dateModified, now, dateLabels)}
      </span>
    </div>
  );
}
