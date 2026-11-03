<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import IssueViews from '@/features/issues/components/IssueViews.vue'
import { useDisplayOptions } from '@/features/issues/composables/useDisplayOptions'
import { useIssueFilters } from '@/features/issues/composables/useIssueFilters'
import { parseDisplayOptions } from '@/features/issues/display-options'
import { PANEL_HEADER_ACTIONS } from '@/layouts/panel-header'
import { errorCode } from '@/lib/errors'
import { useUiStore } from '@/stores/ui'
import ViewIcon from '../components/ViewIcon.vue'
import ViewMenu from '../components/ViewMenu.vue'
import { useUpdateView, viewOptions } from '../queries'
import { fromViewFilters, hasFilterQuery, sameFilters, toViewFilters } from '../view-filters'
import { canEditView } from '../view-permissions'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const { slug, workspace } = useCurrentWorkspace()
const { data: me } = useCurrentUser()
const viewId = computed(() => String(route.params.viewId))
const { data: view, error } = useQuery(computed(() => viewOptions(slug.value, viewId.value)))

// The page edits a draft: filters in the URL, display options under `view:<id>`.
const { filters, update: updateFilters } = useIssueFilters()
const { options, update: updateDisplay } = useDisplayOptions(() => `view:${viewId.value}`)

const stored = computed(() =>
  view.value
    ? {
        filters: fromViewFilters(view.value.filters),
        display: parseDisplayOptions(view.value.display),
      }
    : null,
)

/** Back to what the view stores. */
function revert() {
  if (!stored.value) return
  updateFilters(stored.value.filters)
  updateDisplay(stored.value.display)
}

// Opening a view starts from what it stores; a URL with filters (a reload or a shared link
// of an edited view) keeps them as unsaved changes.
const seeded = ref<string | null>(null)
watch(
  () => view.value?.id,
  (id) => {
    if (!id || seeded.value === id || !stored.value) return
    if (!hasFilterQuery(route.query)) updateFilters(stored.value.filters)
    updateDisplay(stored.value.display)
    seeded.value = id
  },
  { immediate: true },
)

const dirty = computed(
  () =>
    seeded.value === viewId.value &&
    stored.value !== null &&
    (!sameFilters(filters.value, stored.value.filters) ||
      JSON.stringify(options.value) !== JSON.stringify(stored.value.display)),
)
const editable = computed(
  () => !!view.value && canEditView(view.value, me.value?.id, workspace.value?.role),
)

const updateView = useUpdateView(slug)
function save() {
  if (!view.value) return
  updateView.mutate({
    view: view.value,
    changes: { filters: toViewFilters(filters.value), display: { ...options.value } },
  })
}

watchEffect(() => {
  if (!view.value) return
  ui.breadcrumb = [
    { label: 'Views', to: { name: 'views', params: { workspaceSlug: slug.value } } },
    view.value.name,
  ]
  const { id, name, icon, color } = view.value
  ui.favoriteTarget = { entityType: 'view', entityId: id, name, icon, color }
})

function onDeleted() {
  void router.replace({ name: 'views', params: { workspaceSlug: slug.value } })
}
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="View not found" />
  <template v-else-if="view && seeded === view.id">
    <Teleport defer :to="PANEL_HEADER_ACTIONS">
      <div v-if="dirty" class="flex items-center gap-2 text-[13px]" role="status">
        <span class="text-ink-subtle">Unsaved changes</span>
        <span class="text-ink-tertiary" aria-hidden="true">·</span>
        <Button v-if="editable" size="sm" :disabled="updateView.isPending.value" @click="save">
          Save
        </Button>
        <Button variant="ghost" size="sm" @click="revert">Revert</Button>
      </div>
      <ViewMenu :view="view" @deleted="onDeleted" />
    </Teleport>
    <IssueViews
      :key="view.id"
      :workspace-slug="slug"
      :team-id="view.teamId ?? undefined"
      :saved-view-id="view.id"
    >
      <template #toolbar>
        <span
          class="flex h-7 min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-3 text-ink"
        >
          <ViewIcon :icon="view.icon" :color="view.color" />
          <span class="truncate">{{ view.name }}</span>
        </span>
      </template>
    </IssueViews>
  </template>
</template>
