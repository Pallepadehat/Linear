export type AssigneeOption = { id: string; name: string; email: string; avatarUrl: string | null }

/**
 * Orders the assignee picker like Linear: the current user first (shortcut 1),
 * then everyone else by name (shortcuts 2–9 for the first eight). Teams are open
 * to every workspace member, so the workspace members are the team's members.
 */
export function orderAssignees(
  users: readonly AssigneeOption[],
  currentUserId: string | undefined,
) {
  const me = users.find((u) => u.id === currentUserId)
  const others = users
    .filter((u) => u.id !== currentUserId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return {
    me,
    others: others.map((user, i) => ({ user, shortcut: i < 8 ? String(i + 2) : undefined })),
  }
}
