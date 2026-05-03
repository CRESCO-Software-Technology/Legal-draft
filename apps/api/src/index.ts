import { buildApp } from './app.js'
import './workers/index.js'  // start BullMQ workers
import { startCollabServer } from './lib/collab-server.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

const app = await buildApp()

// P10C — start the Hocuspocus WebSocket server on its own port (3002 by
// default). Disabled if COLLAB_DISABLED=1 (e.g. for tests).
if (process.env.COLLAB_DISABLED !== '1') {
  startCollabServer()
}

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`API listening on http://${HOST}:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
