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
