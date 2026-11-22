import { app } from 'electron'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { AgentStatus } from '@shared/types'
import type { AgentManager } from './agents/AgentManager'
import { log } from './log'

interface DemoAgent {
  name: string
  folder: string
  status: AgentStatus
  unread?: boolean
  statusDetail?: string
}

const DEMO_AGENTS: DemoAgent[] = [
  { name: 'Ada', folder: 'web-shop', status: 'working' },
  { name: 'Linus', folder: 'kernel-tools', status: 'attention' },
  { name: 'Grace', folder: 'compiler', status: 'sleeping', unread: true },
  { name: 'Hedy', folder: 'radio-app', status: 'sleeping' },
  { name: 'Alan', folder: 'ml-notebooks', status: 'error', statusDetail: 'Rate limited' },
  { name: 'Margaret', folder: 'apollo-guidance', status: 'working' },
  { name: 'Ken', folder: 'unix-utils', status: 'sleeping' }
]

/** Dev-only: fills a throwaway data folder with a lively town for screenshots. */
export async function seedDemoTown(agents: AgentManager): Promise<void> {
  if (agents.list().length > 0) return
  const base = path.join(app.getPath('userData'), 'demo-projects')
  await rm(base, { recursive: true, force: true })
  for (const demo of DEMO_AGENTS) {
    const folder = path.join(base, demo.folder)
    await mkdir(folder, { recursive: true })
    const agent = await agents.create({ name: demo.name, folder })
    agents.update(agent.id, {
      status: demo.status,
      unread: demo.unread ?? false,
      statusDetail: demo.statusDetail
    })
  }
  log.info(`Demo town seeded with ${DEMO_AGENTS.length} agents`)
}
