<script setup lang="ts">
import { computed, ref } from 'vue'
import EstimateIcon from '@/components/common/EstimateIcon.vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import { ESTIMATE_SCALES, scalePreview, type EstimateScale } from '@/lib/estimates'

// Each option previews its values, so the scale can be chosen without trying it.
const props = defineProps<{ allowZero: boolean }>()
const model = defineModel<EstimateScale>({ required: true })
const open = ref(false)

const current = computed(() => ESTIMATE_SCALES.find((s) => s.value === model.value))
const preview = (scale: EstimateScale) => scalePreview({ scale, allowZero: props.allowZero })

function choose(scale: EstimateScale) {
  model.value = scale
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Estimate scale"
    placeholder="Change scale…"
    :current="model"
    align="end"
  >
    <template #trigger>
      <EstimateIcon />
      <span>{{ current?.label ?? 'Not in use' }}</span>
    </template>
    <PickerItem
      v-for="scale in ESTIMATE_SCALES"
      :key="scale.value"
      :value="scale.value"
      :selected="scale.value === model"
      @select="choose(scale.value)"
    >
      <span class="shrink-0">{{ scale.label }}</span>
      <span v-if="scale.value !== 'off'" class="min-w-0 truncate text-xs text-ink-subtle">
        {{ preview(scale.value) }}
      </span>
    </PickerItem>
  </PickerPopover>
</template>
