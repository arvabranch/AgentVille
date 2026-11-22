import { app, type BrowserWindow, clipboard, dialog, shell } from 'electron'
import { z } from 'zod'
import { MAX_AGENT_NAME, MAX_MESSAGE_CHARS } from '@shared/constants'
import type { ExternalTarget, PlayerState } from '@shared/types'
import type { AgentManager } from './agents/AgentManager'
import type { SessionManager } from './agents/SessionManager'
import type { ChatLog } from './chat/ChatLog'
import { devFlags } from './env'
import { emit, handle } from './ipc'
import { log } from './log'
import type { KeyStore } from './secrets'
import { openExternalSafe } from './security'
import type { Settings } from './settings'

/** Fixed pages of the Anthropic Console (billing and usage live there). */
export const EXTERNAL_URLS: Record<ExternalTarget, string> = {
  console: 'https://platform.claude.com/',
  billing: 'https://platform.claude.com/settings/billing',
  usage: 'https://platform.claude.com/usage',
  apiKeys: 'https://platform.claude.com/settings/keys',
  repo: 'https://github.com/arvabranch/AgentVille'
}

const externalTarget = z.enum(['console', 'billing', 'usage', 'apiKeys', 'repo'])
const agentId = z.string().uuid()
const requestId = z.string().min(1).max(200)
const permissionResponse = z.union([
  z.object({ requestId, decision: z.enum(['allow', 'allowAlways', 'deny']), message: z.string().max(2000).optional() }),
  z.object({ requestId, decision: z.literal('answer'), answers: z.record(z.string().max(1000), z.string().max(5000)) }),
  z.object({ requestId, decision: z.literal('dismiss') })
])

export interface WorldState {
  getPlayer: () => PlayerState | null
  savePlayer: (player: PlayerState) => void
}

export interface HandlerContext {
  agents: AgentManager
  sessions: SessionManager
  chat: ChatLog
  keys: KeyStore
  settings: Settings
  world: WorldState
  getWindow: () => BrowserWindow | null
}

export function registerIpcHandlers(ctx: HandlerContext): void {
  /* ------------------------------------------------------------- app -- */
  handle('app:getInfo', z.tuple([]), () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    mockMode: devFlags.mock,
    demoMode: devFlags.demo,
    scenario: devFlags.demo ? (devFlags.scenario ?? null) : null,
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

  handle('app:revealFolder', z.tuple([z.string().max(4096)]), (folder) => {
    // Only folders that belong to an agent can be revealed.
    if (ctx.agents.list().some((agent) => agent.folder === folder)) {
      void shell.openPath(folder)
    }
  })

  /* ------------------------------------------------------------- key -- */
  handle('key:status', z.tuple([]), () => ctx.keys.status())

  handle('key:save', z.tuple([z.string().max(400)]), async (key) => {
    const result = await ctx.keys.save(key)
    if (result.ok) {
      // Running agents still hold the old key in their environment.
      await ctx.sessions.closeAll()
      emit('key:changed', result.status)
    }
    return result
  })

  handle('key:clear', z.tuple([]), async () => {
    await ctx.sessions.closeAll()
    const status = await ctx.keys.clear()
    emit('key:changed', status)
    return status
  })

  /* -------------------------------------------------------- settings -- */
  handle('settings:get', z.tuple([]), () => ctx.settings.view())

  handle('settings:setLanguage', z.tuple([z.enum(['system', 'en', 'es'])]), (language) =>
    ctx.settings.setLanguage(language)
  )

  handle('usage:totals', z.tuple([]), () => ctx.agents.totals())

  /* ----------------------------------------------------------- world -- */
  handle('world:getPlayer', z.tuple([]), () => ctx.world.getPlayer())

  handle(
    'world:savePlayer',
    z.tuple([
      z.object({
        x: z.number().finite().min(0).max(10_000),
        y: z.number().finite().min(0).max(10_000),
        facing: z.enum(['down', 'up', 'left', 'right'])
      })
    ]),
    (player) => ctx.world.savePlayer(player)
  )

  /* ---------------------------------------------------------- agents -- */
  handle('agents:list', z.tuple([]), () => ctx.agents.list())

  handle('agents:pickFolder', z.tuple([]), async () => {
    const win = ctx.getWindow()
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'OK'
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  handle(
    'agents:create',
    z.tuple([z.object({ name: z.string().min(1).max(MAX_AGENT_NAME * 2), folder: z.string().min(1).max(4096) })]),
    (input) => ctx.agents.create(input)
  )

  handle('agents:remove', z.tuple([agentId]), async (id) => {
    await ctx.sessions.forget(id)
    ctx.chat.clear(id)
    ctx.agents.remove(id)
  })

  handle('agents:markRead', z.tuple([agentId]), (id) => {
    if (ctx.agents.has(id) && ctx.agents.get(id).unread) ctx.agents.update(id, { unread: false })
  })

  /* ------------------------------------------------------------ chat -- */
  handle('chat:history', z.tuple([agentId]), (id) => ctx.chat.get(id))

  handle('chat:send', z.tuple([agentId, z.string().min(1).max(MAX_MESSAGE_CHARS)]), (id, text) => {
    ctx.sessions.send(id, text).catch((error: unknown) => log.error('Could not send message', error))
  })

  handle('chat:stop', z.tuple([agentId]), (id) => ctx.sessions.stop(id))

  handle('chat:respondPermission', z.tuple([agentId, permissionResponse]), (id, response) => {
    ctx.sessions.respond(id, response)
  })
}
