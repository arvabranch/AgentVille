import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import icon from '../../resources/icon.png?asset'
import { runDevScript } from './devScript'
import { devFlags, isDev, mainDir, rendererDevUrl } from './env'
import { log } from './log'
import { APP_ORIGIN } from './protocol'

export function createMainWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 620,
    show: false,
    title: 'AgentVille',
    backgroundColor: '#12131a',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    autoHideMenuBar: !isMac,
    // macOS and Windows take the icon from the app bundle / executable.
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(mainDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev
    }
  })

  win.once('ready-to-show', () => win.show())

  // In development the Dock would show Electron's icon otherwise.
  if (isDev && isMac) app.dock?.setIcon(icon)

  if (isDev) {
    // Surface renderer warnings/errors (CSP violations, exceptions) in the terminal.
    win.webContents.on('console-message', (event) => {
      const { level, message } = event as unknown as { level: string; message: string }
      if (level === 'warning' || level === 'error') log.warn(`[renderer:${level}] ${message}`)
    })
  }

  if (rendererDevUrl) {
    void win.loadURL(rendererDevUrl)
  } else {
    void win.loadURL(`${APP_ORIGIN}/index.html`)
  }

  if (devFlags.capturePath) scheduleCapture(win, devFlags.capturePath)
  return win
}

/** Dev-only: saves a PNG of the window, used for docs and visual checks. */
function scheduleCapture(win: BrowserWindow, file: string): void {
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        if (devFlags.script) await runDevScript(win, devFlags.script)
        const image = await win.webContents.capturePage()
        await writeFile(file, image.toPNG())
        log.info(`Screenshot saved to ${file}`)
      } catch (error) {
        log.error('Screenshot failed', error)
      }
      if (devFlags.captureQuit) app.quit()
    }, devFlags.captureDelayMs)
  })
}
