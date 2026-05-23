import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";

export interface AppInfo {
  toolkit: string;
  name: string;
  description: string;
  logoUrl: string;
  categories: string[];
}

interface AppCardProps {
  app: AppInfo;
  connecting: boolean;
  onConnect: (toolkit: string) => void;
}

export function AppCard({ app, connecting, onConnect }: AppCardProps) {
  const { t } = useTranslation("integrations");
  const [imgError, setImgError] = useState(false);
  const initial = app.name.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onConnect(app.toolkit)}
      disabled={connecting}
      title={t("browse.connectTitle", { name: app.name })}
      className="group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary hover:bg-black/[0.05] transition-colors disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:bg-black/[0.05]"
    >
      {!imgError ? (
        <img
          src={app.logoUrl}
          alt={app.name}
          className="size-8 rounded-lg object-contain shrink-0 bg-background"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="size-8 rounded-lg bg-background flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">
            {initial}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">
          {app.name}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {app.description}
        </p>
      </div>
      {connecting ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Plus className="size-3.5 text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground transition-colors" />
      )}
    </button>
  );
}

export function fallbackLogo(toolkit: string): string {
  return `https://www.google.com/s2/favicons?domain=${toolkit}.com&sz=128`;
}
