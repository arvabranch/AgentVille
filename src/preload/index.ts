import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { type AgentVilleApi, EVENT_CHANNELS, INVOKE_CHANNELS } from '@shared/ipc'

/**
 * The only bridge between the UI and the main process. The renderer never gets
 * `ipcRenderer` itself: it can only call the channels listed in the shared
 * contract, and event listeners receive the payload without the Electron event.
 */
const invokeAllowed = new Set<string>(INVOKE_CHANNELS)
const eventAllowed = new Set<string>(EVENT_CHANNELS)

const api: AgentVilleApi = {
  invoke(channel, ...args) {
    if (!invokeAllowed.has(channel)) {
      return Promise.reject(new Error(`Channel not allowed: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel, listener) {
    if (!eventAllowed.has(channel)) {
      throw new Error(`Event not allowed: ${String(channel)}`)
    }
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => {
      listener(payload as Parameters<typeof listener>[0])
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('agentville', api)
