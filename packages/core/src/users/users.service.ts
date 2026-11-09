import { users, type DbOrTx } from '@linear/db'
import { eq } from 'drizzle-orm'
import { DomainError } from '../errors'

export async function getUser(db: DbOrTx, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new DomainError('NOT_FOUND', 'User not found')
  return user
}

export async function updateUser(db: DbOrTx, userId: string, patch: { name?: string }) {
  if (patch.name === undefined) return getUser(db, userId)
  const [user] = await db
    .update(users)
    .set({ name: patch.name.trim() })
    .where(eq(users.id, userId))
    .returning()
  if (!user) throw new DomainError('NOT_FOUND', 'User not found')
  return user
}
