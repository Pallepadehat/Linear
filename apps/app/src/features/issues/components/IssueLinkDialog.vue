<script setup lang="ts">
import type { IssueLink, LinkFields } from '@linear/contract'
import LinkDialog from '@/components/common/LinkDialog.vue'
import { useCreateIssueLink, useUpdateIssueLink } from '../queries'

// Adds a link to the issue, or edits `link` when given.
const props = defineProps<{ workspaceSlug: string; issueId: string; link?: IssueLink | null }>()
const open = defineModel<boolean>('open', { required: true })

const create = useCreateIssueLink(() => props.workspaceSlug)
const update = useUpdateIssueLink(() => props.workspaceSlug)

function save(fields: LinkFields) {
  // Optimistic: the row changes at once and rolls back with a toast.
  if (props.link) return void update.mutate({ issueId: props.issueId, link: props.link, fields })
  return create.mutateAsync({ issueId: props.issueId, ...fields })
}
</script>

<template>
  <LinkDialog
    v-model:open="open"
    :link="link"
    description="A web link shown in the issue's resources."
    :save="save"
  />
</template>
