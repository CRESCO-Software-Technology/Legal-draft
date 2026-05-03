/**
 * CompleteObligationModal (Phase 08 Step 4)
 *
 * Marks an obligation done with optional completion note + evidence file
 * (e.g. paid invoice, audit cert PDF). Posts multipart/form-data when a
 * file is attached, falls back to JSON otherwise.
 */
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Paperclip, X, Loader2 } from 'lucide-react'

interface Props {
  obligationId: string
  description:  string
  open:         boolean
  onClose:      () => void
  onCompleted?: () => void
}

const MAX_BYTES = 25 * 1024 * 1024

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function CompleteObligationModal({ obligationId, description, open, onClose, onCompleted }: Props) {
  const [note, setNote]   = useState('')
  const [file, setFile]   = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const complete = useMutation({
    mutationFn: async () => {
      if (file) {
        const fd = new FormData()
        if (note.trim()) fd.append('note', note.trim())
        fd.append('file', file)
        const r = await api.post(`/obligations/${obligationId}/complete`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return r.data
      }
      const r = await api.post(`/obligations/${obligationId}/complete`, { note: note.trim() || undefined })
      return r.data
    },
    onSuccess: () => {
      onCompleted?.()
      onClose()
      setNote(''); setFile(null); setError(null)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? 'Failed to complete obligation.')
    },
  })

  const onPickFile = (f: File | null) => {
    setError(null)
    if (!f) { setFile(null); return }
    if (f.size > MAX_BYTES) {
      setError(`File too large — 25MB max (this is ${formatBytes(f.size)}).`)
      return
    }
    setFile(f)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Complete obligation"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
      data-testid="complete-obligation-modal"
    >
      <div
        className="bg-white rounded-xl max-w-md w-full shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Mark obligation complete
            </h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{description}</p>
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
          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Completion note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What was done? Reference numbers, payment date, etc."
              rows={3}
              data-testid="obligation-note"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
            />
          </div>

          {/* Evidence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evidence file <span className="text-gray-400 font-normal">(optional, 25MB max)</span>
            </label>
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="obligation-pick-file"
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-sm text-gray-600"
              >
                <Paperclip className="h-4 w-4" />
                Attach evidence (PDF, image, CSV…)
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm" data-testid="obligation-attached-file">
                <Paperclip className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">{formatBytes(file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onPickFile(null)}
                  data-testid="obligation-remove-file"
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={e => onPickFile(e.target.files?.[0] ?? null)}
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
          <Button variant="outline" onClick={onClose} disabled={complete.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => complete.mutate()}
            disabled={complete.isPending}
            data-testid="obligation-complete-confirm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {complete.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> Mark complete</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
