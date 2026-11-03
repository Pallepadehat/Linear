import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from './routes'

const router = createRouter({ history: createMemoryHistory(), routes })

describe('team routes', () => {
  it('redirects a team to its issues', () => {
    // Resolve the redirect without navigating (navigation would import the .vue page).
    const from = router.resolve('/tip/team/TIP')
    const redirect = router.getRoutes().find((r) => r.name === 'team')?.redirect
    expect(typeof redirect).toBe('function')
    const target = (redirect as (to: typeof from) => Parameters<typeof router.resolve>[0])(from)
    expect(router.resolve(target).fullPath).toBe('/tip/team/TIP/issues')
  })

  it.each([
    ['/tip/team/TIP/issues', 'team-issues'],
    ['/tip/team/TIP/projects', 'team-projects'],
    ['/tip/team/TIP/views', 'team-views'],
    ['/tip/team/TIP/settings', 'team-settings'],
    ['/tip/inbox', 'inbox'],
    ['/tip/views', 'views'],
  ])('resolves %s', (path, name) => {
    const resolved = router.resolve(path)
    expect(resolved.name).toBe(name)
    expect(resolved.params.workspaceSlug).toBe('tip')
  })

  it('lazy-loads every team page', () => {
    for (const name of ['team-issues', 'team-projects', 'team-views']) {
      const record = router.getRoutes().find((r) => r.name === name)
      expect(typeof record?.components?.default).toBe('function')
    }
  })
})
