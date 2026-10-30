import type { Label } from '@linear/contract'
import type { labels } from '@linear/db'

export function toLabelDto(row: typeof labels.$inferSelect): Label {
  return { id: row.id, name: row.name, color: row.color }
}
