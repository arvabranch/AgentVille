import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { randomAppearance } from '@shared/appearance'
import { DESK_COUNT, MAX_AGENT_NAME } from '@shared/constants'
import type { AgentStatus, AgentView, ChatUsage, CreateAgentInput, UsageTotals } from '@shared/types'
import { emit } from '../ipc'

export const emptyUsage = (): UsageTotals => ({
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  turns: 0
})

export function addUsage(totals: UsageTotals, usage: ChatUsage): UsageTotals {
  return {
    costUsd: totals.costUsd + usage.costUsd,
    inputTokens: totals.inputTokens + usage.inputTokens,
    outputTokens: totals.outputTokens + usage.outputTokens,
    cacheReadTokens: totals.cacheReadTokens + usage.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens + usage.cacheWriteTokens,
    turns: totals.turns + 1
  }
}

/** What the main process knows about an agent, including bookkeeping the UI never needs. */
export interface AgentRecord extends AgentView {
  /** Cumulative estimated cost of the current SDK session, as last reported by the SDK. */
  sessionCostUsd: number
}

export type AgentErrorCode = 'noDesk' | 'badFolder' | 'badName' | 'notFound'

/**
 * Errors thrown across IPC lose their custom fields, so the code travels in
 * the message as a `[code]` prefix that the renderer can read back.
 */
export class AgentError extends Error {
  constructor(
    readonly code: AgentErrorCode,
    message: string
  ) {
    super(`[${code}] ${message}`)
  }
}

function toView(record: AgentRecord): AgentView {
  const { sessionCostUsd: _internal, ...view } = record
  return view
}

/**
 * Owns the list of agents (who sits at which desk, their folder, their look
 * and their live status) and broadcasts every change to the renderer.
 */
export class AgentManager {
  private readonly records = new Map<string, AgentRecord>()
  private readonly listeners = new Set<() => void>()
  /** Spend across every agent, including agents that were later removed. */
  private globalUsage: UsageTotals = emptyUsage()

  list(): AgentView[] {
    return this.allRecords().map(toView)
  }

  allRecords(): AgentRecord[] {
    return [...this.records.values()].sort((a, b) => a.deskIndex - b.deskIndex)
  }

  get(agentId: string): AgentRecord {
    const record = this.records.get(agentId)
    if (!record) throw new AgentError('notFound', `Unknown agent ${agentId}`)
    return record
  }

  has(agentId: string): boolean {
    return this.records.has(agentId)
  }

  totals(): UsageTotals {
    return { ...this.globalUsage }
  }

  /** Restores state saved on disk (called once at startup). */
  restore(records: AgentRecord[], totals: UsageTotals): void {
    this.records.clear()
    for (const record of records) {
      // A process that was working when the app closed is not working anymore.
      const status: AgentStatus = record.status === 'error' ? 'error' : 'sleeping'
      this.records.set(record.id, { ...record, status })
    }
    this.globalUsage = totals
  }

  freeDesk(): number | null {
    const taken = new Set([...this.records.values()].map((a) => a.deskIndex))
    for (let i = 0; i < DESK_COUNT; i++) if (!taken.has(i)) return i
    return null
  }

  async create(input: CreateAgentInput): Promise<AgentView> {
    const name = input.name.trim().replace(/\s+/g, ' ')
    if (!name || name.length > MAX_AGENT_NAME) {
      throw new AgentError('badName', 'Invalid agent name')
    }
    const folder = path.resolve(input.folder)
    const info = await stat(folder).catch(() => null)
    if (!info?.isDirectory()) throw new AgentError('badFolder', 'Folder does not exist')

    const deskIndex = this.freeDesk()
    if (deskIndex === null) throw new AgentError('noDesk', 'No free desks left')

    const id = randomUUID()
    const record: AgentRecord = {
      id,
      name,
      folder,
      deskIndex,
      appearance: randomAppearance(id),
      status: 'sleeping',
      sessionId: null,
      allowRules: [],
      usage: emptyUsage(),
      unread: false,
      createdAt: Date.now(),
      sessionCostUsd: 0
    }
    this.records.set(id, record)
    this.changed()
    return toView(record)
  }

  remove(agentId: string): void {
    if (this.records.delete(agentId)) this.changed()
  }

  /** Applies a partial update to an agent and notifies the renderer. */
  update(agentId: string, patch: Partial<Omit<AgentRecord, 'id'>>): AgentRecord | null {
    const record = this.records.get(agentId)
    if (!record) return null
    const next = { ...record, ...patch }
    this.records.set(agentId, next)
    this.changed()
    return next
  }

  setStatus(agentId: string, status: AgentStatus, statusDetail?: string): void {
    const record = this.records.get(agentId)
    if (!record || (record.status === status && record.statusDetail === statusDetail)) return
    this.update(agentId, { status, statusDetail })
  }

  /** Records the cost and tokens of one reply for the agent and the global total. */
  recordUsage(agentId: string, usage: ChatUsage, sessionCostUsd: number): void {
    this.globalUsage = addUsage(this.globalUsage, usage)
    const record = this.records.get(agentId)
    if (!record) return
    this.update(agentId, { usage: addUsage(record.usage, usage), sessionCostUsd })
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(): void {
    emit('agents:changed', this.list())
    for (const listener of this.listeners) listener()
  }
}
