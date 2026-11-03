<script setup lang="ts">
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import IssueList from '../components/IssueList.vue'

const { slug } = useCurrentWorkspace()
</script>

<template>
  <IssueList :workspace-slug="slug" />
</template>
