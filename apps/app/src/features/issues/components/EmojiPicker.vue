<script setup lang="ts">
import { REACTION_EMOJIS, type ReactionEmoji } from '@linear/contract'
import { Search } from '@lucide/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

// A "Frequently used" row, then every allowed reaction, filtered by keyword. The
// slot is the anchor; it toggles `open` itself, so it can be any button (one with
// a tooltip, a reaction pill).
const emit = defineEmits<{ pick: [emoji: ReactionEmoji] }>()
const open = defineModel<boolean>('open', { default: false })

const FREQUENT = REACTION_EMOJIS.slice(0, 6)
const query = ref('')
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? REACTION_EMOJIS.filter((e) => e.keywords.includes(q)) : REACTION_EMOJIS
})
watch(open, (isOpen) => {
  if (isOpen) query.value = ''
})

const anchor = useTemplateRef<{ $el: HTMLElement }>('anchor')
// Clicking the anchor while open should close (via its own toggle), not close-then-reopen.
function onInteractOutside(event: Event) {
  const target = event.target
  if (target instanceof Node && anchor.value?.$el.contains(target)) event.preventDefault()
}

const nameOf = (keywords: string) => keywords.split(' ')[0]

function pick(emoji: ReactionEmoji) {
  emit('pick', emoji)
  open.value = false
}

function onSearchKeydown(event: KeyboardEvent) {
  const first = matches.value[0]
  if (event.key === 'Enter' && first) {
    event.preventDefault()
    pick(first.emoji)
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverAnchor ref="anchor" as="span" class="inline-flex">
      <slot />
    </PopoverAnchor>
    <PopoverContent
      align="start"
      class="w-72 overflow-hidden rounded-lg border-hairline bg-floating p-0 shadow-floating"
      @interact-outside="onInteractOutside"
    >
      <div class="flex h-10 items-center gap-2 border-b border-hairline px-3">
        <Search class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          placeholder="Search emoji..."
          aria-label="Search emoji"
          class="h-full w-full bg-transparent text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          @keydown="onSearchKeydown"
        />
      </div>
      <div class="max-h-64 overflow-y-auto p-2">
        <template v-if="!query.trim()">
          <p class="px-1 pb-1 text-xs text-ink-subtle">Frequently used</p>
          <div class="grid grid-cols-8 gap-0.5 pb-2" role="group" aria-label="Frequently used">
            <button
              v-for="e in FREQUENT"
              :key="e.emoji"
              type="button"
              :aria-label="nameOf(e.keywords)"
              :title="nameOf(e.keywords)"
              class="flex size-8 items-center justify-center rounded-md text-lg outline-none hover:bg-floating-hover focus-visible:ring-2 focus-visible:ring-ring"
              @click="pick(e.emoji)"
            >
              {{ e.emoji }}
            </button>
          </div>
          <p class="px-1 pb-1 text-xs text-ink-subtle">All reactions</p>
        </template>
        <div
          v-if="matches.length"
          class="grid grid-cols-8 gap-0.5"
          role="group"
          :aria-label="query.trim() ? 'Search results' : 'All reactions'"
        >
          <button
            v-for="e in matches"
            :key="e.emoji"
            type="button"
            :aria-label="nameOf(e.keywords)"
            :title="nameOf(e.keywords)"
            class="flex size-8 items-center justify-center rounded-md text-lg outline-none hover:bg-floating-hover focus-visible:ring-2 focus-visible:ring-ring"
            @click="pick(e.emoji)"
          >
            {{ e.emoji }}
          </button>
        </div>
        <p v-else class="py-4 text-center text-[13px] text-ink-subtle">No emoji found</p>
      </div>
    </PopoverContent>
  </Popover>
</template>
