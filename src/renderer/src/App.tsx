import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/types'
import { api } from './api'

export function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let alive = true
    void api.invoke('app:getInfo').then((result) => {
      if (alive) setInfo(result)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="splash">
      <h1 className="brand">AgentVille</h1>
      <p className="muted">
        {info ? `v${info.version} · ${info.platform}${info.mockMode ? ' · mock' : ''}` : '…'}
      </p>
    </main>
  )
}
