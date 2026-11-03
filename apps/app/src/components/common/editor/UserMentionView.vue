<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { orpc } from '@/lib/orpc'

// A mentioned teammate: avatar + current name (the stored label if they left).
const props = defineProps(nodeViewProps)
const { slug } = useCurrentWorkspace()
const members = useQuery(
  computed(() => ({
    ...orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
    enabled: Boolean(slug.value),
    staleTime: 60_000,
  })),
)
const member = computed(() => members.data.value?.find((m) => m.userId === props.node.attrs.id))
const name = computed(() => member.value?.name ?? String(props.node.attrs.label ?? ''))
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="mention-chip"
    :class="{ 'ring-1 ring-primary': selected }"
    contenteditable="false"
    data-user-mention
  >
    <UserAvatar :name="name" :src="member?.avatarUrl" size="xs" />
    <span>{{ name }}</span>
  </NodeViewWrapper>
</template>
