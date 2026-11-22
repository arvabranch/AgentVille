/**
 * A push-based async iterable. The SDK reads user messages from it for as long
 * as the agent is awake (streaming input mode), which is what makes `interrupt()`
 * and follow-up messages possible.
 */
export class MessageQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = []
  private waiter: ((result: IteratorResult<T>) => void) | null = null
  private ended = false

  push(item: T): void {
    if (this.ended) return
    if (this.waiter) {
      const resolve = this.waiter
      this.waiter = null
      resolve({ value: item, done: false })
    } else {
      this.items.push(item)
    }
  }

  end(): void {
    this.ended = true
    if (this.waiter) {
      const resolve = this.waiter
      this.waiter = null
      resolve({ value: undefined, done: true })
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.items.shift()
        if (item !== undefined) return Promise.resolve({ value: item, done: false })
        if (this.ended) return Promise.resolve({ value: undefined, done: true })
        return new Promise((resolve) => {
          this.waiter = resolve
        })
      },
      return: () => {
        this.end()
        return Promise.resolve({ value: undefined, done: true })
      }
    }
  }
}
