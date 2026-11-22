import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AgentView, ChatItem } from '@shared/types'
import { api } from '../api'
import { useT } from '../i18n'
import { useAppStore } from '../state/store'
import { baseName, formatUsd } from '../ui/format'
import { Icon } from '../ui/Icon'
import { CHAT_PANEL_WIDTH } from '../ui/layout'
import { StatusPill } from '../ui/StatusPill'
import { ChatItemView } from './ChatItemView'
import { Composer } from './Composer'

const EMPTY: ChatItem[] = []

export function ChatPanel({ agent }: { agent: AgentView }): React.JSX.Element {
  const t = useT()
  const closeChat = useAppStore((s) => s.closeChat)
  const setChat = useAppStore((s) => s.setChat)
  const loaded = useAppStore((s) => agent.id in s.chats)
  const items = useAppStore((s) => s.chats[agent.id] ?? EMPTY)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const [drawer, setDrawer] = useState<'none' | 'rules' | 'remove'>('none')
  const toast = useAppStore((s) => s.toast)
  const toggle = (next: 'rules' | 'remove'): void => setDrawer((current) => (current === next ? 'none' : next))

  const removeAgent = async (): Promise<void> => {
    await api.invoke('agents:remove', agent.id)
    toast(t('chat.removed', { name: agent.name }))
    closeChat()
  }

  const removeRule = (rule: string): void => {
    void api.invoke(
      'agents:setAllowRules',
      agent.id,
      agent.allowRules.filter((r) => r !== rule)
    )
  }

  useEffect(() => {
    if (loaded) return
    void api.invoke('chat:history', agent.id).then((history) => setChat(agent.id, history))
  }, [agent.id, loaded, setChat])

  // Opening the panel (or receiving a reply while it is open) marks it as read.
  useEffect(() => {
    if (agent.unread) void api.invoke('agents:markRead', agent.id)
  }, [agent.id, agent.unread])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && useAppStore.getState().modal === null) closeChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeChat])

  // Follow new content unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [items])

  const onScroll = (): void => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const streaming = items.some((item) => item.kind === 'assistant' && item.streaming)

  return (
    <aside className="chat-panel" style={{ width: CHAT_PANEL_WIDTH - 24 }}>
      <header className="chat-header">
        <div className="chat-title">
          <h2>{agent.name}</h2>
          <button className="chat-folder" title={agent.folder} onClick={() => void api.invoke('app:revealFolder', agent.folder)}>
            <Icon name="folder" size={13} />
            {baseName(agent.folder)}
          </button>
        </div>
        <div className="chat-header-meta">
          <StatusPill agent={agent} />
          {agent.usage.costUsd > 0 && (
            <span className="chat-total" title={t('chat.agentTotal')}>
              {formatUsd(agent.usage.costUsd)}
            </span>
          )}
        </div>
        <div className="chat-tools">
          <button
            className={`btn btn-icon btn-ghost${drawer === 'rules' ? ' active' : ''}`}
            onClick={() => toggle('rules')}
            title={t('rules.title')}
            aria-label={t('rules.title')}
          >
            <Icon name="shield" />
            {agent.allowRules.length > 0 && <span className="tool-count">{agent.allowRules.length}</span>}
          </button>
          <button
            className={`btn btn-icon btn-ghost${drawer === 'remove' ? ' active' : ''}`}
            onClick={() => toggle('remove')}
            title={t('chat.remove')}
            aria-label={t('chat.remove')}
          >
            <Icon name="trash" />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={closeChat} aria-label={t('common.close')}>
            <Icon name="close" />
          </button>
        </div>
      </header>

      {drawer === 'rules' && (
        <div className="chat-drawer">
          <h4>{t('rules.title')}</h4>
          {agent.allowRules.length === 0 ? (
            <p className="muted">{t('rules.empty')}</p>
          ) : (
            <ul className="rule-list">
              {agent.allowRules.map((rule) => (
                <li key={rule}>
                  <code>{rule}</code>
                  <button className="btn btn-icon btn-ghost btn-small" onClick={() => removeRule(rule)} aria-label={t('common.delete')}>
                    <Icon name="close" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="drawer-hint">{t('rules.hint')}</p>
        </div>
      )}

      {drawer === 'remove' && (
        <div className="chat-drawer chat-drawer-danger">
          <p>{t('chat.removeConfirm', { name: agent.name })}</p>
          <div className="settings-actions">
            <button className="btn btn-small btn-ghost" onClick={() => setDrawer('none')}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-small btn-danger" data-action="remove-agent" onClick={() => void removeAgent()}>
              {t('common.delete')}
            </button>
          </div>
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {loaded && items.length === 0 && (
          <div className="chat-empty">{t('chat.empty', { name: agent.name, folder: baseName(agent.folder) })}</div>
        )}
        {items.map((item) => (
          <ChatItemView key={item.id} item={item} agent={agent} />
        ))}
        {agent.status === 'working' && !streaming && (
          <div className="typing">
            <span />
            <span />
            <span />
            {t('chat.thinking', { name: agent.name })}
          </div>
        )}
      </div>

      <Composer agent={agent} />
    </aside>
  )
}
