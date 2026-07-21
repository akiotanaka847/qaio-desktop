import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink } from "lucide-react";
import { tauriSystem } from "../../lib/tauri";

interface DeviceCodePanelProps {
  /** Verification URL the user opens in a browser. */
  url: string;
  /** One-time code the user types at that URL. */
  code: string;
}

/**
 * Shows the device-code challenge a provider CLI emits when the engine
 * cannot open a browser itself (headless host, container, or a remote
 * engine the desktop talks to over the network).
 *
 * Lives in its own file rather than inside `ProviderCard` to keep that
 * component under the size limit.
 */
export function DeviceCodePanel({ url, code }: DeviceCodePanelProps) {
  const { t } = useTranslation("providers");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be denied; the code stays selectable on screen.
    }
  }, [code]);

  const handleOpen = useCallback(() => {
    tauriSystem.openUrl(url).catch(() => {
      // Opening is a convenience; the URL is shown as text either way.
    });
  }, [url]);

  return (
    <div
      className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-muted-foreground">
        {t("deviceCode.instruction")}
      </p>

      <button
        type="button"
        onClick={handleOpen}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-foreground underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span className="break-all">{url}</span>
      </button>

      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-background px-2.5 py-1.5 font-mono text-sm tracking-widest text-foreground select-all">
          {code}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={copied ? t("deviceCode.copied") : t("deviceCode.copy")}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? t("deviceCode.copied") : t("deviceCode.copy")}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/70">
        {t("deviceCode.expires")}
      </p>
    </div>
  );
}
