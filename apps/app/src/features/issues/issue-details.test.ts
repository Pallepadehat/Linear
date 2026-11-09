import { describe, expect, it, vi } from 'vitest'
import type { FilterDimension, FilterOption } from './composables/useFilterDimensions'
import { detailsPanelKey, facetRows } from './issue-details'

const icon = () => null
const option = (key: string, label: string, selected = false): FilterOption => ({
  key,
  label,
  icon,
  selected,
  toggle: vi.fn(),
})
const dimension = (key: FilterDimension['key'], options: FilterOption[]): FilterDimension => ({
  key,
  label: key,
  icon,
  options,
  selectedLabels: [],
  active: false,
  operator: 'is',
  summary: '',
  clear: vi.fn(),
})

const ada = crypto.randomUUID()
const bob = crypto.randomUUID()
const bug = crypto.randomUUID()
const facets = {
  assignees: [
    { id: null, count: 3 },
    { id: ada, count: 2 },
  ],
  labels: [{ id: bug, count: 4 }],
  priorities: [
    { value: 1, count: 2 },
    { value: 0, count: 1 },
  ],
  projects: [{ id: null, count: 5 }],
  statuses: [],
}
const dimensions = [
  dimension('assignee', [
    option('none', 'No assignee'),
    option(ada, 'Ada'),
    option(bob, 'Bob', true),
  ]),
  dimension('label', [option(bug, 'Bug', true)]),
  dimension('priority', [option('1', 'Urgent'), option('0', 'No priority')]),
  dimension('project', [option('none', 'No project')]),
]

describe('facetRows', () => {
  it('names counts through the filter options, most first, keeping selected values at 0', () => {
    const rows = facetRows(facets, 'assignees', dimensions)
    expect(rows.map((r) => [r.label, r.count, r.selected])).toEqual([
      ['No assignee', 3, false],
      ['Ada', 2, false],
      ['Bob', 0, true],
    ])
    rows[1]!.toggle()
    expect(dimensions[0]!.options[1]!.toggle).toHaveBeenCalledOnce()
  })

  it('maps each tab to its dimension', () => {
    const labels = (tab: Parameters<typeof facetRows>[1]) =>
      facetRows(facets, tab, dimensions).map((r) => `${r.label}:${r.count}`)
    expect(labels('labels')).toEqual(['Bug:4'])
    expect(labels('priority')).toEqual(['Urgent:2', 'No priority:1'])
    expect(labels('projects')).toEqual(['No project:5'])
  })

  it('drops values the workspace no longer knows and handles missing data', () => {
    const gone = { ...facets, labels: [{ id: crypto.randomUUID(), count: 9 }] }
    expect(facetRows(gone, 'labels', [dimension('label', [])])).toEqual([])
    expect(facetRows(undefined, 'labels', dimensions)).toEqual([])
    // A project page has no Project dimension.
    expect(facetRows(facets, 'projects', dimensions.slice(0, 3))).toEqual([])
  })
})

describe('detailsPanelKey', () => {
  it('is per team (or workspace) and view tab', () => {
    expect(detailsPanelKey('t1', 'active')).toBe('t1:active')
    expect(detailsPanelKey(undefined, 'all')).toBe('workspace:all')
  })
})
