/**
 * DiligenceRoomsPage — list view (Phase 09 Step 5).
 *
 * Lists every diligence room in the org. Each row shows progress
 * (done / processing / failed). New room creation kicks off via a
 * dialog; clicking a row opens the detail page.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FolderOpen, Plus, Loader2, AlertCircle, ArrowRight, X,
  ChevronDown, ChevronRight, FileText,
} from 'lucide-react'

interface ApiRoom {
  id: string
  name: string
  description: string | null
  status: string
  documentCount: number
  progress: { done: number; failed: number; processing: number }
  createdAt: string
  updatedAt: string
}

export function DiligenceRoomsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery<{ data: ApiRoom[] }>({
    queryKey: ['diligence-rooms'],
    queryFn:  () => api.get('/diligence').then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto" data-testid="diligence-rooms-page">
      <div className="flex items-center justify-between mb-1 gap-4">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-5 w-5 text-violet-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Diligence Rooms</h1>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="create-room-btn"
          className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="h-4 w-4" />
          New room
        </Button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Bulk-upload contracts for cross-document analysis — M&amp;A due diligence, vendor consolidation, portfolio reviews.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          Failed to load diligence rooms.
        </div>
      ) : (data?.data?.length ?? 0) === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-xl" data-testid="rooms-empty">
          <FolderOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">No diligence rooms yet.</p>
          <p className="text-xs text-gray-400 mb-3">
            Create a room to bulk-upload up to 50 contracts and run cross-document analysis.
          </p>
          <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create first room
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="rooms-grid">
          {(data?.data ?? []).map(r => (
            <RoomCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateRoomDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['diligence-rooms'] })}
        />
      )}
    </div>
  )
}

// U8 audit (2026-04-29). Trust gap on the rooms list — each room card
// claimed "30 contracts inside" but offered no inline preview, so the
// user had to take the agent's word for it. The card now expands on
// click to show the first 5 contract titles + status, with a link to
// the full room. The card itself stays a primary navigation target via
// the chevron-collapsed state.
interface RoomDocument {
  id: string
  title: string | null
  type: string
  status: string
  counterpartyName: string | null
  analysisStatus: string
}

function RoomCard({ r }: { r: ApiRoom }) {
  const [expanded, setExpanded] = useState(false)
  const { data: docs, isLoading: docsLoading } = useQuery<{ data: RoomDocument[] }>({
    queryKey: ['diligence-room-docs', r.id],
    queryFn:  () => api.get(`/diligence/${r.id}/documents`).then(res => res.data),
    enabled:  expanded,
    staleTime: 30_000,
  })
  const previewDocs = (docs?.data ?? []).slice(0, 5)

  return (
    <div
      data-testid={`room-card-${r.id}`}
      data-expanded={expanded ? 'true' : 'false'}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-violet-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link to={`/diligence/${r.id}`} className="flex-1 min-w-0 group">
          <h3 className="font-medium text-gray-900 truncate group-hover:text-violet-700 transition-colors" title={r.name ?? undefined}>{r.name}</h3>
          {r.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>
          )}
        </Link>
        <Link to={`/diligence/${r.id}`} className="text-gray-300 hover:text-violet-600 transition-colors flex-shrink-0 mt-1" title="Open room">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex items-center gap-3 text-xs mt-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          data-testid={`room-card-toggle-${r.id}`}
          className="flex items-center gap-1 text-gray-700 font-medium hover:text-violet-700 transition-colors"
          aria-expanded={expanded}
          aria-controls={`room-card-docs-${r.id}`}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {r.documentCount} {r.documentCount === 1 ? 'doc' : 'docs'}
        </button>
        {r.progress.done > 0 && (
          <span className="text-emerald-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
            {r.progress.done} ready
          </span>
        )}
        {r.progress.processing > 0 && (
          <span className="text-blue-700">
            <Loader2 className="inline h-3 w-3 animate-spin mr-0.5" />
            {r.progress.processing} processing
          </span>
        )}
        {r.progress.failed > 0 && (
          <span className="text-red-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />
            {r.progress.failed} failed
          </span>
        )}
      </div>
      <div className="text-[10.5px] text-gray-400 mt-2">
        Updated {new Date(r.updatedAt).toLocaleDateString()}
      </div>
      {expanded && (
        <div
          id={`room-card-docs-${r.id}`}
          data-testid={`room-card-docs-${r.id}`}
          className="mt-3 pt-3 border-t border-gray-100 space-y-1.5"
        >
          {docsLoading ? (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading contracts…
            </div>
          ) : previewDocs.length === 0 ? (
            <p className="text-[11px] text-gray-400">No contracts uploaded yet.</p>
          ) : (
            <>
              {previewDocs.map(d => (
                <Link
                  key={d.id}
                  to={`/contracts/${d.id}`}
                  className="flex items-start gap-2 text-[11px] hover:bg-violet-50 rounded px-1.5 py-1 -mx-1 transition-colors"
                  title={d.title ?? 'Untitled'}
                >
                  <FileText className="h-3 w-3 text-violet-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-900 truncate">{d.title ?? 'Untitled'}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <span>{d.type}</span>
                      <span aria-hidden>·</span>
                      <span>{d.status.replace(/_/g, ' ').toLowerCase()}</span>
                      {d.analysisStatus && d.analysisStatus !== 'DONE' && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="text-blue-600">{d.analysisStatus.replace(/_/g, ' ').toLowerCase()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              {(docs?.data?.length ?? 0) > previewDocs.length && (
                <Link
                  to={`/diligence/${r.id}`}
                  className="block text-[11px] text-violet-700 hover:text-violet-900 font-medium pt-1"
                >
                  + {(docs?.data?.length ?? 0) - previewDocs.length} more — open room →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CreateRoomDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.post('/diligence', {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      return r.data
    },
    onSuccess: () => {
      onCreated()
      onClose()
      setName(''); setDescription(''); setError(null)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? 'Failed to create room.')
    },
  })

  return (
    <div
      role="dialog"
      aria-label="Create diligence room"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
      data-testid="create-room-dialog"
    >
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-violet-600" />
              New diligence room
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Group a batch of contracts for cross-document analysis.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Acme M&A — Vendor Contracts"
              data-testid="room-name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Q3 2026 vendor contract review for the Acme acquisition…"
              rows={3}
              data-testid="room-description"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y"
            />
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
            data-testid="create-room-confirm"
            className="bg-violet-600 hover:bg-violet-700"
          >
            {create.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating…</>
            ) : (
              <><FolderOpen className="h-4 w-4 mr-1" /> Create room</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
