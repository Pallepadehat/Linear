<script setup lang="ts">
import { computed, ref } from 'vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// A picker for a short list of fixed choices (settings like "2 weeks").
const props = defineProps<{
  label: string
  options: { value: number; label: string }[]
}>()
const model = defineModel<number>({ required: true })
const open = ref(false)
const current = computed(() => props.options.find((o) => o.value === model.value))

function choose(value: number) {
  model.value = value
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    :label="label"
    :placeholder="`${label}...`"
    :current="String(model)"
    align="end"
  >
    <template #trigger>
      <span>{{ current?.label ?? model }}</span>
    </template>
    <PickerItem
      v-for="(option, i) in options"
      :key="option.value"
      :value="String(option.value)"
      :selected="option.value === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(option.value)"
    >
      {{ option.label }}
    </PickerItem>
  </PickerPopover>
</template>
