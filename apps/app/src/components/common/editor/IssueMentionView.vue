<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { issueByIdentifierOptions } from '@/features/issues/queries'

// A mentioned issue: status icon + identifier, linking to it. The status comes from the
// shared query cache, so it follows realtime updates. An identifier that isn't an issue
// here (`ISO-9001`) stays plain text.
const props = defineProps(nodeViewProps)
const { slug } = useCurrentWorkspace()
const identifier = computed(() => String(props.node.attrs.identifier ?? ''))
const issue = useQuery(
  computed(() => ({
    ...issueByIdentifierOptions(slug.value, identifier.value),
    enabled: Boolean(slug.value && identifier.value),
    retry: false,
    staleTime: 30_000,
  })),
)
</script>

<template>
  <NodeViewWrapper as="span" contenteditable="false" data-issue-mention>
    <RouterLink
      v-if="issue.data.value"
      :to="{
        name: 'issue',
        params: { workspaceSlug: slug, identifier: issue.data.value.identifier },
      }"
      class="mention-chip"
      :class="{ 'ring-1 ring-primary': selected }"
      :title="issue.data.value.title"
    >
      <StatusIcon :category="issue.data.value.status.category" class="size-3" />
      <span class="font-mono text-[12px]">{{ issue.data.value.identifier }}</span>
    </RouterLink>
    <span v-else>{{ identifier }}</span>
  </NodeViewWrapper>
</template>
