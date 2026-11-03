<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkflowStatus } from '@linear/contract'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'
import StatusIcon from './StatusIcon.vue'

const props = defineProps<{
  statuses: WorkflowStatus[]
  compact?: boolean
  noHotkey?: boolean
  /** Adds a "No status" option, which sets the model to ''. */
  allowNone?: boolean
}>()
const model = defineModel<string>({ required: true })
const open = ref(false)

const sorted = computed(() => [...props.statuses].sort((a, b) => a.position - b.position))
// Pickers match on `value`, and "none" must not collide with a status id.
const NONE = '__none__'
const current = computed(() => props.statuses.find((s) => s.id === model.value))

function choose(id: string) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change status"
    placeholder="Change status..."
    :hotkey="noHotkey ? undefined : 'S'"
    :current="model || NONE"
    :compact="compact"
  >
    <template #trigger>
      <StatusIcon v-if="current" :category="current.category" />
      <span :class="{ 'sr-only': compact }">{{ current?.name ?? 'Status' }}</span>
    </template>
    <PickerItem v-if="allowNone" :value="NONE" :selected="!model" shortcut="0" @select="choose('')">
      <span class="text-ink-subtle">No status</span>
    </PickerItem>
    <PickerItem
      v-for="(status, i) in sorted"
      :key="status.id"
      :value="status.id"
      :selected="status.id === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(status.id)"
    >
      <StatusIcon :category="status.category" />
      {{ status.name }}
    </PickerItem>
  </PickerPopover>
</template>
