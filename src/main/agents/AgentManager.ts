import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { randomAppearance } from '@shared/appearance'
import { DESK_COUNT, MAX_AGENT_NAME } from '@shared/constants'
import type { AgentStatus, AgentView, CreateAgentInput, UsageTotals } from '@shared/types'
import { emit } from '../ipc'

export const emptyUsage = (): UsageTotals => ({
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  turns: 0
})

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

/**
 * Owns the list of agents (who sits at which desk, their folder, their look
 * and their live status) and broadcasts every change to the renderer.
 */
export class AgentManager {
  protected readonly agents = new Map<string, AgentView>()
  private readonly listeners = new Set<(agents: AgentView[]) => void>()

  list(): AgentView[] {
    return [...this.agents.values()].sort((a, b) => a.deskIndex - b.deskIndex)
  }

  get(agentId: string): AgentView {
    const agent = this.agents.get(agentId)
    if (!agent) throw new AgentError('notFound', `Unknown agent ${agentId}`)
    return agent
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId)
  }

  freeDesk(): number | null {
    const taken = new Set([...this.agents.values()].map((a) => a.deskIndex))
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
    const agent: AgentView = {
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
      createdAt: Date.now()
    }
    this.agents.set(id, agent)
    this.changed()
    return agent
  }

  remove(agentId: string): void {
    if (this.agents.delete(agentId)) this.changed()
  }

  /** Applies a partial update to an agent and notifies the renderer. */
  update(agentId: string, patch: Partial<Omit<AgentView, 'id'>>): AgentView | null {
    const agent = this.agents.get(agentId)
    if (!agent) return null
    const next = { ...agent, ...patch }
    this.agents.set(agentId, next)
    this.changed()
    return next
  }

  setStatus(agentId: string, status: AgentStatus, statusDetail?: string): void {
    const agent = this.agents.get(agentId)
    if (!agent || (agent.status === status && agent.statusDetail === statusDetail)) return
    this.update(agentId, { status, statusDetail })
  }

  onChange(listener: (agents: AgentView[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  protected changed(): void {
    const agents = this.list()
    emit('agents:changed', agents)
    for (const listener of this.listeners) listener(agents)
  }
}
