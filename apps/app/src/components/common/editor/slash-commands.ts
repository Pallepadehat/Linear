import type { Editor, Range } from '@tiptap/core'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  SquareCode,
  TextQuote,
} from '@lucide/vue'
import type { Component } from 'vue'

export type SlashCommand = {
  id: string
  label: string
  /** The markdown shortcut that does the same, shown as a hint. */
  hint: string
  icon: Component
  /** Extra words the filter matches, e.g. "todo" for the checklist. */
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    hint: '#',
    icon: Heading1,
    keywords: ['title', 'big'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    hint: '##',
    icon: Heading2,
    keywords: ['subtitle'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    hint: '###',
    icon: Heading3,
    keywords: [],
    run: (e, r) => chain(e, r).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Bulleted list',
    hint: '-',
    icon: List,
    keywords: ['unordered', 'ul'],
    run: (e, r) => chain(e, r).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Numbered list',
    hint: '1.',
    icon: ListOrdered,
    keywords: ['ordered', 'ol'],
    run: (e, r) => chain(e, r).toggleOrderedList().run(),
  },
  {
    id: 'task',
    label: 'Checklist',
    hint: '[]',
    icon: ListTodo,
    keywords: ['todo', 'task', 'checkbox'],
    run: (e, r) => chain(e, r).toggleTaskList().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    hint: '>',
    icon: TextQuote,
    keywords: ['blockquote'],
    run: (e, r) => chain(e, r).toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code block',
    hint: '```',
    icon: SquareCode,
    keywords: ['snippet', 'pre'],
    run: (e, r) => chain(e, r).toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    hint: '---',
    icon: Minus,
    keywords: ['hr', 'rule', 'separator'],
    run: (e, r) => chain(e, r).setHorizontalRule().run(),
  },
]

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.startsWith(q)),
  )
}
