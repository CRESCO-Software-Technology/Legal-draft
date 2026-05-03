/**
 * SendForReviewDialog (U.6.1)
 *
 * Replaces the silent state-flip the toolbar's "Send for Review" used
 * to do (audit P1 #5). Users now see:
 *   • Which workflow will run (auto-selected, with override picker)
 *   • Who the first reviewer will be (from the workflow's first step)
 *   • An optional message that goes to the approver
 *
 * The auto-selected workflow is the org default OR one whose
 * triggerRules match this contract's type / value. Users can override
 * via the dropdown.
 */
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader2, X, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'

interface WorkflowDef {
  id: string
  name: string
  description?: string | null
  isDefault: boolean
  isActive: boolean
  steps: Array<{
    name?: string
    stepName?: string
    approverType?: string
    approverIds?: string[]
    approverRoles?: string[]
  }>
  triggerRules?: { contractTypes?: string[]; minValue?: number } | null
}

export function SendForReviewDialog({
  contractId,
  contractType,
  open,
  onClose,
  onSent,
}: {
  contractId: string
  contractType?: string
  open: boolean
  onClose: () => void
  onSent: () => void
}) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery<WorkflowDef[]>({
    queryKey: ['workflows-for-review', contractType],
    queryFn: () => api.get('/approvals/workflows').then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  })

  // Pick the auto-default: contractType match → isDefault → first.
  const autoDefault = (() => {
    if (workflows.length === 0) return null
    const byType = contractType
      ? workflows.find(w => w.triggerRules?.contractTypes?.includes(contractType))
      : null
    return byType ?? workflows.find(w => w.isDefault) ?? workflows[0]
  })()

  const effectiveWorkflowId = selectedWorkflowId ?? autoDefault?.id ?? null
  const effectiveWorkflow = workflows.find(w => w.id === effectiveWorkflowId) ?? autoDefault

  const submit = useMutation({
    mutationFn: () => api.post(`/contracts/${contractId}/submit-approval`, {
      workflowDefinitionId: effectiveWorkflowId,
      comment: message.trim() || undefined,
    }).then(r => r.data),
    onSuccess: () => {
      onSent()
      onClose()
      // reset for next time
      setSelectedWorkflowId(null)
      setMessage('')
    },
  })

  if (!open) return null

  const firstStep = effectiveWorkflow?.steps?.[0]
  const firstStepLabel = firstStep
    ? (firstStep.stepName ?? firstStep.name ?? 'First reviewer')
    : 'First reviewer'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Send for review"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="send-for-review-dialog"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Send for review</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick a workflow and (optionally) leave a note for the reviewer.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {loadingWorkflows ? (
            <div className="flex items-center justify-center py-6 text-gray-400 gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading workflows…
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 inline-flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">No workflows configured</p>
                <p className="text-xs mt-1 leading-relaxed">An admin needs to create a workflow first via Admin → Approvals.</p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Workflow</label>
                <select
                  value={effectiveWorkflowId ?? ''}
                  onChange={e => setSelectedWorkflowId(e.target.value || null)}
                  data-testid="send-for-review-workflow"
                  className="w-full h-10 text-sm border border-gray-200 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white"
                >
                  {workflows.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.isDefault ? ' (default)' : ''}
                      {w === autoDefault && w !== workflows[0] ? ' — auto-matched for this contract' : ''}
                    </option>
                  ))}
                </select>
                {effectiveWorkflow?.description && (
                  <p className="text-[11px] text-gray-500 mt-1.5">{effectiveWorkflow.description}</p>
                )}
              </div>

              {/* Reviewer chain preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
                  First reviewer
                </div>
                <div className="text-[13px] text-gray-800 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {firstStepLabel}
                </div>
                {(effectiveWorkflow?.steps?.length ?? 0) > 1 && (
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Then {effectiveWorkflow!.steps.length - 1} more {effectiveWorkflow!.steps.length - 1 === 1 ? 'step' : 'steps'} in sequence.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Anything the reviewer should know? (e.g. urgency, key terms to focus on)"
                  data-testid="send-for-review-message"
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              {submit.isError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2.5 inline-flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{(submit.error as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error ?? (submit.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not submit. Try again.'}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => submit.mutate()}
            disabled={!effectiveWorkflowId || submit.isPending || workflows.length === 0}
            data-testid="send-for-review-confirm"
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submit.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              : <>Send <ArrowRight className="h-3.5 w-3.5" /></>}
          </Button>
        </div>
      </div>
    </div>
  )
}
