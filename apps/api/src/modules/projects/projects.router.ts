import type { Project } from '@linear/contract'
import { createProject, deleteProject, getProject, listProjects, updateProject } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'

const inWorkspace = requireWorkspace()
function toDto(row: Project): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    iconUploadId: row.iconUploadId,
    teamIds: row.teamIds,
  }
}
export const projectsRouter = {
  list: authed.projects.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) =>
      (await listProjects(context.db, context.workspace.id)).map(toDto),
    ),
  get: authed.projects.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const row = await getProject(context.db, context.workspace.id, input.id)
      return { ...toDto(row), progress: row.progress }
    }),
  create: authed.projects.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toDto(await createProject(context.db, context.workspace.id, input)),
    ),
  update: authed.projects.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toDto(await updateProject(context.db, context.workspace.id, input.id, input)),
    ),
  delete: authed.projects.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      deleteProject(context.db, context.workspace.id, input.id),
    ),
}
