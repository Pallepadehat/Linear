<script setup lang="ts">
import { ref } from 'vue'
import { PRIORITIES, priorityLabel, type Priority } from '@/lib/priorities'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'
import PriorityIcon from './PriorityIcon.vue'

// `noHotkey` outside issue views, so a picker there doesn't clash with the create dialog's.
// `triggerText` replaces the current value in the trigger (the bulk action bar).
defineProps<{ compact?: boolean; noHotkey?: boolean; triggerText?: string }>()
const model = defineModel<Priority>({ required: true })
// Fires on every choice, even of the current value (the model only emits changes), so
// a mixed selection in the bulk action bar can still be set to the shown value.
const emit = defineEmits<{ pick: [priority: Priority] }>()
const open = ref(false)

function choose(priority: Priority) {
  model.value = priority
  emit('pick', priority)
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change priority"
    placeholder="Set priority..."
    :hotkey="noHotkey ? undefined : 'P'"
    :current="String(model)"
    :compact="compact"
  >
    <template #trigger>
      <PriorityIcon :priority="model" />
      <span :class="{ 'sr-only': compact }">{{ triggerText ?? priorityLabel(model) }}</span>
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
