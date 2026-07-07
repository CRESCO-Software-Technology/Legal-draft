/**
 * CollabStatusBadge (P10C) — collaboration-server connection indicator.
 *
 * Wave 2.4 (2026-07): the Hocuspocus server now DURABLY PERSISTS each
 * contract's Y.Doc (server onLoadDocument/onStoreDocument → collab_states),
 * verified end-to-end. What is NOT yet wired is the in-editor Collaboration
 * binding (live multi-cursor co-editing), which is deliberately deferred
 * because it's high-blast-radius surgery on the single-user editor and needs
 * multi-browser QA. So this badge honestly shows the connection state to the
 * collaboration server — it does NOT claim live co-editing ("Live") that isn't
 * happening yet.
 */
import { useCollabProvider } from '@/lib/collab'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export function CollabStatusBadge({ contractId }: { contractId: string }) {
  const collab = useCollabProvider(contractId)
  if (!collab) return null

  const { status } = collab
  const config = {
    connecting:   { icon: Loader2,  cls: 'text-amber-700 bg-amber-50 border-amber-200',      label: 'Connecting…', spin: true  },
    connected:    { icon: Wifi,     cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Sync on',     spin: false },
    disconnected: { icon: WifiOff,  cls: 'text-gray-600 bg-gray-100 border-gray-200',         label: 'Offline',     spin: false },
  }[status]
  const Icon = config.icon

  return (
    <span
      data-testid="collab-status-badge"
      title={
        status === 'connected'
          ? 'Connected to the collaboration server — document changes are persisted. Live multi-cursor co-editing is rolling out.'
          : `Collaboration server: ${config.label}`
      }
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${config.cls}`}
    >
      <Icon className={`h-3 w-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  )
}
