<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import GitHubSettings from '@/features/github/components/GitHubSettings.vue'
import LabelsSettings from '@/features/labels/components/LabelsSettings.vue'
import TemplateSettings from '@/features/templates/components/TemplateSettings.vue'
import InviteCodeSettings from '../components/InviteCodeSettings.vue'
import MembersList from '../components/MembersList.vue'
import ProfileSettings from '../components/ProfileSettings.vue'
import SettingsLayout, { type SettingsNavItem } from '../components/SettingsLayout.vue'
import SettingsSection from '../components/SettingsSection.vue'
import ThemeSettings from '../components/ThemeSettings.vue'

const { workspace } = useCurrentWorkspace()
const templates = ref<InstanceType<typeof TemplateSettings> | null>(null)

const sections = computed<SettingsNavItem[]>(() => [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'members', label: 'Members' },
  { id: 'labels', label: 'Labels' },
  { id: 'templates', label: 'Templates' },
  { id: 'github', label: 'GitHub' },
  { id: 'coding-tools', label: 'Coding tools' },
])
</script>

<template>
  <SettingsLayout
    title="Settings"
    :subtitle="workspace ? `Your account and the ${workspace.name} workspace.` : undefined"
    :sections="sections"
  >
    <SettingsSection id="profile" title="Profile" description="How teammates see you.">
      <ProfileSettings />
    </SettingsSection>

    <SettingsSection id="preferences" title="Preferences" description="Only affects this device.">
      <div class="rounded-lg border border-hairline bg-surface-1">
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          <span id="theme-label" class="text-ink-muted">Theme</span>
          <ThemeSettings aria-labelledby="theme-label" />
        </div>
      </div>
    </SettingsSection>

    <SettingsSection
      id="members"
      title="Members"
      :description="workspace ? `Everyone in ${workspace.name}.` : undefined"
    >
      <InviteCodeSettings v-if="workspace?.role === 'owner'" />
      <MembersList />
    </SettingsSection>

    <SettingsSection
      id="labels"
      title="Labels"
      description="Workspace labels can be used by every team."
    >
      <LabelsSettings :team-id="null" />
    </SettingsSection>

    <SettingsSection
      id="templates"
      title="Templates"
      description="Prefill title, description and properties when creating an issue."
    >
      <template #actions>
        <Button size="sm" @click="templates?.create()">
          <Plus aria-hidden="true" />
          New template
        </Button>
      </template>
      <TemplateSettings ref="templates" />
    </SettingsSection>

    <SettingsSection
      id="github"
      title="GitHub"
      description="Link pull requests to issues automatically."
    >
      <GitHubSettings v-if="workspace?.role === 'owner'" />
      <p
        v-else-if="workspace"
        class="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-ink-subtle"
      >
        Only workspace owners can connect GitHub repositories.
      </p>
    </SettingsSection>

    <SettingsSection id="coding-tools" title="Coding tools">
      <p class="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-ink-subtle">
        Coding tool integrations are coming later. Until then, use “Copy as prompt” on an issue and
        paste it into any coding agent.
      </p>
    </SettingsSection>
  </SettingsLayout>
</template>
