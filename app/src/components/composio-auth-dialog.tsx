import { useTranslation } from "react-i18next";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@qaio-ai/core";
import { Loader2, ExternalLink } from "lucide-react";
import type { ComposioAuthState } from "../hooks/use-composio-auth";

interface ComposioAuthDialogProps {
  state: ComposioAuthState;
  onClose: () => void;
  onReopenBrowser: () => void;
}

/**
 * Sign-in dialog for Composio. Shows a spinner while waiting for the
 * user to approve in the browser, an error state if something fails,
 * and a manual "Open in browser" fallback link.
 */
export function ComposioAuthDialog({
  state,
  onClose,
  onReopenBrowser,
}: ComposioAuthDialogProps) {
  const { t } = useTranslation("integrations");
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("authDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("authDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {state.phase === "waiting" && (
            <div className="flex items-center gap-3 rounded-lg bg-secondary/50 px-4 py-3">
              <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t("authDialog.waiting")}
              </p>
            </div>
          )}

          {state.phase === "error" && state.error && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3">
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
          )}

          {state.loginUrl && (
            <button
              onClick={onReopenBrowser}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-background text-foreground text-sm font-medium hover:bg-secondary transition-colors duration-200"
            >
              {t("authDialog.openInBrowser")}
              <ExternalLink className="size-3.5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
