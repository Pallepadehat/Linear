import { describe, expect, it } from 'vitest'
import type { DomainError } from '../../errors'
import {
  assertMilestoneInProject,
  completesMilestone,
  currentMilestoneOf,
  isMilestoneComplete,
  mergeMilestoneOrder,
  milestoneProgress,
  nextIssueMilestone,
} from './rules'

describe('milestoneProgress', () => {
  it('is done / total', () => {
    expect(milestoneProgress({ issueCount: 4, doneCount: 1 })).toBe(0.25)
    expect(milestoneProgress({ issueCount: 3, doneCount: 3 })).toBe(1)
  })
  it('is 0 without issues', () => {
    expect(milestoneProgress({ issueCount: 0, doneCount: 0 })).toBe(0)
  })
})

describe('isMilestoneComplete / currentMilestoneOf', () => {
  it('needs issues, all done', () => {
    expect(isMilestoneComplete({ issueCount: 2, doneCount: 2 })).toBe(true)
    expect(isMilestoneComplete({ issueCount: 2, doneCount: 1 })).toBe(false)
    expect(isMilestoneComplete({ issueCount: 0, doneCount: 0 })).toBe(false)
  })
  it('picks the first milestone that is not complete', () => {
    const list = [
      { id: 'a', issueCount: 1, doneCount: 1 },
      { id: 'b', issueCount: 0, doneCount: 0 },
      { id: 'c', issueCount: 2, doneCount: 0 },
    ]
    expect(currentMilestoneOf(list)?.id).toBe('b')
    expect(currentMilestoneOf(list.slice(0, 1))).toBeNull()
  })
})

describe('completesMilestone', () => {
  const movedToDone = { wasDone: false, isDone: true }

  it('fires when the last open issue moves to done', () => {
    expect(completesMilestone({ issueCount: 3, doneCount: 3 }, movedToDone)).toBe(true)
    expect(completesMilestone({ issueCount: 1, doneCount: 1 }, movedToDone)).toBe(true)
  })

  it('does not fire while other issues are still open', () => {
    expect(completesMilestone({ issueCount: 3, doneCount: 2 }, movedToDone)).toBe(false)
  })

  it('does not fire for an issue that was already done', () => {
    // Edited while done, or a done issue moved into the milestone.
    const stillDone = { wasDone: true, isDone: true }
    expect(completesMilestone({ issueCount: 3, doneCount: 3 }, stillDone)).toBe(false)
  })

  it('does not fire when the issue is not done after the change', () => {
    expect(
      completesMilestone({ issueCount: 2, doneCount: 1 }, { wasDone: true, isDone: false }),
    ).toBe(false)
    expect(
      completesMilestone({ issueCount: 0, doneCount: 0 }, { wasDone: false, isDone: false }),
    ).toBe(false)
  })

  it('never fires for an empty milestone', () => {
    expect(completesMilestone({ issueCount: 0, doneCount: 0 }, movedToDone)).toBe(false)
  })
})

describe('mergeMilestoneOrder', () => {
  it('keeps unmentioned milestones after the requested ones', () => {
    expect(mergeMilestoneOrder(['a', 'b', 'c'], ['c', 'a'])).toEqual(['c', 'a', 'b'])
  })
  it('rejects unknown or repeated ids', () => {
    expect(mergeMilestoneOrder(['a'], ['x'])).toBeNull()
    expect(mergeMilestoneOrder(['a', 'b'], ['a', 'a'])).toBeNull()
  })
})

describe('assertMilestoneInProject', () => {
  it('accepts a milestone of the project', () => {
    expect(() => assertMilestoneInProject({ projectId: 'p1' }, 'p1')).not.toThrow()
  })
  it.each([
    ['another project', { projectId: 'p2' }, 'p1'],
    ['a missing milestone', undefined, 'p1'],
    ['an issue without a project', { projectId: 'p1' }, null],
  ])('rejects %s with BAD_REQUEST', (_, milestone, projectId) => {
    expect(() => assertMilestoneInProject(milestone, projectId)).toThrow(
      expect.objectContaining({ code: 'BAD_REQUEST' }) as DomainError,
    )
  })
})

describe('nextIssueMilestone', () => {
  const current = { projectId: 'p1', milestoneId: 'm1' }
  it('clears the milestone when the project changes or is cleared', () => {
    expect(nextIssueMilestone(current, { projectId: 'p2' })).toEqual({
      milestoneId: null,
      projectId: 'p2',
    })
    expect(nextIssueMilestone(current, { projectId: null })).toEqual({
      milestoneId: null,
      projectId: null,
    })
  })
  it('leaves it alone when the project is unchanged or re-saved', () => {
    expect(nextIssueMilestone(current, {}).milestoneId).toBeUndefined()
    expect(nextIssueMilestone(current, { projectId: 'p1' }).milestoneId).toBeUndefined()
    expect(
      nextIssueMilestone({ projectId: 'p1', milestoneId: null }, { projectId: 'p2' }).milestoneId,
    ).toBeUndefined()
  })
  it('uses a requested milestone, checked against the resulting project', () => {
    expect(nextIssueMilestone(current, { projectId: 'p2', milestoneId: 'm2' })).toEqual({
      milestoneId: 'm2',
      projectId: 'p2',
    })
    expect(nextIssueMilestone(current, { milestoneId: null })).toEqual({
      milestoneId: null,
      projectId: 'p1',
    })
  })
})
