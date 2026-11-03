import type {
  ContractRouterClient,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from '@orpc/contract'
import { projectLabelsContract } from './routers/project-labels'
import { projectsContract } from './routers/projects'
import { issueRelationsContract } from './routers/relations'
import { presenceContract } from './routers/presence'
import { realtimeContract } from './routers/realtime'
import { activityContract } from './routers/activity'
import { commentsContract } from './routers/comments'
import { cyclesContract } from './routers/cycles'
import { favoritesContract } from './routers/favorites'
import { githubContract } from './routers/github'
import { issuesContract } from './routers/issues'
import { labelsContract } from './routers/labels'
import { meContract } from './routers/me'
import { notificationsContract } from './routers/notifications'
import { teamsContract } from './routers/teams'
import { templatesContract } from './routers/templates'
import { uploadsContract } from './routers/uploads'
import { workspacesContract } from './routers/workspaces'

export const contract = {
  me: meContract,
  workspaces: workspacesContract,
  teams: teamsContract,
  uploads: uploadsContract,
  labels: labelsContract,
  issues: issuesContract,
  issueRelations: issueRelationsContract,
  projects: projectsContract,
  cycles: cyclesContract,
  projectLabels: projectLabelsContract,
  github: githubContract,
  activity: activityContract,
  comments: commentsContract,
  favorites: favoritesContract,
  notifications: notificationsContract,
  realtime: realtimeContract,
  templates: templatesContract,
  presence: presenceContract,
}

export type Contract = typeof contract
export type ContractClient = ContractRouterClient<Contract>
export type ContractInputs = InferContractRouterInputs<Contract>
export type ContractOutputs = InferContractRouterOutputs<Contract>

export * from './schemas/common'
export * from './schemas/github'
export * from './schemas/issues'
export * from './schemas/projects'
export * from './schemas/labels'
export * from './schemas/teams'
export * from './schemas/uploads'
export * from './schemas/users'
export * from './schemas/workspaces'
export * from './schemas/activity'
export * from './schemas/comments'
export * from './schemas/cycles'
export * from './schemas/favorites'
export * from './schemas/realtime'
export * from './schemas/templates'
export * from './schemas/relations'
export * from './schemas/notifications'
