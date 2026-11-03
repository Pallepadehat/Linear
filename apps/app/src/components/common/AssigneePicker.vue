<script setup lang="ts">
import { computed, ref } from 'vue'
import { CommandGroup } from '@/components/ui/command'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { orderAssignees, type AssigneeOption } from '@/lib/assignee-options'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'
import UnassignedIcon from './UnassignedIcon.vue'
import UserAvatar from './UserAvatar.vue'

export type { AssigneeOption }

// `users` are the members of the issue's team (every workspace member, see
// domain.md → Assignee picker). Rows: No assignee (0), you (1), then the team
// members by name (2–9). The hidden email lets the filter match it too.
const props = defineProps<{ users: AssigneeOption[]; compact?: boolean; noHotkey?: boolean }>()
// null = unassigned
const model = defineModel<string | null>({ required: true })
const open = ref(false)

const { data: currentUser } = useCurrentUser()
const current = computed(() => props.users.find((u) => u.id === model.value))
const ordered = computed(() => orderAssignees(props.users, currentUser.value?.id))

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Assign to"
    placeholder="Assign to..."
    :hotkey="noHotkey ? undefined : 'A'"
    :current="model ?? 'unassigned'"
    :compact="compact"
    :align="compact ? 'end' : 'start'"
  >
    <template #trigger>
      <UserAvatar v-if="current" :name="current.name" :src="current.avatarUrl" size="xs" />
      <UnassignedIcon v-else />
      <span :class="{ 'text-ink-subtle': !current, 'sr-only': compact }">{{
        current?.name ?? 'Unassigned'
      }}</span>
    </template>
    <template #groups>
      <CommandGroup class="p-0">
        <PickerItem
          value="unassigned"
          :selected="model === null"
          shortcut="0"
          @select="choose(null)"
        >
          <UnassignedIcon />
          No assignee
        </PickerItem>
        <PickerItem
          v-if="ordered.me"
          :value="ordered.me.id"
          :selected="ordered.me.id === model"
          shortcut="1"
          @select="choose(ordered.me.id)"
        >
          <UserAvatar :name="ordered.me.name" :src="ordered.me.avatarUrl" size="xs" />
          <span class="truncate">{{ ordered.me.name }}</span>
          <span hidden>{{ ordered.me.email }}</span>
        </PickerItem>
      </CommandGroup>
      <CommandGroup
        v-if="ordered.others.length"
        heading="Team members"
        class="p-0 [&_[data-slot=command-group-heading]]:px-2.5 [&_[data-slot=command-group-heading]]:pt-2 [&_[data-slot=command-group-heading]]:pb-1 [&_[data-slot=command-group-heading]]:text-ink-subtle"
      >
        <PickerItem
          v-for="{ user, shortcut } in ordered.others"
          :key="user.id"
          :value="user.id"
          :selected="user.id === model"
          :shortcut="shortcut"
          @select="choose(user.id)"
        >
          <UserAvatar :name="user.name" :src="user.avatarUrl" size="xs" />
          <span class="truncate">{{ user.name }}</span>
          <span hidden>{{ user.email }}</span>
        </PickerItem>
      </CommandGroup>
    </template>
  </PickerPopover>
</template>
