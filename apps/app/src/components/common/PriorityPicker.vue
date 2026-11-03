<script setup lang="ts">
import { ref } from 'vue'
import { PRIORITIES, priorityLabel, type Priority } from '@/lib/priorities'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'
import PriorityIcon from './PriorityIcon.vue'

defineProps<{ compact?: boolean }>()
const model = defineModel<Priority>({ required: true })
const open = ref(false)

function choose(priority: Priority) {
  model.value = priority
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change priority"
    placeholder="Set priority..."
    hotkey="P"
    :current="String(model)"
    :compact="compact"
  >
    <template #trigger>
      <PriorityIcon :priority="model" />
      <span :class="{ 'sr-only': compact }">{{ priorityLabel(model) }}</span>
    </template>
    <PickerItem
      v-for="priority in PRIORITIES"
      :key="priority.value"
      :value="String(priority.value)"
      :selected="priority.value === model"
      :shortcut="String(priority.value)"
      @select="choose(priority.value)"
    >
      <PriorityIcon :priority="priority.value" />
      {{ priority.label }}
    </PickerItem>
  </PickerPopover>
</template>
