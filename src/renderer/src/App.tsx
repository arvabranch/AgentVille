import { useEffect, useState } from 'react'
import { api } from './api'
import { ChatPanel } from './chat/ChatPanel'
import { gameBridge } from './game/bridge'
import { GameCanvas } from './game/GameCanvas'
import { useAppStore } from './state/store'
import { Hud } from './ui/Hud'
import { NewAgentDialog } from './ui/NewAgentDialog'
import { Toasts } from './ui/Toasts'

function useBootstrap(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const store = useAppStore.getState()
    const offAgents = api.on('agents:changed', (agents) => useAppStore.getState().setAgents(agents))

    void Promise.all([api.invoke('app:getInfo'), api.invoke('agents:list'), api.invoke('world:getPlayer')]).then(
      ([info, agents, player]) => {
        store.setInfo(info)
        store.setAgents(agents)
        gameBridge.initialPlayer = player
        gameBridge.onPlayerMoved = (next) => void api.invoke('world:savePlayer', next)
        if (info.scenario === 'chat') {
          const target = agents.find((agent) => agent.status === 'attention') ?? agents[0]
          if (target) store.openChat(target.id)
        }
        setReady(true)
      }
    )

    return () => {
      offAgents()
    }
  }, [])

  return ready
}

export function App(): React.JSX.Element {
  const ready = useBootstrap()
  const modal = useAppStore((s) => s.modal)
  const openAgent = useAppStore((s) => s.agents.find((agent) => agent.id === s.openAgentId) ?? null)

  return (
    <div className="app">
      {ready && <GameCanvas />}
      <Hud />
      {openAgent && <ChatPanel key={openAgent.id} agent={openAgent} />}
      {modal === 'newAgent' && <NewAgentDialog />}
      <Toasts />
    </div>
  )
}
