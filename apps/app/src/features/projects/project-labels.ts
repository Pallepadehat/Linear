// Colors for labels created from the picker. Label colors are user data stored as hex
// (docs/domain.md → Labels), not design tokens; these are just the defaults offered.
const LABEL_COLORS = [
  '#5e6ad2',
  '#26b5ce',
  '#4cb782',
  '#f2c94c',
  '#f2994a',
  '#eb5757',
  '#bb87fc',
  '#95a2b3',
]

/** A stable color per name, so the same name gets the same color. */
export function defaultLabelColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length] ?? '#95a2b3'
}
