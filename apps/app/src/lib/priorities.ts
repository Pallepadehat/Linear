// domain.md → Priorities. Stored as integers so they sort; 0 means "No priority".
export const PRIORITIES = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
] as const

export type Priority = (typeof PRIORITIES)[number]['value']

export function priorityLabel(priority: Priority): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? 'No priority'
}

/** Narrows a stored priority number; anything out of range reads as "No priority". */
export function toPriority(value: number | undefined): Priority {
  return PRIORITIES.find((p) => p.value === value)?.value ?? 0
}
