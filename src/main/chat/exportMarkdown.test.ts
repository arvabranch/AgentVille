import { describe, expect, it } from 'vitest'
import type { AgentView, ChatItem } from '@shared/types'
import { chatToMarkdown, exportFileName } from './exportMarkdown'

const agent = {
  id: 'a1',
  name: 'Ada Lovelace',
  folder: '/work/engine',
  sessionId: 'sess-1',
  usage: { costUsd: 0.1234, inputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 1 }
} as AgentView

const items: ChatItem[] = [
  { id: '1', ts: 0, kind: 'user', text: 'Hi' },
  { id: '2', ts: 0, kind: 'assistant', text: 'Hello **there**' },
  { id: '3', ts: 0, kind: 'tool', toolName: 'Bash', summary: 'echo `x`', status: 'done', output: 'has ``` inside' },
  {
    id: '4',
    ts: 0,
    kind: 'permission',
    requestId: 'r',
    toolName: 'Bash',
    detail: { kind: 'command', command: 'rm -rf build' },
    status: 'denied'
  },
  { id: '5', ts: 0, kind: 'result', isError: false, usage: { costUsd: 0.01, inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, durationMs: 1500 } }
]

describe('chatToMarkdown', () => {
  it('includes metadata, messages, tools and costs', () => {
    const md = chatToMarkdown(agent, items, 'en')
    expect(md).toContain('# Chat with Ada Lovelace')
    expect(md).toContain('`/work/engine`')
    expect(md).toContain('Hello **there**')
    expect(md).toContain('→ denied')
    expect(md).toContain('_$0.010 · 1 in · 2 out · 1.5s_')
    expect(md).toContain('$0.123 (1 replies')
  })

  it('uses a longer fence when the output contains backticks', () => {
    const md = chatToMarkdown(agent, items, 'en')
    expect(md).toContain('````\nhas ``` inside\n````')
  })

  it('translates labels', () => {
    expect(chatToMarkdown(agent, items, 'es')).toContain('# Chat con Ada Lovelace')
  })

  it('builds a safe file name', () => {
    expect(exportFileName(agent)).toMatch(/^Ada-Lovelace-chat-\d{4}-\d{2}-\d{2}\.md$/)
  })
})
