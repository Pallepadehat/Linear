import type {
  ContractRouterClient,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from '@orpc/contract'
import { projectsContract } from './routers/projects'
import { realtimeContract } from './routers/realtime'
import { activityContract } from './routers/activity'
import { commentsContract } from './routers/comments'
import { cyclesContract } from './routers/cycles'
import { githubContract } from './routers/github'
import { issuesContract } from './routers/issues'
import { labelsContract } from './routers/labels'
import { meContract } from './routers/me'
import { teamsContract } from './routers/teams'
import { uploadsContract } from './routers/uploads'
import { workspacesContract } from './routers/workspaces'

export const contract = {
  me: meContract,
  workspaces: workspacesContract,
  teams: teamsContract,
  uploads: uploadsContract,
  labels: labelsContract,
  issues: issuesContract,
  projects: projectsContract,
  cycles: cyclesContract,
  github: githubContract,
  activity: activityContract,
  comments: commentsContract,
  realtime: realtimeContract,
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
export * from './schemas/realtime'
