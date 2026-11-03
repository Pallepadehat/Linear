import { onBeforeUnmount, onMounted } from 'vue'
import {
  eventStroke,
  isTypingTarget,
  matchHotkey,
  SHORTCUTS,
  toSequences,
  type ChordState,
  type HotkeyBinding,
  type ShortcutId,
} from '@/lib/hotkeys'

export type HotkeyHandler = {
  id: ShortcutId
  /** Return `false` to decline, letting the next matching binding (outer scope) try. */
  run: (event: KeyboardEvent) => boolean | void
}

type Registration = HotkeyBinding & { inDialog: boolean; run: HotkeyHandler['run'] }

// One document listener serves every registered binding.
const registrations = new Set<Registration>()
let order = 0
let chord: ChordState = null
let listening = false

function hasOpenDialog() {
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ),
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return
  const stroke = eventStroke(event)
  // Bare modifier presses neither match nor break a pending chord.
  if (/^(meta|control|alt|shift)$/.test(event.key.toLowerCase())) return
  // While a dialog or popover is open, only bindings meant for it respond.
  const dialog = hasOpenDialog()
  const active = [...registrations].filter((r) => !dialog || r.inDialog)
  const { matches, state } = matchHotkey(active, stroke, {
    now: Date.now(),
    state: chord,
    typing: isTypingTarget(event.target),
  })
  chord = state
  if (state) event.preventDefault()
  for (const match of matches) {
    if (match.run(event) === false) continue
    event.preventDefault()
    return
  }
}

/**
 * Registers handlers for catalog shortcuts (`lib/hotkeys.ts` → `SHORTCUTS`)
 * while the calling component is mounted. Keys, scope and input behaviour come
 * from the catalog so the `?` sheet always matches what's bound.
 */
export function useHotkeys(handlers: HotkeyHandler[]) {
  const own: Registration[] = handlers.map(({ id, run }) => {
    const def: (typeof SHORTCUTS)[ShortcutId] = SHORTCUTS[id]
    return {
      id,
      scope: def.scope,
      sequences: toSequences(def.keys),
      allowInInputs: 'allowInInputs' in def && def.allowInInputs,
      inDialog: 'inDialog' in def && def.inDialog,
      order: 0,
      run,
    }
  })

  onMounted(() => {
    if (!listening) {
      document.addEventListener('keydown', onKeydown)
      listening = true
    }
    for (const r of own) {
      r.order = order++
      registrations.add(r)
    }
  })
  onBeforeUnmount(() => {
    for (const r of own) registrations.delete(r)
  })
}
