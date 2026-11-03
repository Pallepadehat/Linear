<script setup lang="ts">
import { DISPLAY_PROPERTIES, type SortDirection } from '@linear/contract'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Columns3,
  List,
  SlidersHorizontal,
} from '@lucide/vue'
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDisplayOptions } from '../composables/useDisplayOptions'
import {
  COMPLETED_OPTIONS,
  GROUPING_OPTIONS,
  ORDERING_OPTIONS,
  PROPERTY_LABELS,
  effectiveSubGrouping,
  type DisplayProperty,
  type DisplayViewKey,
} from '../display-options'

// Linear's Display options popover: layout, grouping, ordering, which finished
// issues to keep and which properties rows show. Changes apply at once and are
// remembered per view (`viewKey`). `allowBoard` offers the List | Board toggle.
const props = defineProps<{ viewKey: DisplayViewKey; allowBoard?: boolean }>()

const { options, update, reset, isDefault } = useDisplayOptions(() => props.viewKey)
const id = useId()
const open = ref(false)

const LAYOUTS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'board', label: 'Board', icon: Columns3 },
] as const
const board = computed(() => props.allowBoard && options.value.layout === 'board')
const subGroupingOptions = computed(() =>
  GROUPING_OPTIONS.filter((o) => o.value !== options.value.grouping),
)

// Arrow keys move between List and Board (radio group).
const layoutButtons = useTemplateRef<HTMLButtonElement[]>('layoutButtons')
async function onLayoutKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  const next = options.value.layout === 'list' ? 1 : 0
  update({ layout: LAYOUTS[next]!.value })
  await nextTick()
  layoutButtons.value?.[next]?.focus()
}

const flip = (direction: SortDirection): SortDirection => (direction === 'asc' ? 'desc' : 'asc')

function toggleProperty(property: DisplayProperty) {
  const current = options.value.properties
  update({
    properties: current.includes(property)
      ? current.filter((p) => p !== property)
      : [...current, property],
  })
}

// Native selects hand back strings; only known values get through.
const selected = (event: Event) => (event.target as HTMLSelectElement).value
function pick<T extends string>(choices: readonly { value: T }[], value: unknown): T | undefined {
  return choices.find((c) => c.value === value)?.value
}
function setGrouping(value: unknown) {
  const grouping = pick(GROUPING_OPTIONS, value)
  if (grouping) update({ grouping })
}
function setSubGrouping(value: unknown) {
  const subGrouping = pick(GROUPING_OPTIONS, value)
  if (subGrouping) update({ subGrouping })
}
function setOrdering(value: unknown) {
  const ordering = pick(ORDERING_OPTIONS, value)
  if (ordering) update({ ordering })
}
function setCompleted(value: unknown) {
  const completedIssues = pick(COMPLETED_OPTIONS, value)
  if (completedIssues) update({ completedIssues })
}

const SELECT_CLASS =
  'h-7 w-36 rounded-md border-hairline bg-surface-1 py-0 pr-7 pl-2 text-[13px] text-ink shadow-none dark:bg-surface-1 dark:hover:bg-surface-2'
</script>

