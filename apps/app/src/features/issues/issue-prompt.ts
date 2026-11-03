export type IssueRef = { identifier: string; title: string }

export type IssuePromptInput = {
  /** The workspace's own product name (its workspace name), not "Linear". */
  productName: string
  issue: { identifier: string; title: string; description: string | null }
  team: { name: string }
  labels: { name: string }[]
  project?: { name: string; description: string | null } | null
  /** Issue relations arrive with M8-04; empty until then. */
  relations?: { blockedBy: IssueRef[] }
  branch: string
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/** Escapes an XML attribute value. */
export function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char)
}

/**
 * The issue as a prompt for a coding agent, in Linear's "Copy as prompt" shape:
 * an intro, the suggested branch, then the issue as XML. Element text (title,
 * description, label names) is kept verbatim so markdown reads as written.
 */
export function buildIssuePrompt({
  productName,
  issue,
  team,
  labels,
  project,
  relations,
  branch,
}: IssuePromptInput): string {
  const lines = [
    `Work on ${productName} issue ${issue.identifier}:`,
    '',
    `Suggested branch name: ${branch}`,
    '',
    `<issue identifier="${escapeAttr(issue.identifier)}">`,
    `<title>${issue.title}</title>`,
  ]
  const description = issue.description?.trim()
  if (description) lines.push('<description>', description, '</description>')
  lines.push(`<team name="${escapeAttr(team.name)}"/>`)
  for (const label of labels) lines.push(`<label>${label.name}</label>`)
  if (project) {
    const name = escapeAttr(project.name)
    const summary = project.description?.trim()
    lines.push(
      summary ? `<project name="${name}">${summary}</project>` : `<project name="${name}"/>`,
    )
  }
  const blockedBy = relations?.blockedBy ?? []
  if (blockedBy.length) {
    const refs = blockedBy
      .map(
        (ref) =>
          `<issue-ref identifier="${escapeAttr(ref.identifier)}" title="${escapeAttr(ref.title)}"/>`,
      )
      .join('')
    lines.push(`<issue-relations><blocked-by>${refs}</blocked-by></issue-relations>`)
  }
  lines.push('</issue>')
  return lines.join('\n')
}
