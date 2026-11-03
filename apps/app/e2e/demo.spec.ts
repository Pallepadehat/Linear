import { expect, test } from '@playwright/test'
import { demoUser } from './config'
import { pullRequestPayload, sendPullRequestWebhook } from './github'

// PRD §12 Test 10: create an issue, open a PR for it, merge it — the issue page follows along
// without a reload. GitHub is mocked by signed webhooks to the real endpoint (e2e/github.ts).
test('acceptance: 10 end-to-end demonstration', async ({ page }) => {
  await test.step('log in as the demo user', async () => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(demoUser.email)
    await page.getByLabel('Password').fill(demoUser.password)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(new RegExp(`/${demoUser.workspace}/`))
  })

  const identifier = await test.step('create "Fix login validation" in TIP', async () => {
    await page.getByRole('button', { name: 'New issue' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await dialog.getByLabel('Issue title').fill('Fix login validation')
    await dialog.getByRole('button', { name: 'Create issue' }).click()
    const toast = page.getByText(/^TIP-\d+ created$/)
    await expect(toast).toBeVisible()
    return (await toast.textContent())!.replace(' created', '')
  })

  const properties = page.getByRole('complementary', { name: 'Issue properties' })
  const status = properties.getByRole('button', { name: /Change status/ })
  const pullRequests = properties.getByRole('link', { name: /Fix login validation/ })

  await test.step(`open ${identifier}`, async () => {
    await page.goto(`/${demoUser.workspace}/issue/${identifier}`)
    await expect(page.getByRole('heading', { name: 'Fix login validation' })).toBeVisible()
    await expect(status).not.toContainText(/In Progress|Done/)
    await expect(properties.getByText('None yet')).toBeVisible()
  })

  const number = Number(identifier.split('-')[1]) + 100
  const pr = {
    number,
    branch: `${identifier.toLowerCase()}-fix-login`,
    title: 'Fix login validation',
  }

  await test.step('pull_request.opened → In Progress, PR Open', async () => {
    await sendPullRequestWebhook(pullRequestPayload('opened', pr))
    await expect(status).toContainText('In Progress')
    await expect(pullRequests).toHaveCount(1)
    await expect(pullRequests).toContainText('tip-demo/linear-demo#')
    await expect(pullRequests).toContainText('Open')
  })

  await test.step('pull_request.closed (merged) → Done, PR Merged', async () => {
    await sendPullRequestWebhook(pullRequestPayload('merged', pr))
    await expect(status).toContainText('Done')
    await expect(pullRequests).toContainText('Merged')
  })
})
