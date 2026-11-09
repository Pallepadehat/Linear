import { DomainError } from '../errors'

/** 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low — the same scale as issues. */
export function assertProjectPriority(priority: number) {
  if (!Number.isInteger(priority) || priority < 0 || priority > 4)
    throw new DomainError('BAD_REQUEST', 'Project priority must be between 0 and 4')
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Start and target are calendar days (`YYYY-MM-DD`, which sort as strings). Either may be
 * unset; when both are set the start must not be after the target.
 */
export function assertProjectDates(startDate: string | null, targetDate: string | null) {
  for (const day of [startDate, targetDate]) {
    if (day !== null && (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))))
      throw new DomainError('BAD_REQUEST', 'Project dates must be calendar days (YYYY-MM-DD)')
  }
  if (startDate !== null && targetDate !== null && startDate > targetDate)
    throw new DomainError('BAD_REQUEST', 'The start date must be on or before the target date')
}
