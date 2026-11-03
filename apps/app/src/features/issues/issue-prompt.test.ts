import { describe, expect, it } from 'vitest'
import { buildIssuePrompt, escapeAttr, type IssuePromptInput } from './issue-prompt'

const base: IssuePromptInput = {
  productName: 'Tip',
  issue: {
    identifier: 'TIP-42',
    title: 'Fix login validation',
    description: 'Users can submit an **empty** password.\n\n- [ ] Validate',
  },
  team: { name: 'Tip' },
  labels: [{ name: 'Bug' }, { name: 'Frontend' }],
  project: { name: 'Auth revamp', description: 'Rebuild sign-in.' },
  branch: 'demo/tip-42-fix-login-validation',
}

describe('buildIssuePrompt', () => {
  it('renders the exact prompt', () => {
    expect(buildIssuePrompt(base)).toBe(
      [
        'Work on Tip issue TIP-42:',
        '',
        'Suggested branch name: demo/tip-42-fix-login-validation',
        '',
        '<issue identifier="TIP-42">',
        '<title>Fix login validation</title>',
        '<description>',
        'Users can submit an **empty** password.',
        '',
        '- [ ] Validate',
        '</description>',
        '<team name="Tip"/>',
        '<label>Bug</label>',
        '<label>Frontend</label>',
        '<project name="Auth revamp">Rebuild sign-in.</project>',
        '</issue>',
      ].join('\n'),
    )
  })

  it('escapes attribute values', () => {
    const prompt = buildIssuePrompt({
      ...base,
      team: { name: `R&D "<core>" 'team'` },
      project: { name: 'A & B', description: null },
    })
    expect(prompt).toContain('<team name="R&amp;D &quot;&lt;core&gt;&quot; &apos;team&apos;"/>')
    expect(prompt).toContain('<project name="A &amp; B"/>')
  })

  it('leaves out labels, project and description when there are none', () => {
    const prompt = buildIssuePrompt({
      ...base,
      issue: { ...base.issue, description: '  ' },
      labels: [],
      project: null,
    })
    expect(prompt).toBe(
      [
        'Work on Tip issue TIP-42:',
        '',
        'Suggested branch name: demo/tip-42-fix-login-validation',
        '',
        '<issue identifier="TIP-42">',
        '<title>Fix login validation</title>',
        '<team name="Tip"/>',
        '</issue>',
      ].join('\n'),
    )
  })

  it('lists blocking issues only when there are some', () => {
    expect(buildIssuePrompt({ ...base, relations: { blockedBy: [] } })).not.toContain(
      'issue-relations',
    )
    const prompt = buildIssuePrompt({
      ...base,
      relations: { blockedBy: [{ identifier: 'TIP-7', title: 'Add "auth" schema' }] },
    })
    expect(prompt).toContain(
      '<issue-relations><blocked-by><issue-ref identifier="TIP-7" title="Add &quot;auth&quot; schema"/></blocked-by></issue-relations>\n</issue>',
    )
  })
})

describe('escapeAttr', () => {
  it('escapes all five XML specials', () => {
    expect(escapeAttr(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;')
  })
})
