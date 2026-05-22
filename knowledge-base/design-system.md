# Design System

Visual language: QStrauss Corporate. Navy primary, green accent, warm off-white canvas. Premium consulting feel with clean typography and minimal chrome.

## Personality
Capable, calm, invisible. Quiet expert. Not flashy, not corporate, not techy. Like texting brilliant assistant.

**Anti-references:** Jira, Linear, Notion. No dense toolbars. No keyboard-shortcut culture. No config overload.

## Principles
1. **Show, don't configure.** One obvious action per screen. No settings panels. Infer if possible.
2. **Always feel alive.** AI working = user sees movement every second. Silence = broken.
3. **Chat is interface.** Primary interaction. Everything else supports.
4. **Non-technical labels.** "Prompt" not "Description". "Needs You" not "In Review". Mom-test every word.
5. **Invisible borders, visible actions.** Borders 5-15% opacity. Action buttons (Start/Approve/Delete) always visible, never hover-only.

## Color

### Brand palette
- **Navy** `#1B2A4A` (primary, sidebar, foreground text)
- **Green** `#4CAF7D` (accent, success, ring, CTA highlights)
- **Warm crema** `#FAFAF8` (light background, canvas warmth)
- **Card white** `#ffffff` (cards, popovers)

### Semantic tokens (defined in `ui/core/src/globals.css`)

Token variable prefix: `--qaio-*`. Mapped to Tailwind via `@theme` block as `--color-*`.

| Token | Light | Dark | Tailwind class |
|-------|-------|------|----------------|
| `--qaio-background` | `#FAFAF8` | `#0F1A2E` | `bg-background` |
| `--qaio-foreground` | `#1B2A4A` | `#E8ECF2` | `text-foreground` |
| `--qaio-card` | `#ffffff` | `#162240` | `bg-card` |
| `--qaio-primary` | `#1B2A4A` | `#4CAF7D` | `bg-primary` |
| `--qaio-secondary` | `#F0F3F7` | `#1A2D4D` | `bg-secondary` |
| `--qaio-muted-fg` | `#6B7A94` | `#8899B0` | `text-muted-foreground` |
| `--qaio-accent` | `#4CAF7D` | `rgba(76,175,125,0.12)` | `bg-accent` |
| `--qaio-destructive` | `#DC3545` | `#ef4444` | `bg-destructive` |
| `--qaio-border` | `rgba(27,42,74,0.08)` | `rgba(255,255,255,0.06)` | `border-border` |
| `--qaio-sidebar` | `#1B2A4A` | `#0A1222` | `bg-sidebar` |
| `--qaio-success` | `#4CAF7D` | `#4CAF7D` | `bg-success` / `text-success` |
| `--qaio-warning` | `#E0AC00` | `#eab308` | `bg-warning` |

### Sidebar tokens

The sidebar is a dark surface (navy) inside the light app. Components inside
the sidebar MUST use sidebar-specific tokens, not the main-surface tokens.

| Token | Light | Tailwind class |
|-------|-------|----------------|
| `--qaio-sidebar` | `#1B2A4A` | `bg-sidebar` |
| `--qaio-sidebar-fg` | `#E8ECF2` | `text-sidebar-foreground` |
| `--qaio-sidebar-border` | `rgba(255,255,255,0.08)` | `border-sidebar-border` |
| `--qaio-sidebar-accent` | `rgba(76,175,125,0.15)` | `bg-sidebar-accent` |
| `--qaio-sidebar-accent-fg` | `#ffffff` | `text-sidebar-accent-foreground` |

Common mistake: using `hover:bg-accent` or `bg-muted` inside the sidebar.
These resolve to light-mode values and look broken on the navy background.
Always use `hover:bg-sidebar-accent`, `bg-sidebar-accent`, `text-sidebar-foreground/50`.

### Borders (opacity)
Use `border-border` (token). For inline overrides: `border-black/[0.05]` light, `border-black/[0.15]` heavy.

### Color restraint
Color is intentional. Allowed uses:
1. card-running-glow gradient (green/navy comet trail)
2. Status indicators (`text-success`, `text-destructive`, `text-warning`)
3. Agent/channel avatars (per-agent color via `resolveAgentColor`)
4. Links
5. Sidebar accent highlight

Never decorative color. Never hardcode hex in components.

### Agent avatars
Use `QaioAvatar` from `@qaio-ai/core`. Resting state = no border, secondary bg mixed with agent color, colored helmet glyph. Running state = same badge inside the comet glow. Resolve stored semantic ids with `resolveAgentColor` from `@qaio-ai/core`, not app-local helpers.

## Brand theming
All brand values flow through `--qaio-*` tokens in `globals.css`. Components consume them via `@theme` Tailwind mapping. NEVER hardcode hex. To rebrand: edit the `:root` block, everything updates.

## Typography
System font stack. No webfonts.

