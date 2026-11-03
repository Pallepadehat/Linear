<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { presenceLabel } from '@/features/presence/presence'
import { presenceListOptions } from '@/features/presence/queries'
import { orpc } from '@/lib/orpc'

const { slug } = useCurrentWorkspace()
const { data: members, isPending } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const { data: presence } = useQuery(computed(() => presenceListOptions(slug.value)))
const presenceOf = computed(() => {
  const byId = new Map(presence.value?.map((entry) => [entry.userId, entry]))
  return (userId: string) => byId.get(userId)
})
</script>

<template>
  <ul class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1">
    <li v-if="isPending" class="px-4 py-3 text-ink-subtle">Loading…</li>
    <li v-for="member in members" :key="member.userId" class="flex items-center gap-3 px-4 py-2.5">
      <UserAvatar
        :name="member.name"
        :src="member.avatarUrl"
        :presence="presenceOf(member.userId)?.state"
        size="md"
        class="[--avatar-ring:var(--surface-1)]"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-ink">{{ member.name }}</p>
        <p class="truncate text-xs text-ink-subtle">{{ member.email }}</p>
      </div>
      <span class="text-xs text-ink-subtle">{{ presenceLabel(presenceOf(member.userId)) }}</span>
      <span class="w-14 text-right text-xs text-ink-subtle capitalize">{{ member.role }}</span>
    </li>
  </ul>
</template>
