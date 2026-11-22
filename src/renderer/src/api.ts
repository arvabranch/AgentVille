import type { AgentVilleApi } from '@shared/ipc'

/** Typed handle to the preload bridge (`window.agentville`). */
export const api: AgentVilleApi = window.agentville
