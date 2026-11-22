import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { configureDataDir, mainDir } from './env'
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

app.whenReady().then(() => {
  hardenApp()
  handleAppProtocol(path.join(mainDir, '../renderer'))
  setTrustedUrlCheck(isTrustedUrl)
  registerIpcHandlers()
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
