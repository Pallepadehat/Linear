import type { Member, StatusCategory } from '@linear/contract'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey, type EditorState } from '@tiptap/pm/state'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { refDebounced } from '@vueuse/core'
import { computed, reactive, toRef } from 'vue'
import { orpc } from '@/lib/orpc'
import { findIssueSuggestion } from './mentions'

export type MentionItem =
  | { kind: 'user'; id: string; label: string; email: string; avatarUrl: string | null }
  | { kind: 'issue'; id: string; identifier: string; title: string; category: StatusCategory }

const MAX_ITEMS = 8

const notInCode = ({ state, range }: { state: EditorState; range: Range }) => {
  const $from = state.doc.resolve(range.from)
  return !$from.parent.type.spec.code && !$from.marks().some((m) => m.type.spec.code)
}

/** Members whose name or email contains the query (any case), names starting with it first. */
export function filterMembers(members: readonly Member[], query: string): MentionItem[] {
  const q = query.trim().toLowerCase()
  return members
    .filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    .sort((a, b) => {
      const rank = (m: Member) => (q && m.name.toLowerCase().startsWith(q) ? 0 : 1)
      return rank(a) - rank(b) || a.name.localeCompare(b.name)
    })
    .slice(0, MAX_ITEMS)
    .map((m) => ({
      kind: 'user',
      id: m.userId,
      label: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
    }))
}

/**
 * The `@` (teammates) and `#` / identifier (issues) suggestion menus of the markdown
 * editor (docs/domain.md → Mentions). Returns the Tiptap extension and the menu state;
 * the editor renders MentionMenu from it. Disabled without a workspace.
 */
export function useMentionSuggestions(options: {
  workspaceSlug: () => string | undefined
  editor: () => Editor | undefined
}) {
  const state = reactive({
    open: false,
    kind: 'user' as 'user' | 'issue',
    query: '',
    /** Opened by typing an identifier rather than `#`: stays hidden while nothing matches. */
    implicit: false,
    active: 0,
    range: null as Range | null,
    getRect: (() => null) as () => DOMRect | null,
  })
  const slug = computed(() => options.workspaceSlug() ?? '')

  const members = useQuery(
    computed(() => ({
      ...orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
      enabled: Boolean(slug.value) && state.open && state.kind === 'user',
      staleTime: 60_000,
    })),
  )
  const issueQuery = refDebounced(toRef(state, 'query'), 150)
  const issues = useQuery(
    computed(() => ({
      ...orpc.issues.list.queryOptions({
        input: {
          workspaceSlug: slug.value,
          q: issueQuery.value || undefined,
          sort: 'updatedAt' as const,
          limit: MAX_ITEMS,
        },
      }),
      enabled: Boolean(slug.value) && state.open && state.kind === 'issue',
      placeholderData: keepPreviousData,
    })),
  )

  const items = computed<MentionItem[]>(() => {
    if (!state.open) return []
    if (state.kind === 'user') return filterMembers(members.data.value ?? [], state.query)
    return (issues.data.value?.items ?? []).slice(0, MAX_ITEMS).map((issue) => ({
      kind: 'issue',
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      category: issue.status.category,
    }))
  })
  const loading = computed(() =>
    state.kind === 'user' ? members.isPending.value : issues.isFetching.value,
  )
  const visible = computed(() => state.open && !(state.implicit && items.value.length === 0))

  function select(item: MentionItem | undefined) {
    const editor = options.editor()
    if (!item || !state.range || !editor) return
    const node =
      item.kind === 'user'
        ? { type: 'userMention', attrs: { id: item.id, label: item.label } }
        : { type: 'issueMention', attrs: { identifier: item.identifier } }
    editor
      .chain()
      .focus()
      .insertContentAt(state.range, [node, { type: 'text', text: ' ' }])
      .run()
    state.open = false
  }

  function onKeyDown({ event }: SuggestionKeyDownProps) {
    if (!visible.value) return false
    const count = items.value.length
    if (event.key === 'ArrowDown' && count) {
      state.active = (state.active + 1) % count
      return true
    }
    if (event.key === 'ArrowUp' && count) {
      state.active = (state.active - 1 + count) % count
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (!count) return false
      select(items.value[state.active])
      return true
    }
    if (event.key === 'Escape') {
      // Close the menu, not the dialog around the editor.
      event.stopPropagation()
      state.open = false
      return true
    }
    return false
  }

  const track = (kind: 'user' | 'issue') => (p: SuggestionProps<never>) => {
    // A new query starts at the top; the same query keeps the highlighted row.
    if (p.query !== state.query || kind !== state.kind || !state.open) state.active = 0
    Object.assign(state, {
      open: true,
      kind,
      query: p.query,
      implicit: kind === 'issue' && !p.text.startsWith('#'),
      range: p.range,
      getRect: () => p.clientRect?.() ?? null,
    })
  }
  const render = (kind: 'user' | 'issue') => () => ({
    onStart: track(kind),
    onUpdate: track(kind),
    onKeyDown,
    onExit: () => {
      state.open = false
    },
  })

  const extension = Extension.create({
    name: 'mentionSuggestions',
    addProseMirrorPlugins() {
      if (!slug.value) return []
      return [
        Suggestion<never>({
          editor: this.editor,
          pluginKey: new PluginKey('userMentionSuggestion'),
          char: '@',
          allowedPrefixes: [' ', '('],
          allow: notInCode,
          items: () => [],
          render: render('user'),
        }),
        Suggestion<never>({
          editor: this.editor,
          pluginKey: new PluginKey('issueMentionSuggestion'),
          char: '#',
          findSuggestionMatch: findIssueSuggestion,
          allow: notInCode,
          items: () => [],
          render: render('issue'),
        }),
      ]
    },
  })

  return { extension, state, items, loading, visible, select }
}
