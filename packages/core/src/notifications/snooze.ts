const MAX_SNOOZE_MS = 366 * 24 * 60 * 60 * 1000

/** A snooze must end in the future and at most a year ahead. */
export function isValidSnoozeUntil(until: Date, now = new Date()) {
  const ms = until.getTime() - now.getTime()
  return Number.isFinite(ms) && ms > 0 && ms <= MAX_SNOOZE_MS
}
