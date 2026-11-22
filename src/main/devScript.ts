import type { BrowserWindow } from 'electron'
import { log } from './log'

/**
 * Dev-only input scripting for smoke tests and screenshots. Steps are separated
 * by `;` and sent as real input events, e.g.
 *
 *   AGENTVILLE_SCRIPT="left:780;key:E;wait:600;type:hello;key:Return"
 *
 * - `up|down|left|right:<ms>`  hold an arrow key
 * - `key:<KeyCode>`            press and release one key (Electron key codes)
 * - `type:<text>`              type text into the focused element
 * - `click:<css selector>`     click the first matching element
 * - `wait:<ms>`                pause
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const ARROWS: Record<string, string> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' }

export async function runDevScript(win: BrowserWindow, script: string): Promise<void> {
  const wc = win.webContents
  for (const raw of script.split(';')) {
    const step = raw.trim()
    if (!step) continue
    const sep = step.indexOf(':')
    const action = sep === -1 ? step : step.slice(0, sep)
    const arg = sep === -1 ? '' : step.slice(sep + 1)
    if (win.isDestroyed()) return

    const arrow = ARROWS[action]
    if (arrow) {
      wc.sendInputEvent({ type: 'keyDown', keyCode: arrow })
      await sleep(Number(arg) || 300)
      wc.sendInputEvent({ type: 'keyUp', keyCode: arrow })
      await sleep(80)
    } else if (action === 'key') {
      wc.sendInputEvent({ type: 'keyDown', keyCode: arg })
      wc.sendInputEvent({ type: 'char', keyCode: arg })
      await sleep(60)
      wc.sendInputEvent({ type: 'keyUp', keyCode: arg })
      await sleep(120)
    } else if (action === 'type') {
      for (const ch of arg) {
        wc.sendInputEvent({ type: 'char', keyCode: ch })
        await sleep(15)
      }
    } else if (action === 'click') {
      const clicked = (await wc.executeJavaScript(
        `(() => { const el = document.querySelector(${JSON.stringify(arg)}); if (el) el.click(); return !!el })()`
      )) as boolean
      if (!clicked) log.warn(`dev script: nothing matches ${arg}`)
      await sleep(150)
    } else if (action === 'wait') {
      await sleep(Number(arg) || 500)
    } else {
      log.warn(`dev script: unknown step "${step}"`)
    }
  }
}
