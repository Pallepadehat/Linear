/** Suggests a workspace URL from its name: "My Team!" → "my-team". */
export function suggestSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

/** Suggests a team key from its name: "Tip Development" → "TIP". */
export function suggestTeamKey(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const key = letters.replace(/^[0-9]+/, '').slice(0, 3)
  return key.length >= 2 ? key : ''
}
