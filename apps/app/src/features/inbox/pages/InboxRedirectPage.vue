<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useUiStore } from '@/stores/ui'

// The Inbox is a popover now (sidebar → Notifications); an old /inbox link lands on
// My issues with the popover open.
const ui = useUiStore()
const router = useRouter()
const { slug } = useCurrentWorkspace()
onMounted(async () => {
  await router.replace({ name: 'my-issues', params: { workspaceSlug: slug.value } })
  ui.notificationsOpen = true
})
</script>

<template>
  <div />
</template>
