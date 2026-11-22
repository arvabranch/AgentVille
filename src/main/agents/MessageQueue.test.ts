import { describe, expect, it } from 'vitest'
import { MessageQueue } from './MessageQueue'

describe('MessageQueue', () => {
  it('delivers queued and later messages in order, then ends', async () => {
    const queue = new MessageQueue<number>()
    queue.push(1)
    const seen: number[] = []
    const reader = (async () => {
      for await (const value of queue) seen.push(value)
    })()
    queue.push(2)
    await Promise.resolve()
    queue.push(3)
    queue.end()
    await reader
    expect(seen).toEqual([1, 2, 3])
  })

  it('ignores pushes after end', async () => {
    const queue = new MessageQueue<string>()
    queue.end()
    queue.push('late')
    const iterator = queue[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: undefined, done: true })
  })
})
