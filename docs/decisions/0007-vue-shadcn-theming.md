# 0007 — Vue 3 + shadcn-vue with token-based light/dark theming

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

We need a fast SPA with accessible components that follow `docs/design.md` in both light and dark themes.

## Decision

Vite + Vue 3 (`<script setup lang="ts">`), vue-router, shadcn-vue (Reka UI) with Tailwind v4. Design tokens are CSS variables: `:root` holds light values, `.dark` holds dark values; Tailwind `@theme` and shadcn-vue variables reference them. Theme mode (`light`/`dark`/`system`) is managed by `useTheme()` on top of VueUse `useColorMode`, applied before first paint by an inline script. Server state in TanStack Query, UI state in Pinia, forms with vee-validate + Zod. Fonts: Inter and JetBrains Mono.

## Consequences

- Components are theme-agnostic; no `dark:` color overrides.
- shadcn-vue components are copied into the repo (`components/ui/`) and can be adapted to tokens.
- Every UI change must be checked in both themes.

## Alternatives considered

- **Nuxt** — SSR not needed for an authenticated app; adds complexity.
- **PrimeVue / Vuetify** — harder to match the Linear-style design system.
