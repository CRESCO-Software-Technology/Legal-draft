/**
 * CreateAmendmentDialog (Phase 08 Step 8)
 *
 * Modal that creates a new draft contract linked to a parent via
 * parentContractId. Used to spawn amendments / SOWs / order forms /
 * renewals that should live as their own contract record but stay
 * connected to the parent for family-tree views.
 *
 * After creation the user is redirected to the new contract so they
 * can edit / draft via the agent / upload a file before signing.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GitBranch, X, Loader2 } from 'lucide-react'

interface Props {
  parentContractId: string
  parentTitle:      string
  open:             boolean
  onClose:          () => void
  onCreated?:       (newId: string) => void
}

const REL_TYPES = [
  { key: 'amendment',    label: 'Amendment',    desc: 'Modifies a clause, term, or value of the parent.' },
  { key: 'sow',          label: 'Statement of Work', desc: 'Project-specific scope under an MSA.' },
  { key: 'order_form',   label: 'Order Form',   desc: 'Procurement / pricing addendum.' },
  { key: 'renewal',      label: 'Renewal',      desc: 'Extends the parent past its expiry.' },
  { key: 'exhibit_only', label: 'Exhibit',      desc: 'Schedule, exhibit, or appendix.' },
]

export function CreateAmendmentDialog({ parentContractId, parentTitle, open, onClose, onCreated }: Props) {
  const navigate = useNavigate()
  const [title, setTitle]                         = useState('')
  const [relationshipType, setRelationshipType]   = useState('amendment')
  const [description, setDescription]             = useState('')
  const [error, setError]                         = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.post(`/contracts/${parentContractId}/amendments`, {
        title:            title.trim() || undefined,
        relationshipType,
        description:      description.trim() || undefined,
      })
      return r.data as { id: string; title: string }
    },
    onSuccess: (data) => {
      onCreated?.(data.id)
      onClose()
      setTitle(''); setDescription(''); setRelationshipType('amendment'); setError(null)
      navigate(`/contracts/${data.id}`)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? 'Failed to create amendment.')
    },
  })

  if (!open) return null

  const selectedRel = REL_TYPES.find(r => r.key === relationshipType)

  return (
    <div
      role="dialog"
      aria-label="Create amendment"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
      data-testid="create-amendment-dialog"
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-indigo-600" />
              Create amendment
            </h2>
            <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
              Linked to <span className="font-medium">{parentTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Relationship type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REL_TYPES.map(rt => (
                <button
                  key={rt.key}
                  type="button"
                  onClick={() => setRelationshipType(rt.key)}
                  data-testid={`amendment-rel-${rt.key}`}
                  className={`text-left p-2.5 rounded-md border text-sm transition-colors ${
                    relationshipType === rt.key
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="font-medium text-gray-900">{rt.label}</div>
                </button>
              ))}
            </div>
            {selectedRel && (
              <p className="text-xs text-gray-500 mt-2">{selectedRel.desc}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Input
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder={`${parentTitle} — ${selectedRel?.label}`}
              data-testid="amendment-title"
              className="text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate from the parent + type.</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's changing? Effective date, scope, value impact, etc."
              rows={3}
              data-testid="amendment-description"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            data-testid="amendment-create-confirm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {create.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating…</>
            ) : (
              <><GitBranch className="h-4 w-4 mr-1" /> Create draft</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
