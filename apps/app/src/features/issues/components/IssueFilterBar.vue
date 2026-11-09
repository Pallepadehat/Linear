<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useFilterDimensions } from '../composables/useFilterDimensions'
import { useIssueFilters } from '../composables/useIssueFilters'
import { displayViewKey } from '../display-options'
import IssueDisplayOptions from './IssueDisplayOptions.vue'
import IssueFilterMenu from './IssueFilterMenu.vue'
import IssueSearchField from './IssueSearchField.vue'

const props = defineProps<{
  workspaceSlug: string
  teamId?: string
  projectId?: string
  cycleId?: string
  /** My issues: the display options are that view's. */
  assignee?: 'me'
  creator?: 'me'
  /**
   * The view toolbar above holds the Filter, search and Display options controls, so this
   * bar only shows the active filter chips (and nothing when there are none).
   */
  hideFilterMenu?: boolean
}>()

const { filters, update, clear } = useIssueFilters()
const dimensions = useFilterDimensions(() => props, filters, update)
const activeDimensions = computed(() => dimensions.value.filter((d) => d.active))
const visible = computed(() => !props.hideFilterMenu || activeDimensions.value.length > 0)
</script>

<template>
  <div
    v-if="visible"
    class="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-hairline py-2 pr-2 pl-2 md:pl-4"
    role="toolbar"
    aria-label="Issue filters"
  >
    <IssueFilterMenu v-if="!hideFilterMenu" :dimensions="dimensions" />
    <!-- Chips wrap on wide screens and scroll sideways on phones. -->
    <div
      v-if="activeDimensions.length"
      class="flex min-w-0 flex-1 items-center gap-1.5 max-md:order-last max-md:basis-full max-md:overflow-x-auto max-md:[scrollbar-width:none] md:flex-wrap"
    >
      <div
        v-for="dimension in activeDimensions"
        :key="dimension.key"
        class="flex h-7 shrink-0 items-center overflow-hidden rounded-full border border-hairline text-[13px]"
      >
        <span class="flex items-center gap-1.5 pr-1.5 pl-2.5 text-ink-muted">
          <component :is="dimension.icon" class="size-3.5 text-ink-subtle" aria-hidden="true" />
          {{ dimension.label }}
        </span>
        <button
          v-if="dimension.cycleOperator"
          type="button"
          class="flex h-full items-center border-l border-hairline px-2 text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
          :aria-label="`${dimension.label} ${dimension.operator}, change operator`"
          title="Change operator"
          @click="dimension.cycleOperator()"
        >
          {{ dimension.operator }}
        </button>
        <span v-else class="flex h-full items-center border-l border-hairline px-2 text-ink-subtle">
          {{ dimension.operator }}
        </span>
        <span
          class="max-w-40 truncate border-l border-hairline px-2 text-ink md:max-w-56"
          :title="dimension.selectedLabels.join(', ')"
        >
          {{ dimension.summary }}
        </span>
        <button
          type="button"
          class="flex h-full items-center border-l border-hairline px-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          :aria-label="`Remove ${dimension.label} filter`"
          @click="dimension.clear()"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <Button variant="ghost" size="sm" class="shrink-0 text-ink-subtle" @click="clear">
        Clear
      </Button>
    </div>

    <div v-if="!hideFilterMenu" class="ml-auto flex min-w-0 items-center gap-1 max-md:flex-1">
      <IssueSearchField />
      <IssueDisplayOptions :view-key="displayViewKey(props)" />
    </div>
  </div>
</template>
