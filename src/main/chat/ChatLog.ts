import type { ChatItem } from '@shared/types'
import { emit } from '../ipc'

const DELTA_FLUSH_MS = 40

/**
 * Chat history for every agent, kept in the main process (the source of truth)
 * and mirrored to the renderer through `chat:event` messages. Streaming text
 * deltas are batched so the UI re-renders at most ~25 times per second.
 */
export class ChatLog {
  private readonly items = new Map<string, ChatItem[]>()
  private readonly pending = new Map<string, { agentId: string; text: string }>()
  private flushTimer: NodeJS.Timeout | null = null
  private readonly listeners = new Set<(agentId: string) => void>()

  get(agentId: string): ChatItem[] {
    this.flush()
    return this.items.get(agentId) ?? []
  }

  /** Replaces an agent's whole history (used when loading from disk). */
  load(agentId: string, items: ChatItem[]): void {
    this.items.set(agentId, items)
  }

  find(agentId: string, itemId: string): ChatItem | undefined {
    return this.items.get(agentId)?.find((item) => item.id === itemId)
  }

  append(agentId: string, item: ChatItem): void {
    this.flush()
    const list = this.items.get(agentId) ?? []
    list.push(item)
    this.items.set(agentId, list)
    emit('chat:event', { type: 'append', agentId, item })
    this.changed(agentId)
  }

  update(agentId: string, item: ChatItem): void {
    this.flush()
    const list = this.items.get(agentId)
    if (!list) return
    const index = list.findIndex((existing) => existing.id === item.id)
    if (index === -1) return
    list[index] = item
    emit('chat:event', { type: 'update', agentId, item })
    this.changed(agentId)
  }

  /** Appends streamed text to an assistant message. */
  delta(agentId: string, itemId: string, text: string): void {
    const item = this.find(agentId, itemId)
    if (!item || item.kind !== 'assistant') return
    item.text += text
    const pending = this.pending.get(itemId)
    if (pending) pending.text += text
    else this.pending.set(itemId, { agentId, text })
    this.flushTimer ??= setTimeout(() => this.flush(), DELTA_FLUSH_MS)
  }

  clear(agentId: string): void {
    this.items.delete(agentId)
    for (const [itemId, pending] of this.pending) if (pending.agentId === agentId) this.pending.delete(itemId)
  }

  onChange(listener: (agentId: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.pending.size === 0) return
    const touched = new Set<string>()
    for (const [itemId, { agentId, text }] of this.pending) {
      emit('chat:event', { type: 'delta', agentId, itemId, text })
      touched.add(agentId)
    }
    this.pending.clear()
    for (const agentId of touched) this.changed(agentId)
  }

  private changed(agentId: string): void {
    for (const listener of this.listeners) listener(agentId)
  }
}
