<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { useIntersectionObserver } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { useUpdateViewer } from '../composables/useUpdateViewer'
import { projectUpdateRow } from '../project-updates'
import { projectUpdateListOptions } from '../queries'
import ProjectUpdateComposer from './ProjectUpdateComposer.vue'
import ProjectUpdateItem from './ProjectUpdateItem.vue'

// Every update of the project for the Activity tab, newest first; older pages on scroll.
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const updates = useInfiniteQuery(
  computed(() => projectUpdateListOptions(props.workspaceSlug, props.projectId)),
)
const viewer = useUpdateViewer()
const rows = computed(() =>
  (updates.data.value?.pages ?? [])
    .flatMap((page) => page.items)
    .map((update) => projectUpdateRow(update, viewer.value)),
)
const composing = ref(false)

const sentinel = useTemplateRef<HTMLElement>('sentinel')
useIntersectionObserver(sentinel, ([hit]) => {
  if (hit?.isIntersecting && updates.hasNextPage.value && !updates.isFetchingNextPage.value)
    void updates.fetchNextPage()
})
</script>

<template>
  <section aria-labelledby="project-updates-heading" class="grid content-start gap-3">
    <div class="flex items-center justify-between">
      <h2 id="project-updates-heading" class="text-[13px] font-medium text-ink">Updates</h2>
      <Button v-if="!composing" variant="ghost" size="sm" @click="composing = true">
        <Plus aria-hidden="true" />
        New update
      </Button>
    </div>
    <ProjectUpdateComposer
      v-if="composing"
      :workspace-slug="workspaceSlug"
      :project-id="projectId"
      @done="composing = false"
    />
    <p v-if="updates.isError.value" class="text-xs text-ink-subtle">Couldn't load updates.</p>
    <p v-else-if="!updates.isPending.value && !rows.length" class="text-xs text-ink-subtle">
      No updates yet.
    </p>
    <ol v-else class="grid gap-3">
      <li v-for="row in rows" :key="row.id">
        <ProjectUpdateItem :workspace-slug="workspaceSlug" :project-id="projectId" v-bind="row" />
      </li>
    </ol>
    <div ref="sentinel" aria-hidden="true" class="h-px" />
    <p v-if="updates.isFetchingNextPage.value" class="text-xs text-ink-subtle">Loading…</p>
  </section>
</template>
