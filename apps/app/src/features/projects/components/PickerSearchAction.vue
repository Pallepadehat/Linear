<script setup lang="ts">
import { computed, watch } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import { useCommand, useCommandGroup } from '@/components/ui/command'

// An extra picker option built from the typed text ("Create label …", a typed date).
// The list's filter only knows options that existed when the text changed, so once
// this one renders it marks its group visible and the list non-empty itself.
const props = defineProps<{ accepts: (search: string) => boolean }>()
const emit = defineEmits<{ select: [search: string] }>()

const { filterState } = useCommand()
const group = useCommandGroup()
const search = computed(() => filterState.search.trim())
const visible = computed(() => search.value !== '' && props.accepts(search.value))

watch(
  [search, visible],
  () => {
    if (!visible.value) return
    if (group?.id) filterState.filtered.groups.add(group.id)
    filterState.filtered.count += 1
  },
  { flush: 'post' },
)
</script>

<template>
  <PickerItem
    v-if="visible"
    :key="search"
    :value="`typed:${search}`"
    :selected="false"
    @select="emit('select', search)"
  >
    <slot :search="search" />
    <span class="sr-only">{{ search }}</span>
  </PickerItem>
</template>
