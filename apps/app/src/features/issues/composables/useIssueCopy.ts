import type { Issue } from '@linear/contract'
import { useQuery } from '@tanstack/vue-query'
import { useEventListener } from '@vueuse/core'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { projectListOptions } from '@/features/projects/queries'
import { orpc } from '@/lib/orpc'
import { issueBranchName } from '../issue-branch'
import { buildIssuePrompt } from '../issue-prompt'

export type CopyKind = 'url' | 'id' | 'branch' | 'prompt'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Linear's copy shortcuts: the key `code` (layout-independent) plus modifiers. */
const SHORTCUTS: Record<CopyKind, { code: string; shift: boolean; alt: boolean; label: string }> = {
  url: { code: 'Comma', shift: true, alt: false, label: isMac ? '⌘⇧,' : 'Ctrl Shift ,' },
  id: { code: 'Period', shift: false, alt: false, label: isMac ? '⌘.' : 'Ctrl .' },
  branch: { code: 'Period', shift: true, alt: false, label: isMac ? '⌘⇧.' : 'Ctrl Shift .' },
  prompt: { code: 'KeyP', shift: false, alt: true, label: isMac ? '⌘⌥P' : 'Ctrl Alt P' },
}

export const COPY_LABELS: Record<CopyKind, string> = {
  url: 'Copy issue URL',
  id: 'Copy ID',
  branch: 'Copy git branch name',
  prompt: 'Copy as prompt',
}

export const copyShortcut = (kind: CopyKind) => SHORTCUTS[kind].label

/** Text fields and editors keep their own ⌘. / ⌘⇧, etc. */
function isEditing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  )
}

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

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (!(isMac ? event.metaKey : event.ctrlKey) || isEditing(event.target)) return
    const kind = (Object.keys(SHORTCUTS) as CopyKind[]).find((k) => {
      const s = SHORTCUTS[k]
      return event.code === s.code && event.shiftKey === s.shift && event.altKey === s.alt
    })
    if (!kind) return
    event.preventDefault()
    void copy(kind)
  })

  return { copy }
}
