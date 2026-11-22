/// <reference types="vite/client" />
import type { AgentVilleApi } from '@shared/ipc'

declare global {
  interface Window {
    agentville: AgentVilleApi
  }
}

export {}
