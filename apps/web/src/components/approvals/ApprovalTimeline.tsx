/**
 * ApprovalTimeline — Phase 06
 * Vertical timeline of all steps in an approval instance.
 * Shows: step name, approver, status badge, decision timestamp, comment.
 */
import { CheckCircle2, XCircle, Clock, ArrowRight, Zap, AlertTriangle } from 'lucide-react'

interface ApprovalStep {
  id: string
  stepOrder: number
  stepName: string
  approverId: string
  approverName?: string
  status: string
  decision?: string
  comment?: string
  delegatedToId?: string
  decidedAt?: string
  escalateAt?: string
}

interface ApprovalInstance {
  id: string
  status: string
  currentStepOrder: number
  submittedAt: string
  decidedAt?: string
  aiSummary?: string
  approvalRecommendation?: string
}

interface Props {
  instance: ApprovalInstance
  steps: ApprovalStep[]
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING:      { icon: <Clock className="h-4 w-4" />,          color: 'text-amber-500 bg-amber-50 border-amber-200',   label: 'Pending'       },
  APPROVED:     { icon: <CheckCircle2 className="h-4 w-4" />,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Approved'   },
  REJECTED:     { icon: <XCircle className="h-4 w-4" />,        color: 'text-red-600 bg-red-50 border-red-200',          label: 'Rejected'      },
  DELEGATED:    { icon: <ArrowRight className="h-4 w-4" />,     color: 'text-blue-600 bg-blue-50 border-blue-200',       label: 'Delegated'     },
  ESCALATED:    { icon: <AlertTriangle className="h-4 w-4" />,  color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Escalated'     },
  AUTO_APPROVED:{ icon: <Zap className="h-4 w-4" />,            color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Auto-approved' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['PENDING']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function fmtDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ApprovalTimeline({ instance, steps }: Props) {
  // Auto-approved: single row
  if (instance.status === 'AUTO_APPROVED') {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <Zap className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Auto-approved</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Approved automatically based on org rules on {fmtDate(instance.submittedAt)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (steps.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No approval steps yet.</p>
  }

  // Group by stepOrder to show parallel steps together
  const grouped = steps.reduce<Record<number, ApprovalStep[]>>((acc, s) => {
    ;(acc[s.stepOrder] ??= []).push(s)
    return acc
  }, {})
  const sortedOrders = Object.keys(grouped).map(Number).sort((a, b) => a - b)

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />

      <div className="space-y-4 pl-10">
        {sortedOrders.map(order => {
          const group = grouped[order]
          const isActive = order === instance.currentStepOrder && instance.status === 'PENDING'
          return (
            <div key={order} className={`relative ${isActive ? 'rounded-lg border border-blue-200 bg-blue-50/40 p-3' : ''}`}>
              {/* Dot on the line */}
              <div className={`absolute -left-[26px] top-1.5 w-3 h-3 rounded-full border-2 ${
                isActive ? 'border-blue-500 bg-blue-500' :
                group.some(s => s.status === 'APPROVED') ? 'border-emerald-500 bg-emerald-500' :
                group.some(s => s.status === 'REJECTED') ? 'border-red-500 bg-red-500' :
                'border-gray-300 bg-white'
              }`} />

              {group.length > 1 && (
                <p className="text-xs font-medium text-gray-500 mb-2">Step {order + 1} — Parallel</p>
              )}

              {group.map(step => (
                <div key={step.id} className={`${group.length > 1 ? 'ml-2 border-l-2 pl-3 mb-2' : ''} ${
                  group.length > 1 && step.status === 'APPROVED' ? 'border-emerald-400' :
                  group.length > 1 && step.status === 'REJECTED' ? 'border-red-400' : 'border-gray-200'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {step.stepName}
                        {group.length === 1 && <span className="text-gray-400 font-normal"> — Step {step.stepOrder + 1}</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.approverName ?? step.approverId}</p>
                    </div>
                    <StatusBadge status={step.status} />
                  </div>

                  {step.decidedAt && (
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(step.decidedAt)}</p>
                  )}
                  {step.status === 'PENDING' && step.escalateAt && (
                    <p className="text-xs text-amber-600 mt-1">
                      Due by {fmtDate(step.escalateAt)}
                    </p>
                  )}
                  {step.comment && (
                    <p className="text-xs italic text-gray-500 mt-1 border-l-2 border-gray-200 pl-2">
                      "{step.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {/* Final outcome */}
        {(instance.status === 'APPROVED' || instance.status === 'REJECTED') && (
          <div className={`relative rounded-lg border p-3 ${
            instance.status === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="absolute -left-[26px] top-3 w-3 h-3 rounded-full border-2 bg-white border-gray-300" />
            <div className="flex items-center gap-2">
              {instance.status === 'APPROVED'
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <XCircle className="h-4 w-4 text-red-600" />}
              <p className="text-sm font-semibold text-gray-800">
                {instance.status === 'APPROVED' ? 'Contract Approved' : 'Contract Rejected — Returned to Draft'}
              </p>
            </div>
            {instance.decidedAt && (
              <p className="text-xs text-gray-400 mt-1 ml-6">{fmtDate(instance.decidedAt)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
