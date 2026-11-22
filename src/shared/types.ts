/** Domain types shared between the main process and the renderer. */

export type Language = 'en' | 'es'

export interface AppInfo {
  name: string
  version: string
  platform: string
  /** True when the app runs with the simulated agent backend (dev only). */
  mockMode: boolean
  /** True in demo mode (dev only): seeded agents, temporary data folder. */
  demoMode: boolean
  /** Dev-only UI scenario used for screenshots (e.g. `office`, `chat`). */
  scenario: string | null
  isPackaged: boolean
}

/** Fixed external pages the renderer may ask the main process to open. */
export type ExternalTarget = 'console' | 'billing' | 'usage' | 'apiKeys' | 'repo'

export interface KeyStatus {
  hasKey: boolean
  /** Whether the OS can encrypt secrets (Keychain / DPAPI / libsecret). */
  encryptionAvailable: boolean
  /** Set when encryption is unavailable or too weak to store a key. */
  encryptionIssue?: string
}

export type SaveKeyResult =
  | { ok: true; status: KeyStatus; warning?: string }
  | { ok: false; error: SaveKeyError }

export type SaveKeyError = 'format' | 'invalid' | 'encryption' | 'unknown'

export interface SettingsView {
  language: Language | 'system'
  dataDir: string
}

export interface PlayerState {
  x: number
  y: number
  facing: Facing
}

export type Facing = 'down' | 'up' | 'left' | 'right'

/**
 * - `sleeping`: nothing in progress, no tokens being used (zZz)
 * - `working`: a reply is being generated or tools are running
 * - `attention`: waiting for the user to approve a tool or answer a question (!)
 * - `error`: the last turn failed
 */
export type AgentStatus = 'sleeping' | 'working' | 'attention' | 'error'

export interface Appearance {
  skin: string
  hair: string
  hairStyle: number
  shirt: string
  pants: string
  shoes: string
}

export interface UsageTotals {
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  turns: number
}

export interface AgentView {
  id: string
  name: string
  folder: string
  deskIndex: number
  appearance: Appearance
  status: AgentStatus
  /** Short human-readable detail for the current status (e.g. error text). */
  statusDetail?: string
  sessionId: string | null
  allowRules: string[]
  usage: UsageTotals
  /** There is a reply the user has not opened yet. */
  unread: boolean
  createdAt: number
}

export interface CreateAgentInput {
  name: string
  folder: string
}

/* ------------------------------------------------------------------ chat -- */

export interface ChatUsage {
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  durationMs: number
}

export type PermissionStatus = 'pending' | 'allowed' | 'allowedAlways' | 'denied' | 'cancelled'

export type PermissionDetail =
  | { kind: 'command'; command: string; description?: string }
  | { kind: 'file'; path: string; preview?: string; action: 'edit' | 'write' | 'read' }
  | { kind: 'fetch'; url: string }
  | { kind: 'generic'; input: string }

export interface QuestionOption {
  label: string
  description?: string
}

export interface QuestionPrompt {
  question: string
  header?: string
  options: QuestionOption[]
  multiSelect: boolean
}

interface ChatItemBase {
  id: string
  ts: number
}

export type ChatItem =
  | (ChatItemBase & { kind: 'user'; text: string })
  | (ChatItemBase & { kind: 'assistant'; text: string; streaming?: boolean })
  | (ChatItemBase & {
      kind: 'tool'
      toolName: string
      summary: string
      status: 'running' | 'done' | 'error'
      output?: string
    })
  | (ChatItemBase & {
      kind: 'permission'
      requestId: string
      toolName: string
      detail: PermissionDetail
      reason?: string
      /** Rule that "Allow always" would save for this agent, if any. */
      alwaysRule?: string
      status: PermissionStatus
    })
  | (ChatItemBase & {
      kind: 'question'
      requestId: string
      questions: QuestionPrompt[]
      status: 'pending' | 'answered' | 'dismissed' | 'cancelled'
      answers?: Record<string, string>
    })
  | (ChatItemBase & { kind: 'result'; usage: ChatUsage; isError: boolean })
  | (ChatItemBase & { kind: 'error'; text: string; code?: ChatErrorCode })
  | (ChatItemBase & { kind: 'notice'; code: NoticeCode; detail?: string })

export type ChatItemKind = ChatItem['kind']

/** Short system notes in the timeline; the renderer translates the code. */
export type NoticeCode = 'stopped' | 'resumed' | 'resumeFailed' | 'compacted' | 'retrying'

/**
 * Error categories. Most come straight from the Agent SDK; the rest are
 * AgentVille's own (no key, blocked credentials, crashed process).
 */
export type ChatErrorCode =
  | 'authentication_failed'
  | 'billing_error'
  | 'rate_limit'
  | 'overloaded'
  | 'invalid_request'
  | 'model_not_found'
  | 'server_error'
  | 'max_output_tokens'
  | 'unknown'
  | 'noKey'
  | 'subscriptionBlocked'
  | 'crash'

/** A chat item before the main process stamps its id and timestamp. */
export type NewChatItem = ChatItem extends infer Item
  ? Item extends ChatItem
    ? Omit<Item, 'id' | 'ts'> & { id?: string }
    : never
  : never

export type PermissionResponse =
  | { requestId: string; decision: 'allow' | 'allowAlways' | 'deny'; message?: string }
  | { requestId: string; decision: 'answer'; answers: Record<string, string> }
  | { requestId: string; decision: 'dismiss' }

/** Incremental chat updates pushed from main to the renderer. */
export type ChatEvent =
  | { type: 'append'; agentId: string; item: ChatItem }
  | { type: 'update'; agentId: string; item: ChatItem }
  | { type: 'delta'; agentId: string; itemId: string; text: string }
  | { type: 'reset'; agentId: string; items: ChatItem[] }
