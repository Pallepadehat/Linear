<script setup lang="ts">
import type { Label } from '@linear/contract'
import { Check, Plus, Tag } from '@lucide/vue'
import { ListboxItem } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { CommandGroup } from '@/components/ui/command'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import {
  findLabelByName,
  labelSections,
  labelsForTeam,
  nextLabelColor,
} from '@/features/labels/label-options'
import { useCreateLabel } from '@/features/labels/queries'
import LabelPickerSearch from './LabelPickerSearch.vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

const props = defineProps<{
  /** Workspace labels plus any team's; only workspace labels and `teamId`'s are offered. */
  labels: Label[]
  /** The issue's team: its labels get their own section and new labels belong to it. */
  teamId: string
  compact?: boolean
  /** Fixed trigger text, for when the selected labels are already shown next to it. */
  triggerText?: string
}>()
const model = defineModel<string[]>({ required: true })
// The picked labels as objects, including ones created here before the list refetches.
const emit = defineEmits<{ 'update:labels': [labels: Label[]] }>()

const { slug } = useCurrentWorkspace()
const createLabel = useCreateLabel()
const open = ref(false)
const search = ref('')
// Created here and not yet in `labels` (the list refetches after a create).
const created = ref<Label[]>([])

const options = computed(() => {
  const known = new Set(props.labels.map((l) => l.id))
  const all = [...props.labels, ...created.value.filter((l) => !known.has(l.id))]
  return labelsForTeam(all, props.teamId)
})
const selected = computed(() => options.value.filter((l) => model.value.includes(l.id)))

// Sections are fixed while the picker is open so rows don't jump as they're toggled.
const openedWith = ref<string[]>([])
watch(open, (isOpen) => {
  if (isOpen) openedWith.value = [...model.value]
  else search.value = ''
})
const sections = computed(() => labelSections(options.value, openedWith.value))

const trimmed = computed(() => search.value.trim())
const canCreate = computed(
  () => trimmed.value !== '' && !findLabelByName(options.value, trimmed.value),
)

function apply(ids: string[]) {
  model.value = ids
  const byId = new Map(options.value.map((l) => [l.id, l]))
  emit(
    'update:labels',
    ids.flatMap((id) => byId.get(id) ?? []),
  )
}

// Multi-select: the popover stays open so several labels can be toggled in a row.
function toggle(id: string) {
  apply(model.value.includes(id) ? model.value.filter((v) => v !== id) : [...model.value, id])
}

async function create() {
  const name = trimmed.value
  if (!name || createLabel.isPending.value) return
  search.value = ''
  try {
    const label = await createLabel.mutateAsync({
      workspaceSlug: slug.value,
      teamId: props.teamId,
      name,
      color: nextLabelColor(options.value),
    })
    if (!props.labels.some((l) => l.id === label.id)) created.value = [...created.value, label]
    if (!model.value.includes(label.id)) apply([...model.value, label.id])
  } catch {
    // useCreateLabel already showed a toast.
  }
}

const sectionList = computed(() =>
  [
    { key: 'selected', heading: undefined, labels: sections.value.selected },
    { key: 'team', heading: 'Team labels', labels: sections.value.team },
    { key: 'workspace', heading: 'Workspace labels', labels: sections.value.workspace },
  ].filter((section) => section.labels.length > 0),
)
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change labels"
    placeholder="Change or add labels…"
    hotkey="L"
    grouped
    multiple
    :compact="compact"
    :align="compact ? 'end' : 'start'"
    :trigger-class="compact ? 'h-auto w-auto gap-1 px-0 has-[>svg]:px-0' : undefined"
  >
    <!-- Compact (list rows): the label chips themselves open the picker. -->
    <template v-if="compact" #trigger>
      <span
        v-for="label in selected"
        :key="label.id"
        class="flex h-[22px] max-w-32 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs font-normal text-ink-muted"
      >
        <!-- The label's own color is user data, not a design token. -->
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ backgroundColor: label.color }"
          aria-hidden="true"
        />
        <span class="truncate">{{ label.name }}</span>
      </span>
    </template>
    <template v-else #trigger>
      <Tag class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="triggerText" class="text-ink-subtle">{{ triggerText }}</span>
      <span v-else-if="selected.length === 0" class="text-ink-subtle">Labels</span>
      <span v-else-if="selected.length === 1">{{ selected[0]?.name }}</span>
      <span v-else>{{ selected.length }} labels</span>
    </template>

    <LabelPickerSearch v-model="search" />
    <CommandGroup
      v-for="section in sectionList"
      :key="section.key"
      :heading="section.heading"
      class="p-0 [&_[data-slot=command-group-heading]]:px-2.5 [&_[data-slot=command-group-heading]]:pt-2 [&_[data-slot=command-group-heading]]:pb-1 [&_[data-slot=command-group-heading]]:text-ink-subtle"
    >
      <PickerItem
        v-for="label in section.labels"
        :key="label.id"
        :value="label.id"
        :selected="false"
        @select="toggle(label.id)"
      >
        <span
          class="flex size-3.5 shrink-0 items-center justify-center rounded-xs border"
          :class="
            model.includes(label.id)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-hairline-strong'
          "
          aria-hidden="true"
        >
          <Check v-if="model.includes(label.id)" class="size-2.5" :stroke-width="3" />
        </span>
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ backgroundColor: label.color }"
          aria-hidden="true"
        />
        <span class="truncate">{{ label.name }}</span>
        <span v-if="model.includes(label.id)" class="sr-only">(selected)</span>
      </PickerItem>
    </CommandGroup>
    <!-- Not a CommandItem: it must not be filtered out by the text it echoes. -->
    <ListboxItem
      v-if="canCreate"
      value="__create__"
      class="flex h-8 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-hidden select-none data-[highlighted]:bg-floating-hover"
      @select.prevent="create"
    >
      <Plus class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span class="truncate">
        Create new label: <span class="text-ink-muted">“{{ trimmed }}”</span>
      </span>
    </ListboxItem>
    <p v-else-if="sectionList.length === 0" class="py-4 text-center text-ink-subtle">
      No labels yet. Type to create one.
    </p>
  </PickerPopover>
</template>
