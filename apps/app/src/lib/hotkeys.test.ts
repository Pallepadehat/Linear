import { describe, expect, it } from 'vitest'
import {
  CHORD_TIMEOUT_MS,
  eventStroke,
  formatSequence,
  groupShortcuts,
  isTypingTarget,
  matchHotkey,
  normalizeStroke,
  SHORTCUTS,
  toSequences,
  type HotkeyBinding,
  type HotkeyScope,
} from './hotkeys'

const key = (
  k: string,
  mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>> = {},
) => ({
  key: k,
  metaKey: Boolean(mods.meta),
  ctrlKey: Boolean(mods.ctrl),
  altKey: Boolean(mods.alt),
  shiftKey: Boolean(mods.shift),
})

let order = 0
const bind = (
  id: string,
  keys: string | string[],
  scope: HotkeyScope = 'global',
  allowInInputs = false,
): HotkeyBinding => ({ id, scope, sequences: toSequences(keys), allowInInputs, order: order++ })

const ids = (result: { matches: HotkeyBinding[] }) => result.matches.map((b) => b.id)
const idle = { now: 0, state: null, typing: false }

describe('eventStroke', () => {
  it('normalizes ⌘ on macOS and Ctrl elsewhere to mod', () => {
    expect(eventStroke(key('k', { meta: true }), true)).toBe('mod+k')
    expect(eventStroke(key('k', { ctrl: true }), false)).toBe('mod+k')
    // The other platform's key is not `mod`.
    expect(eventStroke(key('k', { ctrl: true }), true)).toBe('ctrl+k')
    expect(eventStroke(key('k', { meta: true }), false)).toBe('meta+k')
  })

  it('keeps shift on letters but not on symbols that include it', () => {
    expect(eventStroke(key('?', { shift: true }), true)).toBe('?')
    expect(eventStroke(key('C', { shift: true }), true)).toBe('shift+c')
    expect(eventStroke(key('Backspace', { meta: true }), true)).toBe('mod+backspace')
    expect(eventStroke(key('ArrowDown'), true)).toBe('arrowdown')
  })

  it('matches the catalog notation regardless of modifier order', () => {
    expect(normalizeStroke('Shift+Mod+K')).toBe('mod+shift+k')
  })
})

describe('matchHotkey', () => {
  it('matches single keys and alternatives', () => {
    const bindings = [bind('create', 'c'), bind('next', ['j', 'arrowdown'], 'list')]
    expect(ids(matchHotkey(bindings, 'c', idle))).toEqual(['create'])
    expect(ids(matchHotkey(bindings, 'arrowdown', idle))).toEqual(['next'])
    expect(ids(matchHotkey(bindings, 'q', idle))).toEqual([])
  })

  it('completes a chord within the timeout', () => {
    const bindings = [bind('inbox', 'g i'), bind('mine', 'g m')]
    const first = matchHotkey(bindings, 'g', idle)
    expect(first.matches).toEqual([])
    expect(first.state).toEqual({ pending: ['g'], at: 0 })
    const second = matchHotkey(bindings, 'i', { now: 500, state: first.state, typing: false })
    expect(ids(second)).toEqual(['inbox'])
    expect(second.state).toBeNull()
  })

  it('drops a chord after the timeout and matches the key on its own', () => {
    const bindings = [bind('inbox', 'g i'), bind('assign', 'i')]
    const { state } = matchHotkey(bindings, 'g', idle)
    const late = matchHotkey(bindings, 'i', {
      now: CHORD_TIMEOUT_MS + 1,
      state,
      typing: false,
    })
    expect(ids(late)).toEqual(['assign'])
  })

  it('falls back to the single key when the chord does not continue', () => {
    const bindings = [bind('inbox', 'g i'), bind('create', 'c')]
    const { state } = matchHotkey(bindings, 'g', idle)
    expect(ids(matchHotkey(bindings, 'c', { now: 10, state, typing: false }))).toEqual(['create'])
  })

  it('ignores plain keys and chords while typing', () => {
    const bindings = [bind('create', 'c'), bind('inbox', 'g i'), bind('delete', 'mod+backspace')]
    const typing = { ...idle, typing: true }
    expect(ids(matchHotkey(bindings, 'c', typing))).toEqual([])
    expect(matchHotkey(bindings, 'g', typing).state).toBeNull()
    // Modifier combos too, unless they opt in (⌘⌫ deletes a word in a field).
    expect(ids(matchHotkey(bindings, 'mod+backspace', typing))).toEqual([])
  })

  it('lets explicit ⌘ combos fire from inputs', () => {
    const bindings = [bind('menu', 'mod+k', 'global', true)]
    expect(ids(matchHotkey(bindings, 'mod+k', { ...idle, typing: true }))).toEqual(['menu'])
  })

  it('cancels a pending chord when typing starts', () => {
    const bindings = [bind('inbox', 'g i')]
    const { state } = matchHotkey(bindings, 'g', idle)
    expect(ids(matchHotkey(bindings, 'i', { now: 10, state, typing: true }))).toEqual([])
  })

  it('orders matches by scope, then innermost registration', () => {
    const global = bind('global-esc', 'escape', 'global')
    const issue = bind('issue-esc', 'escape', 'issue')
    const list = bind('list-esc', 'escape', 'list')
    const picker1 = bind('picker-1', 's', 'picker')
    const picker2 = bind('picker-2', 's', 'picker')
    expect(ids(matchHotkey([global, issue, list], 'escape', idle))).toEqual([
      'issue-esc',
      'list-esc',
      'global-esc',
    ])
    expect(ids(matchHotkey([picker1, picker2], 's', idle))).toEqual(['picker-2', 'picker-1'])
  })
})

describe('isTypingTarget', () => {
  const el = (tagName: string, matches: boolean, type?: string) => ({
    tagName,
    type,
    closest: () => (matches ? {} : null),
  })

  it('detects inputs, textareas and editors', () => {
    expect(isTypingTarget(el('INPUT', true, 'text'))).toBe(true)
    expect(isTypingTarget(el('TEXTAREA', true))).toBe(true)
    // Any element inside a contenteditable editor (the description editor).
    expect(isTypingTarget(el('P', true))).toBe(true)
  })

  it('ignores buttons, checkboxes and the page', () => {
    expect(isTypingTarget(el('BUTTON', false))).toBe(false)
    expect(isTypingTarget(el('INPUT', true, 'checkbox'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('formatting', () => {
  it('shows platform key caps', () => {
    expect(formatSequence(toSequences('mod+k')[0]!, true)).toEqual([['⌘', 'K']])
    expect(formatSequence(toSequences('mod+k')[0]!, false)).toEqual([['Ctrl', 'K']])
    expect(formatSequence(toSequences('g i')[0]!, true)).toEqual([['G'], ['I']])
    expect(formatSequence(toSequences('mod+backspace')[0]!, true)).toEqual([['⌘', '⌫']])
  })

  it('groups every catalog shortcut by scope for the shortcuts sheet', () => {
    const groups = groupShortcuts(true)
    expect(groups.map((g) => g.scope)).toEqual(['global', 'list', 'issue', 'picker'])
    const listed = groups.flatMap((g) => g.shortcuts.map((s) => s.id))
    expect(listed.sort()).toEqual(Object.keys(SHORTCUTS).sort())
  })
})
