import { useTranslation } from "react-i18next";
import {
  Check,
  CircleDashed,
  ExternalLink,
  Loader2,
  RefreshCw,
  Terminal,
  X,
} from "lucide-react";
import { Button, cn } from "@qaio-ai/core";
import { tauriSystem, type ProviderStatus } from "../../../lib/tauri";
import type { ProviderInfo } from "../../../lib/providers";

interface BrainProviderCardProps {
  provider: ProviderInfo;
  status: ProviderStatus | undefined;
  loading: boolean;
  selected: boolean;
  loginPending: boolean;
  onSelect: (modelId: string) => void;
  onRefresh: () => Promise<void>;
  onLaunchLogin: () => void;
  onCancelLogin: () => void;
  costLabel: string;
}

export function BrainProviderCard({
  provider,
  status,
  loading,
  selected,
  loginPending,
  onSelect,
  onRefresh,
  onLaunchLogin,
  onCancelLogin,
  costLabel,
}: BrainProviderCardProps) {
  const { t } = useTranslation(["setup", "providers"]);
  const installed = status?.cli_installed ?? false;
  const authenticated = status?.authenticated ?? false;
  const connected = installed && authenticated;

  const handlePick = () => onSelect(provider.defaultModel);

  const handleSignIn = () => {
    handlePick();
    onLaunchLogin();
  };

  return (
    <button
      type="button"
      onClick={handlePick}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-xl border bg-background p-4 text-left transition-all",
        "border-black/5 hover:border-black/15 hover:shadow-[0_1px_0_rgba(0,0,0,0.05)]",
        selected && "border-foreground shadow-[0_1px_0_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{provider.name}</p>
          <p className="text-xs text-muted-foreground">{provider.subtitle}</p>
        </div>
        <ProviderStatusPill loading={loading} connected={connected} />
      </div>
      <p className="text-xs text-muted-foreground">{costLabel}</p>
      {selected && !connected && (
        <SetupHint
          provider={provider}
          installed={installed}
          loginPending={loginPending}
          onSignIn={handleSignIn}
          onCancel={onCancelLogin}
          onRefresh={() => void onRefresh()}
        />
      )}
      {selected && connected && (
        <p className="text-xs text-success">
          {t("providers:card.connected")}
        </p>
      )}
    </button>
  );
}

function ProviderStatusPill({ loading, connected }: { loading: boolean; connected: boolean }) {
  const { t } = useTranslation("providers");
  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="size-3" />
        {t("card.connected")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <CircleDashed className="size-3" />
      {t("card.notConnected")}
    </span>
  );
}

function SetupHint({
  provider,
  installed,
  loginPending,
  onSignIn,
  onCancel,
  onRefresh,
}: {
  provider: ProviderInfo;
  installed: boolean;
  loginPending: boolean;
  onSignIn: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation(["setup", "providers"]);
  return (
    <div className="rounded-lg bg-secondary/60 p-3" onClick={(e) => e.stopPropagation()}>
      {!installed && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Terminal className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {t("providers:setup.installHint", { cli: provider.cliName })}{" "}
            <a
              href={provider.installUrl}
              onClick={(e) => {
                e.preventDefault();
                void tauriSystem.openUrl(provider.installUrl);
              }}
              className="text-foreground underline underline-offset-2"
            >
              {t("providers:setup.installGuide")}
              <ExternalLink className="ml-0.5 inline size-3" />
            </a>
          </span>
        </div>
      )}
      {installed && !loginPending && (
        <Button size="sm" className="rounded-full" onClick={onSignIn}>
          <ExternalLink className="size-3.5" />
          {t("providers:setup.signInWith", { provider: provider.name })}
        </Button>
      )}
      {installed && loginPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span>{t("providers:setup.waiting")}</span>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3" />
            {t("providers:card.cancel")}
          </button>
        </div>
      )}
      {!installed && (
        <button
          type="button"
          onClick={onRefresh}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3" />
          {t("providers:setup.installedCheckAgain")}
        </button>
      )}
    </div>
  );
}
