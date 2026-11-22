import { describe, expect, it } from 'vitest'
import { redact } from './log'

describe('redact', () => {
  it('hides Anthropic API keys anywhere in a message', () => {
    const key = `sk-ant-api03-${'a'.repeat(40)}`
    expect(redact(`failed with ${key} :(`)).toBe('failed with sk-ant-*** :(')
    expect(redact(`ANTHROPIC_API_KEY=${key}`)).not.toContain('aaaa')
  })

  it('leaves normal text alone', () => {
    expect(redact('nothing secret here')).toBe('nothing secret here')
  })
})
