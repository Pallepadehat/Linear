export type SnoozePreset = { id: 'hour' | 'tomorrow' | 'next-week'; label: string; until: Date }

/** 9:00 local time, `days` days after `now`'s date. */
function morning(now: Date, days: number) {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  date.setHours(9, 0, 0, 0)
  return date
}

/**
 * "Remind me" choices in the viewer's time zone: in 1 hour, tomorrow 9:00, and next
 * Monday 9:00 (a week later when today is Monday). The server only checks the range.
 */
export function snoozePresets(now = new Date()): SnoozePreset[] {
  const daysToMonday = (8 - now.getDay()) % 7 || 7
  return [
    { id: 'hour', label: 'In 1 hour', until: new Date(now.getTime() + 60 * 60 * 1000) },
    { id: 'tomorrow', label: 'Tomorrow', until: morning(now, 1) },
    { id: 'next-week', label: 'Next week', until: morning(now, daysToMonday) },
  ]
}
