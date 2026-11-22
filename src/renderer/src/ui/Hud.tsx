import { DESK_COUNT } from '@shared/constants'
import { useT } from '../i18n'
import { useAppStore } from '../state/store'
import { formatUsd } from './format'
import { Icon } from './Icon'

export function Hud(): React.JSX.Element {
  const t = useT()
  const info = useAppStore((s) => s.info)
  const agents = useAppStore((s) => s.agents)
  const openModal = useAppStore((s) => s.openModal)
  const isMac = window.agentville.platform === 'darwin'
  const totalCost = agents.reduce((sum, agent) => sum + agent.usage.costUsd, 0)
  const full = agents.length >= DESK_COUNT

  return (
    <header className={`hud${isMac ? ' hud-mac' : ''}`}>
      <div className="hud-brand">
        <span className="hud-logo" aria-hidden="true" />
        <span className="brand">AgentVille</span>
        {info?.mockMode && <span className="badge badge-warn">{info.demoMode ? t('hud.demo') : t('hud.mock')}</span>}
      </div>

      <div className="hud-hint">{agents.length === 0 ? t('world.empty') : t('hud.hint')}</div>

      <div className="hud-actions">
        {totalCost > 0 && (
          <span className="hud-stat" title={t('hud.totalCost')}>
            {formatUsd(totalCost)}
          </span>
        )}
        <span className="hud-stat">{t('hud.desks', { used: agents.length, total: DESK_COUNT })}</span>
        <button
          className="btn btn-primary"
          onClick={() => openModal('newAgent')}
          disabled={full}
          title={full ? t('newAgent.full') : undefined}
        >
          <Icon name="plus" />
          {t('hud.newAgent')}
        </button>
        <button className="btn btn-icon" onClick={() => openModal('settings')} title={t('hud.settings')} aria-label={t('hud.settings')}>
          <Icon name="gear" size={18} />
        </button>
      </div>
    </header>
  )
}
