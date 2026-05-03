/**
 * InvoicesPage — invoice reconciliation (Phase 08 Step 9).
 *
 * Customers track vendor invoices against payment obligations
 * extracted from executed contracts. The page shows every invoice with
 * its match status; users confirm via "Reconcile", flag mismatches via
 * "Dispute", or open the contract for context.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Receipt, Plus, Loader2, AlertCircle, CheckCircle2, ArrowRight,
  Search, Sparkles, RotateCw, Flag, FileText, X,
} from 'lucide-react'

type Status = 'all' | 'PENDING' | 'MATCHED' | 'RECONCILED' | 'DISPUTED'

interface ApiInvoice {
  id:                  string
  vendorName:          string
  invoiceNumber:       string | null
  amount:              string  // Prisma Decimal serialized
  currency:            string
  invoiceDate:         string
  dueDate:             string | null
  description:         string | null
  status:              'PENDING' | 'MATCHED' | 'RECONCILED' | 'DISPUTED'
  matchScore:          number | null
  reconciledAt:        string | null
  contract: { id: string; title: string; counterpartyName: string | null } | null
  matchedObligation: {
    id: string; type: string; description: string; dueDate: string | null
  } | null
}

interface ApiStats {
  pending:    number
  matched:    number
  reconciled: number
  disputed:   number
  openTotal:  number
}

const STATUS_PILL: Record<string, { bg: string; label: string }> = {
  PENDING:    { bg: 'bg-gray-100 border-gray-200 text-gray-700',           label: 'Pending' },
  MATCHED:    { bg: 'bg-blue-50 border-blue-200 text-blue-700',             label: 'Matched' },
  RECONCILED: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',    label: 'Reconciled' },
  DISPUTED:   { bg: 'bg-red-50 border-red-200 text-red-700',                label: 'Disputed' },
}

const FILTERS: { key: Status; label: string; statKey?: keyof ApiStats }[] = [
  { key: 'all',        label: 'All' },
  { key: 'PENDING',    label: 'Pending',    statKey: 'pending' },
  { key: 'MATCHED',    label: 'Matched',    statKey: 'matched' },
  { key: 'RECONCILED', label: 'Reconciled', statKey: 'reconciled' },
  { key: 'DISPUTED',   label: 'Disputed',   statKey: 'disputed' },
]

function formatMoney(amount: string | number, currency = 'USD'): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (isNaN(n)) return `${currency} 0`
  return n.toLocaleString('en-US', { style: 'currency', currency })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function MatchScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const tone = pct >= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : pct >= 50 ? 'text-blue-700 bg-blue-50 border-blue-200'
            : 'text-amber-700 bg-amber-50 border-amber-200'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium border ${tone}`}>
      <Sparkles className="h-2.5 w-2.5" />
      {pct}%
    </span>
  )
}

export function InvoicesPage() {
  const [status, setStatus] = useState<Status>('all')
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const qc = useQueryClient()

  const { data: stats } = useQuery<ApiStats>({
    queryKey: ['invoice-stats'],
    queryFn:  () => api.get('/invoices/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data, isLoading, isError } = useQuery<{ data: ApiInvoice[]; total: number }>({
    queryKey: ['invoices-list', status, q],
    queryFn:  () => api.get(`/invoices?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}&limit=100`).then(r => r.data),
    refetchInterval: 60_000,
  })

  const reconcile = useMutation({
    mutationFn: async (id: string) => (await api.post(`/invoices/${id}/reconcile`, {})).data,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
      qc.invalidateQueries({ queryKey: ['obligations-list'] })
      qc.invalidateQueries({ queryKey: ['obligations-stats'] })
    },
  })
  const rematch = useMutation({
    mutationFn: async (id: string) => (await api.post(`/invoices/${id}/rematch`, {})).data,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['invoices-list'] }),
  })
  const dispute = useMutation({
    mutationFn: async (id: string) => (await api.post(`/invoices/${id}/dispute`, { reason: 'Flagged from invoices page' })).data,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto" data-testid="invoices-page">
      <div className="flex items-center justify-between mb-1 gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-amber-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="add-invoice-btn"
          className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="h-4 w-4" />
          Add invoice
        </Button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Match incoming vendor invoices to the payment obligations on your executed contracts.
      </p>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pending"      value={stats?.pending ?? 0}     tone="gray"    data-testid="stat-pending" />
        <StatCard label="Matched"      value={stats?.matched ?? 0}     tone="blue"    data-testid="stat-matched" />
        <StatCard label="Reconciled"   value={stats?.reconciled ?? 0}  tone="emerald" data-testid="stat-reconciled" />
        <StatCard
          label="Open total"
          value={stats?.openTotal ? formatMoney(stats.openTotal) : '$0'}
          tone="amber"
          data-testid="stat-open-total"
          subtitle="pending + matched"
        />
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-1 -mb-2 overflow-x-auto">
          {FILTERS.map(f => {
            const active = status === f.key
            const count = f.statKey ? stats?.[f.statKey] ?? 0 : null
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                data-testid={`invoice-filter-${f.key}`}
                className={`px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-amber-600 text-amber-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {f.label}
                {count != null && count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
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
            placeholder="Search vendor or invoice #"
            value={q}
            onChange={e => setQ(e.target.value)}
            data-testid="invoices-search"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 w-full sm:w-64"
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
          Failed to load invoices.
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-xl" data-testid="invoices-empty">
          <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">
            {q ? `No invoices match "${q}".` : 'No invoices yet.'}
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Add an invoice to auto-match it against the payment obligations on your contracts.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add invoice
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
            {total} {total === 1 ? 'invoice' : 'invoices'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="invoices-table">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Invoice date</th>
                  <th className="text-left px-4 py-3 font-medium">Match</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(inv => {
                  const pill = STATUS_PILL[inv.status]
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50" data-testid={`invoice-row-${inv.id}`}>
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="font-medium text-gray-900 truncate" title={inv.vendorName}>
                          {inv.vendorName}
                        </div>
                        {inv.invoiceNumber && (
                          <div className="text-xs text-gray-500 mt-0.5 font-mono">#{inv.invoiceNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 tabular-nums">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="px-4 py-3">
                        {inv.matchedObligation && inv.contract ? (
                          <div className="flex items-start gap-1.5 min-w-0">
                            <Sparkles className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 max-w-[260px]">
                              <Link
                                to={`/contracts/${inv.contract.id}`}
                                className="text-xs font-medium text-blue-700 hover:text-blue-800 truncate block"
                                title={inv.contract.title}
                              >
                                {inv.contract.title}
                              </Link>
                              <div className="text-[10.5px] text-gray-500 truncate" title={inv.matchedObligation.description}>
                                {inv.matchedObligation.description}
                              </div>
                              <div className="mt-0.5">
                                <MatchScoreBadge score={inv.matchScore} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No match</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${pill.bg}`}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          {inv.status === 'MATCHED' && (
                            <button
                              type="button"
                              onClick={() => reconcile.mutate(inv.id)}
                              disabled={reconcile.isPending}
                              data-testid={`reconcile-${inv.id}`}
                              className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Reconcile
                            </button>
                          )}
                          {(inv.status === 'PENDING' || inv.status === 'MATCHED') && (
                            <button
                              type="button"
                              onClick={() => rematch.mutate(inv.id)}
                              disabled={rematch.isPending}
                              data-testid={`rematch-${inv.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              title="Re-run auto-matcher"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                              Rematch
                            </button>
                          )}
                          {(inv.status === 'PENDING' || inv.status === 'MATCHED') && (
                            <button
                              type="button"
                              onClick={() => dispute.mutate(inv.id)}
                              disabled={dispute.isPending}
                              data-testid={`dispute-${inv.id}`}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              <Flag className="h-3.5 w-3.5" />
                              Dispute
                            </button>
                          )}
                          {inv.contract?.id && (
                            <Link
                              to={`/contracts/${inv.contract.id}`}
                              className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <ArrowRight className="h-3 w-3" />
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

      {createOpen && (
        <CreateInvoiceDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['invoices-list'] })
            qc.invalidateQueries({ queryKey: ['invoice-stats'] })
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, tone, subtitle, ...rest }: {
  label:    string
  value:    number | string
  tone:     'gray' | 'blue' | 'emerald' | 'amber' | 'red'
  subtitle?: string
  'data-testid'?: string
}) {
  const toneClass = {
    gray:    'text-gray-700',
    blue:    'text-blue-700',
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    red:     'text-red-700',
  }[tone]
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white" {...rest}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${toneClass}`}>{value}</div>
      {subtitle && <div className="text-[10.5px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  )
}

function CreateInvoiceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [vendorName,    setVendorName]    = useState('')
  const [amount,        setAmount]        = useState('')
  const [currency,      setCurrency]      = useState('USD')
  const [invoiceDate,   setInvoiceDate]   = useState(new Date().toISOString().slice(0, 10))
  const [dueDate,       setDueDate]       = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description,   setDescription]   = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const [matchPreview,  setMatchPreview]  = useState<{ vendor: string; obligation: string; score: number } | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.post('/invoices', {
        vendorName:    vendorName.trim(),
        amount:        Number(amount),
        currency:      currency.toUpperCase(),
        invoiceDate,
        dueDate:       dueDate || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        description:   description.trim() || undefined,
      })
      return r.data as { invoice: ApiInvoice; matchReason: string | null }
    },
    onSuccess: (data) => {
      if (data.invoice.matchedObligation && data.invoice.contract) {
        setMatchPreview({
          vendor: data.invoice.contract.title,
          obligation: data.invoice.matchedObligation.description,
          score: Math.round((data.invoice.matchScore ?? 0) * 100),
        })
      } else {
        onCreated()
        onClose()
      }
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? 'Failed to create invoice.')
    },
  })

  const valid = vendorName.trim() && amount && !isNaN(Number(amount)) && Number(amount) > 0 && invoiceDate

  if (matchPreview) {
    return (
      <div role="dialog" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Match found</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            We linked this invoice to <strong>{matchPreview.vendor}</strong> at <strong>{matchPreview.score}%</strong> confidence.
          </p>
          <div className="text-xs bg-blue-50 border border-blue-200 rounded-md p-2 mb-4">
            <div className="text-blue-900">{matchPreview.obligation}</div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { onCreated(); onClose() }}>Done</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-label="Add invoice"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
      data-testid="create-invoice-dialog"
    >
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Add invoice
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Auto-matches against open payment obligations on your contracts.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor name</label>
            <Input
              value={vendorName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendorName(e.target.value)}
              placeholder="Acme Corp"
              data-testid="invoice-vendor"
            />
            <p className="text-[10.5px] text-gray-400 mt-1">Match works best when this matches the contract counterparty.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="invoice-amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                data-testid="invoice-currency"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice date</label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvoiceDate(e.target.value)}
                data-testid="invoice-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date <span className="text-gray-400 font-normal">(optional)</span></label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
                data-testid="invoice-due-date"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice number <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input
              value={invoiceNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvoiceNumber(e.target.value)}
              placeholder="INV-12345"
              data-testid="invoice-number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Q2 2026 retainer, monthly hosting fee, etc."
              rows={2}
              data-testid="invoice-description"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
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
            disabled={!valid || create.isPending}
            data-testid="invoice-create-confirm"
            className="bg-amber-600 hover:bg-amber-700"
          >
            {create.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1" /> Add + match</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
