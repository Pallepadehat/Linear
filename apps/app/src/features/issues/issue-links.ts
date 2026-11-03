/** Absolute link to an issue page: `https://app/tip/issue/TIP-200`. */
export function issueUrl(origin: string, workspaceSlug: string, identifier: string): string {
  return `${origin}/${workspaceSlug}/issue/${identifier}`
}

/**
 * Git branch for an issue, `tip-200-fix-login-redirect`: the identifier first so
 * PR linking picks it up (domain.md → PR linking), then up to 40 chars of title.
 */
export function issueBranchName(identifier: string, title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug ? `${identifier.toLowerCase()}-${slug}` : identifier.toLowerCase()
}
