<script setup lang="ts">
import type { Member } from '@linear/contract'
import { computed, ref } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import UnassignedIcon from '@/components/common/UnassignedIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

const props = defineProps<{ members: Member[]; compact?: boolean }>()
// null = no lead
const model = defineModel<string | null>({ required: true })
const open = ref(false)

const current = computed(() => props.members.find((m) => m.userId === model.value))

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change project lead"
    placeholder="Set project lead..."
    :current="model ?? 'none'"
    :compact="compact"
  >
    <template #trigger>
      <UserAvatar v-if="current" :name="current.name" :src="current.avatarUrl" size="xs" />
      <UnassignedIcon v-else />
      <span :class="{ 'text-ink-subtle': !current, 'sr-only': compact }">
        {{ current?.name ?? 'Lead' }}
      </span>
    </template>
    <PickerItem value="none" :selected="model === null" shortcut="0" @select="choose(null)">
      <UnassignedIcon />
      No lead
    </PickerItem>
    <PickerItem
      v-for="(member, i) in members"
      :key="member.userId"
      :value="member.userId"
      :selected="member.userId === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(member.userId)"
    >
      <UserAvatar :name="member.name" :src="member.avatarUrl" size="xs" />
      {{ member.name }}
    </PickerItem>
  </PickerPopover>
</template>
