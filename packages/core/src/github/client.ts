import { App } from '@octokit/app'
import { DomainError } from '../errors'

export type GitHubInstallationSummary = { id: number; accountLogin: string }
export type GitHubRepositorySummary = { id: number; fullName: string }

/**
 * The GitHub calls the integration needs. Injected (rather than imported) so the API
 * tests can run against a fake; `createGitHubAppClient` is the real one.
 */
export interface GitHubAppClient {
  /** Where to send an owner to install the App; GitHub hands `state` back on the callback. */
  installUrl(state: string): string
  /** Installations visible to the user who authorized the OAuth `code` from the callback. */
  listUserInstallations(code: string): Promise<GitHubInstallationSummary[]>
  /** Repositories the installation can access; null when the App was uninstalled on GitHub. */
  listInstallationRepositories(installationId: number): Promise<GitHubRepositorySummary[] | null>
}

export type GitHubAppConfig = {
  appId: string
  privateKey: string
  slug: string
  clientId: string
  clientSecret: string
}

function hasStatus(error: unknown, check: (status: number) => boolean) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    check(error.status)
  )
}

export function createGitHubAppClient(config: GitHubAppConfig): GitHubAppClient {
  const app = new App({
    appId: config.appId,
    // Env files often carry the PEM on one line with literal \n.
    privateKey: config.privateKey.replace(/\\n/g, '\n'),
    oauth: { clientId: config.clientId, clientSecret: config.clientSecret },
  })

  return {
    installUrl(state) {
      const url = new URL(
        `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`,
      )
      url.searchParams.set('state', state)
      return url.toString()
    },

    async listUserInstallations(code) {
      let octokit
      try {
        octokit = await app.oauth.getUserOctokit({ code })
      } catch (error) {
        // Codes are single-use and short-lived; a reload of the callback page lands here.
        if (hasStatus(error, (s) => s >= 400 && s < 500)) {
          throw new DomainError('BAD_REQUEST', 'GitHub authorization expired. Install again.')
        }
        throw error
      }
      const installations: GitHubInstallationSummary[] = []
      for (let page = 1; ; page++) {
        const { data } = await octokit.request('GET /user/installations', { per_page: 100, page })
        for (const installation of data.installations) {
          const account = installation.account
          const login = account && ('login' in account ? account.login : account.slug)
          if (login) installations.push({ id: installation.id, accountLogin: login })
        }
        if (data.installations.length < 100) return installations
      }
    },

    async listInstallationRepositories(installationId) {
      const repositories: GitHubRepositorySummary[] = []
      try {
        for await (const { repository } of app.eachRepository.iterator({ installationId })) {
          repositories.push({ id: Number(repository.id), fullName: repository.full_name })
        }
      } catch (error) {
        if (hasStatus(error, (s) => s === 404)) return null
        throw error
      }
      return repositories
    },
  }
}
