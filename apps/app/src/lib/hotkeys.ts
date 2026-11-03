// Keyboard shortcut registry: the catalog of every shortcut (the `?` sheet and
// the command menu's hints render from it) plus the pure matching logic used by
// `composables/useHotkeys.ts`. No DOM access here so it stays unit-testable.

/** Where a shortcut applies. Higher scopes win when several bind the same key. */
export type HotkeyScope = 'global' | 'list' | 'issue' | 'picker'

export const SCOPE_PRECEDENCE: Record<HotkeyScope, number> = {
  global: 0,
  list: 1,
  issue: 2,
  picker: 3,
}

export const SCOPE_LABELS: Record<HotkeyScope, string> = {
  global: 'General',
  list: 'Issue list',
  issue: 'Issue',
  picker: 'Issue properties',
}

export type ShortcutDefinition = {
  /**
   * One or more alternatives. Each is a sequence of strokes separated by spaces
   * (`g i` is a chord); a stroke is `+`-joined modifiers and a key (`mod+k`).
   * `mod` is ⌘ on macOS and Ctrl elsewhere.
   */
  keys: string | readonly string[]
  label: string
  scope: HotkeyScope
  /** Also fires while typing in an input or editor. Only for modifier combos. */
  allowInInputs?: boolean
  /** Also fires while a dialog or popover is open (the handler decides where it applies). */
  inDialog?: boolean
}

export const SHORTCUTS = {
  'command-menu': {
    keys: 'mod+k',
    label: 'Open command menu',
    scope: 'global',
    allowInInputs: true,
    inDialog: true,
  },
  'create-issue': { keys: 'c', label: 'Create issue', scope: 'global' },
  'shortcuts-help': { keys: '?', label: 'Keyboard shortcuts', scope: 'global' },
  'go-inbox': { keys: 'g i', label: 'Go to Inbox', scope: 'global' },
  'go-my-issues': { keys: 'g m', label: 'Go to My issues', scope: 'global' },
  'go-projects': { keys: 'g p', label: 'Go to Projects', scope: 'global' },
  'go-team-issues': { keys: 'g t', label: "Go to team's issues", scope: 'global' },
  // Handled by key code in WorkspaceLayout (⌥F types "ƒ" on macOS); listed here for the sheet.
  'toggle-favorite': { keys: 'alt+f', label: 'Favorite / unfavorite', scope: 'global' },
  'list-filter': { keys: 'f', label: 'Filter issues', scope: 'list' },
  'list-details': { keys: 'mod+i', label: 'Toggle details panel', scope: 'list' },
  'list-next': { keys: ['j', 'arrowdown'], label: 'Move down', scope: 'list' },
  'list-prev': { keys: ['k', 'arrowup'], label: 'Move up', scope: 'list' },
  'list-open': { keys: 'enter', label: 'Open focused issue', scope: 'list' },
  'list-select': { keys: 'x', label: 'Select focused issue', scope: 'list' },
  'list-clear': { keys: 'escape', label: 'Clear focus', scope: 'list' },
  'list-delete': { keys: 'mod+backspace', label: 'Delete focused issue', scope: 'list' },
  'issue-next': { keys: 'j', label: 'Next issue', scope: 'issue' },
  'issue-prev': { keys: 'k', label: 'Previous issue', scope: 'issue' },
  'issue-back': { keys: 'escape', label: 'Go back', scope: 'issue' },
  'issue-delete': { keys: 'mod+backspace', label: 'Delete issue', scope: 'issue' },
  'issue-set-parent': { keys: 'mod+shift+p', label: 'Set parent issue', scope: 'issue' },
  // Copy actions match on key code in useIssueCopy (⌘⇧, gives "<", ⌥P gives "π" on
  // macOS); listed here for the sheet and the button / menu hints.
  'issue-copy-url': { keys: 'mod+shift+,', label: 'Copy issue URL', scope: 'issue' },
  'issue-copy-id': { keys: 'mod+.', label: 'Copy ID', scope: 'issue' },
  'issue-copy-branch': { keys: 'mod+shift+.', label: 'Copy git branch name', scope: 'issue' },
  'issue-copy-prompt': { keys: 'mod+alt+p', label: 'Copy as prompt', scope: 'issue' },
  'issue-status': { keys: 's', label: 'Change status', scope: 'picker', inDialog: true },
  'issue-priority': { keys: 'p', label: 'Change priority', scope: 'picker', inDialog: true },
  'issue-assignee': { keys: 'a', label: 'Assign to', scope: 'picker', inDialog: true },
  'issue-labels': { keys: 'l', label: 'Change labels', scope: 'picker', inDialog: true },
  'issue-due-date': {
    keys: 'shift+d',
    label: 'Change due date',
    scope: 'picker',
    inDialog: true,
  },
  'issue-cycle': { keys: 'shift+c', label: 'Change cycle', scope: 'picker', inDialog: true },
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutId = keyof typeof SHORTCUTS

export const CHORD_TIMEOUT_MS = 1000

const MODIFIER_ORDER = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

/** `shift+Mod+K` → `mod+shift+k`: lower case, modifiers in a fixed order. */
export function normalizeStroke(stroke: string): string {
  const parts = stroke.toLowerCase().split('+')
  const key = parts.pop() ?? ''
  const mods = MODIFIER_ORDER.filter((m) => parts.includes(m))
  return [...mods, key].join('+')
}

/** The alternatives of a definition, each as a list of normalized strokes. */
export function toSequences(keys: ShortcutDefinition['keys']): string[][] {
  const list = typeof keys === 'string' ? [keys] : keys
  return list.map((alt) => alt.trim().split(/\s+/).map(normalizeStroke))
}

export type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>

/**
 * The stroke a key event produces. Shift is dropped for printable symbols,
 * whose key already includes it (`?` is Shift+/), but kept for letters.
 */
export function eventStroke(event: KeyEventLike, mac = isMacPlatform()): string {
  const mods: string[] = []
  if (mac ? event.metaKey : event.ctrlKey) mods.push('mod')
  if (mac && event.ctrlKey) mods.push('ctrl')
  if (!mac && event.metaKey) mods.push('meta')
  if (event.altKey) mods.push('alt')
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase()
  const symbol = event.key.length === 1 && !/[a-z]/i.test(event.key)
  if (event.shiftKey && !symbol) mods.push('shift')
  return [...mods, key].join('+')
}

/** True when the stroke uses ⌘/Ctrl (or Alt), i.e. it can't be ordinary typing. */
export function isModifierStroke(stroke: string): boolean {
  return /^(mod|ctrl|meta|alt)\+/.test(stroke)
}

type ElementLike = { tagName?: string; closest?: (selector: string) => unknown }

const TYPING_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range'])

/** Inputs, textareas, selects and editors (contenteditable, incl. the description editor). */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as ElementLike & { type?: string }
  if (el.tagName === 'INPUT' && el.type && NON_TEXT_INPUTS.has(el.type)) return false
  return typeof el.closest === 'function' && Boolean(el.closest(TYPING_SELECTOR))
}

