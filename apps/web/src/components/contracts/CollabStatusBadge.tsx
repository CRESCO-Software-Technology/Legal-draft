/**
 * CollabStatusBadge (P10C) — small live-collab presence indicator.
 *
 * Connects to the Hocuspocus server on mount and shows a colored dot
 * for the connection state. This is intentionally minimal — the full
 * Y.Doc-bound editor swap-in is a follow-up since it touches the
 * single-user editor's content lifecycle.
 *
 * The presence here proves: WebSocket auth works, tenant gating
 * works, and the foundation for multi-user editing is wired.
 */
import { useCollabProvider } from '@/lib/collab'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export function CollabStatusBadge({ contractId }: { contractId: string }) {
  const collab = useCollabProvider(contractId)
  if (!collab) return null

  const { status } = collab
  const config = {
    connecting:   { icon: Loader2,  cls: 'text-amber-700 bg-amber-50 border-amber-200',     label: 'Connecting…', spin: true  },
    connected:    { icon: Wifi,     cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Live',         spin: false },
    disconnected: { icon: WifiOff,  cls: 'text-gray-600 bg-gray-100 border-gray-200',        label: 'Offline',     spin: false },
  }[status]
  const Icon = config.icon

  return (
    <span
      data-testid="collab-status-badge"
      title={`Real-time collab: ${config.label}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${config.cls}`}
    >
      <Icon className={`h-3 w-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  )
}
