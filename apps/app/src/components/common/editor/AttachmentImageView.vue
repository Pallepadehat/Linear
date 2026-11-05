<script setup lang="ts">
import { Loader2, Maximize2 } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, ref } from 'vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'
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

// Read-only (comment bodies): the image itself opens the lightbox. While editing a click
// selects the image, so a hover button opens it instead.
const readonly = computed(() => !props.editor.isEditable)
const zoomed = ref(false)
const canZoom = computed(() => Boolean(displaySrc.value) && !props.node.attrs.uploading)
const alt = computed(() => String(props.node.attrs.alt ?? ''))
</script>

<template>
  <NodeViewWrapper
    as="figure"
    class="group/image relative my-2 w-fit max-w-full"
    :class="{
      'ring-2 ring-primary/60 ring-offset-2 ring-offset-floating rounded-md': selected && !readonly,
    }"
    data-drag-handle
  >
    <button
      v-if="displaySrc && readonly"
      type="button"
      class="block max-w-full cursor-zoom-in rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="`View ${alt || 'image'} full size`"
      @click="zoomed = true"
    >
      <img
        :src="displaySrc"
        :alt="alt"
        class="block max-h-80 max-w-full rounded-md border border-hairline bg-surface-1 object-contain transition-[border-color] hover:border-hairline-strong"
        draggable="false"
      />
    </button>
    <img
      v-else-if="displaySrc"
      :src="displaySrc"
      :alt="alt"
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
    <button
      v-if="canZoom && !readonly"
      type="button"
      contenteditable="false"
      class="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full border border-hairline bg-floating text-ink-muted opacity-0 shadow-floating outline-hidden transition-opacity group-hover/image:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-100"
      aria-label="View full size"
      title="View full size"
      @mousedown.prevent
      @click="zoomed = true"
    >
      <Maximize2 class="size-3.5" aria-hidden="true" />
    </button>
    <ImageLightbox
      v-if="canZoom && displaySrc"
      v-model:open="zoomed"
      :src="displaySrc"
      :alt="alt"
    />
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
