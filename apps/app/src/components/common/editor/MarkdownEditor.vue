<script setup lang="ts">
import { Extension, type Range } from '@tiptap/core'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { Markdown } from '@tiptap/markdown'
import { PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Suggestion from '@tiptap/suggestion'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, reactive, useTemplateRef, watch } from 'vue'
import { cn } from '@/lib/utils'
import EditorBubbleMenu from './EditorBubbleMenu.vue'
import { filterSlashCommands, type SlashCommand } from './slash-commands'
import SlashMenu from './SlashMenu.vue'

// Rich text that reads and writes markdown, like Linear's editor: markdown
// shortcuts as you type (`# `, `- `, `[] `, `> `, ``` ```), a `/` block menu and a
// formatting toolbar on selection. The stored value is always markdown.
const props = defineProps<{
  placeholder?: string
  label: string
  class?: string
}>()
const model = defineModel<string>({ default: '' })

const root = useTemplateRef<HTMLElement>('root')

const slash = reactive({
  open: false,
  items: [] as SlashCommand[],
  active: 0,
  range: null as Range | null,
  getRect: (() => null) as () => DOMRect | null,
})

function runSlash(command: SlashCommand | undefined) {
  if (!command || !slash.range || !editor.value) return
  command.run(editor.value, slash.range)
  slash.open = false
}

const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommands'),
        char: '/',
        startOfLine: false,
        // Only at the start of a word, so URLs like a/b don't open it.
        allowedPrefixes: [' '],
        items: ({ query }) => filterSlashCommands(query),
        render: () => ({
          onStart: (p) => {
            Object.assign(slash, {
              open: true,
              items: p.items,
              active: 0,
              range: p.range,
              getRect: () => p.clientRect?.() ?? null,
            })
          },
          onUpdate: (p) => {
            Object.assign(slash, {
              items: p.items,
              active: 0,
              range: p.range,
              getRect: () => p.clientRect?.() ?? null,
            })
          },
          onKeyDown: ({ event }) => {
            const count = slash.items.length
            if (event.key === 'ArrowDown' && count) {
              slash.active = (slash.active + 1) % count
              return true
            }
            if (event.key === 'ArrowUp' && count) {
              slash.active = (slash.active - 1 + count) % count
              return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              if (!count) return false
              runSlash(slash.items[slash.active])
              return true
            }
            if (event.key === 'Escape') {
              // Close the menu, not the dialog around the editor.
              event.stopPropagation()
              slash.open = false
              return true
            }
            return false
          },
          onExit: () => {
            slash.open = false
          },
        }),
      }),
    ]
  },
})

const Shortcuts = Extension.create({
  name: 'editorShortcuts',
  addKeyboardShortcuts() {
    return {
      // Leave Mod-Enter to the surrounding form (submit) instead of inserting a line break.
      'Mod-Enter': () => true,
    }
  },
})

const editor = useEditor({
  content: model.value,
  contentType: 'markdown',
  extensions: [
    StarterKit.configure({
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      heading: { levels: [1, 2, 3] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: () => props.placeholder ?? '' }),
    Markdown,
    SlashCommands,
    Shortcuts,
  ],
  editorProps: {
    attributes: {
      class: 'markdown-body outline-hidden',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': props.label,
    },
  },
  onUpdate: ({ editor: e }) => {
    model.value = e.isEmpty ? '' : e.getMarkdown()
  },
})

// Outside changes (a form reset) replace the content; our own updates are skipped.
watch(model, (value) => {
  const e = editor.value
  if (!e) return
  const current = e.isEmpty ? '' : e.getMarkdown()
  if (value !== current)
    e.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

const appendTo = () => root.value ?? document.body
const showSlash = computed(() => slash.open && Boolean(editor.value))

// `view.focus()` is synchronous (`commands.focus` waits a frame), so keys typed right
// after moving focus here land in the editor.
defineExpose({ focus: () => editor.value?.view.focus() })
</script>

<template>
  <div ref="root" :class="cn('relative', props.class)">
    <EditorContent :editor="editor" />
    <EditorBubbleMenu v-if="editor" :editor="editor" :append-to="appendTo" />
    <SlashMenu
      v-if="showSlash"
      :items="slash.items"
      :active="slash.active"
      :get-rect="slash.getRect"
      @hover="slash.active = $event"
      @select="runSlash"
    />
  </div>
</template>
