import type { Project } from '@linear/contract'
import { createProject, deleteProject, getProject, listProjects, updateProject } from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'
import { imageUrl } from '../../lib/upload-urls'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'

const inWorkspace = requireWorkspace()

type ProjectRow = Omit<Project, 'iconUrl'>

async function toDto(db: DbOrTx, storage: Storage, row: ProjectRow): Promise<Project> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    iconUploadId: row.iconUploadId,
    iconUrl: await imageUrl(db, storage, row.iconUploadId),
    teamIds: row.teamIds,
    progress: row.progress,
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
  create: authed.projects.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toDto(
        context.db,
        context.storage,
        await createProject(context.db, context.workspace.id, input),
      ),
    ),
  update: authed.projects.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toDto(
        context.db,
        context.storage,
        await updateProject(context.db, context.workspace.id, input.id, input),
      ),
    ),
  delete: authed.projects.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      deleteProject(context.db, context.workspace.id, input.id),
    ),
}
