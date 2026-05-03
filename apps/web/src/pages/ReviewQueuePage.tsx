/**
 * ReviewQueuePage (P2.5 / Wave F.5)
 *
 * Legal's "low-confidence extractions need your eyes" queue. Shows
 * every AI-extracted field across the org whose confidence is below
 * the threshold. One click verifies (confidence → 1.0) or rejects
 * (confidence → 0 + value cleared).
 *
 * Design reference:
 *   - Hebbia review queue (table + bulk actions)
 *   - Ironclad confidence badges
 *   - Harvey one-click verify/reject
 */
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, CheckCircle2, XCircle, ExternalLink, ShieldCheck,
  Search,
} from 'lucide-react'

interface QueueItem {
  contractId:    string
  contractTitle: string
  contractType:  string
  contractStatus: string
  field:         string
  fieldLabel:    string
  value:         string | number | null
  quote:         string | null
  section:       string | null
  confidence:    number
  updatedAt:     string
}

const THRESHOLDS = [
  { value: 0.9, label: 'High bar (<0.9)' },
  { value: 0.7, label: 'Legal bar (<0.7)' },
  { value: 0.5, label: 'Risky only (<0.5)' },
]

export function ReviewQueuePage() {
  const qc = useQueryClient()
  const [threshold, setThreshold] = useState(0.7)
  const [search, setSearch] = useState('')

  const queryKey = ['review-queue', threshold]
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ items: QueueItem[]; total: number; threshold: number }>(
      '/review-queue', { params: { threshold } },
    )).data,
  })

  const verify = useMutation({
    mutationFn: (p: { contractId: string; field: string }) =>
      api.post(`/review-queue/${p.contractId}/verify`, { field: p.field }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  })
  const reject = useMutation({
    mutationFn: (p: { contractId: string; field: string }) =>
      api.post(`/review-queue/${p.contractId}/reject`, { field: p.field }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.items ?? []).filter(it => {
      if (!q) return true
      return (
        it.contractTitle.toLowerCase().includes(q) ||
        it.fieldLabel.toLowerCase().includes(q) ||
        String(it.value ?? '').toLowerCase().includes(q) ||
        (it.quote ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, search])

  const byContract = useMemo(() => {
    const map = new Map<string, { title: string; items: QueueItem[] }>()
    for (const it of filtered) {
      const cur = map.get(it.contractId) ?? { title: it.contractTitle, items: [] }
      cur.items.push(it)
      map.set(it.contractId, cur)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="px-6 py-5 max-w-6xl mx-auto" data-testid="review-queue-page">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Extraction Queue
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            AI-extracted fields below the confidence threshold. Verify (keep the value),
            correct (set a new value), or reject (clear the value) — each contract stops
            carrying a silent low-confidence extraction.
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {data ? `${data.total} items · threshold ${(data.threshold * 100).toFixed(0)}%` : ''}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by contract, field, value or quote…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="review-queue-search"
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
          data-testid="review-queue-threshold"
          className="text-sm rounded-md border border-border bg-background px-2 py-1.5"
        >
          {THRESHOLDS.map(t =>
            <option key={t.value} value={t.value}>{t.label}</option>
          )}
        </select>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          <AlertTriangle className="h-4 w-4" /> Failed to load the queue.
        </div>
      )}
      {filtered.length === 0 && !isLoading && (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground border border-dashed border-gray-300 rounded-lg">
          Nothing to review at this threshold. Try widening it to surface more.
        </div>
      )}

      <div className="space-y-3">
        {byContract.map(([contractId, group]) => (
          <div
            key={contractId}
            data-testid={`review-queue-contract-${contractId}`}
            className="border border-border rounded-lg bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <div className="min-w-0 flex items-baseline gap-2">
                <Link
                  to={`/contracts/${contractId}`}
                  className="font-medium text-sm text-gray-900 hover:underline truncate"
                >
                  {group.title}
                </Link>
                <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">
                  {group.items[0].contractType}
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  {group.items.length} flagged field{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <Link
                to={`/contracts/${contractId}`}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Open contract
              </Link>
            </div>
            <div className="divide-y divide-border">
              {group.items.map(it => (
                <div
                  key={`${it.contractId}::${it.field}`}
                  data-testid={`review-queue-row-${it.contractId}-${it.field}`}
                  className="px-4 py-2.5 flex items-start gap-3"
                >
                  <div className="min-w-[140px] flex-shrink-0">
                    <div className="text-[11px] font-medium text-gray-900">{it.fieldLabel}</div>
                    <div className="text-[10.5px] text-muted-foreground font-mono">{it.field}</div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-[12px] text-gray-900 truncate">
                      {it.value != null && it.value !== ''
                        ? String(it.value)
                        : <em className="text-gray-400">(empty)</em>}
                    </div>
                    {it.quote && (
                      <div className="text-[10.5px] text-muted-foreground italic truncate"
                           title={it.quote}>
                        “{it.quote}”
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={
                        'text-[10.5px] font-mono tabular-nums rounded px-1.5 py-0.5 ' +
                        (it.confidence < 0.5
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : it.confidence < 0.7
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-yellow-50 text-yellow-800 border border-yellow-200')
                      }
                      title={`Extractor confidence: ${(it.confidence * 100).toFixed(0)}%`}
                    >
                      {(it.confidence * 100).toFixed(0)}%
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reject.mutate({ contractId: it.contractId, field: it.field })}
                      disabled={reject.isPending}
                      data-testid={`review-queue-reject-${it.field}`}
                      className="h-7 gap-1 text-[11px] text-red-700 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => verify.mutate({ contractId: it.contractId, field: it.field })}
                      disabled={verify.isPending}
                      data-testid={`review-queue-verify-${it.field}`}
                      className="h-7 gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Verify
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
