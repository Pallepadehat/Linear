import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors'
import { assertNoParentCycle } from './parent'

/** Current parents by issue id. */
const lookup = (parents: Record<string, string | null>) => async (id: string) => parents[id] ?? null

describe('assertNoParentCycle', () => {
  it('rejects an issue as its own parent', async () => {
    const error = await assertNoParentCycle('A', 'A', lookup({})).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects A → B → C → A', async () => {
    // B's parent is A, C's parent is B; making C the parent of A closes the loop.
    const parents = { A: null, B: 'A', C: 'B' }
    await expect(assertNoParentCycle('A', 'C', lookup(parents))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  it('allows a parent from another branch', async () => {
    const parents = { A: null, B: 'A', C: 'A', D: 'C' }
    await expect(assertNoParentCycle('B', 'D', lookup(parents))).resolves.toBeUndefined()
  })

  it('allows moving under a root issue', async () => {
    await expect(assertNoParentCycle('B', 'A', lookup({ A: null }))).resolves.toBeUndefined()
  })
})
