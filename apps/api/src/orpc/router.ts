import { projectLabelsRouter, projectsRouter } from '../modules/projects/projects.router'
import { realtimeRouter } from '../modules/realtime/realtime.router'
import { activityRouter } from '../modules/activity/activity.router'
import { commentsRouter } from '../modules/comments/comments.router'
import { githubRouter } from '../modules/github/github.router'
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
  projectLabels: projectLabelsRouter,
  github: githubRouter,
  activity: activityRouter,
  comments: commentsRouter,
  realtime: realtimeRouter,
})

export type Router = typeof router
