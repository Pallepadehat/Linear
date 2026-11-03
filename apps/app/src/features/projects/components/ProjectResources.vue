<script setup lang="ts">
import type { LinkFields, ProjectLink } from '@linear/contract'
import { Copy, Link2, Pencil, Plus, X } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import IconButton from '@/components/common/IconButton.vue'
import LinkDialog from '@/components/common/LinkDialog.vue'
import { projectLinkListOptions, useProjectLinkMutations } from '../project-links'

// The Overview's Resources: the project's web links (docs/domain.md → Links).
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const { data: links } = useQuery(
  computed(() => projectLinkListOptions(props.workspaceSlug, props.projectId)),
)
const { create, update, remove } = useProjectLinkMutations(
  () => props.workspaceSlug,
  () => props.projectId,
)

const dialogOpen = ref(false)
const editing = ref<ProjectLink | null>(null)
function openDialog(link: ProjectLink | null = null) {
  editing.value = link
  dialogOpen.value = true
}
function save(fields: LinkFields) {
  // Edits are optimistic; a new link waits for the server (its id and hostname).
  if (editing.value) return void update.mutate({ link: editing.value, fields })
  return create.mutateAsync(fields)
}

async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  } catch {
    toast.error("Couldn't copy the link")
  }
}

const rowClass =
  'group relative flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring'
const anchorClass =
  'min-w-0 shrink truncate text-ink outline-hidden after:absolute after:inset-0 after:content-[""]'
const actionsClass =
  'relative z-10 ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
const actionClass = 'size-6 [&_svg]:size-3.5'
</script>

<template>
  <section aria-labelledby="project-resources-heading" class="grid gap-0.5">
    <h2 id="project-resources-heading" class="px-2 text-xs font-medium text-ink-subtle">
      Resources
    </h2>
    <ul v-if="links?.length" class="grid">
      <li v-for="link in links" :key="link.id" :class="rowClass">
        <!-- Generic icon: favicons would mean fetching from the linked site. -->
        <Link2 class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <a :href="link.url" target="_blank" rel="noopener noreferrer" :class="anchorClass">
          {{ link.title }}
          <span class="sr-only">(opens in a new tab)</span>
        </a>
        <span
          v-if="link.title !== link.hostname"
          class="min-w-0 shrink-[2] truncate text-xs text-ink-subtle"
        >
          {{ link.hostname }}
        </span>
        <span :class="actionsClass">
          <IconButton
            :icon="Copy"
            label="Copy link"
            :aria-label="`Copy link ${link.title}`"
            :class="actionClass"
            @click="copy(link.url)"
          />
          <IconButton
            :icon="Pencil"
            label="Edit link"
            :aria-label="`Edit link ${link.title}`"
            :class="actionClass"
            @click="openDialog(link)"
          />
          <IconButton
            :icon="X"
            label="Remove link"
            :aria-label="`Remove link ${link.title}`"
            :class="actionClass"
            @click="remove.mutate(link)"
          />
        </span>
      </li>
    </ul>
    <button
      type="button"
      class="flex h-8 items-center gap-2 rounded-md px-2 text-left text-[13px] text-ink-subtle outline-hidden hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      @click="openDialog()"
    >
      <Plus class="size-3.5" aria-hidden="true" />
      Add document or link…
    </button>
    <LinkDialog
      v-model:open="dialogOpen"
      :link="editing"
      description="A web link shown in the project's resources."
      :save="save"
    />
  </section>
</template>
