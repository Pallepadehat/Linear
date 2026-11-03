<script setup lang="ts">
import type { Member } from '@linear/contract'
import { Users } from '@lucide/vue'
import { computed } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

const props = defineProps<{ members: Member[] }>()
const model = defineModel<string[]>({ required: true })

const selected = computed(() => props.members.filter((m) => model.value.includes(m.userId)))

// Multi-select: stays open so several members can be toggled in a row.
function toggle(id: string) {
  model.value = model.value.includes(id)
    ? model.value.filter((v) => v !== id)
    : [...model.value, id]
}
</script>

<template>
  <PickerPopover label="Change project members" placeholder="Change members...">
    <template #trigger>
      <span v-if="selected.length" class="flex -space-x-1" aria-hidden="true">
        <UserAvatar
          v-for="member in selected.slice(0, 3)"
          :key="member.userId"
          :name="member.name"
          :src="member.avatarUrl"
          size="xs"
          class="ring-1 ring-floating"
        />
      </span>
      <Users v-else class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="selected.length === 0" class="text-ink-subtle">Members</span>
      <span v-else-if="selected.length === 1">{{ selected[0]?.name }}</span>
      <span v-else>{{ selected.length }} members</span>
    </template>
    <PickerItem
      v-for="member in members"
      :key="member.userId"
      :value="member.userId"
      :selected="model.includes(member.userId)"
      @select="toggle(member.userId)"
    >
      <UserAvatar :name="member.name" :src="member.avatarUrl" size="xs" />
      {{ member.name }}
    </PickerItem>
  </PickerPopover>
</template>
