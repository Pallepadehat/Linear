import { expect, test, type Page } from '@playwright/test'
import { appUrl, demoUser } from './config'

// Browser-level security checks: what a user (or an attacker) can do through the real UI.
// The API side of the same rules is in apps/api/test/security/.

async function logIn(page: Page, password = demoUser.password) {
  await page.getByLabel('Email').fill(demoUser.email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Continue' }).click()
}

test('protected pages redirect to login and come back after it', async ({ page }) => {
  await page.goto(`/${demoUser.workspace}/my-issues`)
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await logIn(page)
  await expect(page).toHaveURL(new RegExp(`/${demoUser.workspace}/my-issues`))
})

test('a wrong password shows an error and no session', async ({ page, context }) => {
  await page.goto('/login')
  await logIn(page, 'wrong-password')

  await expect(page.getByRole('alert')).toHaveText('Wrong email or password')
  await expect(page).toHaveURL(/\/login/)
  const cookies = await context.cookies()
  expect(cookies.some((c) => c.name.includes('session_token'))).toBe(false)
})

test('the session cookie is HttpOnly: page scripts cannot steal it', async ({ page, context }) => {
  await page.goto('/login')
  await logIn(page)
  await expect(page).toHaveURL(new RegExp(`/${demoUser.workspace}/`))

  const session = (await context.cookies()).find((c) => c.name.includes('session_token'))
  expect(session?.httpOnly).toBe(true)
  expect(session?.sameSite).toBe('Lax')
  expect(await page.evaluate<string>('document.cookie')).not.toContain('session_token')
})

test('the login redirect cannot send users to another site (open redirect)', async ({ page }) => {
  await page.goto('/login?redirect=//evil.example/phish')
  await logIn(page)
  await page.waitForLoadState('networkidle')
  expect(new URL(page.url()).origin).toBe(appUrl)
})

test('an issue title with HTML is shown as text, never executed (stored XSS)', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
  page.on('dialog', () => {
    throw new Error('a script from user content opened a dialog')
  })

  await page.goto('/login')
  await logIn(page)
  await expect(page).toHaveURL(new RegExp(`/${demoUser.workspace}/`))

  await page.getByRole('button', { name: 'New issue' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New issue' })
  await dialog.getByLabel('Issue title').fill(payload)
  await dialog.getByRole('button', { name: 'Create issue' }).click()
  const toast = page.getByText(/^TIP-\d+ created$/)
  await expect(toast).toBeVisible()
  const identifier = (await toast.textContent())!.replace(' created', '')

  await page.goto(`/${demoUser.workspace}/issue/${identifier}`)
  await expect(page.getByRole('heading', { name: payload })).toBeVisible()
  expect(await page.evaluate<unknown>('window.__xss')).toBeUndefined()
  // The markup is text in the DOM, not elements.
  expect(await page.locator('img[src="x"]').count()).toBe(0)
})
