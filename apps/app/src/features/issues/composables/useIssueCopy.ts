import type { Issue } from '@linear/contract'
import { useQuery } from '@tanstack/vue-query'
import { useEventListener } from '@vueuse/core'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { projectListOptions } from '@/features/projects/queries'
import { isTypingTarget } from '@/lib/hotkeys'
import { orpc } from '@/lib/orpc'
import { copyKindFor, type CopyKind } from '../copy-shortcuts'
import { issueBranchName } from '../issue-branch'
import { buildIssuePrompt } from '../issue-prompt'

/**
 * Copy actions for the open issue (URL, identifier, git branch, prompt for a coding
 * agent) and their shortcuts. Mount once per detail page: it binds the keys.
 */
export function useIssueCopy(issue: MaybeRefOrGetter<Issue>) {
  const router = useRouter()
  const { slug, workspace } = useCurrentWorkspace()
  const { data: user } = useCurrentUser()
  // Already loaded by the detail page; these read from the cache.
  const { data: teams } = useQuery(
    computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
  )
  const { data: projects } = useQuery(computed(() => projectListOptions(slug.value)))

  const branch = computed(() => issueBranchName(toValue(issue), user.value))

  function textFor(kind: CopyKind): string {
    const current = toValue(issue)
    switch (kind) {
      case 'url': {
        const { href } = router.resolve({
          name: 'issue',
          params: { workspaceSlug: slug.value, identifier: current.identifier },
        })
        return new URL(href, window.location.origin).toString()
      }
      case 'id':
        return current.identifier
      case 'branch':
        return branch.value
      case 'prompt':
        return buildIssuePrompt({
          productName: workspace.value?.name ?? slug.value,
          issue: current,
          team: { name: teams.value?.find((t) => t.id === current.teamId)?.name ?? '' },
          labels: current.labels,
          project: projects.value?.find((p) => p.id === current.projectId) ?? null,
          branch: branch.value,
        })
    }
  }

  async function copy(kind: CopyKind) {
    try {
      await navigator.clipboard.writeText(textFor(kind))
      toast.success('Copied')
    } catch {
      toast.error("Couldn't copy")
    }
  }

  // Text fields and editors keep their own ⌘. / ⌘⇧, etc.; dialogs own the keyboard.
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.defaultPrevented || isTypingTarget(event.target)) return
    const kind = copyKindFor(event)
    if (!kind || document.querySelector('[role="dialog"][data-state="open"]')) return
    event.preventDefault()
    void copy(kind)
  })

  return { copy }
}
