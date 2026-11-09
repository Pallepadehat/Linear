<script setup lang="ts">
import 'katex/dist/katex.min.css'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import katex from 'katex'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

// LaTeX block: the rendered formula, with a source field while selected (Linear-style).
const props = defineProps(nodeViewProps)

const latex = computed(() => String(props.node.attrs.latex ?? ''))
const editing = ref(!latex.value)
const field = useTemplateRef<HTMLTextAreaElement>('field')

// KaTeX escapes its input and `trust` stays off, so the HTML is safe to inject.
const html = computed(() =>
  katex.renderToString(latex.value || '\\text{}', {
    displayMode: true,
    throwOnError: false,
    trust: false,
  }),
)

watch(
  () => props.selected,
  async (selected) => {
    if (selected) {
      editing.value = true
      await nextTick()
      field.value?.focus()
    } else if (latex.value) {
      editing.value = false
    }
  },
)

function onKeydown(event: KeyboardEvent) {
  // Escape / ⌘↵ finish editing and put the cursor after the block.
  if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
    event.preventDefault()
    event.stopPropagation()
    editing.value = !latex.value
    const pos = props.getPos()
    if (typeof pos !== 'number') return
    const after = pos + props.node.nodeSize
    const { editor } = props
    // Make sure there's a line to land on, then focus synchronously so the next keys
    // typed go into the editor (`chain().focus()` waits a frame).
    if (after >= editor.state.doc.content.size) {
      editor.commands.insertContentAt(after, { type: 'paragraph' })
    }
    editor.commands.setTextSelection(after + 1)
    editor.view.focus()
  }
}
</script>

<template>
  <NodeViewWrapper class="my-2" contenteditable="false">
    <div
      class="rounded-md border border-transparent px-3 py-2 hover:border-hairline"
      :class="{ 'border-hairline! bg-surface-1': editing }"
      @click="editing = true"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="latex" class="overflow-x-auto text-ink" v-html="html" />
      <p v-else class="text-center text-ink-tertiary">Add a LaTeX formula</p>
      <textarea
        v-if="editing"
        ref="field"
        :value="latex"
        rows="2"
        spellcheck="false"
        placeholder="E = mc^2"
        aria-label="LaTeX source"
        class="mt-2 w-full resize-none rounded-md border border-hairline bg-floating px-2.5 py-1.5 font-mono text-xs text-ink caret-primary outline-hidden field-sizing-content placeholder:text-ink-tertiary focus:border-hairline-strong"
        @input="updateAttributes({ latex: ($event.target as HTMLTextAreaElement).value })"
        @keydown="onKeydown"
      />
    </div>
  </NodeViewWrapper>
</template>
