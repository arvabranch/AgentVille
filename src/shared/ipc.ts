/**
 * Typed IPC contract shared by the main process, the preload script and the
 * renderer. Every channel the renderer can call lives in `InvokeMap`, and every
 * event the main process can push lives in `EventMap`. The preload script only
 * forwards channels listed here, and the main process validates arguments at
 * runtime before handling them.
 */
import type {
  AgentView,
  AppInfo,
  ChatEvent,
  ChatItem,
  CreateAgentInput,
  ExternalTarget,
  KeyStatus,
  PermissionResponse,
  PlayerState,
  SaveKeyResult,
  SettingsView,
  UsageTotals
} from './types'

export interface InvokeMap {
  'app:getInfo': () => AppInfo
  'app:openExternal': (target: ExternalTarget) => void
  'app:openUrl': (url: string) => void
  'app:copyText': (text: string) => void
  'app:revealFolder': (folder: string) => void

  'key:status': () => KeyStatus
  'key:save': (key: string) => SaveKeyResult
  'key:clear': () => KeyStatus

  'settings:get': () => SettingsView
  'settings:setLanguage': (language: SettingsView['language']) => SettingsView

  'world:getPlayer': () => PlayerState | null
  'world:savePlayer': (player: PlayerState) => void

  'agents:list': () => AgentView[]
  'agents:pickFolder': () => string | null
  'agents:create': (input: CreateAgentInput) => AgentView
  'agents:remove': (agentId: string) => void
  'agents:markRead': (agentId: string) => void
  'agents:setAllowRules': (agentId: string, rules: string[]) => void

  'chat:history': (agentId: string) => ChatItem[]
  'chat:send': (agentId: string, text: string) => void
  'chat:stop': (agentId: string) => void
  'chat:respondPermission': (agentId: string, response: PermissionResponse) => void
  'chat:export': (agentId: string) => string | null

  'usage:totals': () => UsageTotals
}

export interface EventMap {
  'agents:changed': AgentView[]
  'chat:event': ChatEvent
  'key:changed': KeyStatus
  /** Ask the UI to open an agent's chat (e.g. after clicking a notification). */
  'ui:openAgent': string
}

export type InvokeChannel = keyof InvokeMap
export type EventChannel = keyof EventMap
export type InvokeArgs<C extends InvokeChannel> = Parameters<InvokeMap[C]>
export type InvokeResult<C extends InvokeChannel> = Awaited<ReturnType<InvokeMap[C]>>

// Records (instead of plain arrays) make the compiler complain if a channel is
// added to the maps above but forgotten here.
const INVOKE_CHANNEL_RECORD: Record<InvokeChannel, true> = {
  'app:getInfo': true,
  'app:openExternal': true,
  'app:openUrl': true,
  'app:copyText': true,
  'app:revealFolder': true,
  'key:status': true,
  'key:save': true,
  'key:clear': true,
  'settings:get': true,
  'settings:setLanguage': true,
  'world:getPlayer': true,
  'world:savePlayer': true,
  'agents:list': true,
  'agents:pickFolder': true,
  'agents:create': true,
  'agents:remove': true,
  'agents:markRead': true,
  'agents:setAllowRules': true,
  'chat:history': true,
  'chat:send': true,
  'chat:stop': true,
  'chat:respondPermission': true,
  'chat:export': true,
  'usage:totals': true
}

const EVENT_CHANNEL_RECORD: Record<EventChannel, true> = {
  'agents:changed': true,
  'chat:event': true,
  'key:changed': true,
  'ui:openAgent': true
}

export const INVOKE_CHANNELS = Object.keys(INVOKE_CHANNEL_RECORD) as InvokeChannel[]
export const EVENT_CHANNELS = Object.keys(EVENT_CHANNEL_RECORD) as EventChannel[]

/** The API the preload script exposes as `window.agentville`. */
export interface AgentVilleApi {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>
  on<E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): () => void
  readonly platform: string
}
