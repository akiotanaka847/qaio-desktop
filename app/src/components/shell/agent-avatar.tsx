import {
  Sparkles,
  Plus,
  LayoutGrid,
  Search,
  Code,
  Wand2,
  FileText,
  Users,
  Bot,
  Briefcase,
  MessageSquare,
  PenTool,
  BarChart3,
  Shield,
  Globe,
  Zap,
  BookOpen,
  Wrench,
  Brain,
  type LucideIcon,
} from "lucide-react";
import qaioIcon from "../../assets/qaio-icon.svg";
import qaioIconWhite from "../../assets/qaio-icon-white.svg";
import qaioSq from "../../assets/qaio-sq.png";
import qaioLogoFull from "../../assets/qaio-logo-full.png";
import { resolveAgentColor } from "@qaio-ai/core";
import type { AgentConfig } from "../../lib/types";

const iconMap: Record<string, LucideIcon> = {
  Plus,
  LayoutGrid,
  Search,
  Code,
  Wand2,
  FileText,
  Users,
  Bot,
  Briefcase,
  MessageSquare,
  PenTool,
  BarChart3,
  Shield,
  Globe,
  Zap,
  BookOpen,
  Wrench,
  Brain,
  Sparkles,
};

/** Returns perceived luminance 0–1 for a hex color */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** True if color is light enough for dark foreground */
export function isLightColor(hex?: string): boolean {
  if (!hex) return true;
  return luminance(hex) >= 0.5;
}

/** Pick the right Qaio logo SVG for a background color */
export function getQaioLogo(bgColor?: string): string {
  if (!bgColor) return qaioIcon;
  return isLightColor(bgColor) ? qaioIcon : qaioIconWhite;
}

export function getAgentIcon(name?: string): LucideIcon {
  return iconMap[name ?? ""] ?? Sparkles;
}

export function getAgentIconColor(color?: string): string {
  return color ?? "#8b8b8b";
}

interface AgentAvatarProps {
  config: Pick<AgentConfig, "image" | "icon" | "name" | "color">;
  size?: "md" | "lg";
}

export function AgentAvatar({ config, size = "md" }: AgentAvatarProps) {
  const dim = size === "lg" ? "h-16 w-16" : "h-14 w-14";
  const iconDim = size === "lg" ? "h-7 w-7" : "h-6 w-6";
  const imgPad = size === "lg" ? "p-3" : "p-2.5";
  const resolved = resolveAgentColor(config.color);

  if (config.image) {
    return (
      <div
        className={`${dim} shrink-0 rounded-full border border-border flex items-center justify-center ${imgPad} bg-background`}
      >
        <img
          src={config.image}
          alt={config.name ?? ""}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  const Icon = getAgentIcon(config.icon);

  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-secondary`}
    >
      <Icon className={iconDim} style={{ color: resolved }} />
    </div>
  );
}

export function QaioLogo({ size = 20, className = "", variant = "icon" }: { size?: number; className?: string; variant?: "icon" | "full" }) {
  if (variant === "full") {
    return (
      <img
        src={qaioLogoFull}
        alt="QStrauss Consulting"
        height={size}
        className={`shrink-0 ${className}`}
        style={{ height: size, width: "auto" }}
      />
    );
  }
  return (
    <img
      src={qaioSq}
      alt="Qaio"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}

/** Pulsing Qaio logo — universal loading indicator for all agents */
export function QaioThinkingIndicator() {
  return (
    <div className="py-2 flex items-center gap-2">
      <QaioLogo size={20} className="animate-pulse" />
    </div>
  );
}
