/**
 * QaioAvatar — the colored Qaio helmet glyph, optionally wrapped in
 * the "card-running-glow" comet halo when an agent is actively working.
 *
 * This is the single source of truth for rendering an agent's avatar
 * across every Qaio surface (desktop, mobile, any third-party
 * frontend built on `qaio-engine`). Old local copies in `app/` and
 * `mobile/` duplicated the SVG path data + the running-glow wrapper;
 * every tweak had to be done twice. Not anymore.
 *
 * Pair `running` with the `.card-running-glow` rule shipped from
 * `globals.css` so the halo animation stays in lockstep with the
 * kanban card / detail panel variants. If your app doesn't import the
 * core globals, the avatar still renders — the halo is just inert.
 */
import type { CSSProperties } from "react";
import { cn } from "../utils";

/** Muted foreground fallback when no agent color is set. */
const QAIO_GRAY = "var(--color-muted-foreground, #9b9b9b)";

interface HelmetProps {
  /** Hex fill color. Defaults to Qaio gray. */
  color?: string;
  /** Pixel size (width + height). */
  size?: number;
  className?: string;
}

/** Bare Qaio glyph — QStrauss SQ mark. No container, no halo. */
export function QaioHelmet({
  color = QAIO_GRAY,
  size = 24,
  className,
}: HelmetProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path d="M18 58 C18 38, 28 28, 38 38 C42 42, 38 52, 32 52 C28 52, 26 48, 30 44 C32 42, 36 42, 36 46" stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"/>
      <circle cx="62" cy="48" r="22" stroke={color} strokeWidth="8" fill="none"/>
      <rect x="76" y="64" width="8" height="8" rx="1" fill={color}/>
    </svg>
  );
}

interface QaioAvatarProps {
  /** Agent's themed hex color. Drives both the helmet fill AND the
   *  faint circle tint behind it. */
  color?: string;
  /** Outer circle diameter in pixels. Helmet sizes itself to ~65% of
   *  this to match the existing desktop look. */
  diameter?: number;
  /** When true, wraps the badge in a `.card-running-glow` halo — the
   *  same comet-trail effect the desktop uses on kanban cards and the
   *  chat panel header when a session is mid-flight. */
  running?: boolean;
  className?: string;
}

/** Agent avatar badge: colored circle + Qaio helmet. Flip `running`
 *  to `true` and the badge grows a spinning comet border without any
 *  other code change required. */
export function QaioAvatar({
  color,
  diameter = 40,
  running = false,
  className,
}: QaioAvatarProps) {
  const bg = color ?? QAIO_GRAY;
  const innerDiameter = running ? Math.max(diameter - 4, 1) : diameter;
  const inner = (
    <div
      className={cn(
        "shrink-0 rounded-full flex items-center justify-center",
        className,
      )}
      style={{
        width: innerDiameter,
        height: innerDiameter,
        backgroundColor: `color-mix(in srgb, var(--color-secondary) 82%, ${bg} 18%)`,
      }}
    >
      <QaioHelmet color={bg} size={Math.round(innerDiameter * 0.65)} />
    </div>
  );
  if (!running) return inner;
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center card-running-glow"
      style={{
        width: diameter,
        height: diameter,
        "--glow-bg": "var(--color-background, #ffffff)",
      } as CSSProperties}
    >
      {inner}
    </span>
  );
}
