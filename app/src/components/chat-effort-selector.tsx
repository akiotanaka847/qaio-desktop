import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@qaio-ai/core";
import {
  getEffortLevels,
  type EffortLevel,
} from "../lib/providers";

interface ChatEffortSelectorProps {
  provider: string;
  model: string;
  effort: EffortLevel | null;
  onSelect: (effort: EffortLevel) => void;
}

/**
 * Effort-level picker rendered next to the model selector in the chat
 * composer footer. Renders nothing when the active model does not
 * support effort control (e.g. Gemini).
 */
export function ChatEffortSelector({ provider, model, effort, onSelect }: ChatEffortSelectorProps) {
  const { t } = useTranslation("chat");
  const levels = getEffortLevels(provider, model);

  if (levels.length === 0) return null;

  const label = effort
    ? t(`modelSelector.effortLevels.${effort}` as const)
    : t("modelSelector.effort");

  return (
    <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span>{label}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-52"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {t("modelSelector.effort")}
          </DropdownMenuLabel>
          {levels.map((level) => {
            const isActive = level === effort;
            return (
              <DropdownMenuItem
                key={level}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(level);
                }}
                className="flex items-start gap-2.5 py-1.5"
              >
                <div className="w-4 shrink-0 mt-0.5 flex justify-center">
                  {isActive && <Check className="h-3.5 w-3.5 text-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{t(`modelSelector.effortLevels.${level}` as const)}</div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    {t(`modelSelector.effortDescriptions.${level}` as const)}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
