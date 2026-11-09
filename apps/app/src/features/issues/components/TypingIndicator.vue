<script setup lang="ts">
import { computed } from 'vue'
import { typingSentence, useTypingUsers } from '@/features/realtime/typing'

/** "Ada is typing…" under the timeline while teammates write a comment (realtime). */
const props = defineProps<{
  issueId: string
  currentUserId: string | undefined
  nameOf: (userId: string) => string | undefined
}>()

const typing = useTypingUsers(
  () => props.issueId,
  () => props.currentUserId,
)
const sentence = computed(() =>
  typingSentence(typing.value.map((id) => props.nameOf(id) ?? 'Someone')),
)
</script>

<template>
  <!-- Always rendered (and 20px tall) so the live region exists and the composer never jumps. -->
  <p class="flex h-5 items-center gap-1.5 pl-3.5 text-xs text-ink-subtle" aria-live="polite">
    <template v-if="sentence">
      <span class="flex items-center gap-0.5" aria-hidden="true">
        <span v-for="i in 3" :key="i" class="typing-dot size-1 rounded-full bg-ink-subtle" />
      </span>
      {{ sentence }}
    </template>
  </p>
</template>

<style scoped>
.typing-dot {
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes typing-bounce {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .typing-dot {
    animation: none;
  }
}
</style>
