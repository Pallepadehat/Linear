<script setup lang="ts">
import { viewNameSchema, type View, type ViewColor, type ViewIcon } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { z } from 'zod'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import type { DisplayOptions } from '@/features/issues/display-options'
import type { IssueFilters } from '@/features/issues/issue-filters'
import { errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { client, orpc } from '@/lib/orpc'
import { toViewFilters } from '../view-filters'
import { viewsKey } from '../queries'
import ViewAppearancePicker from './ViewAppearancePicker.vue'

/**
 * "Save as view": a new view from the page's `filters` + `display`, scoped to `teamId` by
 * default. With `view` it edits that view's name, icon, color and sharing instead.
 */
const props = defineProps<{
  view?: View
  teamId?: string
  filters?: IssueFilters
  display?: DisplayOptions
}>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const formError = ref<string | null>(null)
const icon = ref<ViewIcon>('layers')
const color = ref<ViewColor>('neutral')
// '' = workspace view.
const scopeTeamId = ref('')
const shared = ref(true)

const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(z.object({ name: viewNameSchema })),
})

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    formError.value = null
    resetForm({ values: { name: props.view?.name ?? '' } })
    icon.value = props.view?.icon ?? 'layers'
    color.value = props.view?.color ?? 'neutral'
    scopeTeamId.value = props.teamId ?? ''
    shared.value = props.view?.shared ?? true
  },
  { immediate: true },
)

const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

const save = useMutation({
  mutationFn: (name: string) => {
    const fields = { name, icon: icon.value, color: color.value, shared: shared.value }
    if (props.view) {
      return client.views.update({ workspaceSlug: slug.value, id: props.view.id, ...fields })
    }
    return client.views.create({
      workspaceSlug: slug.value,
      ...fields,
      teamId: scopeTeamId.value || null,
      filters: props.filters ? toViewFilters(props.filters) : {},
      display: props.display!,
    })
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: viewsKey() })
    void queryClient.invalidateQueries({ queryKey: orpc.favorites.key() })
  },
})

const onSubmit = handleSubmit(async ({ name }) => {
  formError.value = null
  try {
    const view = await save.mutateAsync(name)
    open.value = false
    if (!props.view) {
      void router.push({ name: 'view', params: { workspaceSlug: slug.value, viewId: view.id } })
    }
  } catch (error) {
    formError.value = errorMessage(error)
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-0 rounded-xl border-hairline bg-floating p-0 sm:max-w-md">
      <form novalidate class="flex flex-col" @submit="onSubmit">
        <div class="grid gap-1 px-5 pt-4">
          <DialogTitle class="text-[15px] font-semibold text-ink">
            {{ view ? 'Edit view' : 'Save as view' }}
          </DialogTitle>
          <DialogDescription class="text-ink-subtle">
            {{
              view
                ? 'Rename the view or change who can see it.'
                : 'Saves the current filters and display options.'
            }}
          </DialogDescription>
        </div>
        <div class="grid gap-3 px-5 pt-4">
          <div class="flex items-end gap-2">
            <ViewAppearancePicker v-model:icon="icon" v-model:color="color" />
            <div class="min-w-0 flex-1">
              <FormField name="name" label="Name" placeholder="Urgent bugs" autofocus />
            </div>
          </div>
          <div v-if="!view" class="grid gap-1.5">
            <Label for="view-scope" class="text-ink-muted">Scope</Label>
            <NativeSelect
              id="view-scope"
              v-model="scopeTeamId"
              class="h-8 w-56 rounded-md border-hairline bg-surface-1 py-0 pr-8 pl-2.5 text-[13px] text-ink shadow-none dark:bg-surface-1 dark:hover:bg-surface-2"
            >
              <NativeSelectOption value="">Workspace</NativeSelectOption>
              <NativeSelectOption v-for="team in teams ?? []" :key="team.id" :value="team.id">
                {{ team.name }}
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <label class="flex items-center justify-between gap-3 text-[13px] text-ink">
            <span>
              Share with workspace
              <span class="block text-xs text-ink-subtle"> Off: only you can see this view. </span>
            </span>
            <Switch v-model="shared" />
          </label>
        </div>
        <DialogFooter class="flex-row items-center gap-3 px-5 pt-4 pb-4">
          <p v-if="formError" class="text-[13px] text-danger" role="alert">{{ formError }}</p>
          <Button type="button" variant="ghost" size="sm" class="ml-auto" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" size="sm" :disabled="isSubmitting">
            {{ view ? 'Save' : 'Save view' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
