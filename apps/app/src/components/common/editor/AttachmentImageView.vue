<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import { orpc } from '@/lib/orpc'
import { parseAttachmentId } from './attachments'

const props = defineProps(nodeViewProps)

const src = computed(() => String(props.node.attrs.src ?? ''))
const uploadId = computed(() => parseAttachmentId(src.value))
// Presigned GET URLs live 15 minutes; refresh well before they expire.
const { data, isError } = useQuery(
  computed(() => ({
    ...orpc.uploads.getUrl.queryOptions({ input: { uploadId: uploadId.value ?? '' } }),
    enabled: Boolean(uploadId.value),
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
  })),
)
// While uploading, `src` is a local blob: preview; other https images show as-is.
const displaySrc = computed(() => {
  if (uploadId.value) return data.value?.url
  return /^(blob:|https:)/.test(src.value) ? src.value : undefined
})
</script>

<template>
  <NodeViewWrapper
    as="figure"
    class="relative my-2 w-fit max-w-full"
    :class="{ 'ring-2 ring-primary/60 ring-offset-2 ring-offset-floating rounded-md': selected }"
    data-drag-handle
  >
    <img
      v-if="displaySrc"
      :src="displaySrc"
      :alt="node.attrs.alt ?? ''"
      class="block max-h-96 max-w-full rounded-md border border-hairline"
      :class="{ 'opacity-60': node.attrs.uploading }"
      draggable="false"
    />
    <div
      v-else
      class="flex h-24 w-48 items-center justify-center rounded-md border border-hairline bg-surface-2 text-xs text-ink-subtle"
    >
      {{ isError ? 'Image unavailable' : 'Loading image…' }}
    </div>
    <span
      v-if="node.attrs.uploading"
      class="absolute inset-0 flex items-center justify-center"
      role="status"
    >
      <span
        class="flex items-center gap-1.5 rounded-full bg-floating px-2.5 py-1 text-xs text-ink shadow-floating"
      >
        <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
        Uploading…
      </span>
    </span>
  </NodeViewWrapper>
</template>
