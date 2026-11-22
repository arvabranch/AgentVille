import {
  type CanUseTool,
  type Options,
  type Query,
  query,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKPartialAssistantMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { ChatErrorCode, ChatItem, ChatUsage, PermissionResponse } from '@shared/types'
import { log, redact } from '../log'
import type { KeyStore } from '../secrets'
import type { AgentContext, TurnOutcome } from './AgentContext'
import { MessageQueue } from './MessageQueue'
import { buildAgentEnv, claudeExecutablePath } from './runtimeEnv'
import { summarizeTool, toolResultText, truncate } from './toolSummary'
import type { AgentSession } from './types'

/** An agent that stays idle this long goes to sleep and its process exits. */
const IDLE_SLEEP_MS = 10 * 60_000
const STOP_GRACE_MS = 5_000
const CLOSE_GRACE_MS = 3_000

const SUBSCRIPTION_SOURCES = new Set(['oauth', '/login managed key', 'none'])

const KNOWN_ERRORS = new Set<ChatErrorCode>([
  'authentication_failed',
  'billing_error',
  'rate_limit',
  'overloaded',
  'invalid_request',
  'model_not_found',
  'server_error',
  'max_output_tokens'
])

const asErrorCode = (value: string | undefined): ChatErrorCode | undefined =>
  value && KNOWN_ERRORS.has(value as ChatErrorCode) ? (value as ChatErrorCode) : value ? 'unknown' : undefined

type ToolItem = Extract<ChatItem, { kind: 'tool' }>

export type PermissionHandler = (ctx: AgentContext, ...args: Parameters<CanUseTool>) => ReturnType<CanUseTool>

/**
 * One agent backed by the Claude Agent SDK. The SDK process stays alive while
 * the agent is awake (streaming input), so follow-ups keep context and replies
 * can be interrupted. When idle for a while the process exits; the next message
 * resumes the same session from disk.
 */
export class SdkSession implements AgentSession {
  private q: Query | null = null
  private input: MessageQueue<SDKUserMessage> | null = null
  private consumer: Promise<void> | null = null
  private generation = 0
  private turnActive = false
  private interrupting = false
  private closing = false
  private sawInit = false
  private resumedFrom: string | null = null
  private lastPrompt: string | null = null
  private processCost: number | null = null
  private lastAssistantError: string | null = null
  private currentMessageId: string | null = null
  private readonly streamedBlocks = new Map<string, Map<number, string>>()
  private readonly toolItems = new Map<string, ToolItem>()
  private idleTimer: NodeJS.Timeout | null = null
  private stopTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly ctx: AgentContext,
    private readonly keys: KeyStore,
    private readonly permissions: {
      request: PermissionHandler
      respond: (agentId: string, response: PermissionResponse) => void
      cancel: (agentId: string) => void
    }
  ) {}

  get busy(): boolean {
    return this.turnActive
  }

  async send(text: string): Promise<void> {
    this.clearIdle()
    this.ctx.append({ kind: 'user', text })
    this.lastPrompt = text
    this.lastAssistantError = null
    this.interrupting = false
    this.turnActive = true
    this.ctx.status('working')

    if (!this.q && !(await this.start())) return
    this.input?.push(userMessage(text))
  }

  async stop(): Promise<void> {
    if (!this.turnActive || !this.q) return
    this.interrupting = true
    this.permissions.cancel(this.ctx.agentId)
    try {
      await this.q.interrupt()
    } catch (error) {
      log.debug('interrupt failed', error)
    }
    // If the process does not confirm the stop, end the turn ourselves.
    this.stopTimer = setTimeout(() => {
      if (this.turnActive && this.interrupting) {
        this.endTurnLocally()
        void this.restartProcess()
      }
    }, STOP_GRACE_MS)
  }

  respond(response: PermissionResponse): void {
    this.permissions.respond(this.ctx.agentId, response)
  }

  async close(): Promise<void> {
    this.clearIdle()
    this.permissions.cancel(this.ctx.agentId)
    const q = this.q
    if (!q) return
    this.closing = true
    this.input?.end()
    // Give the process a moment to exit on its own so it saves the session.
    await Promise.race([this.consumer, new Promise((resolve) => setTimeout(resolve, CLOSE_GRACE_MS))])
    q.close()
    this.q = null
    this.input = null
    this.closing = false
    if (this.turnActive) this.endTurnLocally()
  }

  /* ---------------------------------------------------------- process -- */

  private async start(): Promise<boolean> {
    const key = await this.keys.get()
    if (!key) {
      this.turnActive = false
      this.ctx.error('No API key saved', 'noKey')
      this.ctx.status('error', 'No API key')
      return false
    }

    const agent = this.ctx.agent
    const generation = ++this.generation
    const input = new MessageQueue<SDKUserMessage>()
    this.input = input
    this.sawInit = false
    this.resumedFrom = agent.sessionId
    this.processCost = null

    const options: Options = {
      cwd: agent.folder,
      env: buildAgentEnv(key),
      // Load ~/.claude and the project's .claude/ so CLAUDE.md, skills,
      // plugins, hooks and MCP servers work like in Claude Code.
      settingSources: ['user', 'project', 'local'],
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `You are "${agent.name}", a coding agent who lives in AgentVille, a desktop app where each agent sits at a desk in a pixel-art office. The user chats with you from a side panel that renders Markdown.`
      },
      // Ask before running commands or editing files, whatever the settings say.
      permissionMode: 'default',
      allowedTools: agent.allowRules,
      canUseTool: (toolName, toolInput, opts) => this.permissions.request(this.ctx, toolName, toolInput, opts),
      includePartialMessages: true,
      resume: agent.sessionId ?? undefined,
      title: agent.sessionId ? undefined : `AgentVille · ${agent.name}`,
      pathToClaudeCodeExecutable: claudeExecutablePath(),
      stderr: (data) => log.debug(`[agent ${agent.name}] ${redact(data).trim()}`)
    }

    const q = query({ prompt: input, options })
    this.q = q
    this.consumer = this.consume(q, generation)
    return true
  }

  private async consume(q: Query, generation: number): Promise<void> {
    try {
      for await (const message of q) {
        if (generation !== this.generation) return
        this.handle(message)
      }
    } catch (error) {
      // Closing the input after an error result makes the iterator throw; only
      // a failure in the middle of a turn is a real crash.
      if (generation === this.generation && this.turnActive && !this.closing) this.crash(error)
    } finally {
      if (generation === this.generation && this.q === q) {
        this.q = null
        this.input = null
        this.permissions.cancel(this.ctx.agentId)
      }
    }
  }

  /** Throws away the current process (used after a failed stop or resume). */
  private async restartProcess(): Promise<void> {
    const q = this.q
    this.generation++
    this.q = null
    this.input?.end()
    this.input = null
    q?.close()
  }

  /* --------------------------------------------------------- messages -- */

  private handle(message: SDKMessage): void {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') this.onInit(message)
        else if (message.subtype === 'api_retry') this.ctx.status('working', `retry ${message.attempt}/${message.max_retries}`)
        else if (message.subtype === 'compact_boundary') this.ctx.notice('compacted')
        break
      case 'stream_event':
        this.onStream(message)
        break
      case 'assistant':
        this.onAssistant(message)
        break
      case 'user':
        this.onUser(message)
        break
      case 'result':
        this.onResult(message)
        break
      default:
        break
    }
  }

  private onInit(message: SDKSystemMessage): void {
    this.sawInit = true
    if (SUBSCRIPTION_SOURCES.has(message.apiKeySource)) {
      // AgentVille only ever runs on the user's own API key.
      this.ctx.error(`Unsupported credentials (${message.apiKeySource})`, 'subscriptionBlocked')
      this.turnActive = false
      this.ctx.status('error', 'Unsupported credentials')
      void this.restartProcess()
      return
    }
    const agent = this.ctx.agent
    if (message.session_id && message.session_id !== agent.sessionId) {
      this.ctx.setSession(message.session_id)
    }
  }

  private onStream(message: SDKPartialAssistantMessage): void {
    if (message.parent_tool_use_id) return
    const event = message.event
    if (event.type === 'message_start') {
      this.currentMessageId = event.message.id
      return
    }
    const messageId = this.currentMessageId
    if (!messageId) return
    const blocks = this.streamedBlocks.get(messageId) ?? new Map<number, string>()
    this.streamedBlocks.set(messageId, blocks)

    if (event.type === 'content_block_start' && event.content_block.type === 'text') {
      const id = `${messageId}:${event.index}`
      blocks.set(event.index, id)
      this.ctx.append({ id, kind: 'assistant', text: event.content_block.text ?? '', streaming: true })
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const id = blocks.get(event.index)
      if (id) this.ctx.delta(id, event.delta.text)
    } else if (event.type === 'content_block_stop') {
      const id = blocks.get(event.index)
      const item = id ? this.ctx.find(id) : undefined
      if (item?.kind === 'assistant') this.ctx.update({ ...item, streaming: false })
    }
  }

  private onAssistant(message: SDKAssistantMessage): void {
    if (message.parent_tool_use_id) return
    const streamed = (this.streamedBlocks.get(message.message.id)?.size ?? 0) > 0
    for (const block of message.message.content) {
      if (block.type === 'text') {
        if (message.error) {
          this.lastAssistantError = block.text
          this.ctx.error(block.text, asErrorCode(message.error))
        } else if (!streamed && block.text.trim()) {
          this.ctx.append({ kind: 'assistant', text: block.text })
        }
      } else if (block.type === 'tool_use' && !this.toolItems.has(block.id)) {
        const input = (block.input ?? {}) as Record<string, unknown>
        const item = this.ctx.append({
          id: `tool:${block.id}`,
          kind: 'tool',
          toolName: block.name,
          summary: summarizeTool(block.name, input, this.ctx.agent.folder),
          status: 'running'
        }) as ToolItem
        this.toolItems.set(block.id, item)
      }
    }
  }

  private onUser(message: SDKUserMessage): void {
    if (message.parent_tool_use_id) return
    const content = message.message.content
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (block.type !== 'tool_result') continue
      const item = this.toolItems.get(block.tool_use_id)
      if (!item) continue
      const next: ToolItem = {
        ...item,
        status: block.is_error ? 'error' : 'done',
        output: truncate(toolResultText(block.content), 4000)
      }
      this.toolItems.set(block.tool_use_id, next)
      this.ctx.update(next)
    }
  }

  private onResult(message: SDKResultMessage): void {
    if (this.stopTimer) clearTimeout(this.stopTimer)

    // Resuming a session that no longer exists fails before `init`: start fresh.
    if (
      !this.sawInit &&
      this.resumedFrom &&
      message.subtype === 'error_during_execution' &&
      message.errors.some((error) => /no conversation found/i.test(error))
    ) {
      void this.startFresh()
      return
    }

    const agent = this.ctx.agent
    const total = message.total_cost_usd ?? 0
    // The SDK reports a running total per session (restored on resume).
    const baseline = this.processCost ?? agent.sessionCostUsd
    const cost = total >= baseline ? total - baseline : total
    this.processCost = total

    const usage: ChatUsage = {
      costUsd: Math.max(0, cost),
      inputTokens: message.usage.input_tokens ?? 0,
      outputTokens: message.usage.output_tokens ?? 0,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      durationMs: message.duration_ms
    }

    let outcome: TurnOutcome = { isError: false }
    if (this.interrupting) {
      this.ctx.notice('stopped')
    } else if (message.is_error) {
      const text = message.subtype === 'success' ? message.result || 'Error' : message.errors.join('\n') || message.subtype
      outcome = this.lastAssistantError
        ? { isError: true, statusDetail: this.lastAssistantError }
        : { isError: true, errorText: text, errorCode: 'unknown' }
    }

    this.closeOpenTools(this.interrupting ? 'error' : 'done')
    this.turnActive = false
    this.interrupting = false
    this.ctx.finishTurn(usage, total, outcome)
    this.scheduleIdle()
  }

  private crash(error: unknown): void {
    this.ctx.endStreaming()
    const text = redact(error instanceof Error ? error.message : String(error))
    log.warn(`Agent ${this.ctx.agent.name} stopped unexpectedly: ${text}`)
    this.closeOpenTools('error')
    this.turnActive = false
    this.ctx.error(text, 'crash')
    this.ctx.status('error', truncate(text, 160))
  }

  private async startFresh(): Promise<void> {
    this.ctx.notice('resumeFailed')
    this.ctx.setSession(null, 0)
    await this.restartProcess()
    if (this.lastPrompt && (await this.start())) this.input?.push(userMessage(this.lastPrompt))
  }

  /** Ends a turn without a result from the SDK (forced stop, closed process). */
  private endTurnLocally(): void {
    this.ctx.endStreaming()
    this.closeOpenTools('error')
    this.turnActive = false
    if (this.interrupting) this.ctx.notice('stopped')
    this.interrupting = false
    this.ctx.status('sleeping')
  }

  private closeOpenTools(status: 'done' | 'error'): void {
    for (const [id, item] of this.toolItems) {
      if (item.status === 'running') {
        const next: ToolItem = { ...item, status }
        this.toolItems.set(id, next)
        this.ctx.update(next)
      }
    }
  }

  private scheduleIdle(): void {
    this.clearIdle()
    this.idleTimer = setTimeout(() => {
      if (!this.turnActive) void this.close()
    }, IDLE_SLEEP_MS)
  }

  private clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }
}

function userMessage(text: string): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }
}
