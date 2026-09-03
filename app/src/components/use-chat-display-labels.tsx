import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Shimmer } from "@qaio-ai/chat";
import type { ChatPanelProps } from "@qaio-ai/chat";
import { useUIStore } from "../stores/ui";

export function useChatDisplayLabels(): Pick<
  ChatPanelProps,
  "processLabels" | "getThinkingMessage" | "copyLabels" | "onCopyError"
> {
  const { t } = useTranslation("chat");
  const addToast = useUIStore((s) => s.addToast);
  const processLabels = useMemo(
    () => ({
      active: t("process.active"),
      complete: t("process.complete"),
    }),
    [t],
  );
  const getThinkingMessage = useCallback<
    NonNullable<ChatPanelProps["getThinkingMessage"]>
  >(
    (isStreaming, duration) => {
      if (isStreaming || duration === 0) {
        return <Shimmer duration={1}>{t("reasoning.thinking")}</Shimmer>;
      }
      if (duration === undefined) return <span>{t("reasoning.thoughtForFew")}</span>;
      return <span>{t("reasoning.thoughtFor", { count: duration })}</span>;
    },
    [t],
  );
  const copyLabels = useMemo(
    () => ({
      copy: t("copy.action"),
      copied: t("copy.copied"),
      failed: t("copy.failed"),
    }),
    [t],
  );
  // The button already shows the failure on itself; the toast is what
  // tells the user WHY, since a denied clipboard is a system setting
  // they have to go change.
  const onCopyError = useCallback(
    () => addToast({ title: t("copy.errorToast"), variant: "error" }),
    [addToast, t],
  );

  return { processLabels, getThinkingMessage, copyLabels, onCopyError };
}
