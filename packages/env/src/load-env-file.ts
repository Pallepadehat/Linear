import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Loads the repo-root `.env` into `process.env` without overriding variables
 * that are already set. Turborepo runs each task inside its package folder, so
 * the runtime's own `.env` lookup (cwd only) would miss the shared root file.
 */
export function loadRootEnvFile(startDir = process.cwd()): void {
  let dir = startDir
  while (!existsSync(join(dir, 'turbo.json'))) {
    const parent = dirname(dir)
    if (parent === dir) return
    dir = parent
  }
  const file = join(dir, '.env')
  if (existsSync(file)) process.loadEnvFile(file)
}
