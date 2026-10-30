<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleUserRound } from '@lucide/vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'
import UserAvatar from './UserAvatar.vue'

export type AssigneeOption = { id: string; name: string; avatarUrl: string | null }

const props = defineProps<{ users: AssigneeOption[] }>()
// null = unassigned
const model = defineModel<string | null>({ required: true })
const open = ref(false)

const current = computed(() => props.users.find((u) => u.id === model.value))

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover v-model:open="open" label="Assign to" placeholder="Assign to…">
    <template #trigger>
      <UserAvatar v-if="current" :name="current.name" :src="current.avatarUrl" size="xs" />
      <CircleUserRound v-else class="size-4 text-ink-tertiary" aria-hidden="true" />
      <span>{{ current?.name ?? 'Unassigned' }}</span>
    </template>
    <PickerItem value="unassigned" :selected="model === null" @select="choose(null)">
      <CircleUserRound class="size-4 text-ink-tertiary" aria-hidden="true" />
      No assignee
    </PickerItem>
    <PickerItem
      v-for="user in users"
      :key="user.id"
      :value="user.id"
      :selected="user.id === model"
      @select="choose(user.id)"
    >
      <UserAvatar :name="user.name" :src="user.avatarUrl" size="xs" />
      {{ user.name }}
    </PickerItem>
  </PickerPopover>
</template>
