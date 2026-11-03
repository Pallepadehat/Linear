import { Extension, type AnyExtension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import CodeBlock from '@tiptap/extension-code-block'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { BlockMath } from '@tiptap/extension-mathematics'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { Component } from 'vue'
import { parseAttachmentId } from './attachments'
import { Collapsible } from './collapsible'

const AttachmentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Local-only flag while the file uploads; never part of the markdown.
      uploading: { default: false, rendered: false },
    }
  },
})

// Linear's shortcuts where they differ from Tiptap's defaults (numbered ⌘⇧9, checklist ⌘⇧7).
const LinearShortcuts = Extension.create({
  name: 'linearShortcuts',
  priority: 1000,
  addKeyboardShortcuts() {
    const blockquote = () => this.editor.commands.toggleBlockquote()
    return {
      'Mod-Shift-7': () => this.editor.commands.toggleTaskList(),
      'Mod-Shift-9': () => this.editor.commands.toggleOrderedList(),
      'Mod-Shift-\\': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Shift-6': () =>
        this.editor.isActive('details')
          ? this.editor.commands.unsetDetails()
          : this.editor.chain().setDetails().updateAttributes('details', { open: true }).run(),
      'Alt-Shift-.': blockquote,
      'Alt-Shift->': blockquote,
      Enter: () =>
        this.editor.commands.command(({ tr, state, dispatch }) => {
          const { $from, empty } = state.selection
          if (!empty || $from.depth < 2) return false

          // In a section title: continue in the body's empty first line rather than
          // adding another (a new section already has one).
          if ($from.parent.type.name === 'detailsSummary' && $from.node(-1).attrs.open) {
            const body = $from.node(-1).child(1)
            const first = body.firstChild
            if (!first || first.type.name !== 'paragraph' || first.content.size > 0) return false
            if (dispatch) tr.setSelection(TextSelection.create(tr.doc, $from.after() + 2))
            return true
          }

          // On an empty line with only empty lines after it in a section body: leave
          // the section (drop those lines, continue below it), like Linear.
          const body = $from.node(-1)
          if (body.type.name !== 'detailsContent' || $from.parent.content.size > 0) return false
          const index = $from.index(-1)
          if (index === 0) return false
          for (let i = index; i < body.childCount; i++) {
            const child = body.child(i)
            if (child.type.name !== 'paragraph' || child.content.size > 0) return false
          }
          if (dispatch) {
            const afterDetails = $from.after($from.depth - 2)
            tr.delete($from.before(), $from.end(-1))
            const at = tr.mapping.map(afterDetails)
            tr.insert(at, state.schema.nodes.paragraph!.create())
            tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView()
          }
          return true
        }),
    }
  },
})

export type EditorViews = { image?: Component; codeBlock?: Component; math?: Component }

/**
 * Everything the description markdown can contain. The editor component passes Vue
 * node views; tests use the plain schema to check markdown round-trips.
 */
export function markdownExtensions(views: EditorViews = {}): AnyExtension[] {
  const withView = <T extends AnyExtension>(ext: T, view?: Component) =>
    view ? ext.extend({ addNodeView: () => VueNodeViewRenderer(view) }) : ext
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['attachment'],
        isAllowedUri: (url, ctx) => Boolean(parseAttachmentId(url)) || ctx.defaultValidate(url),
      },
    }),
    withView(CodeBlock, views.codeBlock),
    TaskList,
    TaskItem.configure({ nested: true }),
    withView(AttachmentImage.configure({ inline: false, allowBase64: false }), views.image),
    withView(BlockMath, views.math),
    ...Collapsible,
    LinearShortcuts,
    Markdown,
  ]
}
