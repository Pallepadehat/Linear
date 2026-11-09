<script setup lang="ts">
import type { Team } from '@linear/contract'
import { Users } from '@lucide/vue'
import { computed } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'

const props = defineProps<{ teams: Team[] }>()
const model = defineModel<string[]>({ required: true })

const selected = computed(() => props.teams.filter((t) => model.value.includes(t.id)))

// Multi-select: stays open so several teams can be toggled in a row.
function toggle(id: string) {
  model.value = model.value.includes(id)
    ? model.value.filter((v) => v !== id)
    : [...model.value, id]
}
</script>

<template>
  <PickerPopover label="Change teams" placeholder="Change teams...">
    <template #trigger>
      <Users class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="selected.length === 0" class="text-ink-subtle">Teams</span>
      <span v-else-if="selected.length === 1">{{ selected[0]?.name }}</span>
      <span v-else>{{ selected.length }} teams</span>
    </template>
    <PickerItem
      v-for="team in teams"
      :key="team.id"
      :value="team.id"
      :selected="model.includes(team.id)"
      @select="toggle(team.id)"
    >
      <span class="w-10 font-mono text-xs text-ink-subtle">{{ team.key }}</span>
      {{ team.name }}
    </PickerItem>
  </PickerPopover>
</template>
