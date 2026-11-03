import { computed } from 'vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'

/** Who is looking at project updates: decides which "…" actions they see. */
export function useUpdateViewer() {
  const { workspace } = useCurrentWorkspace()
  const { data: me } = useCurrentUser()
  return computed(() => ({ userId: me.value?.id, role: workspace.value?.role }))
}
