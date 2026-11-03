/**
 * The id focused after moving `delta` rows from `current`. With nothing
 * focused, down starts at the top and up at the bottom; the ends don't wrap.
 */
export function stepFocus(ids: string[], current: string | null, delta: 1 | -1): string | null {
  if (!ids.length) return null
  const index = current ? ids.indexOf(current) : -1
  if (index === -1) return delta > 0 ? ids[0]! : ids[ids.length - 1]!
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))]!
}
