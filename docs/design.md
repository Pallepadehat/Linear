## Overview

> **Scope.** This file starts from Linear's marketing site. Inside the product app (`apps/app`), **Linear's product UI is the reference**: where the two differ, "Product UI (App)" below wins. The goal is that the app looks like Linear itself, in light and dark.

Linear's marketing canvas is the deepest dark surface in this collection — `{colors.canvas}` is #010102, essentially pure black with a faint blue tint. On top sits a four-step surface ladder (`{colors.surface-1}` through `{colors.surface-4}`) for cards, panels, and lifted tiles, with hairline borders running from `{colors.hairline}` (#23252a) up through `{colors.hairline-strong}` and `{colors.hairline-tertiary}`. Light gray text (`{colors.ink}` #f7f8f8) carries the body and headlines.

The single chromatic accent is **Linear lavender-blue** `{colors.primary}` (#5e6ad2) — used on the brand mark, focus rings, and the primary CTA button. A lighter hover state (`{colors.primary-hover}` #828fff) and a focus-tinted variant (`{colors.primary-focus}` #5e69d1) extend the same hue. Linear avoids saturated greens, oranges, reds, etc. on the marketing canvas — the only semantic color is `{colors.semantic-success}` (#27a644) for status pills and the rare success indicator.

Display type runs Linear's custom sans (with `SF Pro Display` fallback) at weight 500–700 with negative letter-spacing scaling from -3.0px at 80px down to 0 at body. The body family is Linear's text cut, and a Linear Mono is reserved for code snippets in product screenshots.

The page rhythm is **dense product screenshots** — Linear's marketing leads with high-fidelity captures of the product UI (issue list, project view, dashboard) framed in `{colors.surface-1}` panels with `{rounded.xl}` 16px corners. The chrome is intentionally minimal so the app screenshots can do the heavy lifting.

**Key Characteristics:**

- **Dark-canvas marketing system** — `{colors.canvas}` (#010102) is the deepest dark in this collection.
- **Lavender-blue brand accent** (`{colors.primary}` #5e6ad2) — used scarcely on brand mark, focus, and the primary CTA.
- Four-step surface ladder (canvas → surface-1 → surface-2 → surface-3 → surface-4) carries hierarchy without shadow.
- Display tracking pulls aggressively negative (-3.0px at 80px); body holds at -0.05px.
- Cards use `{rounded.lg}` 12px corners with 1px hairline borders — never pill, rarely 16px.
- **Product UI screenshots** dominate the page. The marketing chrome is a dark frame for the app.
- No second chromatic color. No atmospheric gradients. No spotlight cards.

## Colors

> Source pages: linear.app (home), /intake, /pricing, /contact/sales, /build.

### Brand & Accent

- **Lavender-Blue** ({colors.primary}): The signature Linear accent — primary CTA, brand mark, link emphasis.
- **Lavender Hover** ({colors.primary-hover}): Lighter lavender (#828fff) — hovered state of the primary CTA.
- **Lavender Focus** ({colors.primary-focus}): Focus-ring tint (#5e69d1) — focused inputs, focused buttons.
- **Brand Secure** ({colors.brand-secure}): Muted lavender-gray (#7a7fad) — used in "Linear Security" surfaces.

### Surface

- **Canvas** ({colors.canvas}): Default page background — #010102, near-pure black with a faint blue tint.
- **Surface 1** ({colors.surface-1}): One step above canvas — feature cards, pricing cards, product screenshot panels.
- **Surface 2** ({colors.surface-2}): Two steps above — featured pricing card, hovered cards.
- **Surface 3** ({colors.surface-3}): Three steps above — line-tertiary backgrounds, sub-nav.
- **Surface 4** ({colors.surface-4}): Four steps above — bg-level-3, deepest lifted surface.
- **Hairline** ({colors.hairline}): 1px borders on cards and dividers.
- **Hairline Strong** ({colors.hairline-strong}): Stronger 1px borders — input focus rings.
- **Hairline Tertiary** ({colors.hairline-tertiary}): Tertiary borders for nested surfaces.
- **Inverse Canvas** ({colors.inverse-canvas}): Pure white — surface of the inverse pill CTA on a small set of section openers.
- **Inverse Surface 1** ({colors.inverse-surface-1}): One step above inverse canvas.
- **Inverse Surface 2** ({colors.inverse-surface-2}): Two steps above inverse canvas.

### Text

- **Ink** ({colors.ink}): All headlines and emphasized body type — light gray #f7f8f8.
- **Ink Muted** ({colors.ink-muted}): Secondary type at #d0d6e0 — meta info on hero panels.
- **Ink Subtle** ({colors.ink-subtle}): Tertiary type at #8a8f98 — deselected pricing tabs, footer columns.
- **Ink Tertiary** ({colors.ink-tertiary}): Quaternary at #62666d — disabled, footnotes.

### Semantic

- **Success Green** ({colors.semantic-success}): Status pills, success indicators. The only semantic color on marketing.
- **Overlay** ({colors.semantic-overlay}): Pure black overlay scrim for modals.

## Typography

### Font Family

- **Linear Display** — Linear's custom display sans; fallback `SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto`. Carries display-xl through subhead.
- **Linear Text** — Linear's custom text sans (a slightly different cut tuned for body sizes); same fallback stack. Carries body sizes, button labels, captions.
- **Linear Mono** — Linear's custom mono; fallback `ui-monospace, SF Mono, Menlo`. Used for code snippets in product screenshots and for status / ID tokens.

The marketing surface treats Display and Text as one continuous voice; the family change is silent.

### Hierarchy

| Token                     | Size | Weight | Line Height | Letter Spacing | Use                                         |
| ------------------------- | ---- | ------ | ----------- | -------------- | ------------------------------------------- |
| `{typography.display-xl}` | 80px | 600    | 1.05        | -3.0px         | Largest hero headline                       |
| `{typography.display-lg}` | 56px | 600    | 1.10        | -1.8px         | Section opener headlines                    |
| `{typography.display-md}` | 40px | 600    | 1.15        | -1.0px         | Sub-section headlines                       |
| `{typography.headline}`   | 28px | 600    | 1.20        | -0.6px         | Pricing tier titles, CTA banner heading     |
| `{typography.card-title}` | 22px | 500    | 1.25        | -0.4px         | Feature card title                          |
| `{typography.subhead}`    | 20px | 400    | 1.40        | -0.2px         | Lead body, intro paragraphs                 |
| `{typography.body-lg}`    | 18px | 400    | 1.50        | -0.1px         | Hero subhead, lead paragraphs               |
| `{typography.body}`       | 16px | 400    | 1.50        | -0.05px        | Default body                                |
| `{typography.body-sm}`    | 14px | 400    | 1.50        | 0              | Card body, footer columns                   |
| `{typography.caption}`    | 12px | 400    | 1.40        | 0              | Captions, meta, status                      |
| `{typography.button}`     | 14px | 500    | 1.20        | 0              | All button labels                           |
| `{typography.eyebrow}`    | 13px | 500    | 1.30        | 0.4px          | Section eyebrow (slight positive tracking)  |
| `{typography.mono}`       | 13px | 400    | 1.50        | 0              | Linear Mono for code in product screenshots |

### Principles

- **Aggressive negative tracking on display** (-3.0px at 80px ≈ 4% of size).
- **Single voice from display to body.** Display-xl at 600 → body at 400 — same family, narrower weights.
- **Eyebrow uses positive tracking** (+0.4px) — contrast against the negative-tracked display marks the eyebrow as taxonomy.
- **Mono only in code contexts.** Linear Mono lives inside product screenshots — not on marketing chrome.

### Note on Font Substitutes

Linear's custom typeface isn't publicly distributed; the documented fallback `SF Pro Display, -apple-system, system-ui` is the recommended substitute on macOS. For cross-platform implementation, **Inter** at weight 500 / 600 / 700 is the closest free substitute. **Geist Sans** is also viable. For mono, **JetBrains Mono** or **Geist Mono** at weight 400 closely approximates Linear Mono.

## Layout

### Spacing System

- **Base unit**: 4px.
- **Tokens (front matter)**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- Card interior padding: `{spacing.lg}` 24px on feature/pricing cards; `{spacing.xl}` 32px on testimonial cards; `{spacing.xxl}` 48px on CTA banners.
- Pill button padding: 8px vertical · 14px horizontal — Linear's compact button spec.
- Form input padding: 8px vertical · 12px horizontal.

### Grid & Container

- Max content width sits around 1280px.
- Card grids are 3-up at desktop, 2-up at tablet, 1-up at mobile.
- Pricing tier grid is 3-up; comparison strip below shows checkmarks per tier.
- Product screenshot panels span full content width — they're the protagonist.

### Whitespace Philosophy

The dark canvas IS the whitespace. Sections separate by lift onto surface-1 panels, not by gaps in white. Within a panel, generous `{spacing.lg}` 24px gaps between content blocks; `{spacing.section}` 96px between sections.

## Elevation & Depth

| Level              | Treatment                                                          | Use                                      |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------- |
| 0 (flat)           | No shadow, no border                                               | Default for body type, hero text, footer |
| 1 (charcoal lift)  | `{colors.surface-1}` background on canvas, 1px `{colors.hairline}` | Default cards, product panels            |
| 2 (surface-2 lift) | `{colors.surface-2}` background, 1px `{colors.hairline-strong}`    | Featured pricing card, hovered cards     |
| 3 (surface-3 lift) | `{colors.surface-3}` background                                    | Sub-nav, dropdown menus                  |
| 4 (focus ring)     | 2px `{colors.primary-focus}` outline at 50% opacity                | Focused input, focused button            |

Linear's depth is carried by surface ladder + hairline borders. The brand resists drop shadows on dark almost entirely.

### Decorative Depth

- **Product UI screenshots** dominate as decorative depth.
- **No atmospheric gradients, no spotlight cards.**
- **Subtle white edge highlight** on the top edge of lifted panels — gives the dark surface a faint "pixel rendered" feel.

## Shapes

### Border Radius Scale

| Token            | Value  | Use                                             |
| ---------------- | ------ | ----------------------------------------------- |
| `{rounded.xs}`   | 4px    | Small chips, status badges                      |
| `{rounded.sm}`   | 6px    | Inline tags                                     |
| `{rounded.md}`   | 8px    | All buttons, form inputs                        |
| `{rounded.lg}`   | 12px   | Pricing cards, feature cards, testimonial cards |
| `{rounded.xl}`   | 16px   | Product screenshot panels                       |
| `{rounded.xxl}`  | 24px   | Oversized CTA banners (rare)                    |
| `{rounded.pill}` | 9999px | Status pills, property chips in the app         |
| `{rounded.full}` | 9999px | Avatar circles                                  |

### Photography & Illustration Geometry

- Product UI screenshots dominate; they sit in `{rounded.xl}` 16px tiles with `{spacing.lg}` 24px outer padding.
- Customer logo tiles render at small sizes (~24px logo height) on `{colors.canvas}` with no border.
- Avatar circles in testimonial cards use `{rounded.full}` at 32–40px sizes.

## Components

### Buttons

**`button-primary`** — Lavender CTA. The default primary CTA across all pages.

- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}`, padding 8px 14px, rounded `{rounded.md}`.
- Pressed state lives in `button-primary-pressed` (background shifts to `{colors.primary-focus}`).
- Hover state lives in `button-primary-hover` (background shifts to `{colors.primary-hover}` lighter lavender).

**`button-secondary`** — Charcoal button. Used for secondary CTAs ("Sign in", "Read changelog").

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.button}`, padding 8px 14px, rounded `{rounded.md}`. 1px `{colors.hairline}` border.

**`button-tertiary`** — Plain text button.

- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.button}`, rounded `{rounded.md}`, padding 8px 14px.

**`button-inverse`** — White-on-dark inverse CTA.

- Background `{colors.inverse-canvas}`, text `{colors.inverse-ink}`, type `{typography.button}`, rounded `{rounded.md}`, padding 8px 14px.

### Pricing Tabs

**`pricing-tab-default`** + **`pricing-tab-selected`** — Pill-toggle on `/pricing`.

- Default: `{colors.canvas}` background, `{colors.ink-subtle}` text, rounded `{rounded.pill}`, padding 6px 14px.
- Selected: `{colors.surface-2}` background, `{colors.ink}` text — selected = surface lift.

### Cards & Containers

**`pricing-card`** — Each tier on `/pricing`.

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.lg}`, padding 24px. 1px `{colors.hairline}` border.

**`pricing-card-featured`** — Recommended tier — surface lift to surface-2.

- Background `{colors.surface-2}`, otherwise identical structure.

**`feature-card`** — Generic feature highlight tile.

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.lg}`, padding 24px.

**`product-screenshot-card`** — The dominant card type — frames a high-fidelity Linear app UI screenshot.

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.xl}`, padding 24px.

**`testimonial-card`** — Customer quote with avatar + name + role.

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body-lg}`, rounded `{rounded.lg}`, padding 32px.

**`customer-logo-tile`** — Small tile in the customer marquee.

- Background `{colors.canvas}`, text `{colors.ink-subtle}`, type `{typography.caption}`, rounded `{rounded.xs}`, padding 16px.

**`cta-banner`** — Closing CTA panel near page bottom.

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.headline}`, rounded `{rounded.lg}`, padding 48px.

### Inputs & Forms

**`text-input`** + **`text-input-focused`** — Form fields on `/contact/sales` and signup overlays.

- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.md}`, padding 8px 12px.
- Focused state retains the same surface; the focus ring is a 2px `{colors.primary-focus}` outline at 50% opacity.

### Status & Build Page

**`changelog-row`** — Each row in `/build` (changelog page) listing version, date, and changes.

- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.xs}`, padding 24px 0. 1px `{colors.hairline}` bottom rule.

**`status-badge`** — Small status pill.

- Background `{colors.surface-2}`, text `{colors.ink-muted}`, type `{typography.caption}`, rounded `{rounded.pill}`, padding 2px 8px.

### Navigation

**`top-nav`** — Sticky dark bar with the Linear wordmark left, primary nav links centered, and a `button-secondary` ("Sign in") + `button-primary` ("Get started") pair right.

- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-sm}`, height 56px.

### Footer

**`footer`** — Dense link grid on `{colors.canvas}` with the Linear wordmark left.

- Background `{colors.canvas}`, text `{colors.ink-subtle}`, type `{typography.caption}`, padding 64px 32px.

## Themes (App)

The product app ships **dark and light themes**. Dark is the reference theme described throughout this document; light mirrors it token for token. Components only ever reference tokens, so switching theme swaps values, never component code.

- Modes: `dark`, `light`, `system` (follows `prefers-color-scheme`). Default: `system`.
- Mechanism: a `.dark` class on `<html>`; tokens are CSS variables defined in `:root` (light) and `.dark` (dark).

### Light Theme Tokens

| Token                          | Light     | Notes                                        |
| ------------------------------ | --------- | -------------------------------------------- |
| `{colors.canvas}`              | #fcfcfd   | Near-white with a faint cool tint (never pure #ffffff) |
| `{colors.surface-1}`           | #f7f7f8   | Cards, panels, sidebar                       |
| `{colors.surface-2}`           | #f1f1f3   | Hovered rows, selected items                 |
| `{colors.surface-3}`           | #ebebee   | Dropdowns, sub-nav                           |
| `{colors.surface-4}`           | #e3e4e8   | Deepest lifted surface                       |
| `{colors.hairline}`            | #e4e5e9   | 1px borders, dividers                        |
| `{colors.hairline-strong}`     | #d3d5da   | Input borders, stronger dividers             |
| `{colors.hairline-tertiary}`   | #c8cad0   | Nested surfaces                              |
| `{colors.ink}`                 | #0f1011   | Headlines, primary text                      |
| `{colors.ink-muted}`           | #3c4149   | Secondary text                               |
| `{colors.ink-subtle}`          | #6b6f76   | Tertiary text, meta                          |
| `{colors.ink-tertiary}`        | #8a8f98   | Disabled, placeholders                       |
| `{colors.primary}`             | #5e6ad2   | Same lavender in both themes                 |
| `{colors.primary-hover}`       | #4c57c0   | Darker on light (dark theme lightens to #828fff) |
| `{colors.primary-focus}`       | #5e69d1   | Focus ring, 2px at 50% opacity               |
| `{colors.on-primary}`          | #ffffff   |                                              |
| `{colors.semantic-success}`    | #1f8a3a   | Slightly darker for contrast on light        |
| `{colors.semantic-overlay}`    | rgba(15,16,17,0.4) | Modal scrim                         |
| `{colors.status-neutral}`      | #959ba5   | Backlog / Todo / Canceled icons (dark: #8a8f98) |
| `{colors.status-started}`      | #e8b10e   | In-progress status icon (dark: #f2c94c)      |
| `{colors.status-completed}`    | #5e6ad2   | Done status icon (dark: #6c78e6)             |
| `{colors.priority-urgent}`     | #d24a12   | Urgent priority icon (dark: #fc7840)         |
| `{colors.floating}`            | #fefefe   | Popovers and menus (dark: #1c1d1f)           |
| `{colors.floating-hover}`      | #f0f0f2   | Highlighted row inside a popover (dark: #28292d) |
| `{colors.app-base}`            | #f3f3f5   | App shell base under the sidebar (dark: #010102) |
| `{colors.panel}`               | #fcfcfd   | Raised content panel (dark: #0f1011)         |
| `{colors.group-band}`          | #f1f1f3   | Group header band in lists (dark: #18191b)   |
| `{colors.board-card}`          | #fefefe   | Board cards (= `floating`; dark: `surface-3`) |

Status icons map by category: `backlog` dashed circle, `unstarted` empty circle and `canceled` filled cross in `status-neutral`; `started` half-filled circle in `status-started`; `completed` filled check in `status-completed`. Priority icons: Urgent is a filled square with `!` in `priority-urgent`; High / Medium / Low are 3 bars with 3 / 2 / 1 filled in `ink-muted`; No priority is three dashes in `ink-tertiary`.


### Theme Rules

- Dialog scrims use `{colors.semantic-overlay}` (the `overlay` token), never a raw black.
- Hierarchy works the same way in both themes: canvas → surface-1 → … → surface-4, separated by hairlines. In light mode a lift is a step *darker*.
- Floating layers (menus, popovers, dialogs) sit on `{colors.floating}`, one step *lighter* than the page in light mode and lifted in dark, with a hairline border. Light mode adds a very soft shadow: `0 4px 16px rgba(15,16,17,0.08)`. Cards and panels stay shadow-free.
- Status, priority and label colors use Linear's product hues and keep them across themes (tuned per theme). Text stays ≥ 4.5:1; a colored icon may fall below 3:1 (e.g. yellow In Progress on light) as long as its text label sits next to it.
- Every component must be checked in both themes before it is considered done.

## Product UI (App)

The app copies Linear's product UI. When building a screen, compare it side by side with Linear in both themes; when this section and the marketing rules above disagree, this section wins.

### Color in the product

Lavender stays scarce on chrome, but the product uses a small semantic palette, exactly like Linear:

| Use                     | Token                    | Look                                  |
| ----------------------- | ------------------------ | ------------------------------------- |
| Backlog / Todo / Canceled | `status-neutral`       | Gray dashed ring / ring / filled ×    |
| In Progress             | `status-started`         | Yellow half-filled ring               |
| Done                    | `status-completed`       | Lavender filled check                 |
| Urgent                  | `priority-urgent`        | Orange filled square with `!`         |
| High / Medium / Low     | `ink-muted`              | 3 bars, 3 / 2 / 1 filled              |
| No priority             | `ink-tertiary`           | Three dashes                          |
| Labels                  | the label's own color    | 8px dot before the name               |

Lavender in the app is allowed for: primary actions, focus rings, the brand mark, link emphasis, the text caret, the Done status icon and selected/active states. Never as a section or card fill.

### Components

**Property chip** (issue properties: status, priority, assignee, labels, project). Icon + value in `ink`, 13px, `h-7`, `px-2`, `{rounded.pill}`. Transparent at rest; `surface-2` on hover and while its menu is open. Empty values read in `ink-subtle` ("Unassigned", "Labels").

**Picker popover** (opened from a property chip).

- `floating` surface, `{rounded.lg}`, 1px `hairline` border, light-mode floating shadow. Width 240px, opens aligned to the chip's start edge.
- Header: plain filter input (no search icon), 40px tall, `px-3.5`, placeholder in `ink-tertiary` ending in "..." ("Change status...", "Assign to..."), lavender caret, and the picker's hotkey on the right as a 20px `{rounded.xs}` key cap with a `hairline-strong` border. A hairline divides header and list.
- Rows: 32px, `px-2.5`, `{rounded.md}`, 13px `ink`, 16px icon or avatar, 10px gap. Highlighted row on `floating-hover`. On the right: a check on the current value, then the row's number shortcut in `ink-subtle`.
- Keyboard: arrows move, Enter picks, Escape closes and returns focus to the chip. A number key picks that row while the filter is empty (`0` = "No priority" / "No assignee", then `1…9`). The current value is highlighted when the menu opens. Multi-select pickers (labels) stay open while toggling.
- Optional group headings (e.g. "Team members") in 13px `ink-subtle`, no divider.

**Avatar.** Always a circle (`{rounded.full}`), 16px in rows and chips, 20px in lists, 32px in member rows. Image when available, otherwise initials.

**Menus** (dropdowns, context menus) use the same `floating` surface, row height and highlight as the picker popover.

**App shell (inset).** Like Linear, the window is a `app-base` canvas: the 224px sidebar sits directly on it (no border, no fill), and the content is a raised `panel` inset 8px from the top, right and bottom, `{rounded.lg}`, 1px `hairline` border, light-mode `panel` shadow (`0 1px 2px rgba(15,16,17,0.04)`; none in dark). The panel header is 44px with a hairline below: breadcrumb on the left (parents in `ink-muted`, `›` separators in `ink-tertiary`, current page in `ink`) and a ghost "New issue" button on the right. Sidebar rows hover on `surface-3` and the active row is `surface-4`. The compose button beside the workspace menu is a 28px circle on `panel`.

**Issue list.** Rows 36px, inset 8px from the panel edges with `{rounded.md}` hover on `surface-2`; left padding 20px. Order: priority icon, identifier (JetBrains Mono 12px `ink-subtle`, fixed 64px column), status icon, title (13px medium `ink`, truncates), label chips (22px, `{rounded.pill}`, hairline border, 8px color dot, 12px `ink-muted`), assignee avatar (16px; dashed unassigned icon), created date (12px `ink-subtle`, tabular). Group headers are a 32px `group-band` band, `{rounded.md}`, inset like rows: collapse chevron, status icon, status name (medium), count in `ink-subtle`, and a ghost `+` on team lists that opens the create dialog in that status. Loading shows pulsing skeleton rows; empty shows the empty state with a primary "New issue" button.

**Issue board.** A list/board toggle sits in the panel header left of "New issue": a pill with a hairline border holding two 24px circular icon buttons (list, columns), the active one on `surface-3`; arrow keys switch (radio group). The board scrolls horizontally with 12px padding and 12px gaps. Columns are 320px `surface-1` lanes, `{rounded.lg}` (the lane turns `surface-3` while a card it accepts is dragged over it); 40px header with status icon, status name (medium), count in `ink-subtle`, and a ghost `+` on team boards. Cards are `board-card` with a 1px `hairline` border (`hairline-strong` on hover), `{rounded.lg}`, light `panel` shadow, 6px apart: identifier (12px mono `ink-subtle`) with the assignee avatar on the right, title (13px medium `ink`, two lines max), then compact status, priority and label chips. The dragged card fades to 40%.

**Create issue dialog.** `floating` surface, `{rounded.xl}`, 768px wide, 12% from the top. Expand grows it vertically (88vh, same width): the description fills the space and the property chips and footer stay pinned to the bottom. Header: team chip (property chip with hairline border, JetBrains Mono key) `›` "New issue", expand and close icon buttons on the right. Title input 18px semibold, no border; description is the markdown editor (14px), placeholder "Add description...". Property chips (status, priority, assignee, labels) sit in a row with hairline borders. Footer (no divider): "Create more" switch and the primary 28px "Create issue" button. Validation errors ("Required" under the title) appear only after pressing Create issue and clear as soon as the field is fixed. Keys: `C` opens it anywhere outside a text field; `S` / `P` / `A` / `L` open the status, priority, assignee and labels pickers when focus isn't in a text field (only the topmost dialog's pickers respond); Enter in the title moves to the description, ⌘/Ctrl+Enter submits, Esc closes.

**Markdown editor** (`components/common/editor`). Markdown shortcuts as you type (`#`–`###`, `-`, `1.`, `[]`, `>`, ```` ``` ````, `---`, `**bold**`, `` `code` ``). Typing `/` at the start of a word opens the block menu, with Linear's items, order and shortcuts, grouped by hairlines: Heading 1–3 (⌘⌥1–3) · Bulleted list (⌘⇧8), Numbered list (⌘⇧9), Checklist (⌘⇧7) · Insert media…, Attach files… (⌘⇧U) · Code block (⌘⇧\\), Diagram, LaTeX math block, Collapsible section (⌘⇧6), Blockquote (⌥⇧.). Look: `floating`, `hairline-strong` border, 256px wide, 32px rows with a 16px `ink-muted` icon, 13px label and the shortcut in 12px `ink-subtle` (⌘ ⌥ ⇧ on macOS, Ctrl/Alt/Shift elsewhere); arrows/Enter/Tab/Esc. Every listed shortcut also works directly in the editor. Selecting text shows a 32px pill toolbar on `floating` with a `hairline-strong` border and 24px circular buttons: bold, italic, strikethrough, inline code, quote, link (inline URL field). Blocks: code blocks on `surface-1`; diagrams (```` ```mermaid ````) show the rendered chart on `surface-1` above their source, re-rendered as you type; LaTeX blocks show the typeset formula and, while selected, a mono source field (Esc or ⌘↵ returns to the text); collapsible sections have a chevron toggle (rotates when open), a medium-weight title (placeholder "Section title"), Enter in the title continues in the body and Enter on an empty last line leaves the section. Attachments: the round paperclip button bottom-left of the dialog footer, ⌘⇧U, paste or drop upload into the description; dragging files over the editor shows a dashed `primary` drop zone ("Drop files to attach"). Images appear inline at once (local preview at 60% with an "Uploading…" pill, max 384px tall, `{rounded.md}`, hairline border); other files become a chip (paperclip, name, `surface-1`, hairline, `{rounded.md}`) that opens the file in a new tab. The footer shows "Uploading N files…" with a spinner, and Create issue waits for uploads to finish. Content styles: headings 20/17/15px semibold, list markers `ink-subtle`, checkboxes 14px `{rounded.xs}` turning `primary` when checked (checked text struck through in `ink-subtle`), blockquote 2px `hairline-strong` left rule in `ink-muted`, inline code mono on `surface-2` with a hairline, code blocks on `surface-1` `{rounded.md}`, links `primary`, selection `primary` at 25%.

