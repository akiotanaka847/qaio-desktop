export const DEFAULT_PAD = 8;
export const TOOLTIP_W = 360;
export const TOOLTIP_H_EST = 240;
export const TOOLTIP_GAP = 16;
export const VIEWPORT_MARGIN = 16;

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

type Side = "below" | "above" | "right" | "left";
type Placement = Side | "viewport-right" | "viewport-left";

/**
 * Returns cutout rect (target + padding) and tooltip position for a
 * given target rect, viewport, and requested placement.
 *
 * Pure function — no DOM access.
 */
export function computeTooltipPosition(
  rect: Rect | null,
  viewport: Viewport,
  placement?: Placement,
  spotlightPadding?: number,
): { cutout: Rect | null; tooltip: { top: number; left: number } } {
  const pad = spotlightPadding ?? DEFAULT_PAD;
  const cutout = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const tooltip = resolveTooltipSide(cutout, viewport, placement);
  return { cutout, tooltip };
}

function resolveTooltipSide(
  cutout: Rect | null,
  viewport: Viewport,
  placement?: Placement,
): { top: number; left: number } {
  if (placement === "viewport-right") {
    return {
      top: Math.max(VIEWPORT_MARGIN, viewport.height / 2 - TOOLTIP_H_EST / 2),
      left: viewport.width - TOOLTIP_W - VIEWPORT_MARGIN,
    };
  }
  if (placement === "viewport-left") {
    return {
      top: Math.max(VIEWPORT_MARGIN, viewport.height / 2 - TOOLTIP_H_EST / 2),
      left: VIEWPORT_MARGIN,
    };
  }
  if (!cutout) {
    return {
      top: viewport.height / 2 - 140,
      left: viewport.width / 2 - TOOLTIP_W / 2,
    };
  }

  const spaceBelow = viewport.height - (cutout.top + cutout.height) - TOOLTIP_GAP;
  const spaceAbove = cutout.top - TOOLTIP_GAP;
  const spaceRight = viewport.width - (cutout.left + cutout.width) - TOOLTIP_GAP;
  const spaceLeft = cutout.left - TOOLTIP_GAP;

  const isWideShort = cutout.width >= viewport.width * 0.4 && cutout.height < 220;
  const order: Side[] = isWideShort
    ? ["below", "above", "right", "left"]
    : ["right", "left", "below", "above"];
  const fits: Record<Side, boolean> = {
    below: spaceBelow >= TOOLTIP_H_EST,
    above: spaceAbove >= TOOLTIP_H_EST,
    right: spaceRight >= TOOLTIP_W,
    left: spaceLeft >= TOOLTIP_W,
  };
  const space: Record<Side, number> = {
    below: spaceBelow,
    above: spaceAbove,
    right: spaceRight,
    left: spaceLeft,
  };

  if (!order.some((p) => fits[p])) {
    return {
      top: Math.max(VIEWPORT_MARGIN, viewport.height / 2 - TOOLTIP_H_EST / 2),
      left: Math.max(VIEWPORT_MARGIN, viewport.width / 2 - TOOLTIP_W / 2),
    };
  }

  const isSide = (v?: string): v is Side =>
    v === "below" || v === "above" || v === "right" || v === "left";

  const side: Side =
    (isSide(placement) ? placement : undefined) ??
    order.find((p) => fits[p]) ??
    (Object.entries(space).sort((a, b) => b[1] - a[1])[0][0] as Side);

  const clampLeft = (x: number) =>
    Math.max(VIEWPORT_MARGIN, Math.min(x, viewport.width - TOOLTIP_W - VIEWPORT_MARGIN));
  const clampTop = (y: number) =>
    Math.max(VIEWPORT_MARGIN, Math.min(y, viewport.height - TOOLTIP_H_EST - VIEWPORT_MARGIN));

  switch (side) {
    case "below":
      return {
        top: clampTop(cutout.top + cutout.height + TOOLTIP_GAP),
        left: clampLeft(cutout.left + cutout.width / 2 - TOOLTIP_W / 2),
      };
    case "above":
      return {
        top: clampTop(cutout.top - TOOLTIP_H_EST - TOOLTIP_GAP),
        left: clampLeft(cutout.left + cutout.width / 2 - TOOLTIP_W / 2),
      };
    case "right":
      return {
        top: clampTop(cutout.top),
        left: clampLeft(cutout.left + cutout.width + TOOLTIP_GAP),
      };
    case "left":
      return {
        top: clampTop(cutout.top),
        left: clampLeft(cutout.left - TOOLTIP_W - TOOLTIP_GAP),
      };
  }
}
