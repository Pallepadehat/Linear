import { describe, expect, it } from 'vitest'
import { filterSlashCommands, formatShortcut, SLASH_COMMANDS } from './slash-commands'

describe('filterSlashCommands', () => {
  it('returns every command for an empty query', () => {
    expect(filterSlashCommands('')).toEqual(SLASH_COMMANDS)
  })

  it('matches labels and keyword prefixes, case-insensitively', () => {
    expect(filterSlashCommands('HEAD').map((c) => c.id)).toEqual(['h1', 'h2', 'h3'])
    expect(filterSlashCommands('todo').map((c) => c.id)).toEqual(['task'])
    expect(filterSlashCommands('mermaid').map((c) => c.id)).toEqual(['diagram'])
  })

  it('returns nothing for an unknown query', () => {
    expect(filterSlashCommands('zzz')).toEqual([])
  })
})

describe('formatShortcut', () => {
  it('uses symbols on macOS and words elsewhere', () => {
    expect(formatShortcut('Mod-Alt-1', true)).toEqual(['⌘', '⌥', '1'])
    expect(formatShortcut('Mod-Shift-u', false)).toEqual(['Ctrl', 'Shift', 'U'])
  })

  it('keeps punctuation keys, including a trailing dash-free dot or backslash', () => {
    expect(formatShortcut('Alt-Shift-.', true)).toEqual(['⌥', '⇧', '.'])
    expect(formatShortcut('Mod-Shift-\\', true)).toEqual(['⌘', '⇧', '\\'])
  })
})
