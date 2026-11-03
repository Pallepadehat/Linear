import type { JSONContent } from '@tiptap/core'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'

// Collapsible sections in Linear's markdown syntax:
//
//   +++ Summary
//   Hidden content
//   +++
const BLOCK = /^\+\+\+[ \t]*([^\n]*)\n([\s\S]*?)\n?\+\+\+[ \t]*(?:\n|$)/

const CollapsibleDetails = Details.extend({
  // Tiptap's view tracks open state in its own class and a deferred toggle, which can
  // drift from the node's `open` attribute (a section created open renders closed).
  // Keep the DOM in sync with the attribute; CSS keys off `[open]`.
  addNodeView() {
    const parent = this.parent?.()
    if (!parent) return null
    return (props) => {
      const view = parent(props)
      const dom = view.dom as HTMLElement
      let open = Boolean(props.node.attrs.open)
      const sync = () => {
        dom.toggleAttribute('open', open)
        dom.classList.toggle('is-open', open)
        dom
          .querySelector(':scope > button')
          ?.setAttribute('aria-label', open ? 'Collapse section' : 'Expand section')
      }
      sync()
      // After the parent's own deferred toggle.
      setTimeout(sync)
      const update = view.update?.bind(view)
      view.update = (node, decorations, innerDecorations) => {
        const handled = update ? update(node, decorations, innerDecorations) : false
        if (handled) {
          open = Boolean(node.attrs.open)
          sync()
        }
        return handled
      }
      return view
    }
  },
  markdownTokenizer: {
    name: 'details',
    level: 'block',
    start: (src: string) => src.indexOf('+++'),
    tokenize: (src, _tokens, lexer) => {
      const match = BLOCK.exec(src)
      if (!match) return undefined
      const [raw, summary = '', body = ''] = match
      return {
        type: 'details',
        raw,
        summaryTokens: lexer.inlineTokens(summary.trim()),
        tokens: lexer.blockTokens(body),
      }
    },
  },
  parseMarkdown: (token, h) => {
    const body = h.parseChildren(token.tokens ?? [])
    return h.createNode('details', undefined, [
      h.createNode('detailsSummary', undefined, h.parseInline(token.summaryTokens ?? [])),
      h.createNode('detailsContent', undefined, body.length ? body : [{ type: 'paragraph' }]),
    ])
  },
  renderMarkdown: (node, h) => {
    const [summary, content] = node.content ?? []
    const title = summary?.content ? h.renderChildren(summary.content) : ''
    const body = content?.content ? h.renderChildren(content.content as JSONContent[], '\n\n') : ''
    return `+++ ${title}\n${body}\n+++`
  },
}).configure({ persist: true, HTMLAttributes: { class: 'details' } })

export const Collapsible = [CollapsibleDetails, DetailsSummary, DetailsContent]
