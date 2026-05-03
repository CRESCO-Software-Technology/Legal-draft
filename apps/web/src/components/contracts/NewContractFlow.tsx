/**
 * NewContractFlow — Phase 4.5 gap fix
 * Two-step modal:
 *   Step 1: Pick a template (TemplateSelectorModal)
 *   Step 2: Fill title / counterparty / context → call Draft Agent → navigate to contract
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, X, ArrowLeft, Wand2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { TemplateSelectorModal } from '@/components/TemplateSelectorModal'
import type { Template } from '@clm/types'

interface Props {
  onClose: () => void
  onCreated: (contractId: string) => void
}

export function NewContractFlow({ onClose, onCreated }: Props) {
  const user = useAuthStore(s => s.user)
  const [step, setStep] = useState<'template' | 'details'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [title, setTitle] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [context, setContext] = useState('')

  const draftMutation = useMutation({
    mutationFn: async () => {
      const message = [
        `Draft a ${selectedTemplate?.contractType ?? 'contract'} contract titled "${title}"`,
        counterparty ? `for ${counterparty}` : '',
        context ? `. ${context}` : '',
      ].filter(Boolean).join(' ')

      const res = await api.post('/agent/draft', {
        userMessage: message,
        templateId: selectedTemplate?.id,
        orgId: user?.orgId,
        userId: user?.id,
        saveAs: {
          title,
          orgId: user?.orgId,
          createdById: user?.id,
        },
      })
      return res.data
    },
    onSuccess: (data) => {
      const contractId = data.contractId ?? data.contract?.id
      if (contractId) onCreated(contractId)
    },
  })

  // ── Step 1: template picker ────────────────────────────────────────────────

  if (step === 'template') {
    return (
      <TemplateSelectorModal
        onSelect={(t) => {
          setSelectedTemplate(t)
          setTitle(t.name)
          setStep('details')
        }}
        onClose={onClose}
      />
    )
  }

  // ── Step 2: draft details form ─────────────────────────────────────────────

  const canSubmit = title.trim().length > 0 && !draftMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => setStep('template')}
            className="text-gray-400 hover:text-gray-600"
            title="Back to templates"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Draft Details</h2>
            <p className="text-sm text-gray-500">
              Template: <span className="font-medium text-gray-700">{selectedTemplate?.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. NDA with Acme Corp"
              data-testid="draft-title-input"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Counterparty name
            </label>
            <input
              value={counterparty}
              onChange={e => setCounterparty(e.target.value)}
              placeholder="e.g. Acme Corporation"
              data-testid="draft-counterparty-input"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional context for AI
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. 2-year term, mutual NDA, governing law Delaware, SaaS licensing deal..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none"
            />
          </div>

          {draftMutation.isError && (
            <p className="text-sm text-red-600" data-testid="draft-error">
              {(() => {
                // P61 audit (2026-05-02). Surface the API's typed detail
                // (NO_TEMPLATE_MATCH, etc.) instead of a generic "failed"
                // — users need to know to publish a template / pick a
                // different type, not just retry.
                const err = draftMutation.error as { response?: { data?: { detail?: string } }; message?: string } | undefined
                return err?.response?.data?.detail
                  ?? err?.message
                  ?? 'Draft generation failed — please try again.'
              })()}
            </p>
          )}

          {draftMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating draft with AI… this takes 20–40 seconds
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => draftMutation.mutate()}
            disabled={!canSubmit}
            data-testid="draft-generate-btn"
            className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Generate Draft
          </button>
        </div>
      </div>
    </div>
  )
}
