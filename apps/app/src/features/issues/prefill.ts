import type { Issue, StatusCategory, WorkflowStatus } from '@linear/contract'

/**
 * What can prefill the create-issue dialog: a template (an `IssueTemplate` fits as is) or
 * an issue being copied (docs/domain.md → Templates). Missing or empty values prefill nothing.
 */
export type IssuePrefill = {
  title?: string
  description?: string | null
  statusId?: string | null
  /** Resolves the status in another team: that team's first status of this category. */
  statusCategory?: StatusCategory | null
  priority?: number | null
  assigneeId?: string | null
  projectId?: string | null
  labelIds?: string[]
}

/** The dialog's prefillable fields. */
export type PrefillValues = {
  title: string
  description: string
  statusId: string | undefined
  priority: number
  assigneeId: string | null
  projectId: string | null
  labelIds: string[]
}

export type PrefillField = keyof PrefillValues

export type PrefillContext = {
  /** The dialog's values now. */
  current: PrefillValues
  /** What each field holds without a prefill (empty, or the team's issue defaults). */
  base: PrefillValues
  /** Fields the user (or the opener) set by hand; a prefill never overwrites them. */
  dirty: ReadonlySet<PrefillField>
  /** The picked team's statuses. */
  statuses: readonly Pick<WorkflowStatus, 'id' | 'category' | 'position'>[]
  /** Workspace members; a source assignee who left is skipped. */
  memberIds?: readonly string[]
}

function resolveStatus(source: IssuePrefill, statuses: PrefillContext['statuses']) {
  if (source.statusId && statuses.some((s) => s.id === source.statusId)) return source.statusId
  if (!source.statusCategory) return undefined
  return [...statuses]
    .sort((a, b) => a.position - b.position)
    .find((s) => s.category === source.statusCategory)?.id
}

/**
 * Merges `source` into the dialog. A field the user changed keeps its value; every other
 * field takes the source's value, else its base — so switching templates, or picking
 * "No template" (`source` null), clears what the previous template filled in.
 */
export function prefillFrom(
  source: IssuePrefill | null,
  { current, base, dirty, statuses, memberIds }: PrefillContext,
): PrefillValues {
  const s = source ?? {}
  const assigneeOk =
    s.assigneeId != null && (memberIds === undefined || memberIds.includes(s.assigneeId))
  const next: PrefillValues = {
    title: s.title || base.title,
    description: s.description || base.description,
    statusId: resolveStatus(s, statuses) ?? base.statusId,
    priority: s.priority ?? base.priority,
    assigneeId: assigneeOk ? (s.assigneeId ?? null) : base.assigneeId,
    projectId: s.projectId ?? base.projectId,
    labelIds: s.labelIds?.length ? [...s.labelIds] : base.labelIds,
  }
  const merged = { ...next }
  for (const field of dirty) Object.assign(merged, { [field]: current[field] })
  // A hand-picked status from another team can't stay once the team changed.
  if (merged.statusId && !statuses.some((st) => st.id === merged.statusId)) {
    merged.statusId = next.statusId
  }
  return merged
}

/** "Make a copy…": the issue's title, description and properties. */
export function issuePrefill(issue: Issue): IssuePrefill {
  return {
    title: `Copy of ${issue.title}`,
    description: issue.description,
    statusId: issue.status.id,
    statusCategory: issue.status.category,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    projectId: issue.projectId,
    labelIds: issue.labels.map((l) => l.id),
  }
}
