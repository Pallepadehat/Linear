/** Single-key shortcuts (`C`, `F`) are ignored while typing or with a modifier held. */
export function isPlainShortcut(event: KeyboardEvent) {
  const target = event.target
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  return !(
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
}

/**
 * Whether a keydown should be left alone by single-key shortcuts (`C`, `J`/`K`):
 * the user is typing, or a menu or dialog has the keyboard.
 */
export function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select, [role="menu"], [role="dialog"]') !== null)
  )
}
