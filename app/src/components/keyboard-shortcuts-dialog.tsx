import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@qaio-ai/core";
import { groupedShortcuts, type ShortcutCategory } from "../lib/shortcuts";

const CATEGORY_ORDER: ShortcutCategory[] = ["navigation", "actions", "general"];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("shell");
  const groups = groupedShortcuts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 py-2">
          {CATEGORY_ORDER.map((cat) => {
            const items = groups[cat];
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
                  {t(`shortcuts.categories.${cat}`)}
                </h3>
                <div className="flex flex-col gap-1">
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-1.5 px-1"
                    >
                      <span className="text-sm text-foreground">
                        {t(`shortcuts.actions.${s.labelKey}`)}
                      </span>
                      <kbd className="inline-flex items-center gap-0.5">
                        {s.display.map((part, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-muted border border-border text-[11px] font-medium text-muted-foreground"
                          >
                            {part}
                          </span>
                        ))}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
