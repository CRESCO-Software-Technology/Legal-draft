/**
 * AnalyticsPage — executive dashboard (Phase 09 Step 1).
 *
 * Replaces the prior "Coming Soon" stub with a real KPI dashboard:
 * headline KPIs, contract status pie, contract type bar, risk
 * distribution, monthly volume trend, top counterparties by ACV.
 *
 * Backed by /api/v1/analytics/* endpoints. Each KPI card is clickable
 * — drills into the Contracts list pre-filtered (Step 3 will wire
 * the filter params on /contracts).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import {
  BarChart2, FileText, CheckCircle2, AlertTriangle, CalendarClock,
  Loader2, TrendingUp, ArrowRight, Sparkles, Building2, Clock,
} from 'lucide-react'

interface ApiSummary {
  totalContracts:    number
  executedContracts: number
  pendingApprovals:  number
  expiringSoon:      number
  highRiskOpen:      number
  executedTotalValue: number
  executedTotalCurrency: string
  cycleTimeAvgDays:    number | null
  cycleTimeMedianDays: number | null
  approvalAcceptanceRate: number | null
  onTimeExecutionRate:    number | null
  withinTargetDays:        number
  windowDays:              number
}

interface ApiDistributions {
  byStatus: { key: string; count: number }[]
  byType:   { key: string; count: number }[]
  byRisk:   { key: string; count: number; label: string }[]
}

interface ApiTimeseries {
  series: { month: string; label: string; created: number; executed: number }[]
}

interface ApiTopCps {
  data: { counterparty: string; counterpartyId: string | null; count: number; value: number; currency: string }[]
}

function formatMoney(n: number, currency = 'USD'): string {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(0)}K`
  return `${currency} ${n.toFixed(0)}`
}
function formatPct(p: number | null): string {
  if (p == null) return '—'
  return `${Math.round(p * 100)}%`
}
function formatDays(d: number | null): string {
  if (d == null) return '—'
  if (d < 1) return '<1d'
  return `${d.toFixed(1)}d`
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:               '#94a3b8',  // slate-400
  PENDING_REVIEW:      '#a78bfa',  // violet-400
  UNDER_NEGOTIATION:   '#fb923c',  // orange-400
  PENDING_APPROVAL:    '#facc15',  // yellow-400
  APPROVED:            '#34d399',  // emerald-400
  PENDING_SIGNATURE:   '#fbbf24',  // amber-400
  EXECUTED:            '#10b981',  // emerald-500
  EXPIRED:             '#ef4444',  // red-500
  TERMINATED:          '#dc2626',  // red-600
  ARCHIVED:            '#9ca3af',  // gray-400
}

const RISK_COLOR: Record<string, string> = {
  low:      '#10b981',
  medium:   '#fbbf24',
  high:     '#f97316',
  critical: '#dc2626',
  none:     '#cbd5e1',
}

export function AnalyticsPage() {
  const [windowDays, setWindowDays] = useState(90)

  const { data: summary, isLoading: summaryLoading } = useQuery<ApiSummary>({
    queryKey: ['analytics-summary', windowDays],
    queryFn:  () => api.get(`/analytics/summary?days=${windowDays}`).then(r => r.data),
    refetchInterval: 60_000,
  })
  const { data: dists } = useQuery<ApiDistributions>({
    queryKey: ['analytics-distributions'],
    queryFn:  () => api.get('/analytics/distributions').then(r => r.data),
  })
  const { data: ts } = useQuery<ApiTimeseries>({
    queryKey: ['analytics-timeseries'],
    queryFn:  () => api.get('/analytics/timeseries').then(r => r.data),
  })
  const { data: tops } = useQuery<ApiTopCps>({
    queryKey: ['analytics-top-cps'],
    queryFn:  () => api.get('/analytics/top-counterparties?limit=10').then(r => r.data),
  })

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto" data-testid="analytics-page">
      <div className="flex items-center justify-between mb-1 gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-blue-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Window:</span>
          <select
            value={windowDays}
            onChange={e => setWindowDays(Number(e.target.value))}
            data-testid="analytics-window"
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Portfolio KPIs, cycle time, and contract distribution at a glance.
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard
          label="Total contracts"
          value={summary?.totalContracts ?? 0}
          icon={FileText}
          tone="blue"
          to="/contracts"
          loading={summaryLoading}
          data-testid="kpi-total"
        />
        <KpiCard
          label="Executed"
          value={summary?.executedContracts ?? 0}
          icon={CheckCircle2}
          tone="emerald"
          subtitle={summary ? formatMoney(summary.executedTotalValue, summary.executedTotalCurrency) + ' total' : ''}
          to="/contracts?status=EXECUTED"
          loading={summaryLoading}
          data-testid="kpi-executed"
        />
        <KpiCard
          label="Pending approvals"
          value={summary?.pendingApprovals ?? 0}
          icon={Clock}
          tone="amber"
          to="/approvals"
          loading={summaryLoading}
          data-testid="kpi-approvals"
        />
        <KpiCard
          label="Expiring (90d)"
          value={summary?.expiringSoon ?? 0}
          icon={CalendarClock}
          tone="orange"
          to="/renewals?bucket=next_90"
          loading={summaryLoading}
          data-testid="kpi-expiring"
        />
        <KpiCard
          label="High risk + open"
          value={summary?.highRiskOpen ?? 0}
          icon={AlertTriangle}
          tone="red"
          to="/contracts?riskBand=high"
          loading={summaryLoading}
          data-testid="kpi-high-risk"
        />
      </div>

      {/* KPIs row 2: time-based metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetricBar
          label="Cycle time"
          value={formatDays(summary?.cycleTimeAvgDays ?? null)}
          subtitle={`Median ${formatDays(summary?.cycleTimeMedianDays ?? null)} · over last ${summary?.windowDays ?? 90} days`}
          icon={TrendingUp}
          tone="blue"
        />
        <MetricBar
          label="Approval acceptance"
          value={formatPct(summary?.approvalAcceptanceRate ?? null)}
          subtitle="Approved ÷ (Approved + Rejected)"
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricBar
          label="On-time execution"
          value={formatPct(summary?.onTimeExecutionRate ?? null)}
          subtitle={`% executed within ${summary?.withinTargetDays ?? 14}d of creation`}
          icon={Sparkles}
          tone="purple"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Monthly contract volume" data-testid="chart-volume">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ts?.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="created"  stroke="#3b82f6" strokeWidth={2} name="Created" />
              <Line type="monotone" dataKey="executed" stroke="#10b981" strokeWidth={2} name="Executed" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status distribution" data-testid="chart-status">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={(dists?.byStatus ?? []).map(s => ({ name: s.key.replace(/_/g, ' '), count: s.count, key: s.key }))}
              layout="vertical"
              margin={{ left: 100, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, 'dataMax']} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" name="Contracts" isAnimationActive={false}>
                {(dists?.byStatus ?? []).map((s, i) => (
                  <Cell key={i} fill={STATUS_COLOR[s.key] ?? '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Risk distribution" data-testid="chart-risk">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dists?.byRisk ?? []} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Contracts">
                {(dists?.byRisk ?? []).map((r, i) => (
                  <Cell key={i} fill={RISK_COLOR[r.key] ?? '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Contract types" data-testid="chart-types">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={(dists?.byType ?? []).slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="key" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" name="Contracts" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top counterparties */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Top counterparties by executed value
          </h3>
        </header>
        {!tops?.data?.length ? (
          <div className="text-sm text-gray-500 px-5 py-8 text-center">No executed contracts yet.</div>
        ) : (
          <table className="w-full text-sm" data-testid="top-counterparties-table">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Counterparty</th>
                <th className="text-right px-5 py-2 font-medium">Contracts</th>
                <th className="text-right px-5 py-2 font-medium">Total ACV</th>
                <th className="text-right px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tops.data.map(cp => (
                <tr key={cp.counterparty} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{cp.counterparty}</td>
                  <td className="px-5 py-2.5 text-right text-gray-700 tabular-nums">{cp.count}</td>
                  <td className="px-5 py-2.5 text-right font-medium text-gray-900 tabular-nums">{formatMoney(cp.value, cp.currency)}</td>
                  <td className="px-5 py-2.5 text-right">
                    {cp.counterpartyId ? (
                      <Link
                        to={`/contracts?counterpartyId=${encodeURIComponent(cp.counterpartyId)}&filterLabel=${encodeURIComponent(cp.counterparty)}`}
                        className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
                      >
                        View <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, subtitle, icon: Icon, tone, to, loading, ...rest }: {
  label:    string
  value:    number
  subtitle?: string
  icon:     React.ComponentType<{ className?: string }>
  tone:     'blue' | 'emerald' | 'amber' | 'orange' | 'red'
  to?:      string
  loading?: boolean
  'data-testid'?: string
}) {
  const tones = {
    blue:    'text-blue-700 bg-blue-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    amber:   'text-amber-700 bg-amber-50',
    orange:  'text-orange-700 bg-orange-50',
    red:     'text-red-700 bg-red-50',
  }[tone]
  const card = (
    <div className="border border-gray-200 rounded-xl p-3 bg-white hover:shadow-sm transition-shadow" {...rest}>
      <div className="flex items-start justify-between">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${tones}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums text-gray-900">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-300" /> : value}
      </div>
      {subtitle && <div className="text-[10.5px] text-gray-500 mt-0.5 truncate">{subtitle}</div>}
    </div>
  )
  return to ? <Link to={to} className="block">{card}</Link> : card
}

function MetricBar({ label, value, subtitle, icon: Icon, tone }: {
  label:    string
  value:    string
  subtitle: string
  icon:     React.ComponentType<{ className?: string }>
  tone:     'blue' | 'emerald' | 'purple'
}) {
  const valueClass = {
    blue:    'text-blue-700',
    emerald: 'text-emerald-700',
    purple:  'text-purple-700',
  }[tone]
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
        <div className="text-[10.5px] text-gray-500 truncate">{subtitle}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children, ...rest }: {
  title:    string
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4" {...rest}>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}
