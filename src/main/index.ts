import { app, BrowserWindow } from 'electron'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import type { PlayerState } from '@shared/types'
import { AgentManager } from './agents/AgentManager'
import { PermissionBroker } from './agents/PermissionBroker'
import { resolveShellPath } from './agents/runtimeEnv'
import { SessionManager } from './agents/SessionManager'
import { ChatLog } from './chat/ChatLog'
import { seedDemoTown } from './demo'
import { configureDataDir, devFlags, mainDir } from './env'
import { registerIpcHandlers } from './handlers'
import { setEventTarget, setTrustedUrlCheck } from './ipc'
import { log } from './log'
import { watchAgentsForNotifications } from './notifications'
import { handleAppProtocol, registerAppScheme } from './protocol'
import { KeyStore } from './secrets'
import { hardenApp, isTrustedUrl } from './security'
import { Settings } from './settings'
import { type PersistedState, Persistence, settleLoadedHistory } from './store/Persistence'
import { createMainWindow } from './window'

// Things that must happen before the app is ready.
registerAppScheme()
app.enableSandbox()
configureDataDir()

if (!app.requestSingleInstanceLock()) {
  // Another AgentVille is already running; it owns the data folder.
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let persistence: Persistence | null = null
let player: PlayerState | null = null

const agents = new AgentManager()
const chat = new ChatLog()
const keys = new KeyStore()
const settings = new Settings()
const permissions = new PermissionBroker(agents)
const sessions = new SessionManager({ agents, chat, keys }, permissions)

const snapshot = (): PersistedState => ({
  version: 1,
  settings: settings.raw,
  player,
  agents: agents.allRecords(),
  usage: agents.totals()
})

const saveState = (): void => persistence?.scheduleState(snapshot)

const world = {
  getPlayer: () => player,
  savePlayer: (next: PlayerState) => {
    player = next
    saveState()
  }
}

/** Loads agents, settings, the player's position and every chat history. */
async function loadData(): Promise<void> {
  const dataDir = app.getPath('userData')
  if (devFlags.demo && !devFlags.keepData) {
    // The demo town starts from scratch on every run.
    await rm(path.join(dataDir, 'state.json'), { force: true })
    await rm(path.join(dataDir, 'history'), { recursive: true, force: true })
  }
  persistence = new Persistence(dataDir)
  const state = await persistence.loadState()
  if (state) {
    agents.restore(state.agents, state.usage)
    settings.load(state.settings)
    player = state.player
  }
  for (const agent of agents.allRecords()) {
    chat.load(agent.id, settleLoadedHistory(await persistence.loadHistory(agent.id)))
  }

  if (devFlags.demo) await seedDemoTown(agents)
  if (devFlags.scenario === 'office' || devFlags.scenario?.startsWith('chat')) player = { x: 22 * 16, y: 15 * 16, facing: 'up' }

  agents.onChange(saveState)
  settings.onChange(saveState)
  chat.onChange((agentId) => {
    if (agents.has(agentId)) persistence?.scheduleHistory(agentId, () => chat.get(agentId))
  })
}

function openMainWindow(): void {
  mainWindow = createMainWindow()
  setEventTarget(mainWindow)
  mainWindow.on('closed', () => {
    mainWindow = null
    setEventTarget(null)
  })
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app
  .whenReady()
  .then(async () => {
    hardenApp()
    handleAppProtocol(path.join(mainDir, '../renderer'))
    setTrustedUrlCheck(isTrustedUrl)
    await loadData()
    registerIpcHandlers({
      agents,
      sessions,
      chat,
      keys,
      settings,
      world,
      getWindow: () => mainWindow,
      forgetHistory: async (agentId) => {
        await persistence?.deleteHistory(agentId)
      }
    })
    openMainWindow()
    watchAgentsForNotifications(agents, settings, () => mainWindow)
    void resolveShellPath()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
    })
  })
  .catch((error: unknown) => {
    log.error('Failed to start AgentVille', error)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Let agent processes exit cleanly (so their sessions are saved) before quitting.
let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000))
  void Promise.race([sessions.closeAll(), timeout]).finally(() => app.quit())
})

app.on('will-quit', () => {
  persistence?.flushSync()
})
