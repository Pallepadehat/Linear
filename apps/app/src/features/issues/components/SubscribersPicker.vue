<script setup lang="ts">
import { computed } from 'vue'
import type { AssigneeOption } from '@/components/common/AssigneePicker.vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

const MAX_AVATARS = 4

const props = defineProps<{
  subscribers: AssigneeOption[]
  /** Workspace members who can be added. */
  members: AssigneeOption[]
}>()
const emit = defineEmits<{ toggle: [user: AssigneeOption, subscribe: boolean] }>()

const shown = computed(() => props.subscribers.slice(0, MAX_AVATARS))
const overflow = computed(() => props.subscribers.length - shown.value.length)
const isSubscribed = (id: string) => props.subscribers.some((s) => s.id === id)
const summary = computed(() =>
  props.subscribers.length === 1 ? '1 subscriber' : `${props.subscribers.length} subscribers`,
)
</script>

<template>
  <!-- Multi-select: the popover stays open so several members can be toggled in a row. -->
  <PickerPopover label="Change subscribers" placeholder="Add or remove subscribers...">
    <template #trigger>
      <span v-if="subscribers.length === 0" class="text-ink-subtle">No subscribers</span>
      <template v-else>
        <span class="flex -space-x-1" aria-hidden="true">
          <UserAvatar
            v-for="user in shown"
            :key="user.id"
            :name="user.name"
            :src="user.avatarUrl"
            size="sm"
            class="ring-2 ring-canvas"
          />
        </span>
        <span v-if="overflow > 0" class="text-xs text-ink-subtle" aria-hidden="true">
          +{{ overflow }}
        </span>
        <span class="sr-only">{{ summary }}</span>
      </template>
    </template>
    <PickerItem
      v-for="member in members"
      :key="member.id"
      :value="member.id"
      :selected="isSubscribed(member.id)"
      @select="emit('toggle', member, !isSubscribed(member.id))"
    >
      <UserAvatar :name="member.name" :src="member.avatarUrl" size="xs" />
      {{ member.name }}
    </PickerItem>
  </PickerPopover>
</template>
