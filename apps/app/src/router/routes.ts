import type { RouteRecordRaw } from 'vue-router'

// Every page is lazy-loaded.
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    meta: { requiresAuth: true },
    component: () => import('@/features/workspaces/pages/HomeRedirectPage.vue'),
  },
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'login',
        meta: { guestOnly: true, title: 'Log in' },
        component: () => import('@/features/auth/pages/LoginPage.vue'),
      },
      {
        path: 'register',
        name: 'register',
        meta: { guestOnly: true, title: 'Create account' },
        component: () => import('@/features/auth/pages/RegisterPage.vue'),
      },
      {
        path: 'setup',
        name: 'workspace-setup',
        meta: { requiresAuth: true, title: 'Create workspace' },
        component: () => import('@/features/workspaces/pages/WorkspaceSetupPage.vue'),
      },
      {
        // GitHub App callback URL. Under the reserved `setup` slug so it can't shadow a workspace.
        path: 'setup/github',
        name: 'github-callback',
        meta: { requiresAuth: true, title: 'Connect GitHub' },
        component: () => import('@/features/github/pages/GitHubCallbackPage.vue'),
      },
    ],
  },
  {
    path: '/:workspaceSlug',
    component: () => import('@/layouts/WorkspaceLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'workspace', redirect: { name: 'my-issues' } },
      {
        path: 'my-issues',
        name: 'my-issues',
        meta: { title: 'My issues' },
        component: () => import('@/features/issues/pages/MyIssuesPage.vue'),
      },
      {
        path: 'issues',
        name: 'issues',
        meta: { title: 'All issues' },
        component: () => import('@/features/issues/pages/IssuesPage.vue'),
      },
      {
        // Identifiers are case-insensitive (`tip-200` opens TIP-200).
        path: 'issue/:identifier',
        name: 'issue',
        meta: { title: 'Issue' },
        component: () => import('@/features/issues/pages/IssueDetailPage.vue'),
      },
      {
        path: 'projects',
        name: 'projects',
        meta: { title: 'Projects' },
        component: () => import('@/features/projects/pages/ProjectsPage.vue'),
      },
      {
        path: 'project/:projectId',
        name: 'project',
        meta: { title: 'Project' },
        component: () => import('@/features/projects/pages/ProjectDetailPage.vue'),
      },
      {
        path: 'teams',
        name: 'teams',
        meta: { title: 'Teams' },
        component: () => import('@/features/teams/pages/TeamsPage.vue'),
      },
      {
        path: 'team/:teamKey',
        name: 'team',
        meta: { title: 'Team' },
        component: () => import('@/features/teams/pages/TeamPage.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        meta: { title: 'Settings' },
        component: () => import('@/features/settings/pages/SettingsPage.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    meta: { title: 'Not found' },
    component: () => import('@/components/common/NotFoundPage.vue'),
  },
]
