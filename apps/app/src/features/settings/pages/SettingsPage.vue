<script setup lang="ts">
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import GitHubSettings from '@/features/github/components/GitHubSettings.vue'
import TemplateSettings from '@/features/templates/components/TemplateSettings.vue'
import MembersList from '../components/MembersList.vue'
import ProfileSettings from '../components/ProfileSettings.vue'
import ThemeSettings from '../components/ThemeSettings.vue'

const { workspace } = useCurrentWorkspace()
</script>

<template>
  <div class="mx-auto grid w-full max-w-3xl gap-10 px-6 py-8">
    <section aria-labelledby="profile-heading" class="grid gap-4">
      <h2 id="profile-heading" class="text-base font-semibold text-ink">Profile</h2>
      <ProfileSettings />
    </section>
    <section aria-labelledby="preferences-heading" class="grid gap-4">
      <h2 id="preferences-heading" class="text-base font-semibold text-ink">Preferences</h2>
      <div class="flex items-center justify-between gap-4">
        <span class="text-ink-muted">Theme</span>
        <ThemeSettings />
      </div>
    </section>
    <section aria-labelledby="members-heading" class="grid gap-4">
      <h2 id="members-heading" class="text-base font-semibold text-ink">
        Members<span v-if="workspace" class="font-normal text-ink-subtle">
          · {{ workspace.name }}</span
        >
      </h2>
      <MembersList />
    </section>
    <section id="templates" aria-labelledby="templates-heading" class="grid gap-4">
      <h2 id="templates-heading" class="text-base font-semibold text-ink">Templates</h2>
      <TemplateSettings />
    </section>
    <section id="github" aria-labelledby="github-heading" class="grid gap-4">
      <h2 id="github-heading" class="text-base font-semibold text-ink">GitHub</h2>
      <GitHubSettings v-if="workspace?.role === 'owner'" />
      <p v-else-if="workspace" class="text-ink-subtle">
        Only workspace owners can connect GitHub repositories.
      </p>
    </section>
  </div>
</template>
