import type { ProjectActivity } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { activityDay, describeProjectActivity } from './project-activity'

const base = {
  id: '0190a1b2-0000-7000-8000-000000000001',
  projectId: '0190a1b2-0000-7000-8000-000000000002',
  actorType: 'user' as const,
  actor: { id: '0190a1b2-0000-7000-8000-000000000003', name: 'Patrick Jakobsen', avatarUrl: null },
  createdAt: new Date(2026, 9, 29),
}
const lead = '0190a1b2-0000-7000-8000-000000000004'
const names = { member: (id: string) => (id === lead ? 'Ada' : undefined) }
type Event = ProjectActivity extends infer T
  ? T extends ProjectActivity
    ? Omit<T, keyof typeof base>
    : never
  : never
const entry = (event: Event): ProjectActivity => ({ ...base, ...event })
const describe_ = (event: Event) => describeProjectActivity(entry(event), names)

describe('describeProjectActivity', () => {
  it('reads project creation and status changes with the actor', () => {
    expect(describe_({ kind: 'project.created', payload: {} })).toEqual({
      actor: 'Patrick Jakobsen',
      text: 'created the project',
    })
    expect(
      describe_({ kind: 'project.status_changed', payload: { from: 'planned', to: 'in_progress' } })
        .text,
    ).toBe('changed status from Planned to In Progress')
  })

  it('reads priority, lead and date changes', () => {
    const text = (entry: Parameters<typeof describe_>[0]) => describe_(entry).text
    expect(text({ kind: 'project.priority_changed', payload: { from: 0, to: 2 } })).toBe(
      'set priority to High',
    )
    expect(text({ kind: 'project.priority_changed', payload: { from: 4, to: 1 } })).toBe(
      'changed priority from Low to Urgent',
    )
    expect(text({ kind: 'project.priority_changed', payload: { from: 1, to: 0 } })).toBe(
      'removed priority',
    )
    expect(text({ kind: 'project.lead_changed', payload: { from: null, to: lead } })).toBe(
      'set lead to Ada',
    )
    expect(text({ kind: 'project.lead_changed', payload: { from: lead, to: null } })).toBe(
      'removed the lead',
    )
    expect(
      text({
        kind: 'project.lead_changed',
        payload: { from: null, to: '0190a1b2-0000-7000-8000-000000000009' },
      }),
    ).toBe('set lead to a removed user')
    expect(
      text({
        kind: 'project.dates_changed',
        payload: { field: 'targetDate', from: null, to: `${new Date().getFullYear()}-11-03` },
      }),
    ).toBe('set the target date to Nov 3')
    expect(
      text({
        kind: 'project.dates_changed',
        payload: { field: 'startDate', from: '2026-11-01', to: null },
      }),
    ).toBe('removed the start date')
  })

  it('reads a completed milestone without an actor', () => {
    expect(
      describe_({
        kind: 'milestone.completed',
        payload: { milestoneId: base.id, name: 'M3 — Projects and views' },
      }),
    ).toEqual({ actor: null, text: 'Milestone M3 — Projects and views completed' })
  })

  it('reads issue additions and removals with the issue', () => {
    const payload = { issueId: base.id, identifier: 'TIP-12', title: 'Fix login' }
    expect(describe_({ kind: 'project.issue_added', payload })).toEqual({
      actor: 'Patrick Jakobsen',
      text: 'added',
      issue: payload,
    })
    expect(describe_({ kind: 'project.issue_removed', payload }).text).toBe('removed')
  })

  it('names GitHub and removed users', () => {
    const created = entry({ kind: 'project.created', payload: {} })
    expect(
      describeProjectActivity({ ...created, actor: null, actorType: 'github' }, names).actor,
    ).toBe('GitHub')
    expect(describeProjectActivity({ ...created, actor: null }, names).actor).toBe('A removed user')
  })
})

describe('activityDay', () => {
  it('shows the month and day, with the year outside the current one', () => {
    expect(activityDay(new Date(2026, 9, 29), new Date(2026, 10, 3))).toBe('Oct 29')
    expect(activityDay(new Date(2025, 9, 29), new Date(2026, 10, 3))).toBe('Oct 29, 2025')
  })
})
