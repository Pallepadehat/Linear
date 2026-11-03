import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { listFilter, type IssueFilterInput } from './issues.service'

const W = '0192f5a0-0000-7000-8000-00000000000a'
const A = '0192f5a0-0000-7000-8000-000000000001'
const B = '0192f5a0-0000-7000-8000-000000000002'

// The app's drizzle client maps camelCase columns to snake_case.
const dialect = new PgDialect({ casing: 'snake_case' })
/** The WHERE clause the builder produces, as SQL text plus bound params. */
function render(filters: Omit<IssueFilterInput, 'workspaceId'>) {
  const where = listFilter({ workspaceId: W, ...filters })
  if (!where) return { sql: '', params: [] }
  const { sql, params } = dialect.sqlToQuery(where)
  return { sql: sql.replace(/\s+/g, ' '), params }
}

describe('listFilter', () => {
  it('adds nothing without filters or with empty lists', () => {
    expect(render({}).sql).toBe('')
    expect(render({ statusIdsNot: [], labelIdsNot: [], creatorIds: [], content: '  ' }).sql).toBe(
      '',
    )
  })

  it('excludes values with the `not` variants', () => {
    expect(render({ statusIdsNot: [A] })).toEqual({
      sql: '"issues"."status_id" not in ($1)',
      params: [A],
    })
    expect(render({ prioritiesNot: [0, 4] })).toEqual({
      sql: '"issues"."priority" not in ($1, $2)',
      params: [0, 4],
    })
    expect(render({ creatorIdsNot: [A] }).sql).toBe('"issues"."creator_id" not in ($1)')
  })

  it('keeps issues without a value unless `null` is excluded', () => {
    expect(render({ assigneeIdsNot: [A] }).sql).toBe(
      '("issues"."assignee_id" is null or "issues"."assignee_id" not in ($1))',
    )
    expect(render({ projectIdsNot: [null] }).sql).toBe('"issues"."project_id" is not null')
    expect(render({ assigneeIdsNot: [null, A] }).sql).toBe(
      '("issues"."assignee_id" is not null and "issues"."assignee_id" not in ($1))',
    )
  })

  it('matches any label by default, every label with `all`, none with `labelIdsNot`', () => {
    const any = render({ labelIds: [A, B] })
    expect(any.sql.match(/exists/g)).toHaveLength(1)
    expect(any.params).toEqual([A, B])
    expect(render({ labelIds: [A, B], labelMode: 'any' })).toEqual(any)

    const all = render({ labelIds: [A, B, A], labelMode: 'all' })
    // One EXISTS per distinct label.
    expect(all.sql.match(/exists/g)).toHaveLength(2)
    expect(all.sql).toContain(' and ')
    expect(all.params).toEqual([A, B])

    const none = render({ labelIdsNot: [A] })
    expect(none.sql).toMatch(/^not exists \(select 1 from "issue_labels"/)
    expect(none.params).toEqual([A])
  })

  it('filters by creator', () => {
    expect(render({ creatorIds: [A, B] })).toEqual({
      sql: '"issues"."creator_id" in ($1, $2)',
      params: [A, B],
    })
  })

  it('bounds dates: after inclusive, before exclusive', () => {
    const after = new Date('2026-10-01T00:00:00Z')
    const before = new Date('2026-11-01T00:00:00Z')
    expect(render({ createdAfter: after, createdBefore: before }).sql).toBe(
      '("issues"."created_at" >= $1 and "issues"."created_at" < $2)',
    )
    expect(render({ updatedAfter: after }).sql).toBe('"issues"."updated_at" >= $1')
    expect(render({ completedBefore: before }).sql).toBe('"issues"."completed_at" < $1')
    expect(render({ completedSince: after }).sql).toBe('"issues"."completed_at" >= $1')
    expect(render({ completedSince: after, completedBefore: before }).params).toHaveLength(2)
  })

  it('searches title and description, escaping LIKE wildcards', () => {
    expect(render({ content: ' 100%_done ' })).toEqual({
      sql: '("issues"."title" ilike $1 or "issues"."description" ilike $2)',
      params: ['%100\\%\\_done%', '%100\\%\\_done%'],
    })
  })

  it('checks linked pull requests within the workspace', () => {
    const has = render({ hasPullRequests: true })
    expect(has.sql).toMatch(/^exists \(select 1 from "issue_pull_request_links"/)
    expect(has.params).toEqual([W])
    expect(render({ hasPullRequests: false }).sql).toMatch(/^not exists /)
  })

  it('combines filters with AND', () => {
    const { sql } = render({ statusIdsNot: [A], creatorIds: [B], hasPullRequests: true })
    expect(sql.split(' and ').length).toBeGreaterThanOrEqual(3)
  })
})
