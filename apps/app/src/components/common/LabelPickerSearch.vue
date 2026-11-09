<script setup lang="ts">
import { watch } from 'vue'
import { useCommand } from '@/components/ui/command'

// Renderless bridge: mirrors the picker's filter text (owned by the Command
// inside PickerPopover) into the label picker, and clears it from there.
const search = defineModel<string>({ required: true })
const { filterState } = useCommand()

watch(
  () => filterState.search,
  (value) => {
    search.value = value
  },
  { immediate: true },
)
watch(search, (value) => {
  if (value !== filterState.search) filterState.search = value
})
</script>

<template>
  <slot />
</template>
