import type { Project, ProjectLabel } from '@linear/contract'
import {
  createProject,
  createProjectLabel,
  deleteProject,
  getProject,
  getProjectProgress,
  listProjectLabels,
  listProjects,
  updateProject,
} from '@linear/core'
import type { DbOrTx, projectLabels } from '@linear/db'
import type { Storage } from '@linear/storage'
import { imageUrl } from '../../lib/upload-urls'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'

const inWorkspace = requireWorkspace()

type ProjectRow = Omit<Project, 'iconUrl'>

function toLabelDto(row: typeof projectLabels.$inferSelect): ProjectLabel {
  return { id: row.id, name: row.name, color: row.color }
}

async function toDto(db: DbOrTx, storage: Storage, row: ProjectRow): Promise<Project> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    iconUploadId: row.iconUploadId,
    iconUrl: await imageUrl(db, storage, row.iconUploadId),
    teamIds: row.teamIds,
    priority: row.priority,
    leadId: row.leadId,
    memberIds: row.memberIds,
    startDate: row.startDate,
    targetDate: row.targetDate,
    labelIds: row.labelIds,
    progress: row.progress,
    issueCount: row.issueCount,
    currentMilestone: row.currentMilestone
      ? {
          id: row.currentMilestone.id,
          name: row.currentMilestone.name,
          progress: row.currentMilestone.progress,
        }
      : null,
    createdAt: row.createdAt,
  }
}

export const projectsRouter = {
  list: authed.projects.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) => {
      const rows = await listProjects(context.db, context.workspace.id)
      return Promise.all(rows.map((row) => toDto(context.db, context.storage, row)))
    }),
  get: authed.projects.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toDto(
        context.db,
        context.storage,
        await getProject(context.db, context.workspace.id, input.id),
      ),
    ),
  progress: authed.projects.progress
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(({ context, input }) =>
      getProjectProgress(context.db, context.workspace.id, input.projectId),
    ),
  create: authed.projects.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const project = await createProject(context.db, context.workspace.id, input)
      await publishChange(context, { type: 'project.updated', projectId: project.id })
      return toDto(context.db, context.storage, project)
    }),
  update: authed.projects.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const project = await updateProject(context.db, context.workspace.id, input.id, input)
      await publishChange(context, { type: 'project.updated', projectId: project.id })
      return toDto(context.db, context.storage, project)
    }),
  delete: authed.projects.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const deleted = await deleteProject(context.db, context.workspace.id, input.id)
      await publishChange(context, { type: 'project.updated', projectId: deleted.id })
      return deleted
    }),
}

// Any member may manage project labels, like issue labels (docs/domain.md → Roles).
export const projectLabelsRouter = {
  list: authed.projectLabels.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) =>
      (await listProjectLabels(context.db, context.workspace.id)).map(toLabelDto),
    ),
  create: authed.projectLabels.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toLabelDto(await createProjectLabel(context.db, context.workspace.id, input)),
    ),
}
