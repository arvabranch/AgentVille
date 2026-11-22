import type { CanUseTool, PermissionResult, PermissionRuleValue, PermissionUpdate } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'node:crypto'
import type { ChatItem, PermissionDetail, PermissionResponse, PermissionStatus, QuestionPrompt } from '@shared/types'
import type { AgentContext } from './AgentContext'
import type { AgentManager } from './AgentManager'
import type { PermissionGate } from './SessionManager'
import { displayPath, truncate } from './toolSummary'

type ToolOptions = Parameters<CanUseTool>[2]
type PermissionItem = Extract<ChatItem, { kind: 'permission' }>
type QuestionItem = Extract<ChatItem, { kind: 'question' }>

interface Pending {
  ctx: AgentContext
  requestId: string
  itemId: string
  kind: 'permission' | 'question'
  input: Record<string, unknown>
  rules: PermissionRuleValue[]
  resolve: (result: PermissionResult) => void
}

const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value))

export function ruleToString(rule: PermissionRuleValue): string {
  return rule.ruleContent ? `${rule.toolName}(${rule.ruleContent})` : rule.toolName
}

/**
 * Decides which rule "Always allow for this agent" saves. The SDK's own
 * suggestion wins; otherwise we pick the narrowest sensible rule.
 */
export function alwaysRulesFor(
  toolName: string,
  input: Record<string, unknown>,
  suggestions: PermissionUpdate[] | undefined
): PermissionRuleValue[] {
  const suggested = (suggestions ?? []).flatMap((update) =>
    update.type === 'addRules' && update.behavior === 'allow' ? update.rules : []
  )
  if (suggested.length > 0) return suggested
  switch (toolName) {
    case 'Bash':
      return input['command'] ? [{ toolName: 'Bash', ruleContent: str(input['command']) }] : []
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      // Any edit inside the agent's own project folder.
      return [{ toolName: 'Edit', ruleContent: '/**' }]
    case 'WebFetch': {
      try {
        return [{ toolName: 'WebFetch', ruleContent: `domain:${new URL(str(input['url'])).hostname}` }]
      } catch {
        return []
      }
    }
    default:
      return [{ toolName }]
  }
}

function describe(toolName: string, input: Record<string, unknown>, cwd: string): PermissionDetail {
  switch (toolName) {
    case 'Bash':
      return { kind: 'command', command: str(input['command']), description: str(input['description']) || undefined }
    case 'Edit':
    case 'MultiEdit': {
      const edits = Array.isArray(input['edits'])
        ? (input['edits'] as Array<Record<string, unknown>>)
        : [{ old_string: input['old_string'], new_string: input['new_string'] }]
      const preview = edits
        .map((edit) => {
          const before = str(edit['old_string']).split('\n').map((line) => `- ${line}`)
          const after = str(edit['new_string']).split('\n').map((line) => `+ ${line}`)
          return [...before, ...after].join('\n')
        })
        .join('\n…\n')
      return { kind: 'file', action: 'edit', path: displayPath(input['file_path'], cwd), preview: truncate(preview, 3000) }
    }
    case 'Write':
      return {
        kind: 'file',
        action: 'write',
        path: displayPath(input['file_path'], cwd),
        preview: truncate(str(input['content']).split('\n').slice(0, 60).join('\n'), 3000)
      }
    case 'NotebookEdit':
      return { kind: 'file', action: 'edit', path: displayPath(input['notebook_path'], cwd), preview: truncate(str(input['new_source']), 3000) }
    case 'Read':
      return { kind: 'file', action: 'read', path: displayPath(input['file_path'], cwd) }
    case 'WebFetch':
      return { kind: 'fetch', url: str(input['url']) }
    default:
      return { kind: 'generic', input: truncate(JSON.stringify(input, null, 2), 3000) }
  }
}

function parseQuestions(raw: unknown): QuestionPrompt[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 4).map((entry: unknown) => {
    const q = (entry ?? {}) as Record<string, unknown>
    const options = Array.isArray(q['options']) ? (q['options'] as Array<Record<string, unknown>>) : []
    return {
      question: str(q['question']),
      header: q['header'] ? str(q['header']) : undefined,
      multiSelect: q['multiSelect'] === true,
      options: options.slice(0, 6).map((option) => ({
        label: str(option['label']),
        description: option['description'] ? str(option['description']) : undefined
      }))
    }
  })
}

/**
 * Bridges the SDK's `canUseTool` callback and the approval cards in the chat.
 * Each request waits (the agent shows "!") until the user decides, the turn
 * is stopped, or the agent goes to sleep.
 */
