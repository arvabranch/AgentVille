import { app, clipboard } from 'electron'
import { z } from 'zod'
import type { ExternalTarget } from '@shared/types'
import { devFlags } from './env'
import { handle } from './ipc'
import { openExternalSafe } from './security'

/** Fixed pages of the Anthropic Console (billing and usage live there). */
export const EXTERNAL_URLS: Record<ExternalTarget, string> = {
  console: 'https://platform.claude.com/',
  billing: 'https://platform.claude.com/settings/billing',
  usage: 'https://platform.claude.com/usage',
  apiKeys: 'https://platform.claude.com/settings/keys',
  repo: 'https://github.com/arvabranch/AgentVille'
}

const externalTarget = z.enum(['console', 'billing', 'usage', 'apiKeys', 'repo'])

export function registerIpcHandlers(): void {
  handle('app:getInfo', z.tuple([]), () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    mockMode: devFlags.mock,
    demoMode: devFlags.demo,
    isPackaged: app.isPackaged
  }))

  handle('app:openExternal', z.tuple([externalTarget]), (target) => {
    openExternalSafe(EXTERNAL_URLS[target])
  })

  handle('app:openUrl', z.tuple([z.string().max(4096)]), (url) => {
    openExternalSafe(url)
  })

  handle('app:copyText', z.tuple([z.string().max(2_000_000)]), (text) => {
    clipboard.writeText(text)
  })
}
