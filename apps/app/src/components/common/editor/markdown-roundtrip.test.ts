// @vitest-environment happy-dom
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownExtensions } from './extensions'

let editor: Editor | undefined
afterEach(() => editor?.destroy())

function roundTrip(markdown: string) {
  editor = new Editor({
    extensions: markdownExtensions(),
    content: markdown,
    contentType: 'markdown',
  })
  return editor.getMarkdown().trim()
}

describe('description markdown', () => {
  it('keeps collapsible sections in Linear syntax', () => {
    const md = '+++ Details\nHidden **text**\n+++'
    expect(roundTrip(md)).toBe(md)
  })

  it('keeps math blocks, diagrams and checklists', () => {
    expect(roundTrip('$$\nE = mc^2\n$$')).toBe('$$\nE = mc^2\n$$')
    expect(roundTrip('```mermaid\ngraph TD\n  A --> B\n```')).toBe(
      '```mermaid\ngraph TD\n  A --> B\n```',
    )
    expect(roundTrip('- [ ] todo\n- [x] done')).toBe('- [ ] todo\n- [x] done')
  })

  it('keeps attachment images and file links', () => {
    const id = '0190a6f2-1c2b-7d3e-8f40-123456789abc'
    expect(roundTrip(`![shot.png](attachment:${id})`)).toBe(`![shot.png](attachment:${id})`)
    expect(roundTrip(`[spec.pdf](attachment:${id})`)).toBe(`[spec.pdf](attachment:${id})`)
  })
})

describe('collapsible sections', () => {
  it('Enter on an empty last line leaves the section', () => {
    editor = new Editor({
      extensions: markdownExtensions(),
      content: '+++ Title\nBody\n+++',
      contentType: 'markdown',
    })
    // End of "Body": details › content › paragraph.
    let bodyEnd = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Body') bodyEnd = pos + node.nodeSize
    })
    editor.commands.setTextSelection(bodyEnd)
    // A real keydown through the view, so the handler's selection change applies.
    const press = (key: string) =>
      editor!.view.someProp('handleKeyDown', (f) =>
        f(editor!.view, new KeyboardEvent('keydown', { key })),
      )
    press('Enter')
    press('Enter')
    editor.commands.insertContent('Outside')
    expect(editor.getMarkdown().trim()).toBe('+++ Title\nBody\n+++\n\nOutside')
  })

  it('Enter in a new section title continues in its body, then exits on an empty line', () => {
    editor = new Editor({ extensions: markdownExtensions(), content: '' })
    const press = (key: string) =>
      editor!.view.someProp('handleKeyDown', (f) =>
        f(editor!.view, new KeyboardEvent('keydown', { key })),
      )
    editor.commands.focus()
    editor.chain().setDetails().updateAttributes('details', { open: true }).run()
    editor.commands.insertContent('Title')
    press('Enter')
    editor.commands.insertContent('Body')
    press('Enter')
    press('Enter')
    editor.commands.insertContent('Outside')
    expect(editor.getMarkdown().trim()).toBe('+++ Title\nBody\n+++\n\nOutside')
  })
})