export class PermissionBroker implements PermissionGate {
  private readonly pending = new Map<string, Pending>()

  constructor(private readonly agents: AgentManager) {}

  request = async (ctx: AgentContext, toolName: string, input: Record<string, unknown>, opts: ToolOptions): Promise<PermissionResult> => {
    const requestId = opts.requestId || opts.toolUseID || randomUUID()
    let itemId: string
    let rules: PermissionRuleValue[] = []

    if (toolName === 'AskUserQuestion') {
      const item = ctx.append({ kind: 'question', requestId, questions: parseQuestions(input['questions']), status: 'pending' })
      itemId = item.id
    } else {
      rules = opts.suppressAlwaysAllowRule ? [] : alwaysRulesFor(toolName, input, opts.suggestions)
      const item = ctx.append({
        kind: 'permission',
        requestId,
        toolName,
        detail: describe(toolName, input, ctx.agent.folder),
        reason: opts.decisionReason || undefined,
        alwaysRule: rules.length > 0 ? rules.map(ruleToString).join(', ') : undefined,
        status: 'pending'
      })
      itemId = item.id
    }
    ctx.status('attention')

    return new Promise<PermissionResult>((resolve) => {
      this.pending.set(requestId, {
        ctx,
        requestId,
        itemId,
        kind: toolName === 'AskUserQuestion' ? 'question' : 'permission',
        input,
        rules,
        resolve
      })
      opts.signal.addEventListener(
        'abort',
        () => this.finish(requestId, 'cancelled', { behavior: 'deny', message: 'The request was cancelled.' }),
        { once: true }
      )
    })
  }

  respond = (agentId: string, response: PermissionResponse): void => {
    const entry = this.pending.get(response.requestId)
    if (!entry || entry.ctx.agentId !== agentId) return

    switch (response.decision) {
      case 'allow':
        this.finish(entry.requestId, 'allowed', { behavior: 'allow', updatedInput: entry.input })
        break
      case 'allowAlways': {
        const saved = entry.rules.map(ruleToString)
        const agent = this.agents.has(agentId) ? this.agents.get(agentId) : null
        if (agent && saved.length > 0) {
          this.agents.update(agentId, { allowRules: [...new Set([...agent.allowRules, ...saved])] })
        }
        this.finish(entry.requestId, 'allowedAlways', {
          behavior: 'allow',
          updatedInput: entry.input,
          updatedPermissions:
            entry.rules.length > 0 ? [{ type: 'addRules', rules: entry.rules, behavior: 'allow', destination: 'session' }] : undefined
        })
        break
      }
      case 'deny':
        this.finish(entry.requestId, 'denied', {
          behavior: 'deny',
          message: response.message?.trim() || 'The user denied this action. Ask before trying something similar.'
        })
        break
      case 'answer':
        this.finish(
          entry.requestId,
          'answered',
          { behavior: 'allow', updatedInput: { questions: entry.input['questions'], answers: response.answers } },
          response.answers
        )
        break
      case 'dismiss':
        this.finish(entry.requestId, 'dismissed', { behavior: 'deny', message: 'The user preferred not to answer.' })
        break
    }
  }

  /** Cancels everything an agent is waiting on (Stop, sleep, removal). */
  cancel = (agentId: string): void => {
    for (const entry of [...this.pending.values()]) {
      if (entry.ctx.agentId === agentId) {
        this.finish(entry.requestId, 'cancelled', { behavior: 'deny', message: 'The request was cancelled.', interrupt: true })
      }
    }
  }

  private finish(
    requestId: string,
    status: PermissionStatus | 'answered' | 'dismissed',
    result: PermissionResult,
    answers?: Record<string, string>
  ): void {
    const entry = this.pending.get(requestId)
    if (!entry) return
    this.pending.delete(requestId)

    const item = entry.ctx.find(entry.itemId)
    if (item?.kind === 'permission' && status !== 'answered' && status !== 'dismissed') {
      entry.ctx.update({ ...item, status } satisfies PermissionItem)
    } else if (item?.kind === 'question') {
      const questionStatus: QuestionItem['status'] =
        status === 'answered' ? 'answered' : status === 'cancelled' ? 'cancelled' : 'dismissed'
      entry.ctx.update({ ...item, status: questionStatus, answers } satisfies QuestionItem)
    }

    const stillWaiting = [...this.pending.values()].some((other) => other.ctx.agentId === entry.ctx.agentId)
    if (!stillWaiting && status !== 'cancelled' && entry.ctx.alive && entry.ctx.agent.status === 'attention') {
      entry.ctx.status('working')
    }
    entry.resolve(result)
  }
}
