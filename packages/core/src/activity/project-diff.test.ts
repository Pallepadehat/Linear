import { describe, expect, it } from 'vitest'
import { diffProject, issueProjectEvents, type ProjectSnapshot } from './project-diff'

const current: ProjectSnapshot = {
  status: 'planned',
  priority: 0,
  leadId: null,
  startDate: null,
  targetDate: '2026-12-01',
}
const lead = '0190a1b2-0000-7000-8000-000000000001'
const issue = { issueId: '0190a1b2-0000-7000-8000-000000000002', identifier: 'TIP-1', title: 'Fix' }

describe('diffProject', () => {
  it('writes one event per changed field with from and to', () => {
    expect(
      diffProject(current, {
        status: 'in_progress',
        priority: 2,
        leadId: lead,
        startDate: '2026-11-01',
        targetDate: null,
      }),
    ).toEqual([
      { kind: 'project.status_changed', payload: { from: 'planned', to: 'in_progress' } },
      { kind: 'project.priority_changed', payload: { from: 0, to: 2 } },
      { kind: 'project.lead_changed', payload: { from: null, to: lead } },
      {
        kind: 'project.dates_changed',
        payload: { field: 'startDate', from: null, to: '2026-11-01' },
      },
      {
        kind: 'project.dates_changed',
        payload: { field: 'targetDate', from: '2026-12-01', to: null },
      },
    ])
  })

  it('writes nothing for omitted fields or values that did not change', () => {
    expect(diffProject(current, {})).toEqual([])
    expect(diffProject(current, { ...current })).toEqual([])
  })
})

describe('issueProjectEvents', () => {
  it('adds to the new project and removes from the old one', () => {
    expect(issueProjectEvents(null, 'p1', issue)).toEqual([
      { projectId: 'p1', event: { kind: 'project.issue_added', payload: issue } },
    ])
    expect(issueProjectEvents('p1', null, issue)).toEqual([
      { projectId: 'p1', event: { kind: 'project.issue_removed', payload: issue } },
    ])
    expect(issueProjectEvents('p1', 'p2', issue)).toEqual([
      { projectId: 'p1', event: { kind: 'project.issue_removed', payload: issue } },
      { projectId: 'p2', event: { kind: 'project.issue_added', payload: issue } },
    ])
  })

  it('writes nothing when the project is unchanged', () => {
    expect(issueProjectEvents('p1', 'p1', issue)).toEqual([])
    expect(issueProjectEvents(null, null, issue)).toEqual([])
  })
})
