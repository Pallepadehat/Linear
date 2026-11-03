<script setup lang="ts">
import { computed, ref } from 'vue'
import KeyCaps from '@/components/common/KeyCaps.vue'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { groupShortcuts } from '@/lib/hotkeys'
import { useUiStore } from '@/stores/ui'

// The `?` sheet: every shortcut in the registry catalog, grouped by scope, so
// it can't drift from what is actually bound.
const ui = useUiStore()
const open = computed({
  get: () => ui.shortcutsOpen,
  set: (value) => (ui.shortcutsOpen = value),
})

const filter = ref('')
const groups = computed(() => {
  const q = filter.value.trim().toLowerCase()
  return groupShortcuts()
    .map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((s) => !q || s.label.toLowerCase().includes(q)),
    }))
    .filter((group) => group.shortcuts.length)
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="w-[360px] gap-0 border-hairline bg-floating p-0 shadow-floating sm:max-w-[360px] [&>button:last-child]:top-3.5 [&>button:last-child]:right-3.5"
    >
      <SheetHeader class="gap-1 border-b border-hairline px-4 pt-4 pb-3">
        <SheetTitle class="text-[15px] font-semibold text-ink">Keyboard shortcuts</SheetTitle>
        <SheetDescription class="sr-only"
          >Every keyboard shortcut, grouped by where it works.</SheetDescription
        >
        <input
          v-model="filter"
          type="search"
          aria-label="Search shortcuts"
          placeholder="Search shortcuts..."
          autocomplete="off"
          class="mt-2 h-7 w-full rounded-md border border-hairline bg-surface-1 px-2 text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-ring"
        />
      </SheetHeader>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <section
          v-for="group in groups"
          :key="group.scope"
          :aria-labelledby="`shortcuts-${group.scope}`"
          class="mb-4"
        >
          <h3 :id="`shortcuts-${group.scope}`" class="px-2 pb-1 text-xs text-ink-subtle">
            {{ group.label }}
          </h3>
          <dl class="grid gap-px">
            <div
              v-for="shortcut in group.shortcuts"
              :key="shortcut.id"
              class="flex min-h-8 items-center justify-between gap-3 rounded-md px-2 text-[13px]"
            >
              <dt class="text-ink">{{ shortcut.label }}</dt>
              <dd class="flex items-center gap-1.5">
                <template v-for="(keys, i) in shortcut.keys" :key="i">
                  <span v-if="i > 0" class="text-xs text-ink-tertiary">or</span>
                  <KeyCaps :keys="keys" />
                </template>
              </dd>
            </div>
          </dl>
        </section>
        <p v-if="groups.length === 0" class="px-2 py-4 text-[13px] text-ink-subtle">
          No shortcuts found
        </p>
      </div>
    </SheetContent>
  </Sheet>
</template>
