<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { orpc } from '@/lib/orpc'
import { viewersOf } from '../presence'
import { presenceListOptions } from '../queries'

const MAX_SHOWN = 3

// Self-contained so any issue header can drop it in: <IssueViewers :issue-id="issue.id" />.
const props = defineProps<{ issueId: string }>()

const { slug } = useCurrentWorkspace()
const { data: me } = useCurrentUser()
const { data: presence } = useQuery(computed(() => presenceListOptions(slug.value)))
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)

const viewers = computed(() => {
  const byId = new Map(members.value?.map((m) => [m.userId, m]))
  return viewersOf(presence.value ?? [], props.issueId, me.value?.id).flatMap((entry) => {
    const member = byId.get(entry.userId)
    return member ? [{ ...entry, name: member.name, avatarUrl: member.avatarUrl }] : []
  })
})
const shown = computed(() => viewers.value.slice(0, MAX_SHOWN))
const hidden = computed(() => viewers.value.slice(MAX_SHOWN))
const summary = computed(() => {
  const names = viewers.value.map((v) => v.name)
  if (names.length <= 1) return `${names[0]} is viewing`
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are viewing`
})
</script>

<template>
  <div v-if="viewers.length" role="group" :aria-label="summary" class="flex items-center">
    <Tooltip v-for="viewer in shown" :key="viewer.userId">
      <TooltipTrigger as-child>
        <span
          tabindex="0"
          class="-ml-1 rounded-full ring-2 ring-panel first:ml-0 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <UserAvatar
            :name="viewer.name"
            :src="viewer.avatarUrl"
            :presence="viewer.state"
            size="sm"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ viewer.name }} is viewing</TooltipContent>
    </Tooltip>
    <Tooltip v-if="hidden.length">
      <TooltipTrigger as-child>
        <span
          tabindex="0"
          class="-ml-1 flex size-5 items-center justify-center rounded-full bg-surface-3 text-[10px] font-medium text-ink-muted ring-2 ring-panel focus-visible:outline-2 focus-visible:outline-primary"
        >
          +{{ hidden.length }}
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ hidden.map((v) => v.name).join(', ') }}</TooltipContent>
    </Tooltip>
  </div>
</template>
