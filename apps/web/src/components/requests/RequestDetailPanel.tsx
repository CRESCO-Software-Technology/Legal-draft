import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  X, Loader2, CheckCircle, XCircle, MessageSquare, User,
  Sparkles, ChevronRight, AlertTriangle,
} from 'lucide-react'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SUBMITTED:        { label: 'Submitted',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_REVIEW:        { label: 'In Review',        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED:         { label: 'Accepted',         cls: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED:         { label: 'Rejected',         cls: 'bg-red-50 text-red-700 border-red-200' },
  MORE_INFO_NEEDED: { label: 'More Info Needed', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  COMPLETED:        { label: 'Completed',        cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const PRIORITY_BADGE: Record<string, string> = {
  LOW:    'bg-gray-100 text-gray-500',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH:   'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-600',
}

const TYPE_COLORS: Record<string, string> = {
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

interface AiClassification {
  contractType:      string
  suggestedPriority: string
  confidence:        number
  reason:            string
  extractedTerms: {
    counterparty?:   string | null
    estimatedValue?: number | null
    governingLaw?:   string | null
    duration?:       string | null
    startDate?:      string | null
  }
}

interface Request {
  id:              string
  requestNumber:   string | null
  title:           string
  type:            string
  status:          string
  priority:        string
  counterpartyName: string | null
  description:     string
  estimatedValue:  string | null
  assignedToId:    string | null
  createdAt:       string
  metadata:        Record<string, unknown>
}

interface Props {
  request: Request
  onClose: () => void
}

export function RequestDetailPanel({ request, onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedAssignee, setSelectedAssignee] = useState(request.assignedToId ?? '')

  const { data: usersData } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })
  const users: Array<{ id: string; name: string; email: string }> = usersData?.data ?? usersData ?? []

  const aiClassification = request.metadata?._aiClassification as AiClassification | undefined

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/requests/${request.id}`, body).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  })

  const convert = useMutation({
    mutationFn: () => api.post(`/requests/${request.id}/convert`).then(r => r.data),
    onSuccess: (data: { contractId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      onClose()
      navigate(`/contracts/${data.contractId}`)
    },
  })

  const handleAssign = (userId: string) => {
    setSelectedAssignee(userId)
    patch.mutate({ assignedToId: userId || null })
  }

  const handleStatus = (status: string) => patch.mutate({ status })

  const isActionable = !['ACCEPTED', 'REJECTED', 'COMPLETED'].includes(request.status)
  const badge = STATUS_BADGE[request.status] ?? STATUS_BADGE.SUBMITTED

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {request.requestNumber && (
                <span className="text-[10px] font-mono text-gray-400">{request.requestNumber}</span>
              )}
              <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
                {badge.label}
              </span>
              <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[request.priority] ?? PRIORITY_BADGE.MEDIUM}`}>
                {request.priority}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900 mt-1.5 leading-snug">{request.title}</h2>
          </div>
          <button onClick={onClose} className="ml-3 p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* AI Classification card */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-gray-700">AI Classification</span>
              {!aiClassification && (
                <span className="flex items-center gap-1 text-[10px] text-blue-500 ml-auto">
                  <Loader2 className="h-3 w-3 animate-spin" /> Classifying…
                </span>
              )}
            </div>
            {aiClassification ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[aiClassification.contractType] ?? TYPE_COLORS.OTHER}`}>
                    {aiClassification.contractType.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.round(aiClassification.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{Math.round(aiClassification.confidence * 100)}%</span>
                  </div>
                </div>
                {aiClassification.reason && (
                  <p className="text-xs text-gray-500 italic">{aiClassification.reason}</p>
                )}
                {/* Extracted terms */}
                {(() => {
                  const t = aiClassification.extractedTerms
                  const terms = [
                    t.counterparty    && ['Counterparty', t.counterparty],
                    t.estimatedValue  && ['Est. Value', `$${Number(t.estimatedValue).toLocaleString()}`],
                    t.governingLaw    && ['Governing Law', t.governingLaw],
                    t.duration        && ['Duration', t.duration],
                  ].filter(Boolean) as [string, string][]
                  return terms.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {terms.map(([label, val]) => (
                        <div key={label} className="bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                          <p className="text-[9px] uppercase tracking-wide text-gray-400">{label}</p>
                          <p className="text-xs font-medium text-gray-700 truncate">{val}</p>
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
            ) : (
              <p className="text-xs text-gray-400">AI is analysing the request in the background…</p>
            )}
          </div>

          {/* Meta */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Contract type</span>
              <span className={`font-medium px-2 py-0.5 rounded-full text-[11px] ${TYPE_COLORS[request.type] ?? TYPE_COLORS.OTHER}`}>
                {request.type.replace(/_/g, ' ')}
              </span>
            </div>
            {request.counterpartyName && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Counterparty</span>
                <span className="font-medium text-gray-800">{request.counterpartyName}</span>
              </div>
            )}
            {request.estimatedValue && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Est. value</span>
                <span className="font-medium text-gray-800">${Number(request.estimatedValue).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Submitted</span>
              <span className="text-gray-700">{new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{request.description}</p>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Assignee</p>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <select
                value={selectedAssignee}
                onChange={e => handleAssign(e.target.value)}
                disabled={!isActionable || patch.isPending}
                className="w-full h-9 text-sm border border-gray-200 rounded-lg pl-8 pr-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action footer */}
        {isActionable && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-2">
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              size="sm"
              onClick={() => convert.mutate()}
              disabled={convert.isPending || patch.isPending}
            >
              {convert.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating contract…</>
              ) : (
                <><CheckCircle className="h-3.5 w-3.5" /> Accept &amp; Create Contract <ChevronRight className="h-3.5 w-3.5 ml-auto" /></>
              )}
            </Button>
            <div className="flex gap-2">
              {request.status !== 'MORE_INFO_NEEDED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
                  onClick={() => handleStatus('MORE_INFO_NEEDED')}
                  disabled={patch.isPending}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Need More Info
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleStatus('REJECTED')}
                disabled={patch.isPending}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
            {request.status === 'MORE_INFO_NEEDED' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Awaiting additional information from requester
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
