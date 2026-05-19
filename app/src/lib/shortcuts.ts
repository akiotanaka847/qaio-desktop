/**
 * Typed keyboard shortcut definitions.
 *
 * Each shortcut maps a key combination to an action ID. The hook
 * (`useKeyboardShortcuts`) resolves actions; the cheatsheet dialog
 * renders the human-readable labels via i18n.
 */

/** Platform-aware modifier: ⌘ on macOS, Ctrl elsewhere. */
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export type ShortcutCategory = "navigation" | "actions" | "general";

export interface ShortcutDef {
  /** Unique action identifier dispatched by the hook. */
  id: string;
  /** i18n key inside `shell:shortcuts.actions.<id>`. */
  labelKey: string;
  /** Human-readable key parts for the cheatsheet (e.g. ["⌘", "K"]). */
  display: string[];
  /** Category for grouping in the cheatsheet. */
  category: ShortcutCategory;
  /** Predicate: does this KeyboardEvent match? */
  match: (e: KeyboardEvent) => boolean;
}

/** True when the platform modifier (⌘ or Ctrl) is held. */
function mod(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

const M = isMac ? "⌘" : "Ctrl";

export const SHORTCUTS: ShortcutDef[] = [
  // ── Navigation ───────────────────────────────────────────────
  {
    id: "go-dashboard",
    labelKey: "goDashboard",
    display: [M, "D"],
    category: "navigation",
    match: (e) => mod(e) && e.key === "d",
  },
  {
    id: "prev-agent",
    labelKey: "prevAgent",
    display: [M, "["],
    category: "navigation",
    match: (e) => mod(e) && e.key === "[",
  },
  {
    id: "next-agent",
    labelKey: "nextAgent",
    display: [M, "]"],
    category: "navigation",
    match: (e) => mod(e) && e.key === "]",
  },
  {
    id: "go-settings",
    labelKey: "goSettings",
    display: [M, ","],
    category: "navigation",
    match: (e) => mod(e) && e.key === ",",
  },

  // ── Actions ──────────────────────────────────────────────────
  {
    id: "new-mission",
    labelKey: "newMission",
    display: [M, "N"],
    category: "actions",
    match: (e) => mod(e) && e.key === "n",
  },
  {
    id: "new-agent",
    labelKey: "newAgent",
    display: [M, "Shift", "N"],
    category: "actions",
    match: (e) => mod(e) && e.shiftKey && e.key === "N",
  },
  {
    id: "search",
    labelKey: "search",
    display: [M, "F"],
    category: "actions",
    match: (e) => mod(e) && e.key === "f",
  },

  // ── General ──────────────────────────────────────────────────
  {
    id: "show-shortcuts",
    labelKey: "showShortcuts",
    display: ["?"],
    category: "general",
    match: (e) => e.key === "?" && !mod(e),
  },
  {
    id: "close-panel",
    labelKey: "closePanel",
    display: ["Esc"],
    category: "general",
    match: (e) => e.key === "Escape",
  },
];

/** Group shortcuts by category for the cheatsheet. */
export function groupedShortcuts(): Record<ShortcutCategory, ShortcutDef[]> {
  const groups: Record<ShortcutCategory, ShortcutDef[]> = {
    navigation: [],
    actions: [],
    general: [],
  };
  for (const s of SHORTCUTS) {
    groups[s.category].push(s);
  }
  return groups;
}