### Density

- 13px body (UI text, menus, inputs, buttons), 12px meta (identifiers, dates, label chips, captions), 14px editor text, 18px dialog titles. Linear's app is a step smaller than its marketing site; don't use the 14–16px marketing sizes in the app.
- Controls 28px (`Button size="sm"`, property chips, sidebar rows); primary page CTAs 32px. Menu rows 32px. List rows 36px; group headers a 32px band in a 40px slot. Panel header 44px. Sidebar 224px.
- Avatars 16px in rows and chips, 20px in member lists.
- Icons 14–16px. Spacing on a 4px grid.

## Do's and Don'ts

### Do

- Reserve `{colors.canvas}` (#010102) as the system's anchor surface — the faint blue tint is intentional.
- Use `{colors.primary}` lavender ONLY for: brand mark, primary CTA, focus ring, link emphasis (plus the in-app uses listed under "Product UI (App)").
- Use the four-step surface ladder for hierarchy. Avoid skipping levels.
- Pair display weight 600 with body weight 400 — Linear resists 700+ display weights.
- Apply negative letter-spacing aggressively on display.
- Use product UI screenshots as the protagonist of every section.
- Compose CTAs as `{rounded.md}` 8px corners.
- In the app, match Linear's product UI side by side in light and dark before calling a screen done.

### Don't

- Don't hard-code colors; always use tokens so both themes work.
- Don't use lavender as a section background or card fill.
- Don't introduce a second chromatic accent on marketing or app chrome. The product's semantic palette (status, priority, labels) is the only exception.
- Don't add atmospheric gradients or spotlight cards.
- In the app, buttons are pills (`{rounded.pill}`) and icon-only buttons are circles, like Linear's product UI; inputs stay `{rounded.md}`. The `{rounded.md}` button specs above describe the marketing site only.
- Don't use `#000000` true black as the canvas.
- Don't combine multiple bright accents in product screenshot mockups.

## Responsive Behavior

### Breakpoints

| Name       | Width  | Key Changes                                         |
| ---------- | ------ | --------------------------------------------------- |
| Desktop-XL | 1440px | Default desktop layout                              |
| Desktop    | 1280px | Card grid 3-up maintained                           |
| Tablet     | 1024px | Card grid 3-up → 2-up                               |
| Mobile-Lg  | 768px  | Pricing comparison becomes accordion; nav hamburger |
| Mobile     | 480px  | Single-column; display-xl scales 80px → ~36px       |

### Touch Targets

- CTAs hold ≥40px tap height across viewports.
- Pricing tab pills hold ≥36px tap height; touch viewports grow to ≥44px.
- Form inputs hold ≥44px tap target on touch.

### Collapsing Strategy

- **Top nav**: links collapse to hamburger below 768px.
- **Card grids**: 3-up → 2-up at 1024px → 1-up below 768px.
- **Pricing comparison**: per-tier accordion below 768px.
- **Display type**: `{typography.display-xl}` 80px scales toward `{typography.display-md}` 40px on mobile.

### Image Behavior

- Product UI screenshots maintain aspect ratio and never crop.
- Customer logos in the marquee may collapse from 6-up to 3-up below 768px.

## Iteration Guide

1. Focus on ONE component at a time and reference it by its `components:` token name.
2. When introducing a section, decide first which surface lift it lives on.
3. Default body to `{typography.body}` at weight 400.
4. Run `npx @google/design.md lint DESIGN.md` after edits.
5. Add new variants as separate component entries.
6. Treat lavender as scarce: brand mark, primary CTA, focus, link emphasis (and the in-app exceptions under "Product UI (App)").
7. Lead every section with a product UI screenshot.

## Known Gaps

- The four-step surface ladder values are extracted directly from Linear's `--color-bg-level-3`, `--color-line-tint`, etc. CSS variables; they are Linear's canonical surface spec.
- Form-field error and validation styling is not visible on the inspected pages.
- The light theme (see "Themes (App)") is derived for the product app; Linear's marketing site itself is dark-only.
- "Product UI (App)" is taken from Linear's app (light and dark) by side-by-side comparison, not from a published spec. Values are approximations; when in doubt, compare with Linear again.
- Linear's actual product UI uses a richer color-tag palette (red, orange, yellow, green, blue, purple) for issue priorities and project labels — those colors live in the in-product surfaces shown in mockups.
- The custom display, text, and mono families are proprietary; an open-source substitute is acceptable.
