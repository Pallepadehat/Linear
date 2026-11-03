import { describe, expect, it } from 'vitest'
import {
  LABEL_PALETTE,
  findLabelByName,
  labelSections,
  labelsForTeam,
  nextLabelColor,
} from './label-options'

const label = (id: string, teamId: string | null, name = id, color = '#000000') => ({
  id,
  teamId,
  name,
  color,
})

describe('label options', () => {
  it('picks the least used palette color, in palette order', () => {
    expect(nextLabelColor([])).toBe(LABEL_PALETTE[0])
    expect(nextLabelColor([{ color: LABEL_PALETTE[0] }])).toBe(LABEL_PALETTE[1])
    const all = LABEL_PALETTE.map((color) => ({ color }))
    expect(nextLabelColor([...all, { color: LABEL_PALETTE[0] }])).toBe(LABEL_PALETTE[1])
    expect(nextLabelColor([{ color: '#123456' }])).toBe(LABEL_PALETTE[0])
  })

  it("keeps workspace labels and the team's own labels", () => {
    const labels = [label('ws', null), label('tip', 't1'), label('ops', 't2')]
    expect(labelsForTeam(labels, 't1').map((l) => l.id)).toEqual(['ws', 'tip'])
    expect(labelsForTeam(labels, null).map((l) => l.id)).toEqual(['ws'])
  })

  it('matches names case-insensitively and trimmed', () => {
    const labels = [label('a', null, 'Bug')]
    expect(findLabelByName(labels, ' bug ')?.id).toBe('a')
    expect(findLabelByName(labels, 'bugs')).toBeUndefined()
  })

  it('splits labels into selected, team and workspace sections', () => {
    const labels = [
      label('ws1', null),
      label('t1', 'team'),
      label('ws2', null),
      label('t2', 'team'),
    ]
    expect(labelSections(labels, ['ws2', 't2'])).toEqual({
      selected: [labels[2], labels[3]],
      team: [labels[1]],
      workspace: [labels[0]],
    })
  })
})
