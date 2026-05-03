/**
 * collab-server.ts (Phase 10C — real-time collab).
 *
 * Runs a Hocuspocus (Yjs-backed) WebSocket server on a dedicated port
 * (default 3002). Clients connect at ws://localhost:3002 with the
 * document name `contract:<id>` and a JWT token in the connection
 * params for tenant isolation + cursor presence.
 *
 * Auto-starts on import via startCollabServer(). The HTML content
 * still persists via the editor's existing PATCH-on-save flow; this
 * server only carries live ops between concurrent editors.
 */
import { Server } from '@hocuspocus/server'
import { verifyToken } from './jwt.js'
import { prisma } from './prisma.js'

const PORT = Number(process.env.COLLAB_PORT ?? 3030)

let server: Server | null = null

export function startCollabServer(): Server {
  if (server) return server
  server = new Server({
    port: PORT,
    name: 'clm-collab',

    async onAuthenticate({ token, documentName }) {
      if (!token) throw new Error('Missing token')
      let payload
      try { payload = verifyToken(token) }
      catch { throw new Error('Invalid token') }
      if (payload.type !== 'access') throw new Error('Wrong token type')

      const contractId = documentName.startsWith('contract:')
        ? documentName.slice('contract:'.length)
        : null
      if (!contractId) throw new Error('Bad document name')

      // Tenant check: the contract must live in the user's org.
      const c = await prisma.contract.findFirst({
        where: { id: contractId, orgId: payload.orgId, deletedAt: null },
        select: { id: true },
      })
      if (!c) throw new Error('Contract not found in your org')

      return { user: { id: payload.sub, orgId: payload.orgId } }
    },
  })

  server.listen()
    .then(() => console.info('[collab] Hocuspocus listening on :%d', PORT))
    .catch(err => console.error('[collab] failed to start:', err))

  return server
}
