<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  estimateLabel,
  estimateShortLabel,
  estimateValues,
  type EstimateScale,
} from '@/lib/estimates'
import EstimateIcon from './EstimateIcon.vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// Render only for teams whose scale isn't `off`. `compact` (rows, cards) shows a
// chip with the value; while unset the chip is hidden but `E` still opens it.
const props = defineProps<{
  scale: EstimateScale
  allowZero: boolean
  compact?: boolean
  noHotkey?: boolean
}>()
const model = defineModel<number | null>({ required: true })
const open = ref(false)

const NONE = 'none'
const values = computed(() => estimateValues({ scale: props.scale, allowZero: props.allowZero }))

function choose(value: number | null) {
  model.value = value
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change estimate"
    placeholder="Set estimate to…"
    :hotkey="noHotkey ? undefined : 'E'"
    :current="model === null ? NONE : String(model)"
    :compact="compact"
    :hidden-trigger="compact && model === null && !open"
    :trigger-class="compact && model !== null ? 'w-auto gap-1 px-1.5 has-[>svg]:px-1.5' : undefined"
  >
    <template #trigger>
      <EstimateIcon />
      <span v-if="compact && model === null" class="sr-only">No estimate</span>
      <span v-else-if="compact" class="text-xs text-ink-muted tabular-nums">
        {{ estimateShortLabel(model ?? 0, scale) }}
      </span>
      <span v-else>{{ model === null ? 'Estimate' : estimateLabel(model, scale) }}</span>
    </template>
    <PickerItem :value="NONE" :selected="model === null" @select="choose(null)">
      <EstimateIcon />
      No estimate
    </PickerItem>
    <PickerItem
      v-for="value in values"
      :key="value"
      :value="String(value)"
      :selected="value === model"
      @select="choose(value)"
    >
      <EstimateIcon />
      {{ estimateLabel(value, scale) }}
    </PickerItem>
  </PickerPopover>
</template>
