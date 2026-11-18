import { describe, expect, it } from 'vitest'
import { teamKeySchema, workspaceSlugSchema } from './common'
import {
  issueEstimateSchema,
  issuePrioritySchema,
  issueTitleSchema,
  listIssuesInputSchema,
} from './issues'
import { createPresignedUploadInputSchema } from './uploads'

// Boundary value analysis: every limit is tested just below, on, and just above the edge.
// These schemas run on the server for every request and in the app's forms.
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success

describe('boundaries: issue title (1–255 characters after trimming)', () => {
  it.each([
    ['empty', '', false],
    ['only spaces', '   ', false],
    ['1 character', 'a', true],
    ['255 characters', 'a'.repeat(255), true],
    ['256 characters', 'a'.repeat(256), false],
    ['255 + surrounding spaces', ` ${'a'.repeat(255)} `, true],
  ])('%s → %s', (_, value, expected) => {
    expect(ok(issueTitleSchema, value)).toBe(expected)
  })
})

describe('boundaries: priority (integer 0–4)', () => {
  it.each([
    [-1, false],
    [0, true],
    [4, true],
    [5, false],
    [2.5, false],
    ['2', false],
  ])('%j → %s', (value, expected) => {
    expect(ok(issuePrioritySchema, value)).toBe(expected)
  })
})

describe('boundaries: estimate (integer 0–100)', () => {
  it.each([
    [-1, false],
    [0, true],
    [100, true],
    [101, false],
  ])('%j → %s', (value, expected) => {
    expect(ok(issueEstimateSchema, value)).toBe(expected)
  })
})

describe('boundaries: workspace slug (2–40, lowercase, no leading/trailing dash)', () => {
  it.each([
    ['a', false],
    ['ab', true],
    ['a'.repeat(40), true],
    ['a'.repeat(41), false],
    ['-ab', false],
    ['ab-', false],
    ['TIP', true], // normalised to lowercase
    ['api', false], // reserved route
    ["tip' or '1'='1", false],
    ['<script>', false],
  ])('%j → %s', (value, expected) => {
    expect(ok(workspaceSlugSchema, value)).toBe(expected)
  })
})

describe('boundaries: team key (2–10, starts with a letter)', () => {
  it.each([
    ['T', false],
    ['TI', true],
    ['ABCDEFGHIJ', true],
    ['ABCDEFGHIJK', false],
    ['1TIP', false],
  ])('%j → %s', (value, expected) => {
    expect(ok(teamKeySchema, value)).toBe(expected)
  })
})

describe('boundaries: list page size (1–100, default 50)', () => {
  const page = (limit?: number) =>
    listIssuesInputSchema.safeParse({
      workspaceSlug: 'tip',
      ...(limit === undefined ? {} : { limit }),
    })

  it.each([
    [0, false],
    [1, true],
    [100, true],
    [101, false],
  ])('limit %i → %s', (limit, expected) => {
    expect(page(limit).success).toBe(expected)
  })

  it('defaults to 50', () => {
    expect(page().data?.limit).toBe(50)
  })

  it('caps the search text at 255 characters', () => {
    const q = (length: number) =>
      listIssuesInputSchema.safeParse({ workspaceSlug: 'tip', q: 'x'.repeat(length) }).success
    expect(q(255)).toBe(true)
    expect(q(256)).toBe(false)
  })
})

describe('boundaries: attachment size (max 25 MB)', () => {
  const MB = 1024 * 1024
  const upload = (size: number) =>
    createPresignedUploadInputSchema.safeParse({
      kind: 'attachment',
      workspaceSlug: 'tip',
      contentType: 'application/pdf',
      size,
    }).success

  it.each([
    [0, false],
    [1, true],
    [25 * MB, true],
    [25 * MB + 1, false],
  ])('%i bytes → %s', (size, expected) => {
    expect(upload(size)).toBe(expected)
  })
})
