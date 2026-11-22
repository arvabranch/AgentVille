import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import type { PlayerState } from '@shared/types'
import { AgentManager } from './agents/AgentManager'
import { seedDemoTown } from './demo'
import { configureDataDir, devFlags, mainDir } from './env'
import { setEventTarget, setTrustedUrlCheck } from './ipc'
import { registerIpcHandlers } from './handlers'
import { log } from './log'
import { handleAppProtocol, registerAppScheme } from './protocol'
import { hardenApp, isTrustedUrl } from './security'
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
const agents = new AgentManager()

// Player position (persisted to disk in a later step).
let player: PlayerState | null =
  devFlags.scenario === 'office' || devFlags.scenario === 'chat' ? { x: 22 * 16, y: 15 * 16, facing: 'up' } : null
const world = {
  getPlayer: () => player,
  savePlayer: (next: PlayerState) => {
    player = next
  }
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

app.whenReady().then(async () => {
  hardenApp()
  handleAppProtocol(path.join(mainDir, '../renderer'))
  setTrustedUrlCheck(isTrustedUrl)
  registerIpcHandlers({ agents, world, getWindow: () => mainWindow })
  if (devFlags.demo) await seedDemoTown(agents)
  openMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
}).catch((error: unknown) => {
  log.error('Failed to start AgentVille', error)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