<template>
  <Popover v-model:open="open">
    <!-- An explicit anchor: inside the tooltip, the trigger would register with the
         tooltip's popper and the popover would have nothing to position against. -->
    <PopoverAnchor as-child>
      <span class="inline-flex">
        <Tooltip>
          <TooltipTrigger as-child>
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="shrink-0 text-ink-subtle data-[state=open]:bg-surface-2 data-[state=open]:text-ink"
                aria-label="Display options"
              >
                <SlidersHorizontal aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Display options</TooltipContent>
        </Tooltip>
      </span>
    </PopoverAnchor>
    <PopoverContent
      align="end"
      class="w-80 overflow-hidden rounded-lg border-hairline bg-floating p-0 text-[13px] text-ink shadow-floating"
      aria-label="Display options"
    >
      <div
        v-if="allowBoard"
        role="radiogroup"
        aria-label="Layout"
        class="m-3 mb-1 grid grid-cols-2 gap-1 rounded-md border border-hairline p-0.5"
      >
        <button
          v-for="layout in LAYOUTS"
          ref="layoutButtons"
          :key="layout.value"
          type="button"
          role="radio"
          :aria-checked="options.layout === layout.value"
          :tabindex="options.layout === layout.value ? 0 : -1"
          class="flex h-7 items-center justify-center gap-1.5 rounded-[6px] outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="
            options.layout === layout.value
              ? 'bg-surface-3 text-ink'
              : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
          "
          @click="update({ layout: layout.value })"
          @keydown="onLayoutKeydown"
        >
          <component :is="layout.icon" class="size-3.5" aria-hidden="true" />
          {{ layout.label }}
        </button>
      </div>

      <div class="grid gap-0.5 px-3 py-2">
        <div class="flex h-8 items-center gap-2">
          <label :for="`${id}-grouping`" class="flex-1 text-ink-muted">
            {{ board ? 'Columns' : 'Grouping' }}
          </label>
          <Button
            variant="ghost"
            size="icon-xs"
            class="text-ink-subtle"
            :aria-label="
              options.groupDirection === 'asc'
                ? 'Group order: ascending'
                : 'Group order: descending'
            "
            :disabled="options.grouping === 'none'"
            @click="update({ groupDirection: flip(options.groupDirection) })"
          >
            <component
              :is="options.groupDirection === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow"
              aria-hidden="true"
            />
          </Button>
          <NativeSelect
            :id="`${id}-grouping`"
            :model-value="options.grouping"
            :class="SELECT_CLASS"
            @change="setGrouping(selected($event))"
          >
            <NativeSelectOption v-for="o in GROUPING_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <!-- Board sub-grouping (swimlanes) isn't built; the option is the list's. -->
        <div v-if="!board" class="flex h-8 items-center gap-2">
          <label :for="`${id}-subgrouping`" class="flex-1 text-ink-muted">Sub-grouping</label>
          <NativeSelect
            :id="`${id}-subgrouping`"
            :model-value="effectiveSubGrouping(options)"
            :class="SELECT_CLASS"
            :disabled="options.grouping === 'none'"
            @change="setSubGrouping(selected($event))"
          >
            <NativeSelectOption v-for="o in subGroupingOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div class="flex h-8 items-center gap-2">
          <label :for="`${id}-ordering`" class="flex-1 text-ink-muted">Ordering</label>
          <Button
            variant="ghost"
            size="icon-xs"
            class="text-ink-subtle"
            :aria-label="
              options.orderDirection === 'asc' ? 'Order: ascending' : 'Order: descending'
            "
            @click="update({ orderDirection: flip(options.orderDirection) })"
          >
            <component
              :is="options.orderDirection === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow"
              aria-hidden="true"
            />
          </Button>
          <NativeSelect
            :id="`${id}-ordering`"
            :model-value="options.ordering"
            :class="SELECT_CLASS"
            @change="setOrdering(selected($event))"
          >
            <NativeSelectOption v-for="o in ORDERING_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <label class="flex h-8 items-center justify-between gap-2">
          <span class="text-ink-muted">Order completed by recency</span>
          <Switch
            :model-value="options.orderCompletedByRecency"
            @update:model-value="update({ orderCompletedByRecency: $event })"
          />
        </label>
      </div>

      <div class="grid gap-0.5 border-t border-hairline px-3 py-2">
        <div class="flex h-8 items-center gap-2">
          <label :for="`${id}-completed`" class="flex-1 text-ink-muted">Completed issues</label>
          <NativeSelect
            :id="`${id}-completed`"
            :model-value="options.completedIssues"
            :class="SELECT_CLASS"
            @change="setCompleted(selected($event))"
          >
            <NativeSelectOption v-for="o in COMPLETED_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <label class="flex h-8 items-center justify-between gap-2">
          <span class="text-ink-muted">Show sub-issues</span>
          <Switch
            :model-value="options.showSubIssues"
            @update:model-value="update({ showSubIssues: $event })"
          />
        </label>
      </div>

      <div class="grid gap-0.5 border-t border-hairline px-3 py-2">
        <p class="flex h-6 items-center text-xs text-ink-subtle">
          {{ board ? 'Board options' : 'List options' }}
        </p>
        <label class="flex h-8 items-center justify-between gap-2">
          <span class="text-ink-muted">{{
            board ? 'Show empty columns' : 'Show empty groups'
          }}</span>
          <Switch
            :model-value="options.showEmptyGroups"
            @update:model-value="update({ showEmptyGroups: $event })"
          />
        </label>
      </div>

      <div class="border-t border-hairline px-3 py-2">
        <p :id="`${id}-properties`" class="flex h-6 items-center text-xs text-ink-subtle">
          Display properties
        </p>
        <div role="group" :aria-labelledby="`${id}-properties`" class="flex flex-wrap gap-1 py-1">
          <button
            v-for="property in DISPLAY_PROPERTIES"
            :key="property"
            type="button"
            :aria-pressed="options.properties.includes(property)"
            class="flex h-6 items-center rounded-full border px-2 text-xs outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            :class="
              options.properties.includes(property)
                ? 'border-hairline-strong bg-surface-3 text-ink'
                : 'border-hairline text-ink-subtle hover:bg-surface-2 hover:text-ink'
            "
            @click="toggleProperty(property)"
          >
            {{ PROPERTY_LABELS[property] }}
          </button>
        </div>
      </div>

      <div class="flex items-center justify-end border-t border-hairline px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          class="text-ink-muted"
          :disabled="isDefault"
          @click="reset"
        >
          Reset
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
