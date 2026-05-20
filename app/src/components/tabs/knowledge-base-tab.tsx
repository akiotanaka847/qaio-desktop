import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  ConfirmDialog,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
} from "@qaio-ai/core";
import { Plus, Search } from "lucide-react";
import type { TabProps } from "../../lib/types";
import type { KnowledgeEntry } from "../../data/knowledge-base";
import {
  useKnowledgeBase,
  useCreateKnowledgeEntry,
  useUpdateKnowledgeEntry,
  useDeleteKnowledgeEntry,
} from "../../hooks/queries";
import { KnowledgeEntryCard } from "./knowledge-entry-card";
import { KnowledgeEntryForm } from "./knowledge-entry-form";

export default function KnowledgeBaseTab({ agent }: TabProps) {
  const { t } = useTranslation("agents");
  const path = agent.folderPath;
  const { data: entries = [] } = useKnowledgeBase(path);
  const createEntry = useCreateKnowledgeEntry(path);
  const updateEntry = useUpdateKnowledgeEntry(path);
  const deleteEntry = useDeleteKnowledgeEntry(path);

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeEntry | null>(null);

  const filtered = useMemo(() => {
    if (!query) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        (e.client ?? "").toLowerCase().includes(q) ||
        (e.project ?? "").toLowerCase().includes(q),
    );
  }, [entries, query]);

  const handleCreate = async (input: Parameters<typeof createEntry.mutateAsync>[0]) => {
    await createEntry.mutateAsync(input);
    setFormOpen(false);
  };

  const handleUpdate = async (input: Parameters<typeof updateEntry.mutateAsync>[0]) => {
    await updateEntry.mutateAsync(input);
    setEditing(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteEntry.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  };

  if (entries.length === 0 && !query) {
    return (
      <div className="mx-auto max-w-md flex flex-col items-center gap-6 text-center pt-24 px-6">
        <EmptyHeader>
          <EmptyTitle>{t("knowledgeBase.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("knowledgeBase.emptyDescription")}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          {t("knowledgeBase.addEntry")}
        </Button>
        <KnowledgeEntryForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={handleCreate}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("knowledgeBase.searchPlaceholder")}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Button size="sm" onClick={() => setFormOpen(true)} className="shrink-0">
            <Plus className="size-3.5" />
            {t("knowledgeBase.addEntry")}
          </Button>
        </div>

        {filtered.length === 0 && query && (
          <p className="text-sm text-muted-foreground text-center py-12">
            {t("knowledgeBase.emptyTitle")}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((entry) => (
            <KnowledgeEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => setEditing(entry)}
              onDelete={() => setPendingDelete(entry)}
            />
          ))}
        </div>

        <KnowledgeEntryForm
          open={formOpen || editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              setFormOpen(false);
              setEditing(null);
            }
          }}
          entry={editing ?? undefined}
          onSubmit={editing ? handleUpdate : handleCreate}
        />

        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title={t("knowledgeBase.confirmDeleteTitle")}
          description={t("knowledgeBase.confirmDeleteDescription")}
          confirmLabel={t("knowledgeBase.confirmDeleteLabel")}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </div>
  );
}
