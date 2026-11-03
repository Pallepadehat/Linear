<script setup lang="ts">
import type { ProjectProgressReport } from '@linear/contract'
import { computed, nextTick, ref, useId } from 'vue'
import { doneLabel } from '../progress-chart'
import ProgressRing from './ProgressRing.vue'

const props = defineProps<{
  byAssignee: ProjectProgressReport['byAssignee']
  byLabel: ProjectProgressReport['byLabel']
}>()

const TABS = [
  { value: 'assignees', label: 'Assignees' },
  { value: 'labels', label: 'Labels' },
] as const
type Tab = (typeof TABS)[number]['value']

const id = useId()
const tab = ref<Tab>('assignees')
const tabEls = ref<HTMLButtonElement[]>()

const rows = computed(() =>
  tab.value === 'assignees'
    ? props.byAssignee.map((row) => ({ key: row.userId ?? 'none', color: null, ...row }))
    : props.byLabel.map((row) => ({ key: row.labelId, ...row })),
)

async function onKeydown(event: KeyboardEvent) {
  const index = TABS.findIndex((t) => t.value === tab.value)
  const last = TABS.length - 1
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  tab.value = TABS[next]!.value
  await nextTick()
  tabEls.value?.[next]?.focus()
}
</script>

<template>
  <div class="grid gap-2">
    <div role="tablist" aria-label="Progress by" class="flex items-center gap-1">
      <button
        v-for="t in TABS"
        :id="`${id}-tab-${t.value}`"
        ref="tabEls"
        :key="t.value"
        type="button"
        role="tab"
        :aria-selected="t.value === tab"
        :aria-controls="`${id}-panel`"
        :tabindex="t.value === tab ? 0 : -1"
        class="h-7 rounded-full border px-3 text-xs font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        :class="
          t.value === tab
            ? 'border-hairline bg-surface-2 text-ink'
            : 'border-transparent text-ink-subtle hover:bg-surface-2 hover:text-ink'
        "
        @click="tab = t.value"
        @keydown="onKeydown"
      >
        {{ t.label }}
      </button>
    </div>
    <div :id="`${id}-panel`" role="tabpanel" :aria-labelledby="`${id}-tab-${tab}`">
      <p v-if="rows.length === 0" class="px-1 py-1.5 text-ink-subtle">
        {{ tab === 'assignees' ? 'No issues' : 'No labeled issues' }}
      </p>
      <ul v-else class="grid gap-px">
        <li
          v-for="row in rows"
          :key="row.key"
          class="flex h-8 items-center gap-2 rounded-md px-1 text-ink-muted"
        >
          <ProgressRing :done="row.done" :total="row.total" />
          <span
            v-if="row.color"
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: row.color }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate">{{ row.name }}</span>
          <span class="shrink-0 text-ink-subtle tabular-nums">{{ doneLabel(row) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
