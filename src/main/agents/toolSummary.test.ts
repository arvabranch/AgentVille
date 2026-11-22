import { describe, expect, it } from 'vitest'
import { displayPath, summarizeTool, toolResultText, truncate } from './toolSummary'

describe('toolSummary', () => {
  it('shows paths relative to the agent folder', () => {
    expect(displayPath('/work/app/src/index.ts', '/work/app')).toBe('src/index.ts')
    expect(displayPath('/etc/hosts', '/work/app')).toBe('/etc/hosts')
  })

  it('summarizes common tools', () => {
    expect(summarizeTool('Bash', { command: 'npm test' }, '/p')).toBe('npm test')
    expect(summarizeTool('Edit', { file_path: '/p/a.ts' }, '/p')).toBe('a.ts')
    expect(summarizeTool('Grep', { pattern: 'TODO', path: '/p/src' }, '/p')).toBe('TODO · src')
    expect(summarizeTool('WebFetch', { url: 'https://example.com' }, '/p')).toBe('https://example.com')
    expect(summarizeTool('mcp__x__y', {}, '/p')).toBe('')
  })

  it('extracts text from tool results', () => {
    expect(toolResultText('plain')).toBe('plain')
    expect(toolResultText([{ type: 'text', text: 'a' }, { type: 'image' }])).toBe('a\n[image]')
    expect(toolResultText(undefined)).toBe('')
  })

  it('truncates long text with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 4)).toBe('abc')
  })
})
