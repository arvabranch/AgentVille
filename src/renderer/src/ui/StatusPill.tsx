import type { AgentView } from '@shared/types'
import { useT } from '../i18n'

export function StatusPill({ agent }: { agent: AgentView }): React.JSX.Element {
  const t = useT()
  const key =
    agent.status === 'sleeping' && agent.unread
      ? 'status.unread'
      : (`status.${agent.status}` as const)
  return (
    <span className={`status-pill status-${agent.unread && agent.status === 'sleeping' ? 'unread' : agent.status}`}>
      <span className="status-dot" />
      {t(key)}
    </span>
  )
}
