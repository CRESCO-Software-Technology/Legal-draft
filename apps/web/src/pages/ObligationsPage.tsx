/**
 * ObligationsPage — org-wide obligations list (Phase 08 Step 3).
 *
 * Replaces the per-contract rail-only view with a queryable table:
 * filter by bucket (open / due-soon / overdue / completed), free-text
 * search, sortable columns, and a stats strip showing pipeline health.
 *
 * Click an obligation row to jump to the contract; a "Mark complete"
 * button appears on the row hover (Step 4 wires the modal).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  CalendarClock, DollarSign, Shield, RefreshCw, FileSearch, Bell,
  Check, AlertTriangle, ArrowRight, Loader2, AlertCircle, ListTodo,
  Search, CheckCircle2, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompleteObligationModal } from '@/components/contracts/CompleteObligationModal'

type Bucket = 'all' | 'open' | 'due_soon' | 'overdue' | 'completed'

interface ApiObligation {
  id:               string
  type:             string
  description:      string
  owner:            string
  dueDate:          string | null
  recurrence:       string
  trigger:          string | null
  quote:            string
  severity:         string
  sectionRef:       string | null
  status:           'OPEN' | 'COMPLETED' | 'OVERDUE' | 'WAIVED'
  completedAt:      string | null
  notifiedAt:       string | null
  contract: {
    id: string
    title: string
    status: string
    type: string
    counterpartyName: string | null
  } | null
}

interface ApiStats {
  open: number
  dueSoon: number
  overdue: number
  completedRecent: number
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  payment:     DollarSign,
  sla:         Shield,
  renewal:     RefreshCw,
  audit:       FileSearch,
  report:      CalendarClock,
  termination: AlertTriangle,
  compliance:  Check,
  other:       Bell,
}

const BUCKETS: { key: Bucket; label: string; statKey?: keyof ApiStats }[] = [
  { key: 'all',       label: 'All' },
  { key: 'open',      label: 'Open',         statKey: 'open' },
  { key: 'due_soon',  label: 'Due soon',     statKey: 'dueSoon' },
  { key: 'overdue',   label: 'Overdue',      statKey: 'overdue' },
  { key: 'completed', label: 'Completed',    statKey: 'completedRecent' },
]

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(t).setHours(0,0,0,0) - today.getTime()) / (24 * 3600 * 1000))
}

function dueLabel(iso: string | null, status: string): { text: string; tone: string } {
  if (!iso) return { text: 'No due date', tone: 'text-muted-foreground' }
  const d = daysUntil(iso)
  if (status === 'COMPLETED') return { text: new Date(iso).toLocaleDateString(), tone: 'text-emerald-700' }
  if (d == null) return { text: new Date(iso).toLocaleDateString(), tone: 'text-gray-700' }
  if (d < 0)  return { text: `${-d}d overdue`, tone: 'text-red-700 font-medium' }
  if (d === 0) return { text: 'Due today',     tone: 'text-amber-700 font-medium' }
  if (d === 1) return { text: 'Due tomorrow',  tone: 'text-amber-700 font-medium' }
  if (d <= 14) return { text: `Due in ${d}d`,  tone: 'text-amber-700 font-medium' }
  return { text: `Due in ${d}d`, tone: 'text-gray-600' }
}

const SEVERITY_PILL: Record<string, string> = {
  high:   'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low:    'bg-gray-50 border-gray-200 text-gray-600',
}

const STATUS_PILL: Record<string, { bg: string; label: string }> = {
  OPEN:      { bg: 'bg-blue-50 border-blue-200 text-blue-700',         label: 'Open' },
  COMPLETED: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Completed' },
  OVERDUE:   { bg: 'bg-red-50 border-red-200 text-red-700',             label: 'Overdue' },
  WAIVED:    { bg: 'bg-gray-100 border-gray-200 text-gray-600',         label: 'Waived' },
}

export function ObligationsPage() {
  const [bucket, setBucket] = useState<Bucket>('all')
  const [q, setQ] = useState('')
  const [completeTarget, setCompleteTarget] = useState<{ id: string; description: string } | null>(null)
  const qc = useQueryClient()

  const { data: stats } = useQuery<ApiStats>({
    queryKey: ['obligations-stats'],
    queryFn:  () => api.get('/obligations/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data, isLoading, isError } = useQuery<{ data: ApiObligation[]; total: number }>({
    queryKey: ['obligations-list', bucket, q],
    queryFn:  () => api.get(`/obligations?bucket=${bucket}${q ? `&q=${encodeURIComponent(q)}` : ''}&limit=100`).then(r => r.data),
    refetchInterval: 60_000,
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto" data-testid="obligations-page">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <ListTodo className="h-5 w-5 text-blue-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Obligations</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const r = await api.get(`/obligations/export?bucket=${bucket}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { responseType: 'blob' })
            const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
            const a = document.createElement('a'); a.href = url; a.download = `obligations-${new Date().toISOString().slice(0,10)}.csv`
            document.body.appendChild(a); a.click(); a.remove()
            URL.revokeObjectURL(url)
          }}
          className="gap-1.5"
          data-testid="export-obligations-btn"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Every commitment extracted from your executed contracts — payments, SLAs, renewals, audits, and reports.
      </p>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open"        value={stats?.open ?? 0}         tone="blue"   data-testid="stat-open" />
        <StatCard label="Due in 30d"  value={stats?.dueSoon ?? 0}      tone="amber"  data-testid="stat-due-soon" />
        <StatCard label="Overdue"     value={stats?.overdue ?? 0}      tone="red"    data-testid="stat-overdue" />
        <StatCard label="Completed (30d)" value={stats?.completedRecent ?? 0} tone="emerald" data-testid="stat-completed" />
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-1 -mb-2 overflow-x-auto">
          {BUCKETS.map(b => {
            const isActive = bucket === b.key
            const count = b.statKey ? stats?.[b.statKey] ?? 0 : null
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBucket(b.key)}
                data-testid={`bucket-${b.key}`}
                className={`px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {b.label}
                {count != null && count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search description or contract"
            value={q}
            onChange={e => setQ(e.target.value)}
            data-testid="obligations-search"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full sm:w-72"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          Failed to load obligations.
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-xl" data-testid="obligations-empty">
          <ListTodo className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">
            {q
              ? `No obligations match "${q}".`
              : bucket === 'completed'
                ? 'No obligations completed in the last 30 days.'
                : bucket === 'overdue'
                  ? 'Nothing overdue — well done.'
                  : bucket === 'due_soon'
                    ? 'Nothing due in the next 30 days.'
                    : 'No obligations extracted yet.'}
          </p>
          <p className="text-xs text-gray-400">
            Obligations are auto-extracted when a contract is signed; you can also run extraction manually from any contract page.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span>{total} {total === 1 ? 'obligation' : 'obligations'}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="obligations-table">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-left px-4 py-3 font-medium">Contract</th>
                <th className="text-left px-4 py-3 font-medium">Due</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(o => {
                const TypeIcon = TYPE_ICON[o.type] ?? Bell
                const due = dueLabel(o.dueDate, o.status)
                const sevPill = SEVERITY_PILL[o.severity] ?? SEVERITY_PILL.medium
                const statusPill = STATUS_PILL[o.status] ?? STATUS_PILL.OPEN
                return (
                  <tr key={o.id} className="hover:bg-gray-50" data-testid={`obligation-row-${o.id}`}>
                    <td className="px-4 py-3 max-w-[380px]">
                      <div className="flex items-start gap-2">
                        <TypeIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate" title={o.description}>
                            {o.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                            <span className="uppercase font-mono tracking-wider text-[10px]">{o.type}</span>
                            <span>· {o.owner}</span>
                            {o.sectionRef && <span className="font-mono">§{o.sectionRef}</span>}
                            {o.recurrence !== 'one-time' && o.recurrence !== 'unknown' && (
                              <span className="text-blue-700">↻ {o.recurrence}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.contract ? (
                        <Link
                          to={`/contracts/${o.contract.id}`}
                          className="text-xs hover:text-blue-600 block max-w-[200px] truncate"
                          title={o.contract.title}
                        >
                          <span className="font-medium text-gray-800">{o.contract.title}</span>
                          {o.contract.counterpartyName && (
                            <div className="text-gray-500">{o.contract.counterpartyName}</div>
                          )}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">(deleted)</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs ${due.tone}`}>
                      {due.text}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${sevPill}`}>
                        {o.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusPill.bg}`}>
                        {statusPill.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        {o.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => setCompleteTarget({ id: o.id, description: o.description })}
                            data-testid={`complete-btn-${o.id}`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete
                          </button>
                        )}
                        {o.contract?.id && (
                          <Link
                            to={`/contracts/${o.contract.id}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {completeTarget && (
        <CompleteObligationModal
          obligationId={completeTarget.id}
          description={completeTarget.description}
          open={!!completeTarget}
          onClose={() => setCompleteTarget(null)}
          onCompleted={() => {
            qc.invalidateQueries({ queryKey: ['obligations-list'] })
            qc.invalidateQueries({ queryKey: ['obligations-stats'] })
            qc.invalidateQueries({ queryKey: ['contract-obligations'] })
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, tone, ...rest }: {
  label: string
  value: number
  tone: 'blue' | 'amber' | 'red' | 'emerald'
  'data-testid'?: string
}) {
  const toneClass = {
    blue:    'text-blue-700',
    amber:   'text-amber-700',
    red:     'text-red-700',
    emerald: 'text-emerald-700',
  }[tone]
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white" {...rest}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  )
}
