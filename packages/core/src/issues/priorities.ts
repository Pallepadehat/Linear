/** 0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low (docs/domain.md → Priorities). */
export const ISSUE_PRIORITIES = [0, 1, 2, 3, 4] as const
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number]
