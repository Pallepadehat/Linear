import { projectsRouter } from '../modules/projects/projects.router'
import { issuesRouter } from '../modules/issues/issues.router'
import { labelsRouter } from '../modules/labels/labels.router'
import { meRouter } from '../modules/me/me.router'
import { teamsRouter } from '../modules/teams/teams.router'
import { uploadsRouter } from '../modules/uploads/uploads.router'
import { workspacesRouter } from '../modules/workspaces/workspaces.router'
import { os } from './base'

export const router = os.router({
  me: meRouter,
  workspaces: workspacesRouter,
  teams: teamsRouter,
  uploads: uploadsRouter,
  labels: labelsRouter,
  issues: issuesRouter,
  projects: projectsRouter,
})

export type Router = typeof router
