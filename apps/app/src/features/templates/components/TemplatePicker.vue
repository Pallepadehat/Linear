<script setup lang="ts">
import type { IssueTemplate } from '@linear/contract'
import { LayoutTemplate } from '@lucide/vue'
import { computed, ref } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'

const props = defineProps<{ templates: IssueTemplate[] }>()
const model = defineModel<string | null>({ required: true })
const open = ref(false)

// Pickers match on `value`, and "none" must not collide with a template id.
const NONE = '__none__'
const current = computed(() => props.templates.find((t) => t.id === model.value))

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Template"
    placeholder="Choose template…"
    :current="model ?? NONE"
    align="end"
  >
    <template #trigger>
      <LayoutTemplate class="text-ink-subtle" aria-hidden="true" />
      <span v-if="current" class="max-w-40 truncate">{{ current.name }}</span>
      <span v-else class="text-ink-subtle">Template</span>
    </template>
    <PickerItem :value="NONE" :selected="model === null" shortcut="0" @select="choose(null)">
      <span class="text-ink-subtle">No template</span>
    </PickerItem>
    <PickerItem
      v-for="(template, i) in templates"
      :key="template.id"
      :value="template.id"
      :selected="template.id === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(template.id)"
    >
      <LayoutTemplate class="text-ink-subtle" aria-hidden="true" />
      <span class="truncate">{{ template.name }}</span>
    </PickerItem>
  </PickerPopover>
</template>
