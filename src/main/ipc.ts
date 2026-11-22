import { type BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import type { EventChannel, EventMap, InvokeArgs, InvokeChannel, InvokeResult } from '@shared/ipc'
import { log } from './log'

type Handler<C extends InvokeChannel> = (
  ...args: InvokeArgs<C>
) => InvokeResult<C> | Promise<InvokeResult<C>>

let isTrustedUrl: (url: string) => boolean = () => false

/** Tells the IPC layer which page origins may call into the main process. */
export function setTrustedUrlCheck(check: (url: string) => boolean): void {
  isTrustedUrl = check
}

function assertTrustedSender(event: IpcMainInvokeEvent, channel: string): void {
  const url = event.senderFrame?.url ?? ''
  if (!isTrustedUrl(url)) {
    log.warn(`Blocked IPC call to ${channel} from untrusted frame: ${url}`)
    throw new Error('Untrusted sender')
  }
}

/**
 * Registers a handler for a typed channel. Arguments coming from the renderer
 * are validated with the given zod tuple before the handler runs.
 */
export function handle<C extends InvokeChannel>(
  channel: C,
  argsSchema: z.ZodType<InvokeArgs<C>>,
  handler: Handler<C>
): void {
  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
    assertTrustedSender(event, channel)
    const parsed = argsSchema.safeParse(rawArgs)
    if (!parsed.success) {
      log.warn(`Invalid arguments for ${channel}`)
      throw new Error(`Invalid arguments for ${channel}`)
    }
    return handler(...parsed.data)
  })
}

let targetWindow: BrowserWindow | null = null

export function setEventTarget(win: BrowserWindow | null): void {
  targetWindow = win
}

/** Pushes a typed event to the renderer, if the window is alive. */
export function emit<E extends EventChannel>(channel: E, payload: EventMap[E]): void {
  if (!targetWindow || targetWindow.isDestroyed()) return
  targetWindow.webContents.send(channel, payload)
}
