<script setup lang="ts">
import type { Team } from '@linear/contract'
import { computed, ref } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'

const props = defineProps<{ teams: Team[] }>()
const model = defineModel<string>({ required: true })
const open = ref(false)

const current = computed(() => props.teams.find((t) => t.id === model.value))

function choose(id: string) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover v-model:open="open" label="Team" placeholder="Move to team..." :current="model">
    <template #trigger>
      <span class="font-mono text-xs text-ink-muted">{{ current?.key ?? 'Team' }}</span>
    </template>
    <PickerItem
      v-for="(team, i) in teams"
      :key="team.id"
      :value="team.id"
      :selected="team.id === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(team.id)"
    >
      <span class="w-10 font-mono text-xs text-ink-subtle">{{ team.key }}</span>
      {{ team.name }}
    </PickerItem>
  </PickerPopover>
</template>
