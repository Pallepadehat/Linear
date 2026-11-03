<script setup lang="ts">
import { computed } from 'vue'
import { Tag } from '@lucide/vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// `color` is user data (the label's own color), not a design token.
export type LabelOption = { id: string; name: string; color?: string | null }

const props = defineProps<{ labels: LabelOption[]; compact?: boolean }>()
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
  <PickerPopover
    label="Change labels"
    placeholder="Change labels..."
    hotkey="L"
    :compact="compact"
    :trigger-class="compact ? 'h-auto w-auto gap-1 px-0 has-[>svg]:px-0' : undefined"
  >
    <!-- Compact (list rows): the label chips themselves open the picker. -->
    <template v-if="compact" #trigger>
      <span
        v-for="label in selected"
        :key="label.id"
        class="flex h-[22px] max-w-32 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs font-normal text-ink-muted"
      >
        <span
          class="size-2 shrink-0 rounded-full bg-ink-tertiary"
          :style="label.color ? { backgroundColor: label.color } : undefined"
          aria-hidden="true"
        />
        <span class="truncate">{{ label.name }}</span>
      </span>
    </template>
    <template v-else #trigger>
      <Tag class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="selected.length === 0" class="text-ink-subtle">Labels</span>
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
