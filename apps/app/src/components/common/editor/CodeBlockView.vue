<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

// Code blocks; ```mermaid blocks also render the diagram, like Linear's "Diagram".
const props = defineProps(nodeViewProps)

const isDiagram = computed(() => props.node.attrs.language === 'mermaid')
const svg = ref('')
const error = ref<string | null>(null)
let renders = 0

// mermaid is large, so it's only loaded once a diagram is on screen.
const render = useDebounceFn(async (source: string) => {
  const id = `diagram-${crypto.randomUUID()}`
  const run = ++renders
  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
    })
    const result = await mermaid.render(id, source)
    if (run !== renders) return
    svg.value = result.svg
    error.value = null
  } catch (e) {
    if (run !== renders) return
    error.value = e instanceof Error ? e.message.split('\n')[0]! : 'Invalid diagram'
  } finally {
    document.getElementById(`d${id}`)?.remove()
  }
}, 300)

watch(
  () => [isDiagram.value, props.node.textContent] as const,
  ([diagram, source]) => {
    if (diagram && source.trim()) void render(source)
  },
  { immediate: true },
)
</script>

<template>
  <NodeViewWrapper class="my-2">
    <div v-if="isDiagram" class="overflow-hidden rounded-md border border-hairline">
      <div
        class="flex min-h-24 items-center justify-center overflow-x-auto bg-surface-1 p-4"
        contenteditable="false"
      >
        <!-- mermaid output, rendered with securityLevel 'strict' (sanitized SVG). -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="svg && !error"
          class="max-w-full [&_svg]:h-auto [&_svg]:max-w-full"
          v-html="svg"
        />
        <!-- eslint-enable vue/no-v-html -->
        <p v-else class="text-xs text-ink-subtle">{{ error ?? 'Rendering diagram…' }}</p>
      </div>
      <pre
        class="m-0! rounded-none! border-0! border-t! border-hairline!"
      ><NodeViewContent as="code" /></pre>
    </div>
    <pre v-else><NodeViewContent as="code" /></pre>
  </NodeViewWrapper>
</template>
