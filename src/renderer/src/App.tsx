import { useEffect, useState } from 'react'
import { api } from './api'
import { ChatPanel } from './chat/ChatPanel'
import { gameBridge } from './game/bridge'
import { GameCanvas } from './game/GameCanvas'
import { useAppStore } from './state/store'
import { Hud } from './ui/Hud'
import { HudAlerts } from './ui/HudAlerts'
import { NewAgentDialog } from './ui/NewAgentDialog'
import { Onboarding } from './ui/Onboarding'
import { SettingsDialog } from './ui/SettingsDialog'
import { Toasts } from './ui/Toasts'

function useBootstrap(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const store = useAppStore.getState()
    const offs = [
      api.on('agents:changed', (agents) => useAppStore.getState().setAgents(agents)),
      api.on('chat:event', (event) => useAppStore.getState().applyChatEvent(event)),
      api.on('key:changed', (status) => useAppStore.getState().setKeyStatus(status)),
      api.on('ui:openAgent', (agentId) => useAppStore.getState().openChat(agentId))
    ]

    void Promise.all([
      api.invoke('app:getInfo'),
      api.invoke('agents:list'),
      api.invoke('world:getPlayer'),
      api.invoke('key:status'),
      api.invoke('settings:get')
    ]).then(([info, agents, player, keyStatus, settings]) => {
      store.setInfo(info)
      store.setAgents(agents)
      store.setKeyStatus(keyStatus)
      store.setSettings(settings)
      gameBridge.initialPlayer = player
      gameBridge.onPlayerMoved = (next) => void api.invoke('world:savePlayer', next)
      // Dev-only screenshot scenarios, e.g. "chat" or "chat:Hedy".
      const [scenario, scenarioAgent] = (info.scenario ?? '').split(':')
      if (scenario === 'chat') {
        const target =
          agents.find((agent) => agent.name === scenarioAgent) ??
          agents.find((agent) => agent.status === 'sleeping' && !agent.unread) ??
          agents[0]
        if (target) store.openChat(target.id)
      }
      if (scenario === 'settings') store.openModal('settings')
      setReady(true)
    })

    return () => offs.forEach((off) => off())
  }, [])

  return ready
}

export function App(): React.JSX.Element {
  const ready = useBootstrap()
  const modal = useAppStore((s) => s.modal)
  const info = useAppStore((s) => s.info)
  const keyStatus = useAppStore((s) => s.keyStatus)
  const openAgent = useAppStore((s) => s.agents.find((agent) => agent.id === s.openAgentId) ?? null)
  const needsOnboarding = ready && !info?.mockMode && keyStatus !== null && !keyStatus.hasKey

  useEffect(() => {
    useAppStore.setState({ onboarding: needsOnboarding })
  }, [needsOnboarding])

  return (
    <div className="app">
      {ready && <GameCanvas />}
      <Hud />
      <HudAlerts />
      {openAgent && <ChatPanel key={openAgent.id} agent={openAgent} />}
      {modal === 'newAgent' && <NewAgentDialog />}
      {modal === 'settings' && <SettingsDialog />}
      {needsOnboarding && modal === null && <Onboarding />}
      <Toasts />
    </div>
  )
}
