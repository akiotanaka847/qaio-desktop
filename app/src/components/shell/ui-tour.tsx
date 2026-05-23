import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, cn } from "@qaio-ai/core";
import { computeTooltipPosition, TOOLTIP_W, type Rect } from "./ui-tour-placement";

export interface UiTourStep {
  title: string;
  body: string;
  /**
   * CSS selector (queried against `document`) for the UI element to spotlight.
   * Omit for a centered "no-target" step like the closing card.
   */
  targetSelector?: string;
  /** Padding (px) around the target element for the spotlight cutout. */
  spotlightPadding?: number;
  /**
   * Side-effect to run when this step becomes active (forward or backward).
   * Use to actually open the tab/section/dialog the step talks about so the
   * user sees the destination, not just a spotlight on the trigger.
   */
  onEnter?: () => void;
  /**
   * Override automatic tooltip placement. `viewport-right`/`viewport-left`
   * pin the card to the corresponding viewport edge instead of anchoring to
   * the cutout. Useful when the cutout is huge (e.g. a modal interior) and
   * a card next to it would still cover the content.
   */
  placement?: "below" | "above" | "right" | "left" | "viewport-right" | "viewport-left";
  /** Override the confirm button label on this step (defaults to next/done). */
  confirmLabel?: string;
}

interface UiTourProps {
  steps: UiTourStep[];
  onDismiss: () => void;
}

/**
 * Game-tutorial style coachmark overlay. Per step:
 *  - Looks up the target element by CSS selector
 *  - Cuts a transparent hole in a dark scrim around it (box-shadow trick)
 *  - Highlights the element with a subtle pulsing ring
 *  - Floats a tooltip card next to the cutout with an arrow pointing in
 *
 * Steps without a `targetSelector` render as a centered modal with no
 * spotlight (used for the closing "you're set" card).
 *
 * Re-measures on window resize so the cutout/tooltip stay glued to the
 * target as the user resizes the window.
 */
export function UiTour({ steps, onDismiss }: UiTourProps) {
  const { t } = useTranslation("shell");
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  // Re-measure target on step change + on viewport resize. useLayoutEffect so
  // the cutout/tooltip render in the right place on the same paint as the
  // step transition (avoids a 1-frame flash at the old position).
  useLayoutEffect(() => {
    step?.onEnter?.();
    if (!step?.targetSelector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let raf = 0;
    let tries = 0;
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(step.targetSelector!);
      if (!el) {
        if (tries++ < 30) {
          raf = window.requestAnimationFrame(measure);
        } else {
          setRect(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      measure();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [step]);

  if (!step) return null;
  const isLast = index === steps.length - 1;
  const isFirst = index === 0;
  const { cutout, tooltip } = computeTooltipPosition(rect, viewport, step.placement, step.spotlightPadding);

  return (
    <>
      {cutout ? (
        <div
          aria-hidden
          className="pointer-events-auto fixed z-[60] rounded-xl ring-2 ring-white/70 transition-[top,left,width,height] duration-200"
          style={{
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            boxShadow: "0 0 0 9999px rgba(13,13,13,0.55)",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-auto fixed inset-0 z-[60] bg-foreground/45"
        />
      )}

      {cutout && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-white/40 motion-safe:animate-pulse"
          style={{
            top: cutout.top - 4,
            left: cutout.left - 4,
            width: cutout.width + 8,
            height: cutout.height + 8,
          }}
        />
      )}

      <div
        className={cn(
          "fixed z-[60] rounded-2xl border border-black/5 bg-background p-5 shadow-[0_10px_40px_rgba(0,0,0,0.18)]",
        )}
        style={{ top: tooltip.top, left: tooltip.left, width: TOOLTIP_W }}
        role="dialog"
        aria-modal="true"
      >
        <p className="text-xs text-muted-foreground">
          {t("uiTour.counter", { current: index + 1, total: steps.length })}
        </p>
        <h2 className="mt-2 text-[22px] font-normal leading-snug">{step.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          {!isLast ? (
            <Button variant="ghost" className="rounded-full" onClick={onDismiss}>
              {t("uiTour.skip")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="secondary" className="rounded-full" onClick={() => setIndex(index - 1)}>
                {t("uiTour.previous")}
              </Button>
            )}
            <Button className="rounded-full" onClick={() => (isLast ? onDismiss() : setIndex(index + 1))}>
              {step.confirmLabel ?? (isLast ? t("uiTour.done") : t("uiTour.next"))}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
