import type { PermissionGate } from './SessionManager'

/** Placeholder gate: denies every tool call that would need the user's approval. */
export const noApprovals: PermissionGate = {
  request: async (ctx, toolName) => {
    ctx.notice('permissionUnavailable', toolName)
    return { behavior: 'deny', message: 'Tool approvals are not available in this build of AgentVille yet.' }
  },
  respond: () => undefined,
  cancel: () => undefined
}
