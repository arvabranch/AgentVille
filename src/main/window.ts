import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
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
