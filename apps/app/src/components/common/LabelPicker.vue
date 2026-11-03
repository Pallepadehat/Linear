<script setup lang="ts">
import { computed } from 'vue'
import { Tag } from '@lucide/vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// `color` is user data (the label's own color), not a design token.
export type LabelOption = { id: string; name: string; color?: string | null }

const props = defineProps<{
  labels: LabelOption[]
  /** Fixed trigger text, for when the selected labels are already shown next to it. */
  triggerText?: string
}>()
const model = defineModel<string[]>({ required: true })

const selected = computed(() => props.labels.filter((l) => model.value.includes(l.id)))

// Multi-select: the popover stays open so several labels can be toggled in a row.
function toggle(id: string) {
  model.value = model.value.includes(id)
    ? model.value.filter((v) => v !== id)
    : [...model.value, id]
}
</script>

<template>
  <PickerPopover label="Change labels" placeholder="Change labels..." hotkey="L">
    <template #trigger>
      <Tag class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="triggerText" class="text-ink-subtle">{{ triggerText }}</span>
      <span v-else-if="selected.length === 0" class="text-ink-subtle">Labels</span>
      <span v-else-if="selected.length === 1">{{ selected[0]?.name }}</span>
      <span v-else>{{ selected.length }} labels</span>
    </template>
    <PickerItem
      v-for="label in labels"
      :key="label.id"
      :value="label.id"
      :selected="model.includes(label.id)"
      @select="toggle(label.id)"
    >
      <span
        class="size-2 shrink-0 rounded-full bg-ink-tertiary"
        :style="label.color ? { backgroundColor: label.color } : undefined"
        aria-hidden="true"
      />
      {{ label.name }}
    </PickerItem>
  </PickerPopover>
</template>
