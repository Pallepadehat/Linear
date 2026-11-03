import type { Label } from '@linear/contract'

// Label colors are stored as hex (user data, see docs/domain.md → Labels), so the
// palette new labels draw from lives here as data rather than as CSS tokens.
// Linear's default label hues: gray, slate, lavender, teal, green, yellow, orange,
// pink, red.
export const LABEL_PALETTE = [
  '#bec2c8',
  '#95a2b3',
  '#5e6ad2',
  '#26b5ce',
  '#4cb782',
  '#f2c94c',
  '#f2994a',
  '#f7c8c1',
  '#eb5757',
] as const

/** The palette color used least by `existing`; ties go to palette order. */
export function nextLabelColor(existing: Pick<Label, 'color'>[]): string {
  const counts = new Map<string, number>()
  for (const label of existing) counts.set(label.color, (counts.get(label.color) ?? 0) + 1)
  let best: string = LABEL_PALETTE[0]
  for (const color of LABEL_PALETTE) {
    if ((counts.get(color) ?? 0) < (counts.get(best) ?? 0)) best = color
  }
  return best
}

/** Labels an issue in `teamId` can use: workspace labels plus that team's own (null = workspace only). */
export function labelsForTeam<T extends Pick<Label, 'teamId'>>(labels: T[], teamId: string | null) {
  return labels.filter((label) => label.teamId === null || label.teamId === teamId)
}

/** Case-insensitive exact name match, ignoring surrounding whitespace. */
export function findLabelByName<T extends Pick<Label, 'name'>>(labels: T[], name: string) {
  const wanted = name.trim().toLocaleLowerCase()
  return labels.find((label) => label.name.toLocaleLowerCase() === wanted)
}

export type LabelSections<T> = { selected: T[]; team: T[]; workspace: T[] }

/** Picker sections in order: selected, then the team's labels, then workspace labels. */
export function labelSections<T extends Pick<Label, 'id' | 'teamId'>>(
  labels: T[],
  selectedIds: readonly string[],
): LabelSections<T> {
  const selected = new Set(selectedIds)
  return {
    selected: labels.filter((l) => selected.has(l.id)),
    team: labels.filter((l) => !selected.has(l.id) && l.teamId !== null),
    workspace: labels.filter((l) => !selected.has(l.id) && l.teamId === null),
  }
}
