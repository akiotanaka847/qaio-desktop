import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { cn } from "@qaio-ai/core";
import { useFiles } from "../../hooks/queries";
import { tauriFiles } from "../../lib/tauri";
import type { TabProps } from "../../lib/types";
import type { FileCategory } from "./files-tab-utils";
import { matchesCategory, matchesSearch } from "./files-tab-utils";
import { FilesTabRow } from "./files-tab-row";

const CATEGORIES: FileCategory[] = ["all", "documents", "sheets", "pdf"];

function agentInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function FilesTab({ agent }: TabProps) {
  const { t } = useTranslation("files");
  const path = agent.folderPath;
  const { data: files = [], isLoading } = useFiles(path);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FileCategory>("all");

  const filtered = useMemo(() => {
    const flat = files.filter((f) => !f.is_directory);
    return flat
      .filter((f) => matchesSearch(f, query) && matchesCategory(f, category))
      .sort((a, b) => (b.dateModified ?? 0) - (a.dateModified ?? 0));
  }, [files, query, category]);

  const initials = agentInitials(agent.name);

  const dateLabels = {
    justNow: t("dates.justNow"),
    minutesAgo: t("dates.minutesAgo"),
    hoursAgo: t("dates.hoursAgo"),
    yesterday: t("dates.yesterday"),
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Search + filter pills */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-3 h-8 rounded-lg text-xs font-medium transition-colors",
                  category === cat
                    ? "bg-accent/10 text-accent"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`categories.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        {/* File list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse py-12 text-center">
            {t("loading")}
          </p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-20 text-center">
            <p className="text-lg font-semibold">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground max-w-xs">{t("emptyDescription")}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {filtered.map((file) => (
              <FilesTabRow
                key={file.path}
                file={file}
                agentInitials={initials}
                onOpen={(f) => tauriFiles.open(path, f.path)}
                dateLabels={dateLabels}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
