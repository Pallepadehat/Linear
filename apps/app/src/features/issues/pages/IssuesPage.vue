<script setup lang="ts">
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import IssueViews from '../components/IssueViews.vue'

const { slug } = useCurrentWorkspace()
</script>

<template>
  <IssueViews :workspace-slug="slug" />
</template>
