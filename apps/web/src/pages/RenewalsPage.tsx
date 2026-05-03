/**
 * RenewalsPage — org-wide renewal calendar (Phase 08 Step 7).
 *
 * Lists every EXECUTED contract whose expiryDate falls inside the
 * lookahead window, grouped by month. Each month shows count + total
 * ACV; each row shows counterparty, value, expiryDate, decision state,
 * and links to the contract detail page where the user records a
 * decision (renew | renegotiate | let_expire | pause) via the
 * RenewalAdviceRailSection.
 *
 * "Calendar" here means a month-grouped timeline, not a Google-style
 * grid — for legal portfolios, the relevant question is "what
 * decisions are needed in the next N days," not "what date is May 17."
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  CalendarDays, ArrowRight, Loader2, AlertCircle, RefreshCw,
  Clock, AlertTriangle, CheckCircle2, Search, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Bucket = 'all' | 'this_week' | 'next_30' | 'next_60' | 'next_90' | 'overdue'
type StatusFilter = 'all' | 'pending' | 'decided'

interface RenewalRow {
  id:               string
  title:            string
  type:             string
  counterpartyName: string | null
  expiryDate:       string | null
  effectiveDate:    string | null
  value:            string | null
  currency:         string | null
  ownerId:          string
  ownerName:        string | null
  renewalDecision:    string | null
  renewalDecisionAt:  string | null
  renewalAdvice: {
    recommendation: string
    confidence:     string
    rationale:      string
  } | null
}

interface MonthGroup {
  month:      string
  label:      string
  rows:       RenewalRow[]
  totalValue: number
  currency:   string
}

interface ApiList {
  data:    RenewalRow[]
  months:  MonthGroup[]
  total:   number
  window:  { from: string; to: string }
}

interface ApiStats {
  overdue:        number
  thisWeek:       number
  next30:         number
  next60:         number
  next90:         number
  undecided:      number
  totalAcvNext90: number
}

const BUCKETS: { key: Bucket; label: string; statKey?: keyof ApiStats }[] = [
  { key: 'all',       label: 'Next year' },
  { key: 'this_week', label: 'This week',  statKey: 'thisWeek' },
  { key: 'next_30',   label: 'Next 30d',   statKey: 'next30' },
  { key: 'next_60',   label: 'Next 60d',   statKey: 'next60' },
  { key: 'next_90',   label: 'Next 90d',   statKey: 'next90' },
  { key: 'overdue',   label: 'Overdue',    statKey: 'overdue' },
]

const DECISION_PILL: Record<string, { bg: string; label: string }> = {
  renew:        { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Renew' },
  renegotiate:  { bg: 'bg-amber-50 border-amber-200 text-amber-700',       label: 'Renegotiate' },
  let_expire:   { bg: 'bg-red-50 border-red-200 text-red-700',             label: 'Let expire' },
  pause:        { bg: 'bg-gray-100 border-gray-200 text-gray-600',         label: 'Pause' },
}

const ADVICE_PILL: Record<string, { bg: string; label: string }> = {
  RENEW:        { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'AI: Renew' },
  RENEGOTIATE:  { bg: 'bg-amber-50 border-amber-200 text-amber-700',       label: 'AI: Renegotiate' },
  LET_EXPIRE:   { bg: 'bg-red-50 border-red-200 text-red-700',             label: 'AI: Let expire' },
  PAUSE:        { bg: 'bg-gray-100 border-gray-200 text-gray-600',         label: 'AI: Pause' },
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(t).setHours(0, 0, 0, 0) - today.getTime()) / (24 * 3600 * 1000))
}

function dueText(iso: string | null): { text: string; tone: string } {
  if (!iso) return { text: 'No date', tone: 'text-muted-foreground' }
  const d = daysUntil(iso)
  const dateStr = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d == null) return { text: dateStr, tone: 'text-gray-700' }
  if (d < 0)  return { text: `${dateStr} · ${-d}d ago`,        tone: 'text-red-700 font-medium' }
  if (d === 0) return { text: `${dateStr} · today`,             tone: 'text-amber-700 font-medium' }
  if (d <= 7)  return { text: `${dateStr} · in ${d}d`,          tone: 'text-amber-700 font-medium' }
  if (d <= 30) return { text: `${dateStr} · in ${d}d`,          tone: 'text-amber-700' }
  return { text: `${dateStr} · in ${d}d`, tone: 'text-gray-600' }
}

function formatMoney(n: number, currency = 'USD'): string {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(0)}K`
  return `${currency} ${n.toFixed(0)}`
}

export function RenewalsPage() {
  const [bucket, setBucket] = useState<Bucket>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [q, setQ] = useState('')

  const { data: stats } = useQuery<ApiStats>({
    queryKey: ['renewals-stats'],
    queryFn:  () => api.get('/renewals/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data, isLoading, isError } = useQuery<ApiList>({
    queryKey: ['renewals-list', bucket, statusFilter],
    queryFn:  () => api.get(`/renewals?bucket=${bucket}&status=${statusFilter}`).then(r => r.data),
    refetchInterval: 60_000,
  })

  // Client-side text filter — server endpoint doesn't support `q` for renewals yet.
  const filteredMonths = (data?.months ?? []).map(m => ({
    ...m,
    rows: q
      ? m.rows.filter(r =>
          r.title.toLowerCase().includes(q.toLowerCase()) ||
          (r.counterpartyName ?? '').toLowerCase().includes(q.toLowerCase()),
        )
      : m.rows,
  })).filter(m => m.rows.length > 0)

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto" data-testid="renewals-page">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-purple-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Renewals</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const r = await api.get('/renewals/export', { responseType: 'blob' })
            const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
            const a = document.createElement('a'); a.href = url; a.download = `renewals-${new Date().toISOString().slice(0,10)}.csv`
            document.body.appendChild(a); a.click(); a.remove()
            URL.revokeObjectURL(url)
          }}
          className="gap-1.5"
          data-testid="export-renewals-btn"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Every executed contract heading toward its expiry — grouped by month so you can see what decisions are needed when.
      </p>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="This week"    value={stats?.thisWeek ?? 0} tone="amber"   icon={Clock}            data-testid="stat-this-week" />
        <StatCard label="Next 30 days" value={stats?.next30 ?? 0}   tone="amber"   icon={CalendarDays}     data-testid="stat-next-30" />
        <StatCard label="Next 90 days" value={stats?.next90 ?? 0}   tone="purple"  icon={CalendarDays}     data-testid="stat-next-90" />
        <StatCard
          label="Decisions needed"
          value={stats?.undecided ?? 0}
          tone="red"
          icon={AlertTriangle}
          data-testid="stat-undecided"
          subtitle={stats?.totalAcvNext90 ? `${formatMoney(stats.totalAcvNext90)} ACV in next 90d` : ''}
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-1 -mb-2 overflow-x-auto">
          {BUCKETS.map(b => {
            const active = bucket === b.key
            const count = b.statKey ? stats?.[b.statKey] ?? 0 : null
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBucket(b.key)}
                data-testid={`renewal-bucket-${b.key}`}
                className={`px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-purple-600 text-purple-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {b.label}
                {count != null && count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            data-testid="renewal-decision-filter"
            className="text-sm border border-gray-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            <option value="all">All decisions</option>
            <option value="pending">No decision yet</option>
            <option value="decided">Decided</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search title or counterparty"
              value={q}
              onChange={e => setQ(e.target.value)}
              data-testid="renewals-search"
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Month groups */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          Failed to load renewals.
        </div>
      ) : filteredMonths.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-xl" data-testid="renewals-empty">
          <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">
            {q ? `No renewals match "${q}".` : 'No upcoming renewals in this window.'}
          </p>
          <p className="text-xs text-gray-400">
            Renewals appear here once a contract is executed and the expiry date is set.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredMonths.map(m => (
            <section
              key={m.month}
              data-testid={`renewal-month-${m.month}`}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              <header className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-200">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{m.label}</h3>
                  <span className="text-xs text-gray-500">
                    {m.rows.length} {m.rows.length === 1 ? 'renewal' : 'renewals'}
                  </span>
                </div>
                {m.totalValue > 0 && (
                  <span className="text-xs font-medium text-gray-700 tabular-nums">
                    {formatMoney(m.totalValue, m.currency)} ACV
                  </span>
                )}
              </header>
              <ul className="divide-y divide-gray-100">
                {m.rows.map(r => {
                  const due = dueText(r.expiryDate)
                  const decisionPill = r.renewalDecision ? DECISION_PILL[r.renewalDecision] : null
                  const advicePill = r.renewalAdvice
                    ? ADVICE_PILL[r.renewalAdvice.recommendation?.toUpperCase() ?? '']
                    : null
                  return (
                    <li
                      key={r.id}
                      data-testid={`renewal-row-${r.id}`}
                      data-decision={r.renewalDecision ?? 'none'}
                      className="flex items-center px-5 py-3 gap-3 hover:bg-gray-50/60"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/contracts/${r.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-purple-700 truncate max-w-[400px]"
                            title={r.title}
                          >
                            {r.title}
                          </Link>
                          <span className="text-[10px] uppercase tracking-wider font-mono text-gray-400">
                            {r.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          {r.counterpartyName && <span>{r.counterpartyName}</span>}
                          {r.value && <span>· {formatMoney(Number(r.value), r.currency ?? 'USD')}</span>}
                          {r.ownerName && <span>· {r.ownerName}</span>}
                        </div>
                      </div>
                      <div className={`text-xs whitespace-nowrap ${due.tone}`}>
                        {due.text}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {advicePill && !decisionPill && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium border ${advicePill.bg}`}
                            title={r.renewalAdvice?.rationale ?? ''}>
                            {advicePill.label}
                          </span>
                        )}
                        {decisionPill ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${decisionPill.bg}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            {decisionPill.label}
                          </span>
                        ) : (
                          <Link
                            to={`/contracts/${r.id}#renewal`}
                            className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-800 font-medium"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Decide
                          </Link>
                        )}
                        <Link
                          to={`/contracts/${r.id}`}
                          className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 font-medium ml-2"
                        >
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone, icon: Icon, subtitle, ...rest }: {
  label: string
  value: number
  tone: 'amber' | 'red' | 'purple' | 'emerald'
  icon: React.ComponentType<{ className?: string }>
  subtitle?: string
  'data-testid'?: string
}) {
  const toneClass = {
    amber:   'text-amber-700',
    red:     'text-red-700',
    purple:  'text-purple-700',
    emerald: 'text-emerald-700',
  }[tone]
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white" {...rest}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-0.5 ${toneClass}`}>{value}</div>
      {subtitle && <div className="text-[10.5px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  )
}