export type HotkeyBinding = {
  id: string
  scope: HotkeyScope
  sequences: string[][]
  allowInInputs?: boolean
  /** Registration order; among equal scopes the latest (innermost) wins. */
  order: number
}

export type ChordState = { pending: string[]; at: number } | null

export type MatchResult<B extends HotkeyBinding> = {
  /** Bindings to try, best first; a handler may decline and pass to the next. */
  matches: B[]
  state: ChordState
}

const startsWith = (seq: string[], prefix: string[]) =>
  seq.length > prefix.length && prefix.every((stroke, i) => seq[i] === stroke)
const equals = (seq: string[], other: string[]) =>
  seq.length === other.length && other.every((stroke, i) => seq[i] === stroke)

function byPrecedence<B extends HotkeyBinding>(a: B, b: B) {
  return SCOPE_PRECEDENCE[b.scope] - SCOPE_PRECEDENCE[a.scope] || b.order - a.order
}

/**
 * Resolves one stroke against the registered bindings. A stroke that starts a
 * chord is held (`state.pending`) for `CHORD_TIMEOUT_MS`; the next stroke either
 * completes it or, failing that, is matched on its own. While typing, only
 * bindings that opt in with `allowInInputs` and use a modifier can match.
 */
export function matchHotkey<B extends HotkeyBinding>(
  bindings: readonly B[],
  stroke: string,
  { now, state, typing }: { now: number; state: ChordState; typing: boolean },
): MatchResult<B> {
  const eligible = typing
    ? bindings.filter((b) => b.allowInInputs && isModifierStroke(stroke))
    : bindings
  const find = (seq: string[]) => ({
    exact: eligible.filter((b) => b.sequences.some((s) => equals(s, seq))).sort(byPrecedence),
    prefix: eligible.some((b) => b.sequences.some((s) => startsWith(s, seq))),
  })

  if (state && !typing && now - state.at <= CHORD_TIMEOUT_MS) {
    const seq = [...state.pending, stroke]
    const { exact, prefix } = find(seq)
    if (exact.length) return { matches: exact, state: null }
    if (prefix) return { matches: [], state: { pending: seq, at: now } }
  }

  const { exact, prefix } = find([stroke])
  if (exact.length) return { matches: exact, state: null }
  if (prefix) return { matches: [], state: { pending: [stroke], at: now } }
  return { matches: [], state: null }
}

const KEY_LABELS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
  space: 'Space',
}
const MAC_LABELS: Record<string, string> = {
  mod: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  backspace: '⌫',
}
const OTHER_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  meta: 'Win',
  alt: 'Alt',
  shift: 'Shift',
  backspace: 'Backspace',
}

/** Key caps for one alternative: `g i` → [['G'], ['I']], `mod+k` → [['⌘', 'K']] on macOS. */
export function formatSequence(sequence: string[], mac = isMacPlatform()): string[][] {
  const platform = mac ? MAC_LABELS : OTHER_LABELS
  return sequence.map((stroke) =>
    stroke
      .split('+')
      .map(
        (key) => platform[key] ?? KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key),
      ),
  )
}

/** Key caps for a catalog shortcut's first alternative. */
export function shortcutKeys(id: ShortcutId, mac = isMacPlatform()): string[][] {
  const [first] = toSequences(SHORTCUTS[id].keys)
  return first ? formatSequence(first, mac) : []
}

export type ShortcutGroup = {
  scope: HotkeyScope
  label: string
  shortcuts: { id: ShortcutId; label: string; keys: string[][][] }[]
}

/** The catalog grouped by scope, for the `?` sheet. */
export function groupShortcuts(mac = isMacPlatform()): ShortcutGroup[] {
  const ids = Object.keys(SHORTCUTS) as ShortcutId[]
  return (Object.keys(SCOPE_LABELS) as HotkeyScope[]).flatMap((scope) => {
    const shortcuts = ids
      .filter((id) => SHORTCUTS[id].scope === scope)
      .map((id) => ({
        id,
        label: SHORTCUTS[id].label,
        keys: toSequences(SHORTCUTS[id].keys).map((seq) => formatSequence(seq, mac)),
      }))
    return shortcuts.length ? [{ scope, label: SCOPE_LABELS[scope], shortcuts }] : []
  })
}
