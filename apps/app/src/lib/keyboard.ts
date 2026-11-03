/** Single-key shortcuts (`C`, `F`) are ignored while typing or with a modifier held. */
export function isPlainShortcut(event: KeyboardEvent) {
  const target = event.target
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  return !(
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
}
