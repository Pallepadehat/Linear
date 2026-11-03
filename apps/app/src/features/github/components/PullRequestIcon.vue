<script setup lang="ts">
import type { PullRequestState } from '@linear/contract'
import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { pullRequestStates } from '../pull-requests'

defineProps<{ state: PullRequestState; class?: string }>()

const icons = {
  open: GitPullRequest,
  draft: GitPullRequestDraft,
  merged: GitMerge,
  closed: GitPullRequestClosed,
}
</script>

<template>
  <component
    :is="icons[state]"
    aria-hidden="true"
    :class="cn('size-3.5 shrink-0', pullRequestStates[state].iconClass, $props.class)"
  />
</template>
