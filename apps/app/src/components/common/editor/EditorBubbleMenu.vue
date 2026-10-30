<script setup lang="ts">
import { Bold, Code, Italic, Link, Strikethrough, TextQuote } from '@lucide/vue'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { nextTick, ref, useTemplateRef, type Component } from 'vue'

// Formatting toolbar shown over a text selection, like Linear's.
const props = defineProps<{ editor: Editor; appendTo: () => HTMLElement }>()

const linkMode = ref(false)
const linkUrl = ref('')
const linkInput = useTemplateRef<HTMLInputElement>('linkInput')

type Action = { id: string; label: string; icon: Component; run: () => void; active: () => boolean }
const actions: Action[] = [
  {
    id: 'bold',
    label: 'Bold (⌘B)',
    icon: Bold,
    run: () => props.editor.chain().focus().toggleBold().run(),
    active: () => props.editor.isActive('bold'),
  },
  {
    id: 'italic',
    label: 'Italic (⌘I)',
    icon: Italic,
    run: () => props.editor.chain().focus().toggleItalic().run(),
    active: () => props.editor.isActive('italic'),
  },
  {
    id: 'strike',
    label: 'Strikethrough (⌘⇧S)',
    icon: Strikethrough,
    run: () => props.editor.chain().focus().toggleStrike().run(),
    active: () => props.editor.isActive('strike'),
  },
  {
    id: 'code',
    label: 'Inline code (⌘E)',
    icon: Code,
    run: () => props.editor.chain().focus().toggleCode().run(),
    active: () => props.editor.isActive('code'),
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: TextQuote,
    run: () => props.editor.chain().focus().toggleBlockquote().run(),
    active: () => props.editor.isActive('blockquote'),
  },
]

async function startLink() {
  if (props.editor.isActive('link')) {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  linkUrl.value = ''
  linkMode.value = true
  await nextTick()
  linkInput.value?.focus()
}

function applyLink() {
  const href = linkUrl.value.trim()
  if (href) {
    const url = /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`
    props.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  linkMode.value = false
}

function cancelLink(event: KeyboardEvent) {
  // Keep Escape from also closing the surrounding dialog.
  event.stopPropagation()
  linkMode.value = false
  props.editor.commands.focus()
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :append-to="appendTo"
    :options="{ strategy: 'fixed', placement: 'top-start', offset: 8 }"
    :should-show="
      ({ editor: e, from, to }) => from !== to && !e.isActive('codeBlock') && e.isEditable
    "
  >
    <div
      class="flex h-8 items-center gap-0.5 rounded-full border border-hairline-strong bg-floating p-1 shadow-floating"
      role="toolbar"
      aria-label="Formatting"
    >
      <template v-if="!linkMode">
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          :title="action.label"
          :aria-label="action.label"
          :aria-pressed="action.active()"
          class="flex size-6 items-center justify-center rounded-full text-ink-muted hover:bg-floating-hover hover:text-ink aria-pressed:bg-floating-hover aria-pressed:text-ink"
          @click="action.run"
        >
          <component :is="action.icon" class="size-3.5" aria-hidden="true" />
        </button>
        <span class="mx-0.5 h-4 w-px bg-hairline" aria-hidden="true" />
        <button
          type="button"
          :title="editor.isActive('link') ? 'Remove link' : 'Link (⌘K)'"
          :aria-label="editor.isActive('link') ? 'Remove link' : 'Add link'"
          :aria-pressed="editor.isActive('link')"
          class="flex size-6 items-center justify-center rounded-full text-ink-muted hover:bg-floating-hover hover:text-ink aria-pressed:text-primary"
          @click="startLink"
        >
          <Link class="size-3.5" aria-hidden="true" />
        </button>
      </template>
      <div v-else class="flex items-center">
        <label for="editor-link-url" class="sr-only">Link URL</label>
        <input
          id="editor-link-url"
          ref="linkInput"
          v-model="linkUrl"
          type="url"
          placeholder="Paste or type a link..."
          class="h-6 w-64 bg-transparent px-2 text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          @keydown.enter.prevent.stop="applyLink"
          @keydown.esc="cancelLink"
        />
      </div>
    </div>
  </BubbleMenu>
</template>