| Element | Size | Weight | Tailwind |
|---------|------|--------|----------|
| h1 | 28px | 400 | `text-[28px]` |
| model selector | 18px | 400 | `text-lg` |
| body/input | 16px | 400 | `text-base` |
| buttons | 14px | 500 | `text-sm font-medium` |
| sidebar items | 14px | 400 | `text-sm` |
| small labels | 12px | 400 | `text-xs` |

Section headers: sentence case, never uppercase/tracking-wider. `text-sm font-medium`.

## Buttons
Pill shape (`rounded-full`) everywhere.

- **Primary:** `bg-primary text-primary-foreground rounded-full h-9 px-3 text-sm font-medium hover:opacity-90`
- **Secondary:** `bg-card text-primary rounded-full h-9 px-3 border border-primary/15 hover:bg-secondary`
- **Ghost:** `bg-transparent rounded-lg w-9 h-9 hover:bg-secondary`
- **Soft chip:** `bg-secondary rounded-full h-9 px-3 hover:bg-muted`
- **Large:** `h-11 px-4`

## Composer (signature)
`max-w-3xl rounded-[28px] bg-card p-2.5` + multi-shadow:
```
0 4px 4px rgba(0,0,0,0.04),
0 4px 80px 8px rgba(0,0,0,0.04),
0 0 1px rgba(0,0,0,0.62)
```
Grid: leading (attach) | primary (text) | trailing (send).

## Messages
- **User:** `ml-auto max-w-[70%] rounded-3xl bg-secondary px-5 py-2.5`
- **Assistant:** no bubble. Plain markdown, left-aligned, transparent.

## Cards
`bg-card`, `border-border`, `rounded-xl`, hover shadow. Running state = `card-running-glow` animation border.

## Empty states
`Empty` from `@qaio-ai/core`. Big `text-2xl font-semibold` title + description + optional action. No icon-in-box. Container must be `flex flex-col` for `flex-1 justify-center`.

## Progress panel
`ProgressPanel` from `@qaio-ai/chat`. Agent calls `update_progress({steps})`. States: pending (empty circle) / active (spinner + highlight) / done (`bg-success` check). Header: "X of Y steps complete". Renders right-side alongside ChatPanel.

## Layout

```
+----------+---------------+-------------+
| Sidebar  | Tab Bar       | Right Panel |
| 200px    |---------------| (optional)  |
|          | Main Content  |             |
+----------+---------------+-------------+
```

Sidebar 220px (`w-[220px]`), navy `bg-sidebar` with subtle gradient. Right panel 45% width, 380px min. Split view resizable, default 55/45. Chat max-width 768px (`max-w-3xl`). Header 52px.

### Dashboard header
Time-based greeting (`DashboardHeader`) + five `StatPill` components showing active, running, needs-you, agents, completed counts. Uses `useAgentActivitySummaries` hook. Greeting key: morning (< 12), afternoon (< 18), evening. i18n keys in `dashboard` namespace.

### Radii
`rounded` (0.25rem chips) / `rounded-md` (inputs) / `rounded-lg` (sidebar items, icon btns) / `rounded-xl` (cards) / `rounded-2xl` (large cards, dialogs) / `rounded-[28px]` (composer) / `rounded-full` (pills, avatars)

### Button sizes
`h-9` standard / `h-11` large / `w-9 h-9` icon

## Shadows
Composer shadow = main depth cue. Else flat or 1px edge: `0 1px 0 rgba(0,0,0,0.05)`.

## Animation
- **card-running-glow** -- rotating conic-gradient border. Green/navy comet trail. 2.5s infinite. Uses `var(--glow-accent)` and `var(--glow-primary)`, no hardcoded hex.
- **Framer Motion (Board):** enter `opacity:0, y:8` -> `opacity:1, y:0`. Exit `y:-8`. Duration 0.2s, easing `[0.25, 0.1, 0.25, 1]`. `AnimatePresence` with `popLayout`.
- **Spring preferred:** `{type:"spring", stiffness:300, damping:30, mass:1}`.
- **typing-bounce** -- 3-dot indicator, vertical translate + opacity.
- **tool-pulse** -- pulsing dot, 1s, active tool calls.

Duration: fast 0.2s / common 0.667s / bounce 0.833s / elegant 0.582s. Under 0.3s for interactions.

Rules: `layout` prop on reordering items. `AnimatePresence mode="popLayout"` for lists. Spring > CSS easing.

## Icons
Lucide React only. 20px standard (`h-5 w-5`), 16px small, 24px large. Stroke 2px (or 1.5px lighter). `currentColor`.

**No emoji as icons.**

## Rules
1. No emoji icons
2. No hover-only affordances
3. Token colors only, never hardcode hex
4. Compact not cramped
5. Animations serve purpose
6. Pill shapes for buttons (`rounded-full`)
7. Brand via `--qaio-*` tokens only

## Design skill workflow
1. `/critique` -- before building
2. `/polish` -- final alignment/spacing/consistency pass
Use when relevant: `/clarify` (UX copy), `/distill` (overloaded screen), `/animate` (micro-interactions), `/audit` (a11y, perf).
