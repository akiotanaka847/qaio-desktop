"use client";

import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { MessageAction } from "./ai-elements/message";
import { copyTextToClipboard } from "./clipboard";

const RESET_MS = 1600;

export interface MessageCopyLabels {
  copy: string;
  copied: string;
  failed: string;
}

const DEFAULT_LABELS: MessageCopyLabels = {
  copy: "Copy message",
  copied: "Copied",
  failed: "Copy failed",
};

type CopyState = "idle" | "copied" | "failed";

/**
 * Copy one message to the clipboard.
 *
 * Always rendered, never revealed on hover: hover-gated affordances are
 * invisible to touch and to anyone who does not think to point at the
 * message.
 *
 * A denied clipboard is shown, not swallowed. `onError` lets the app
 * escalate to a toast; the button reports the failure on its own either
 * way, so the outcome is never silent even without a handler.
 */
export function MessageCopyButton({
  text,
  labels,
  onError,
}: {
  text: string;
  labels?: Partial<MessageCopyLabels>;
  onError?: (error: unknown) => void;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const resolved = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const tooltip =
    state === "copied"
      ? resolved.copied
      : state === "failed"
        ? resolved.failed
        : resolved.copy;

  return (
    <MessageAction
      tooltip={tooltip}
      onClick={() => {
        copyTextToClipboard(text).then(
          () => setState("copied"),
          (error: unknown) => {
            setState("failed");
            onError?.(error);
          },
        );
      }}
    >
      {state === "copied" ? (
        <CheckIcon className="size-3.5" />
      ) : state === "failed" ? (
        <XIcon className="size-3.5 text-destructive" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </MessageAction>
  );
}
