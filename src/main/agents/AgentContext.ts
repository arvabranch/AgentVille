import { randomUUID } from 'node:crypto'
import type { AgentStatus, ChatErrorCode, ChatItem, ChatUsage, NewChatItem, NoticeCode } from '@shared/types'
import type { ChatLog } from '../chat/ChatLog'
import type { KeyStore } from '../secrets'
import type { AgentManager, AgentRecord } from './AgentManager'

export interface TurnOutcome {
  isError: boolean
  /** Error text to show in the chat (omit when it is already on screen). */
  errorText?: string
  errorCode?: ChatErrorCode
  /** Short text for the agent's status (tooltip / panel header). */
  statusDetail?: string
}

export interface SessionDeps {
  agents: AgentManager
  chat: ChatLog
  keys: KeyStore
}

/**
 * The narrow interface a running session uses to report back: chat items,
 * status changes and usage. Shared by the real SDK session and the mock.
 */
export class AgentContext {
  constructor(
    readonly agentId: string,
    private readonly deps: SessionDeps
  ) {}

  get agent(): AgentRecord {
    return this.deps.agents.get(this.agentId)
  }

  get alive(): boolean {
    return this.deps.agents.has(this.agentId)
  }

  append(item: NewChatItem): ChatItem {
    const full = { ...item, id: item.id ?? randomUUID(), ts: Date.now() } as ChatItem
    if (this.alive) this.deps.chat.append(this.agentId, full)
    return full
  }

  update(item: ChatItem): void {
    if (this.alive) this.deps.chat.update(this.agentId, item)
  }

  find(itemId: string): ChatItem | undefined {
    return this.deps.chat.find(this.agentId, itemId)
  }

  delta(itemId: string, text: string): void {
    if (this.alive) this.deps.chat.delta(this.agentId, itemId, text)
  }

  notice(code: NoticeCode, detail?: string): void {
    this.append({ kind: 'notice', code, detail })
  }

  error(text: string, code?: ChatErrorCode): void {
    this.append({ kind: 'error', text, code })
  }

  status(status: AgentStatus, detail?: string): void {
    if (this.alive) this.deps.agents.setStatus(this.agentId, status, detail)
  }

  setSession(sessionId: string | null, sessionCostUsd?: number): void {
    if (!this.alive) return
    const patch: Partial<AgentRecord> = { sessionId }
    if (sessionCostUsd !== undefined) patch.sessionCostUsd = sessionCostUsd
    this.deps.agents.update(this.agentId, patch)
  }

  /** Marks any message still "typing" as complete (after a stop, crash or result). */
  endStreaming(): void {
    if (!this.alive) return
    for (const item of this.deps.chat.get(this.agentId)) {
      if (item.kind === 'assistant' && item.streaming) this.update({ ...item, streaming: false })
    }
  }

  /** Closes a turn: shows the usage line, records spend and updates the status. */
  finishTurn(usage: ChatUsage, sessionCostUsd: number, outcome: TurnOutcome): void {
    if (!this.alive) return
    this.endStreaming()
    if (outcome.errorText) this.error(outcome.errorText, outcome.errorCode)
    const spent = usage.costUsd > 0 || usage.inputTokens + usage.outputTokens > 0
    if (spent) this.append({ kind: 'result', usage, isError: outcome.isError })
    this.deps.agents.recordUsage(this.agentId, usage, sessionCostUsd)
    const detail = outcome.isError ? (outcome.statusDetail ?? outcome.errorText ?? 'Error').slice(0, 160) : undefined
    this.deps.agents.update(this.agentId, {
      unread: true,
      status: outcome.isError ? 'error' : 'sleeping',
      statusDetail: detail
    })
  }
}
