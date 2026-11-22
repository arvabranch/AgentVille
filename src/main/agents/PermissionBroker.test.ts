import { describe, expect, it, vi } from 'vitest'
import type { ChatItem } from '@shared/types'
import type { AgentContext } from './AgentContext'
import type { AgentManager, AgentRecord } from './AgentManager'
import { alwaysRulesFor, PermissionBroker, ruleToString } from './PermissionBroker'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

describe('alwaysRulesFor', () => {
  it('prefers the SDK suggestion', () => {
    const rules = alwaysRulesFor('Bash', { command: 'npm test -- --watch' }, [
      { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' }
    ])
    expect(rules.map(ruleToString)).toEqual(['Bash(npm test:*)'])
  })

  it('falls back to the exact command for Bash', () => {
    expect(alwaysRulesFor('Bash', { command: 'ls -la' }, undefined).map(ruleToString)).toEqual(['Bash(ls -la)'])
  })

  it('limits file edits to the project folder', () => {
    expect(alwaysRulesFor('Write', { file_path: '/p/a.ts' }, []).map(ruleToString)).toEqual(['Edit(/**)'])
  })

  it('scopes web fetches to a domain', () => {
    expect(alwaysRulesFor('WebFetch', { url: 'https://docs.example.com/x' }, []).map(ruleToString)).toEqual([
      'WebFetch(domain:docs.example.com)'
    ])
  })
})

function fakeContext(): { ctx: AgentContext; items: ChatItem[]; statuses: string[]; agent: AgentRecord } {
  const items: ChatItem[] = []
  const statuses: string[] = []
  const agent = { id: 'a1', folder: '/p', allowRules: [] as string[], status: 'working' } as unknown as AgentRecord
  const ctx = {
    agentId: 'a1',
    alive: true,
    get agent() {
      return agent
    },
    append: (item: Omit<ChatItem, 'id' | 'ts'> & { id?: string }) => {
      const full = { ...item, id: item.id ?? `i${items.length}`, ts: 0 } as ChatItem
      items.push(full)
      return full
    },
    update: (item: ChatItem) => {
      const index = items.findIndex((i) => i.id === item.id)
      if (index >= 0) items[index] = item
    },
    find: (id: string) => items.find((i) => i.id === id),
    status: (status: string) => {
      statuses.push(status)
      ;(agent as { status: string }).status = status
    }
  } as unknown as AgentContext
  return { ctx, items, statuses, agent }
}

describe('PermissionBroker', () => {
  it('waits for the user and saves "always allow" rules on the agent', async () => {
    const { ctx, items, statuses, agent } = fakeContext()
    const update = vi.fn((_id: string, patch: Partial<AgentRecord>) => Object.assign(agent, patch))
    const agents = { has: () => true, get: () => agent, update } as unknown as AgentManager
    const broker = new PermissionBroker(agents)

    const pending = broker.request(ctx, 'Bash', { command: 'npm test' }, {
      signal: new AbortController().signal,
      toolUseID: 't1',
      requestId: 'r1'
    })
    expect(items[0]?.kind).toBe('permission')
    expect(statuses).toContain('attention')

    broker.respond('a1', { requestId: 'r1', decision: 'allowAlways' })
    const result = await pending
    expect(result.behavior).toBe('allow')
    expect(agent.allowRules).toEqual(['Bash(npm test)'])
    expect(items[0]?.kind === 'permission' && items[0].status).toBe('allowedAlways')
    expect(statuses.at(-1)).toBe('working')
  })

  it('denies and closes the card when the request is cancelled', async () => {
    const { ctx, items } = fakeContext()
    const broker = new PermissionBroker({ has: () => true } as unknown as AgentManager)
    const abort = new AbortController()
    const pending = broker.request(ctx, 'Write', { file_path: '/p/a.ts', content: 'x' }, {
      signal: abort.signal,
      toolUseID: 't2',
      requestId: 'r2'
    })
    abort.abort()
    const result = await pending
    expect(result.behavior).toBe('deny')
    expect(items[0]?.kind === 'permission' && items[0].status).toBe('cancelled')
  })

  it('answers clarifying questions with the chosen labels', async () => {
    const { ctx } = fakeContext()
    const broker = new PermissionBroker({ has: () => true } as unknown as AgentManager)
    const questions = [{ question: 'Which?', header: 'Pick', multiSelect: false, options: [{ label: 'A' }, { label: 'B' }] }]
    const pending = broker.request(ctx, 'AskUserQuestion', { questions }, {
      signal: new AbortController().signal,
      toolUseID: 't3',
      requestId: 'r3'
    })
    broker.respond('a1', { requestId: 'r3', decision: 'answer', answers: { 'Which?': 'B' } })
    const result = await pending
    expect(result.behavior === 'allow' && result.updatedInput).toEqual({ questions, answers: { 'Which?': 'B' } })
  })
})
