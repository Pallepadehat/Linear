import type { Editor, Range } from '@tiptap/core'
import {
  ChevronsDownUp,
  Heading1,
  Heading2,
  Heading3,
  Image,
  List,
  ListChecks,
  ListOrdered,
  Paperclip,
  Quote,
  Radical,
  SquareCode,
  Workflow,
} from '@lucide/vue'
import type { Component } from 'vue'

/** What a command may need from the editor component beyond the Tiptap editor. */
export type SlashContext = { pickFiles: (kind: 'media' | 'files') => void }

export type SlashCommand = {
  id: string
  label: string
  group: 'headings' | 'lists' | 'attach' | 'blocks'
  icon: Component
  /** Keyboard shortcut in ProseMirror notation (also registered in the editor), if any. */
  shortcut?: string
  /** Extra words the filter matches, e.g. "todo" for the checklist. */
  keywords: string[]
  run: (editor: Editor, range: Range, ctx: SlashContext) => void
}

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

// Same items, order, groups and shortcuts as Linear's `/` menu.
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    group: 'headings',
    icon: Heading1,
    shortcut: 'Mod-Alt-1',
    keywords: ['title', 'big', '#'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    group: 'headings',
    icon: Heading2,
    shortcut: 'Mod-Alt-2',
    keywords: ['subtitle', '##'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    group: 'headings',
    icon: Heading3,
    shortcut: 'Mod-Alt-3',
    keywords: ['###'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Bulleted list',
    group: 'lists',
    icon: List,
    shortcut: 'Mod-Shift-8',
    keywords: ['unordered', 'ul', 'bullet'],
    run: (e, r) => chain(e, r).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Numbered list',
    group: 'lists',
    icon: ListOrdered,
    shortcut: 'Mod-Shift-9',
    keywords: ['ordered', 'ol'],
    run: (e, r) => chain(e, r).toggleOrderedList().run(),
  },
  {
    id: 'task',
    label: 'Checklist',
    group: 'lists',
    icon: ListChecks,
    shortcut: 'Mod-Shift-7',
    keywords: ['todo', 'task', 'checkbox'],
    run: (e, r) => chain(e, r).toggleTaskList().run(),
  },
  {
    id: 'media',
    label: 'Insert media...',
    group: 'attach',
    icon: Image,
    keywords: ['image', 'picture', 'photo', 'gif'],
    run: (e, r, ctx) => {
      chain(e, r).run()
      ctx.pickFiles('media')
    },
  },
  {
    id: 'files',
    label: 'Attach files...',
    group: 'attach',
    icon: Paperclip,
    shortcut: 'Mod-Shift-u',
    keywords: ['upload', 'attachment', 'pdf', 'zip'],
    run: (e, r, ctx) => {
      chain(e, r).run()
      ctx.pickFiles('files')
    },
  },
  {
    id: 'code',
    label: 'Code block',
    group: 'blocks',
    icon: SquareCode,
    shortcut: 'Mod-Shift-\\',
    keywords: ['snippet', 'pre', '```'],
    run: (e, r) => chain(e, r).toggleCodeBlock().run(),
  },
  {
    id: 'diagram',
    label: 'Diagram',
    group: 'blocks',
    icon: Workflow,
    keywords: ['mermaid', 'flowchart', 'chart', 'graph'],
    run: (e, r) =>
      chain(e, r)
        .insertContent({
          type: 'codeBlock',
          attrs: { language: 'mermaid' },
          content: [{ type: 'text', text: 'graph TD\n  A[Start] --> B[Finish]' }],
        })
        .run(),
  },
  {
    id: 'math',
    label: 'LaTeX math block',
    group: 'blocks',
    icon: Radical,
    keywords: ['math', 'equation', 'formula', 'katex', 'tex'],
    run: (e, r) =>
      chain(e, r)
        .insertContent({ type: 'blockMath', attrs: { latex: '' } })
        .run(),
  },
  {
    id: 'details',
    label: 'Collapsible section',
    group: 'blocks',
    icon: ChevronsDownUp,
    shortcut: 'Mod-Shift-6',
    keywords: ['toggle', 'details', 'accordion', 'fold'],
    // Open, so Enter in the title moves straight into the body.
    run: (e, r) => chain(e, r).setDetails().updateAttributes('details', { open: true }).run(),
  },
  {
    id: 'quote',
    label: 'Blockquote',
    group: 'blocks',
    icon: Quote,
    shortcut: 'Alt-Shift-.',
    keywords: ['quote', '>'],
    run: (e, r) => chain(e, r).toggleBlockquote().run(),
  },
]

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.startsWith(q)),
  )
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MAC_KEYS: Record<string, string> = { Mod: '⌘', Alt: '⌥', Shift: '⇧', Ctrl: '⌃' }

/** `Mod-Shift-8` → `⌘ ⇧ 8` on macOS, `Ctrl Shift 8` elsewhere. */
export function formatShortcut(shortcut: string, mac = isMac): string[] {
  return shortcut
    .split(/-(?!$)/)
    .map((key) =>
      mac
        ? (MAC_KEYS[key] ?? key.toUpperCase())
        : key === 'Mod'
          ? 'Ctrl'
          : key.length === 1
            ? key.toUpperCase()
            : key,
    )
}
