<script setup lang="ts">
import { VIEW_COLORS, VIEW_ICONS, type ViewColor, type ViewIcon as Icon } from '@linear/contract'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VIEW_COLOR_CLASSES, VIEW_COLOR_LABELS, VIEW_ICON_COMPONENTS } from '../view-appearance'
import ViewIcon from './ViewIcon.vue'

// Spelled out: the SFC compiler can't resolve the zod-inferred unions for models.
const icon = defineModel<
  'layers' | 'list' | 'star' | 'zap' | 'bug' | 'flag' | 'target' | 'inbox' | 'bookmark'
>('icon', { required: true })
const color = defineModel<'neutral' | 'started' | 'completed' | 'success' | 'urgent'>('color', {
  required: true,
})

const ICON_LABELS: Record<Icon, string> = {
  layers: 'Layers',
  list: 'List',
  star: 'Star',
  zap: 'Lightning',
  bug: 'Bug',
  flag: 'Flag',
  target: 'Target',
  inbox: 'Inbox',
  bookmark: 'Bookmark',
}
const pickColor = (value: ViewColor) => (color.value = value)
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label="Icon and color"
        class="shrink-0 border border-hairline"
      >
        <ViewIcon :icon="icon" :color="color" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-56 rounded-lg border-hairline bg-floating p-2">
      <div role="group" aria-label="Icon" class="grid grid-cols-5 gap-1">
        <button
          v-for="value in VIEW_ICONS"
          :key="value"
          type="button"
          :aria-label="ICON_LABELS[value]"
          :aria-pressed="icon === value"
          class="flex size-8 items-center justify-center rounded-md outline-hidden hover:bg-floating-hover focus-visible:ring-2 focus-visible:ring-ring"
          :class="icon === value && 'bg-surface-3'"
          @click="icon = value"
        >
          <component
            :is="VIEW_ICON_COMPONENTS[value]"
            class="size-4"
            :class="VIEW_COLOR_CLASSES[color]"
            aria-hidden="true"
          />
        </button>
      </div>
      <div role="group" aria-label="Color" class="mt-2 flex gap-1 border-t border-hairline pt-2">
        <button
          v-for="value in VIEW_COLORS"
          :key="value"
          type="button"
          :aria-label="VIEW_COLOR_LABELS[value]"
          :aria-pressed="color === value"
          class="flex size-7 items-center justify-center rounded-full outline-hidden hover:bg-floating-hover focus-visible:ring-2 focus-visible:ring-ring"
          :class="color === value && 'bg-surface-3'"
          @click="pickColor(value)"
        >
          <span class="size-3 rounded-full bg-current" :class="VIEW_COLOR_CLASSES[value]" />
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
