import type { Project } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import {
  PROJECT_SORT_KEYS,
  sortProjects,
  toggleProjectSort,
  type ProjectSort,
} from './project-sort'

let n = 0
function project(name: string, overrides: Partial<Project> = {}): Project {
  n += 1
  return {
    id: `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`,
    name,
    description: null,
    summary: null,
    status: 'planned',
    iconUploadId: null,
    iconUrl: null,
    teamIds: [],
    priority: 0,
    leadId: null,
    memberIds: [],
    startDate: null,
    targetDate: null,
    labelIds: [],
    progress: { completed: 0, total: 0 },
    issueCount: 0,
    currentMilestone: null,
    createdAt: new Date(0),
    ...overrides,
  }
}

const people: Record<string, string> = { u1: 'Ada', u2: 'Zed' }
const lookup = { leadName: (id: string) => people[id] }
const names = (list: Project[]) => list.map((p) => p.name)
const sorted = (list: Project[], sort: ProjectSort) => names(sortProjects(list, sort, lookup))

describe('sortProjects', () => {
  const alpha = project('alpha', {
    priority: 3,
    leadId: 'u2',
    targetDate: '2026-12-01',
    issueCount: 4,
    status: 'in_progress',
    progress: { completed: 1, total: 4 },
  })
  const beta = project('Beta', {
    priority: 1,
    leadId: 'u1',
    targetDate: '2026-11-10',
    issueCount: 9,
    status: 'in_progress',
    progress: { completed: 3, total: 4 },
  })
  const gamma = project('gamma', { issueCount: 1, status: 'completed' })
  const all = [gamma, beta, alpha]

  it('sorts by name, case-insensitively, both ways', () => {
    expect(sorted(all, { key: 'name', direction: 'asc' })).toEqual(['alpha', 'Beta', 'gamma'])
    expect(sorted(all, { key: 'name', direction: 'desc' })).toEqual(['gamma', 'Beta', 'alpha'])
  })

  it('keeps empty values (no priority, lead or date) last in both directions', () => {
    for (const key of ['priority', 'lead', 'targetDate'] as const) {
      expect(sorted(all, { key, direction: 'asc' }).at(-1)).toBe('gamma')
      expect(sorted(all, { key, direction: 'desc' }).at(-1)).toBe('gamma')
    }
    expect(sorted(all, { key: 'priority', direction: 'asc' })).toEqual(['Beta', 'alpha', 'gamma'])
    expect(sorted(all, { key: 'lead', direction: 'asc' })).toEqual(['Beta', 'alpha', 'gamma'])
    expect(sorted(all, { key: 'targetDate', direction: 'desc' })).toEqual([
      'alpha',
      'Beta',
      'gamma',
    ])
  })

  it('sorts by issue count and by status, then progress', () => {
    expect(sorted(all, { key: 'issues', direction: 'desc' })).toEqual(['Beta', 'alpha', 'gamma'])
    expect(sorted(all, { key: 'status', direction: 'asc' })).toEqual(['alpha', 'Beta', 'gamma'])
  })

  it('falls back to the name for ties, including the health placeholder', () => {
    expect(sorted(all, { key: 'health', direction: 'desc' })).toEqual(['alpha', 'Beta', 'gamma'])
  })

  it('handles every column without mutating the input', () => {
    for (const key of PROJECT_SORT_KEYS) sortProjects(all, { key, direction: 'asc' }, lookup)
    expect(names(all)).toEqual(['gamma', 'Beta', 'alpha'])
  })
})

describe('toggleProjectSort', () => {
  it('starts a new column ascending and flips the active one', () => {
    const byName: ProjectSort = { key: 'name', direction: 'asc' }
    expect(toggleProjectSort(byName, 'priority')).toEqual({ key: 'priority', direction: 'asc' })
    expect(toggleProjectSort(byName, 'name')).toEqual({ key: 'name', direction: 'desc' })
  })
})
