<script setup lang="ts">
import type { LinkedPullRequest } from '@linear/contract'
import { ArrowUpRight, GitPullRequest } from '@lucide/vue'
import { linkTypeLabel, pullRequestRef, pullRequestStates } from '../pull-requests'
import PullRequestIcon from './PullRequestIcon.vue'

defineProps<{ pullRequests: LinkedPullRequest[] | undefined }>()
</script>

<template>
  <div
    v-if="!pullRequests"
    class="mx-2 h-9 animate-pulse rounded-md bg-surface-2"
    aria-busy="true"
    aria-label="Loading pull requests"
  />
  <p v-else-if="!pullRequests.length" class="flex items-center gap-2 px-2 text-ink-subtle">
    <GitPullRequest class="size-3.5" aria-hidden="true" />
    None yet
  </p>
  <ul v-else class="grid gap-0.5">
    <li v-for="pr in pullRequests" :key="pr.id">
      <a
        :href="pr.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group grid grid-cols-[auto_1fr_auto] items-start gap-x-2 rounded-md px-2 py-1.5 outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PullRequestIcon :state="pr.state" class="mt-[3px]" />
        <span class="grid min-w-0 gap-0.5">
          <span class="truncate text-ink">{{ pr.title }}</span>
          <span class="flex min-w-0 items-center gap-1 text-xs text-ink-subtle">
            <span class="max-w-[70%] shrink-0 truncate font-mono">{{ pullRequestRef(pr) }}</span>
            <span aria-hidden="true">·</span>
            <span class="min-w-0 truncate">{{ linkTypeLabel[pr.linkType] }}</span>
            <span
              class="ml-auto shrink-0 rounded-full bg-surface-2 px-1.5 py-px text-ink-muted group-hover:bg-surface-3 group-focus-visible:bg-surface-3"
            >
              {{ pullRequestStates[pr.state].label }}
            </span>
          </span>
        </span>
        <ArrowUpRight class="mt-[3px] size-3.5 text-ink-tertiary" aria-hidden="true" />
        <span class="sr-only">(opens on GitHub in a new tab)</span>
      </a>
    </li>
  </ul>
</template>
