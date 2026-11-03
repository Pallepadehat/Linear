/** Longest title part of a generated branch name. */
export const BRANCH_SLUG_MAX = 60

/** Lowercase ASCII words joined by single hyphens: "Fix: Login (é)" → "fix-login-e". */
function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The title slug, at most `BRANCH_SLUG_MAX` chars, cut at a word boundary when there is one. */
export function branchSlug(title: string): string {
  const slug = slugify(title)
  if (slug.length <= BRANCH_SLUG_MAX) return slug
  const head = slug.slice(0, BRANCH_SLUG_MAX + 1)
  const lastBreak = head.lastIndexOf('-')
  return (lastBreak > 0 ? head.slice(0, lastBreak) : head.slice(0, BRANCH_SLUG_MAX)).replace(
    /-+$/,
    '',
  )
}

/** A `**Branch:** \`name\`` line at the top of the description names the branch to use. */
export function descriptionBranch(description: string | null): string | null {
  const firstLine = description
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return firstLine?.match(/^\*\*Branch:\*\*\s*`([^`\s]+)`/)?.[1] ?? null
}

/** The user's branch prefix: their email's local part, else their name. */
export function userHandle(user: { name: string; email: string } | null | undefined): string {
  if (!user) return ''
  return slugify(user.email.split('@')[0] ?? '') || slugify(user.name)
}

/**
 * The git branch for an issue: the description's `**Branch:**` when present, else
 * `<handle>/<tip-200>-<title-slug>`. The identifier starts its own segment, so a PR
 * from this branch links back to the issue (docs/domain.md → GitHub PR linking).
 */
export function issueBranchName(
  issue: { identifier: string; title: string; description: string | null },
  user: { name: string; email: string } | null | undefined,
): string {
  const fromDescription = descriptionBranch(issue.description)
  if (fromDescription) return fromDescription
  const name = [issue.identifier.toLowerCase(), branchSlug(issue.title)].filter(Boolean).join('-')
  const handle = userHandle(user)
  return handle ? `${handle}/${name}` : name
}
