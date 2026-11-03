// The issue copy actions' labels and shortcuts. Keys live in the shortcut catalog
// (lib/hotkeys.ts) for the `?` sheet; matching is by key code, see `copyKindFor`.
import { isMacPlatform, shortcutKeys, SHORTCUTS, type ShortcutId } from '@/lib/hotkeys'

export type CopyKind = 'url' | 'id' | 'branch' | 'prompt'

/**
 * Each action's catalog entry (labels, keys for the `?` sheet) and the key `code` it
 * matches: layout-independent, and ⌥P on macOS would otherwise arrive as "π".
 */
const ACTIONS: Record<CopyKind, { id: ShortcutId; code: string; shift: boolean; alt: boolean }> = {
  url: { id: 'issue-copy-url', code: 'Comma', shift: true, alt: false },
  id: { id: 'issue-copy-id', code: 'Period', shift: false, alt: false },
  branch: { id: 'issue-copy-branch', code: 'Period', shift: true, alt: false },
  prompt: { id: 'issue-copy-prompt', code: 'KeyP', shift: false, alt: true },
}

export const COPY_LABELS: Record<CopyKind, string> = {
  url: SHORTCUTS['issue-copy-url'].label,
  id: SHORTCUTS['issue-copy-id'].label,
  branch: SHORTCUTS['issue-copy-branch'].label,
  prompt: SHORTCUTS['issue-copy-prompt'].label,
}

/** The shortcut hint, e.g. `⌘⇧,` on macOS and `Ctrl Shift ,` elsewhere. */
export function copyShortcut(kind: CopyKind, mac = isMacPlatform()): string {
  return shortcutKeys(ACTIONS[kind].id, mac)
    .map((keys) => keys.join(mac ? '' : ' '))
    .join(' ')
}

/** The copy action a key event triggers, if any (pure, for tests). */
export function copyKindFor(
  event: Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  mac = isMacPlatform(),
): CopyKind | null {
  if (!(mac ? event.metaKey : event.ctrlKey) || (mac ? event.ctrlKey : event.metaKey)) return null
  const kinds = Object.keys(ACTIONS) as CopyKind[]
  return (
    kinds.find((kind) => {
      const a = ACTIONS[kind]
      return event.code === a.code && event.shiftKey === a.shift && event.altKey === a.alt
    }) ?? null
  )
}
