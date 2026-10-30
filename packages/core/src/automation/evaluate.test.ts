import { describe, expect, it } from 'vitest'
import { evaluate, type AutomationEvent, type PRState, type StatusCategory } from './evaluate'

const merged: AutomationEvent = { type: 'pr_merged', linkType: 'closing' }
const closing = (prState: PRState) => ({ type: 'closing' as const, prState })
const reference = (prState: PRState) => ({ type: 'reference' as const, prState })

describe('evaluate', () => {
  describe('A: newly created closing links start eligible issues', () => {
    for (const category of ['backlog', 'unstarted'] as const) {
      it.each(['open', 'draft'] as const)(`${category} starts on a %s PR`, (prState) => {
        expect(
          evaluate({ category }, [closing(prState)], {
            type: 'link_created',
            linkType: 'closing',
            prState,
          }),
        ).toEqual({ to: 'started' })
      })
    }

    it.each(['closed', 'merged'] as const)('does not start on a %s PR', (prState) => {
      expect(
        evaluate({ category: 'unstarted' }, [closing(prState)], {
          type: 'link_created',
          linkType: 'closing',
          prState,
        }),
      ).toBeNull()
    })
  })

  describe('B/C: merges complete only a non-empty, fully merged required set', () => {
    it.each(['backlog', 'unstarted', 'started'] as const)('completes a %s issue', (category) => {
      expect(evaluate({ category }, [closing('merged')], merged)).toEqual({ to: 'completed' })
    })

    it('completes when all closing PRs merge', () => {
      expect(
        evaluate({ category: 'started' }, [closing('merged'), closing('merged')], merged),
      ).toEqual({ to: 'completed' })
    })

    it.each(['open', 'draft'] as const)('waits for a remaining %s PR', (prState) => {
      expect(
        evaluate({ category: 'started' }, [closing('merged'), closing(prState)], merged),
      ).toBeNull()
    })

    it('excludes closed-unmerged PRs from the required set', () => {
      expect(
        evaluate({ category: 'started' }, [closing('merged'), closing('closed')], merged),
      ).toEqual({ to: 'completed' })
    })

    it('does not complete with no links', () => {
      expect(evaluate({ category: 'started' }, [], merged)).toBeNull()
    })

    it('does not complete when all closing PRs were closed without merge', () => {
      expect(evaluate({ category: 'started' }, [closing('closed')], merged)).toBeNull()
    })
  })

  describe('D: reference links never trigger status changes', () => {
    it('does not start for a reference link even with an existing open closing PR', () => {
      expect(
        evaluate({ category: 'unstarted' }, [closing('open'), reference('open')], {
          type: 'link_created',
          linkType: 'reference',
          prState: 'open',
        }),
      ).toBeNull()
    })

    it('does not complete on a reference merge even with all closing PRs merged', () => {
      expect(
        evaluate({ category: 'started' }, [closing('merged'), reference('merged')], {
          type: 'pr_merged',
          linkType: 'reference',
        }),
      ).toBeNull()
    })

    it('has no required set when only reference PRs merged', () => {
      expect(evaluate({ category: 'started' }, [reference('merged')], merged)).toBeNull()
    })

    it('does not wait for reference PRs', () => {
      expect(
        evaluate({ category: 'started' }, [closing('merged'), reference('open')], merged),
      ).toEqual({ to: 'completed' })
    })
  })

  it('E: closing without merge never completes, even if remaining required PRs merged', () => {
    expect(
      evaluate({ category: 'started' }, [closing('merged'), closing('closed')], {
        type: 'pr_closed',
        linkType: 'closing',
      }),
    ).toBeNull()
  })

  describe('F: respects terminal and already started statuses', () => {
    const events: AutomationEvent[] = [
      { type: 'link_created', linkType: 'closing', prState: 'open' },
      { type: 'link_created', linkType: 'closing', prState: 'draft' },
      merged,
      { type: 'pr_closed', linkType: 'closing' },
    ]
    for (const category of ['completed', 'canceled'] satisfies StatusCategory[]) {
      it.each(events)(`never changes ${category} on $type`, (event) => {
        expect(evaluate({ category }, [closing('merged')], event)).toBeNull()
      })
    }

    it('does not reset an already started issue on link creation', () => {
      expect(evaluate({ category: 'started' }, [closing('open')], events[0]!)).toBeNull()
    })
  })
})
