import { useTranslation } from "react-i18next";
import { Badge, Button } from "@qaio-ai/core";
import { Pencil, Trash2 } from "lucide-react";
import type { KnowledgeEntry } from "../../data/knowledge-base";

export function KnowledgeEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: KnowledgeEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("agents");
  const sourceLabel = t(`knowledgeBase.sources.${entry.source}`, entry.source);

  return (
    <article className="rounded-xl border border-black/[0.05] bg-secondary px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate">
            {entry.title}
          </h3>
          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-3 whitespace-pre-wrap">
            {entry.content}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onEdit}
            aria-label={t("common:actions.edit")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive/70 hover:text-destructive"
            onClick={onDelete}
            aria-label={t("common:actions.delete")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {sourceLabel}
        </Badge>
        {entry.client && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {entry.client}
          </Badge>
        )}
        {entry.project && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {entry.project}
          </Badge>
        )}
        {entry.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
            {tag}
          </Badge>
        ))}
      </div>
    </article>
  );
}
