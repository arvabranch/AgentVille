import { useEffect, useRef, useState } from 'react'
import { MAX_MESSAGE_CHARS } from '@shared/constants'
import type { AgentView } from '@shared/types'
import { api } from '../api'
import { useT } from '../i18n'
import { useAppStore } from '../state/store'
import { Icon } from '../ui/Icon'

const drafts = new Map<string, string>()

export function Composer({ agent }: { agent: AgentView }): React.JSX.Element {
  const t = useT()
  const info = useAppStore((s) => s.info)
  const keyStatus = useAppStore((s) => s.keyStatus)
  const openModal = useAppStore((s) => s.openModal)
  const [text, setText] = useState(() => drafts.get(agent.id) ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)

  const busy = agent.status === 'working' || agent.status === 'attention'
  const needsKey = !info?.mockMode && !keyStatus?.hasKey

  useEffect(() => {
    drafts.set(agent.id, text)
  }, [agent.id, text])

  useEffect(() => {
    ref.current?.focus()
  }, [agent.id])

  // Grow with the content, up to a limit.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [text])

  const send = (): void => {
    const message = text.trim()
    if (!message || busy || needsKey) return
    void api.invoke('chat:send', agent.id, message.slice(0, MAX_MESSAGE_CHARS))
    setText('')
  }

  const stop = (): void => {
    void api.invoke('chat:stop', agent.id)
  }

  if (needsKey) {
    return (
      <div className="composer composer-locked">
        <Icon name="key" />
        <span>{t('chat.needsKey', { name: agent.name })}</span>
        <button className="btn btn-small btn-primary" onClick={() => openModal('settings')}>
          {t('chat.openSettings')}
        </button>
      </div>
    )
  }

  return (
    <div className="composer">
      <textarea
        ref={ref}
        value={text}
        rows={1}
        placeholder={t('chat.placeholder', { name: agent.name })}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send()
          }
        }}
      />
      {busy ? (
        <button className="btn btn-danger composer-btn" onClick={stop} title={t('chat.stop')}>
          <Icon name="stop" />
          {t('chat.stop')}
        </button>
      ) : (
        <button className="btn btn-primary composer-btn" onClick={send} disabled={!text.trim()} title={t('chat.send')}>
          <Icon name="send" />
          {t('chat.send')}
        </button>
      )}
    </div>
  )
}
