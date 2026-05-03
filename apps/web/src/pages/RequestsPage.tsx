import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NewRequestModal } from '@/components/requests/NewRequestModal'
import { RequestDetailPanel } from '@/components/requests/RequestDetailPanel'
import { Plus, Search, ClipboardList, Loader2, ChevronRight } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: '',                label: 'All' },
  { value: 'SUBMITTED',       label: 'Submitted' },
  { value: 'IN_REVIEW',       label: 'In Review' },
  { value: 'MORE_INFO_NEEDED',label: 'More Info' },
  { value: 'ACCEPTED',        label: 'Accepted' },
  { value: 'REJECTED',        label: 'Rejected' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SUBMITTED:        { label: 'Submitted',       cls: 'bg-blue-50 text-blue-700' },
  IN_REVIEW:        { label: 'In Review',        cls: 'bg-amber-50 text-amber-700' },
  ACCEPTED:         { label: 'Accepted',         cls: 'bg-green-50 text-green-700' },
  REJECTED:         { label: 'Rejected',         cls: 'bg-red-50 text-red-600' },
  MORE_INFO_NEEDED: { label: 'More Info',        cls: 'bg-orange-50 text-orange-700' },
  COMPLETED:        { label: 'Completed',        cls: 'bg-gray-100 text-gray-500' },
}

const PRIORITY_CLS: Record<string, string> = {
  LOW:    'bg-gray-100 text-gray-500',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH:   'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-600',
}

const TYPE_CLS: Record<string, string> = {
  NDA:              'bg-purple-100 text-purple-700',
  MSA:              'bg-blue-100 text-blue-700',
  SOW:              'bg-cyan-100 text-cyan-700',
  SLA:              'bg-teal-100 text-teal-700',
  VENDOR_AGREEMENT: 'bg-orange-100 text-orange-700',
  EMPLOYMENT:       'bg-pink-100 text-pink-700',
  PARTNERSHIP:      'bg-indigo-100 text-indigo-700',
  LICENSE:          'bg-violet-100 text-violet-700',
  DATA_PROCESSING:  'bg-green-100 text-green-700',
  ORDER_FORM:       'bg-yellow-100 text-yellow-700',
  OTHER:            'bg-gray-100 text-gray-600',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RequestsPage() {
  const [activeTab, setActiveTab]     = useState('')
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [selectedRequest, setSelected] = useState<any>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['requests', activeTab, debouncedSearch],
    queryFn:  () => api.get('/requests', {
      params: {
        status: activeTab || undefined,
        search: debouncedSearch || undefined,
        limit: 50,
      },
    }).then(r => r.data),
    // Poll every 5s while any request is freshly submitted (AI classification in flight)
    refetchInterval: (q) => {
      const items: any[] = q.state.data?.data ?? []
      return items.some((r: any) => r.status === 'SUBMITTED') ? 5000 : false
    },
  })

  // B.6.16 — per-tab counts so users can see where the work is.
  const { data: countsData } = useQuery({
    queryKey: ['requests-counts'],
    queryFn: () => api.get('/requests/counts').then(r => r.data) as Promise<{ counts: Record<string, number>; total: number }>,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const counts = countsData?.counts ?? {}
  const totalAllTabs = countsData?.total ?? 0

  const requests: any[] = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 bg-white gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">Contract Requests</h1>
          {/* B.6.16 — one-sentence explainer so first-time visitors
              understand what a "request" is before they hunt. */}
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Ask Legal to draft a contract. Fill out what you need —
            type, counterparty, timeline — and they'll produce the
            first version for you.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNew(true)}
          data-testid="requests-create-btn"
          className="gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> New Request
        </Button>
      </div>

      {/* Tabs — B.6.16 adds inline counts so users see where work is */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-gray-100 bg-white">
        {STATUS_TABS.map(tab => {
          // For the "All" tab the count is the sum; otherwise look up
          // the specific status.
          const count = tab.value === '' ? totalAllTabs : counts[tab.value] ?? 0
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              data-testid={`requests-tab-${tab.value || 'all'}`}
              className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px inline-flex items-center gap-1.5 ${
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`tabular-nums rounded-full px-1.5 text-[10px] font-semibold ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="px-6 py-3 bg-white border-b border-gray-100">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search requests…"
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-gray-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ClipboardList className="h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">
              {debouncedSearch ? 'No requests match your search' : 'No requests found'}
            </p>
            {!activeTab && !debouncedSearch && (
              <Button size="sm" variant="outline" onClick={() => setShowNew(true)} className="gap-1.5 mt-1">
                <Plus className="h-3.5 w-3.5" /> Submit your first request
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 bg-white mx-6 my-4 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {requests.map(req => {
              const badge   = STATUS_BADGE[req.status] ?? STATUS_BADGE.SUBMITTED
              const typeCls = TYPE_CLS[req.type] ?? TYPE_CLS.OTHER
              const priCls  = PRIORITY_CLS[req.priority] ?? PRIORITY_CLS.MEDIUM
              const isClassifying = req.status === 'SUBMITTED' && !req.metadata?._aiClassification

              return (
                <button
                  key={req.id}
                  data-testid={`request-row-${req.id}`}
                  data-request-title={req.title}
                  onClick={() => setSelected(req)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors group"
                >
                  {/* Type dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${typeCls.split(' ')[0].replace('bg-', 'bg-').replace('-100', '-400')}`} />

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                      {isClassifying && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-500 bg-blue-50 rounded-full px-1.5 py-0.5 flex-shrink-0">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Classifying
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {req.requestNumber && (
                        <span className="text-[10px] font-mono text-gray-400">{req.requestNumber}</span>
                      )}
                      {req.counterpartyName && (
                        <span className="text-xs text-gray-400">{req.counterpartyName}</span>
                      )}
                      <span className="text-xs text-gray-300">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeCls}`}>
                      {req.type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priCls}`}>
                      {req.priority}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
      {selectedRequest && (
        <RequestDetailPanel
          request={selectedRequest}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
