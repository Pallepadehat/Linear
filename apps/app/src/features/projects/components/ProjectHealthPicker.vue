<script setup lang="ts">
import { ref } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import { PROJECT_HEALTHS, healthLabel, type HealthValue } from '../project-health'
import HealthIcon from './HealthIcon.vue'

const model = defineModel<HealthValue>({ required: true })
const open = ref(false)

function choose(value: HealthValue) {
  model.value = value
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Set project health"
    placeholder="Set health..."
    :current="model"
  >
    <template #trigger>
      <HealthIcon :health="model" />
      <span>{{ healthLabel(model) }}</span>
    </template>
    <PickerItem
      v-for="(health, i) in PROJECT_HEALTHS"
      :key="health.value"
      :value="health.value"
      :selected="health.value === model"
      :shortcut="String(i + 1)"
      @select="choose(health.value)"
    >
      <HealthIcon :health="health.value" />
      {{ health.label }}
    </PickerItem>
  </PickerPopover>
</template>
