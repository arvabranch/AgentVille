import { useT } from '../i18n'
import { useAppStore } from '../state/store'

/** Pills under the HUD for agents that need you, so you never miss one off-screen. */
export function HudAlerts(): React.JSX.Element | null {
  const t = useT()
  const agents = useAppStore((s) => s.agents)
  const openAgentId = useAppStore((s) => s.openAgentId)
  const openChat = useAppStore((s) => s.openChat)
  const alerts = agents.filter(
    (agent) => agent.id !== openAgentId && (agent.status === 'attention' || agent.status === 'error' || agent.unread)
  )
  if (alerts.length === 0) return null

  return (
    <div className="hud-alerts">
      {alerts.map((agent) => {
        const tone = agent.status === 'attention' ? 'attention' : agent.status === 'error' ? 'error' : 'unread'
        const label =
          tone === 'attention' ? t('status.attention') : tone === 'error' ? t('status.error') : t('status.unread')
        return (
          <button key={agent.id} className={`hud-alert hud-alert-${tone}`} onClick={() => openChat(agent.id)}>
            <span className="status-dot" />
            <strong>{agent.name}</strong>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
