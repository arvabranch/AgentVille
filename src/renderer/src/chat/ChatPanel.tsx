import { useEffect } from 'react'
import type { AgentView } from '@shared/types'
import { api } from '../api'
import { useT } from '../i18n'
import { useAppStore } from '../state/store'
import { baseName } from '../ui/format'
import { Icon } from '../ui/Icon'
import { CHAT_PANEL_WIDTH } from '../ui/layout'
import { StatusPill } from '../ui/StatusPill'

export function ChatPanel({ agent }: { agent: AgentView }): React.JSX.Element {
  const t = useT()
  const closeChat = useAppStore((s) => s.closeChat)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && useAppStore.getState().modal === null) closeChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeChat])

  return (
    <aside className="chat-panel" style={{ width: CHAT_PANEL_WIDTH - 24 }}>
      <header className="chat-header">
        <div className="chat-title">
          <h2>{agent.name}</h2>
          <button
            className="chat-folder"
            title={agent.folder}
            onClick={() => void api.invoke('app:revealFolder', agent.folder)}
          >
            <Icon name="folder" size={13} />
            {baseName(agent.folder)}
          </button>
        </div>
        <StatusPill agent={agent} />
        <button className="btn btn-icon btn-ghost" onClick={closeChat} aria-label={t('common.close')}>
          <Icon name="close" />
        </button>
      </header>

      <div className="chat-scroll">
        <div className="chat-empty">{t('chat.empty', { name: agent.name, folder: baseName(agent.folder) })}</div>
      </div>
    </aside>
  )
}
