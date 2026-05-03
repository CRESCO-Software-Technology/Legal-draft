/**
 * CompareMode — State 9 in the unified-canvas wireframes.
 *
 * A first-class fullscreen mode (not a buried tab) for comparing two
 * contract versions. Per docs/26 §5 State 9 + the round-3 critique:
 * negotiation attribution + per-change accept/reject is what turns a
 * diff viewer into a negotiation tool. We ship the mode + attribution
 * + bulk controls now; the per-change inline buttons land in v1.1 once
 * the backend supports a patch-apply endpoint (it currently returns the
 * full diffHtml, not per-span mutations).
 *
 * Open from: the header [Compare ▾] button, or the History rail
 * section. Esc closes.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DiffViewer } from './DiffViewer'
import { X, ChevronDown, Loader2, User, Clock, Check, XCircle } from 'lucide-react'

interface VersionMini {
  id:            string
  versionNumber: number
  createdAt:     string
  authorName?:   string | null
  changeNote?:   string | null
}

export function CompareMode({
  open,
  onClose,
  contractId,
  versions,
}: {
  open:        boolean
  onClose:     () => void
  contractId:  string
  versions:    VersionMini[]
}) {
  // Default: newest vs. one-prior. This matches State 9's "v5 vs v4".
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  )
  const [newerId, setNewerId] = useState<string>(sorted[0]?.id ?? '')
  const [olderId, setOlderId] = useState<string>(sorted[1]?.id ?? '')
  const [filter,  setFilter]  = useState<'all' | 'theirs' | 'ours' | 'pending'>('all')

  // Keep picker state in sync when the parent's versions list changes.
  useEffect(() => {
    if (sorted.length === 0) return
    if (!sorted.find(v => v.id === newerId)) setNewerId(sorted[0].id)
    if (!sorted.find(v => v.id === olderId)) setOlderId(sorted[1]?.id ?? sorted[0].id)
  }, [sorted, newerId, olderId])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { data: diff, isLoading } = useQuery({
    queryKey: ['contract-diff', contractId, olderId, newerId],
    queryFn: () => api
      .get(`/contracts/${contractId}/versions/${olderId}/diff/${newerId}`)
      .then(r => r.data),
    enabled: open && !!olderId && !!newerId && olderId !== newerId,
  })

  if (!open) return null

  const newer = sorted.find(v => v.id === newerId) ?? null
  const older = sorted.find(v => v.id === olderId) ?? null

  return (
    <div
      role="dialog"
      aria-label="Compare versions"
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Compare versions</span>

          {/* Newer picker */}
          <VersionPicker
            value={newerId}
            onChange={setNewerId}
            versions={sorted}
            label="Newer"
          />

          <span className="text-gray-400 text-xs">vs.</span>

          {/* Older picker */}
          <VersionPicker
            value={olderId}
            onChange={setOlderId}
            versions={sorted}
            label="Older"
          />
        </div>

        {/* Attribution chips for the two versions */}
        <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-500">
          {newer && (
            <Attribution label={`v${newer.versionNumber}`} author={newer.authorName} createdAt={newer.createdAt} tone="blue" />
          )}
          {older && (
            <Attribution label={`v${older.versionNumber}`} author={older.authorName} createdAt={older.createdAt} tone="gray" />
          )}
        </div>

        {/* Filter chips — V1 visual stubs; wire to per-change toggles in v1.1 */}
        <div className="ml-auto flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
          {(['all', 'theirs', 'ours', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium capitalize',
                filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Close compare (Esc)"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Bulk action bar — visible when diff loaded ──────────── */}
      {diff && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 bg-gray-50 text-xs">
          <span className="text-gray-500">
            <span className="text-emerald-700 font-medium">{diff.stats.insertions}</span> added,{' '}
            <span className="text-red-700 font-medium">{diff.stats.deletions}</span> removed
          </span>
          <div className="h-3 w-px bg-gray-300" aria-hidden />
          <span className="text-gray-400 italic">
            Per-change Accept / Reject with attribution arrives in v1.1; for now use bulk:
          </span>
          <Button size="sm" variant="outline" className="gap-1 ml-auto text-emerald-700 border-emerald-200 hover:bg-emerald-50" disabled title="Coming in v1.1">
            <Check className="h-3.5 w-3.5" />
            Accept all theirs
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-red-700 border-red-200 hover:bg-red-50" disabled title="Coming in v1.1">
            <XCircle className="h-3.5 w-3.5" />
            Reject all theirs
          </Button>
        </div>
      )}

      {/* ── Diff body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        {sorted.length < 2 ? (
          <Centered>
            <p className="text-sm text-gray-500">Only one version exists — nothing to compare.</p>
          </Centered>
        ) : olderId === newerId ? (
          <Centered>
            <p className="text-sm text-gray-500">Pick two different versions to see changes.</p>
          </Centered>
        ) : isLoading ? (
          <Centered>
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Computing diff…</p>
          </Centered>
        ) : diff?.diffHtml ? (
          <div className="mx-auto max-w-5xl">
            <DiffViewer
              diffHtml={diff.diffHtml}
              stats={diff.stats}
              v1Label={older ? `v${older.versionNumber} · ${short(older.authorName)} · ${dateLabel(older.createdAt)}` : 'Older'}
              v2Label={newer ? `v${newer.versionNumber} · ${short(newer.authorName)} · ${dateLabel(newer.createdAt)}` : 'Newer'}
            />
          </div>
        ) : (
          <Centered>
            <p className="text-sm text-gray-500">No diff available for these versions.</p>
          </Centered>
        )}
      </div>
    </div>
  )
}

function VersionPicker({
  value,
  onChange,
  versions,
  label,
}: {
  value:     string
  onChange:  (id: string) => void
  versions:  VersionMini[]
  label:     string
}) {
  return (
    <label className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs">
      <span className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent outline-none text-gray-800 font-medium pr-1"
      >
        {versions.map(v => (
          <option key={v.id} value={v.id}>
            v{v.versionNumber}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 text-gray-400 -ml-1" />
    </label>
  )
}

function Attribution({
  label,
  author,
  createdAt,
  tone,
}: {
  label:     string
  author?:   string | null
  createdAt: string
  tone:      'blue' | 'gray'
}) {
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border',
      tone === 'blue'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-gray-50 text-gray-600 border-gray-200',
    )}>
      <span className="font-semibold">{label}</span>
      <span className="opacity-60">·</span>
      <User className="h-3 w-3 opacity-60" />
      <span className="truncate max-w-[120px]">{short(author)}</span>
      <span className="opacity-60">·</span>
      <Clock className="h-3 w-3 opacity-60" />
      <span>{dateLabel(createdAt)}</span>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      {children}
    </div>
  )
}

function short(a: string | null | undefined): string {
  if (!a) return 'Unknown'
  return a.length > 20 ? a.slice(0, 20) + '…' : a
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = Math.max(0, now - d.getTime())
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
