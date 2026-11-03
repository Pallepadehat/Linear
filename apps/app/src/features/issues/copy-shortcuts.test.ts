import { describe, expect, it } from 'vitest'
import { SHORTCUTS } from '@/lib/hotkeys'
import { COPY_LABELS, copyKindFor, copyShortcut } from './copy-shortcuts'

const key = (
  code: string,
  mods: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {},
) => ({
  code,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
})

describe('copyKindFor', () => {
  it('maps the four shortcuts on macOS', () => {
    expect(copyKindFor(key('Comma', { meta: true, shift: true }), true)).toBe('url')
    expect(copyKindFor(key('Period', { meta: true }), true)).toBe('id')
    expect(copyKindFor(key('Period', { meta: true, shift: true }), true)).toBe('branch')
    expect(copyKindFor(key('KeyP', { meta: true, alt: true }), true)).toBe('prompt')
  })

  it('uses Ctrl instead of ⌘ elsewhere', () => {
    expect(copyKindFor(key('Period', { ctrl: true }), false)).toBe('id')
    expect(copyKindFor(key('Period', { meta: true }), false)).toBeNull()
    expect(copyKindFor(key('Period', { ctrl: true }), true)).toBeNull()
  })

  it('ignores other modifier combinations and keys', () => {
    expect(copyKindFor(key('Period'), true)).toBeNull()
    expect(copyKindFor(key('Comma', { meta: true }), true)).toBeNull()
    expect(copyKindFor(key('KeyP', { meta: true }), true)).toBeNull()
    expect(copyKindFor(key('KeyP', { meta: true, alt: true, shift: true }), true)).toBeNull()
    expect(copyKindFor(key('Period', { meta: true, ctrl: true }), true)).toBeNull()
  })
})

describe('copyShortcut', () => {
  it('formats the catalog keys per platform', () => {
    expect(copyShortcut('url', true)).toBe('⌘⇧,')
    expect(copyShortcut('id', true)).toBe('⌘.')
    expect(copyShortcut('branch', true)).toBe('⌘⇧.')
    expect(copyShortcut('prompt', true)).toBe('⌘⌥P')
    expect(copyShortcut('url', false)).toBe('Ctrl Shift ,')
    expect(copyShortcut('prompt', false)).toBe('Ctrl Alt P')
  })

  it('takes labels from the shortcut catalog', () => {
    expect(COPY_LABELS.prompt).toBe(SHORTCUTS['issue-copy-prompt'].label)
  })
})
