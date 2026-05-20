import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@qaio-ai/core";
import type { KnowledgeEntry, NewKnowledgeEntry } from "../../data/knowledge-base";

const SOURCES = ["manual", "meeting", "project", "chat"] as const;

export function KnowledgeEntryForm({
  open,
  onOpenChange,
  entry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: KnowledgeEntry;
  onSubmit: (input: any) => Promise<unknown>;
}) {
  const { t } = useTranslation(["agents", "common"]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState<string>("manual");
  const [tagsStr, setTagsStr] = useState("");
  const [client, setClient] = useState("");
  const [project, setProject] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setSource(entry.source);
      setTagsStr(entry.tags.join(", "));
      setClient(entry.client ?? "");
      setProject(entry.project ?? "");
    } else if (open) {
      setTitle("");
      setContent("");
      setSource("manual");
      setTagsStr("");
      setClient("");
      setProject("");
    }
  }, [open, entry]);

  const parseTags = () =>
    tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (entry) {
        await onSubmit({
          id: entry.id,
          updates: {
            title: title.trim(),
            content: content.trim(),
            source,
            tags: parseTags(),
            client: client.trim() || null,
            project: project.trim() || null,
          },
        });
      } else {
        const input: NewKnowledgeEntry = {
          title: title.trim(),
          content: content.trim(),
          source,
          tags: parseTags(),
          client: client.trim() || undefined,
          project: project.trim() || undefined,
        };
        await onSubmit(input);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entry ? t("common:actions.edit") : t("agents:knowledgeBase.addEntry")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("agents:knowledgeBase.titlePlaceholder")}
            autoFocus
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("agents:knowledgeBase.contentPlaceholder")}
            rows={5}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("agents:knowledgeBase.sourceLabel")}
              </label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`agents:knowledgeBase.sources.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder={t("agents:knowledgeBase.tagsPlaceholder")}
              className="mt-auto"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder={t("agents:knowledgeBase.clientPlaceholder")}
            />
            <Input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder={t("agents:knowledgeBase.projectPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? t("common:actions.saving") : t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
