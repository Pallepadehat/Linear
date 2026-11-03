import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'
import { issueDescriptionSchema, issuePrioritySchema } from './issues'
import { statusCategorySchema } from './teams'

/** Prefills for the create-issue dialog (docs/domain.md → Templates). */
export const issueTemplateSchema = z.object({
  id: z.uuid(),
  /** `null` = workspace template, offered for every team. */
  teamId: z.uuid().nullable(),
  name: z.string(),
  /** Empty = leave the title alone. */
  title: z.string(),
  description: z.string().nullable(),
  statusId: z.uuid().nullable(),
  /**
   * The status's category, so a workspace template used for another team resolves to
   * that team's first status of the same category.
   */
  statusCategory: statusCategorySchema.nullable(),
  /** `null` = leave the dialog's priority alone. */
  priority: issuePrioritySchema.nullable(),
  assigneeId: z.uuid().nullable(),
  projectId: z.uuid().nullable(),
  /** Labels that still exist; deleted ones are dropped on read. */
  labelIds: z.array(z.uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const templateTitleSchema = z.string().trim().max(255)

const templateFieldsSchema = z.object({
  name: nameSchema,
  title: templateTitleSchema.default(''),
  description: issueDescriptionSchema.optional(),
  statusId: z.uuid().nullable().optional(),
  priority: issuePrioritySchema.nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  labelIds: z.array(z.uuid()).max(50).optional(),
})

export const listTemplatesInputSchema = workspaceScopedSchema.extend({
  /** Adds that team's templates to the workspace ones. */
  teamId: z.uuid().optional(),
})

/** The form fields (also used by the app's template form). */
export const templateFormSchema = templateFieldsSchema.extend({
  /** Set once at creation; `null` = workspace template. */
  teamId: z.uuid().nullable().optional(),
})

export const createTemplateInputSchema = workspaceScopedSchema.extend(templateFormSchema.shape)

/** Omitted fields are left unchanged; the scope (team) can't change. */
export const updateTemplateInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  name: nameSchema.optional(),
  title: templateTitleSchema.optional(),
  description: issueDescriptionSchema.optional(),
  statusId: z.uuid().nullable().optional(),
  priority: issuePrioritySchema.nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  labelIds: z.array(z.uuid()).max(50).optional(),
})

export const templateIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export type IssueTemplate = z.infer<typeof issueTemplateSchema>
export type ListTemplatesInput = z.input<typeof listTemplatesInputSchema>
export type CreateTemplateInput = z.input<typeof createTemplateInputSchema>
export type UpdateTemplateInput = z.input<typeof updateTemplateInputSchema>
