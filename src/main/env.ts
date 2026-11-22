import { app } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Directory of the bundled main-process file (`out/main`). */
export const mainDir = path.dirname(fileURLToPath(import.meta.url))

export const isDev = !app.isPackaged

/** URL of the Vite dev server, only set by `electron-vite dev`. */
export const rendererDevUrl = isDev ? process.env['ELECTRON_RENDERER_URL'] : undefined

/**
 * Developer-only switches. They are ignored in packaged builds so a user can
 * never end up in a simulated mode by accident.
 *
 * - AGENTVILLE_MOCK=1      simulated agents, no API calls, no key needed
 * - AGENTVILLE_DEMO=1      mock + seeded demo town in a throwaway data folder
 * - AGENTVILLE_CAPTURE=png save a screenshot of the window, then optionally quit
 */
const demo = isDev && process.env['AGENTVILLE_DEMO'] === '1'

export const devFlags = {
  demo,
  // Demo implies mock unless AGENTVILLE_MOCK=0 asks for real agents in the demo town.
  mock: isDev && (process.env['AGENTVILLE_MOCK'] === '1' || (demo && process.env['AGENTVILLE_MOCK'] !== '0')),
  capturePath: isDev ? process.env['AGENTVILLE_CAPTURE'] : undefined,
  captureDelayMs: Number(process.env['AGENTVILLE_CAPTURE_DELAY'] ?? 3500),
  captureQuit: isDev && process.env['AGENTVILLE_CAPTURE_QUIT'] === '1',
  /** Optional UI scenario applied before capturing (demo mode only). */
  scenario: isDev ? process.env['AGENTVILLE_SCENARIO'] : undefined,
  /** Optional input script run before capturing (see devScript.ts). */
  script: isDev ? process.env['AGENTVILLE_SCRIPT'] : undefined
} as const

/**
 * Keep development data apart from a packaged install so testing never
 * touches real agents or the real encrypted key. Must run before `ready`.
 */
export function configureDataDir(): void {
  if (devFlags.demo) {
    app.setPath('userData', path.join(os.tmpdir(), 'AgentVille-demo'))
  } else if (isDev) {
    app.setPath('userData', path.join(app.getPath('appData'), 'AgentVille-dev'))
  }
}
