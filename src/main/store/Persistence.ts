import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { ChatItem, PlayerState, UsageTotals } from '@shared/types'
import type { AgentRecord } from '../agents/AgentManager'
import { emptyUsage } from '../agents/AgentManager'
import { log } from '../log'
import type { StoredSettings } from '../settings'

const STATE_VERSION = 1
const MAX_HISTORY_ITEMS = 2000
const STATE_DEBOUNCE_MS = 400
const HISTORY_DEBOUNCE_MS = 800

export interface PersistedState {
  version: number
  settings: StoredSettings
  player: PlayerState | null
  agents: AgentRecord[]
  usage: UsageTotals
}

const usageSchema = z.object({
  costUsd: z.number().default(0),
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  cacheReadTokens: z.number().default(0),
  cacheWriteTokens: z.number().default(0),
  turns: z.number().default(0)
})

const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  folder: z.string().min(1),
  deskIndex: z.number().int().min(0),
  appearance: z.object({
    skin: z.string(),
    hair: z.string(),
    hairStyle: z.number().int(),
    shirt: z.string(),
    pants: z.string(),
    shoes: z.string()
  }),
  status: z.enum(['sleeping', 'working', 'attention', 'error']).default('sleeping'),
  statusDetail: z.string().optional(),
  sessionId: z.string().nullable().default(null),
  allowRules: z.array(z.string()).default([]),
  usage: usageSchema.default(emptyUsage()),
  unread: z.boolean().default(false),
  createdAt: z.number().default(() => Date.now()),
  sessionCostUsd: z.number().default(0)
})

const stateSchema = z.object({
  version: z.number(),
  settings: z.object({ language: z.enum(['system', 'en', 'es']).default('system') }).default({ language: 'system' }),
  player: z
    .object({ x: z.number(), y: z.number(), facing: z.enum(['down', 'up', 'left', 'right']) })
    .nullable()
    .default(null),
  agents: z.array(agentSchema).default([]),
  usage: usageSchema.default(emptyUsage())
})

/**
 * Local persistence in the app data folder: one `state.json` (agents, player,
 * settings, totals) and one file per agent under `history/`. Writes are
 * debounced and atomic (write to a temp file, then rename).
 */
export class Persistence {
  private stateTimer: NodeJS.Timeout | null = null
  private pendingState: (() => PersistedState) | null = null
  private readonly historyTimers = new Map<string, NodeJS.Timeout>()
  private readonly pendingHistory = new Map<string, () => ChatItem[]>()

  constructor(private readonly dir: string) {
    mkdirSync(path.join(dir, 'history'), { recursive: true })
  }

  private get stateFile(): string {
    return path.join(this.dir, 'state.json')
  }

  private historyFile(agentId: string): string {
    return path.join(this.dir, 'history', `${agentId.replace(/[^a-zA-Z0-9-]/g, '')}.json`)
  }

  async loadState(): Promise<PersistedState | null> {
    if (!existsSync(this.stateFile)) return null
    try {
      const raw: unknown = JSON.parse(await readFile(this.stateFile, 'utf8'))
      const parsed = stateSchema.safeParse(raw)
      if (parsed.success) return parsed.data
      log.warn('state.json is not valid, starting fresh', parsed.error.message)
    } catch (error) {
      log.warn('Could not read state.json, starting fresh', error)
    }
    await rename(this.stateFile, `${this.stateFile}.broken-${Date.now()}`).catch(() => undefined)
    return null
  }

  async loadHistory(agentId: string): Promise<ChatItem[]> {
    const file = this.historyFile(agentId)
    if (!existsSync(file)) return []
    try {
      const raw: unknown = JSON.parse(await readFile(file, 'utf8'))
      if (!Array.isArray(raw)) return []
      return raw.filter(
        (item): item is ChatItem =>
          typeof item === 'object' && item !== null && typeof (item as ChatItem).id === 'string' && 'kind' in item
      )
    } catch (error) {
      log.warn(`Could not read chat history for ${agentId}`, error)
      return []
    }
  }

  scheduleState(snapshot: () => PersistedState): void {
    this.pendingState = snapshot
    if (this.stateTimer) return
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null
      void this.writeState()
    }, STATE_DEBOUNCE_MS)
  }

  scheduleHistory(agentId: string, snapshot: () => ChatItem[]): void {
    this.pendingHistory.set(agentId, snapshot)
    if (this.historyTimers.has(agentId)) return
    this.historyTimers.set(
      agentId,
      setTimeout(() => {
        this.historyTimers.delete(agentId)
        void this.writeHistory(agentId)
      }, HISTORY_DEBOUNCE_MS)
    )
  }

  async deleteHistory(agentId: string): Promise<void> {
    const timer = this.historyTimers.get(agentId)
    if (timer) clearTimeout(timer)
    this.historyTimers.delete(agentId)
    this.pendingHistory.delete(agentId)
    await rm(this.historyFile(agentId), { force: true })
  }

  /** Writes everything that is pending right now (used when quitting). */
  flushSync(): void {
    if (this.stateTimer) clearTimeout(this.stateTimer)
    this.stateTimer = null
    const state = this.pendingState
    this.pendingState = null
    if (state) this.writeAtomicSync(this.stateFile, JSON.stringify({ ...state(), version: STATE_VERSION }, null, 2))
    for (const [agentId, timer] of this.historyTimers) {
      clearTimeout(timer)
      const snapshot = this.pendingHistory.get(agentId)
      if (snapshot) this.writeAtomicSync(this.historyFile(agentId), JSON.stringify(trim(snapshot())))
    }
    this.historyTimers.clear()
    this.pendingHistory.clear()
  }

  private async writeState(): Promise<void> {
    const state = this.pendingState
    this.pendingState = null
    if (!state) return
    await this.writeAtomic(this.stateFile, JSON.stringify({ ...state(), version: STATE_VERSION }, null, 2))
  }

  private async writeHistory(agentId: string): Promise<void> {
    const snapshot = this.pendingHistory.get(agentId)
    this.pendingHistory.delete(agentId)
    if (!snapshot) return
    await this.writeAtomic(this.historyFile(agentId), JSON.stringify(trim(snapshot())))
  }

  private async writeAtomic(file: string, data: string): Promise<void> {
    const tmp = `${file}.tmp`
    try {
      await writeFile(tmp, data, { mode: 0o600 })
      await rename(tmp, file)
    } catch (error) {
      log.error(`Could not save ${path.basename(file)}`, error)
    }
  }

  private writeAtomicSync(file: string, data: string): void {
    const tmp = `${file}.tmp`
    try {
      writeFileSync(tmp, data, { mode: 0o600 })
      renameSync(tmp, file)
    } catch (error) {
      log.error(`Could not save ${path.basename(file)}`, error)
    }
  }
}

function trim(items: ChatItem[]): ChatItem[] {
  return items.length > MAX_HISTORY_ITEMS ? items.slice(-MAX_HISTORY_ITEMS) : items
}

/** Items saved mid-turn cannot continue after a restart: close them. */
export function settleLoadedHistory(items: ChatItem[]): ChatItem[] {
  return items.map((item) => {
    switch (item.kind) {
      case 'assistant':
        return item.streaming ? { ...item, streaming: false } : item
      case 'tool':
        return item.status === 'running' ? { ...item, status: 'error' } : item
      case 'permission':
        return item.status === 'pending' ? { ...item, status: 'cancelled' } : item
      case 'question':
        return item.status === 'pending' ? { ...item, status: 'cancelled' } : item
      default:
        return item
    }
  })
}
