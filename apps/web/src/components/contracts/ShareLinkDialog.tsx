/**
 * ShareLinkDialog — create and manage portal share links for contracts.
 * Creates time-limited, permission-scoped links for external reviewers.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link, Copy, Check, X, Trash2, Loader2, Eye, MessageSquare } from 'lucide-react'

interface ShareLink {
  id: string
  label?: string | null
  permissions: string[]
  expiresAt: string
  viewCount: number
  lastViewedAt?: string | null
  createdAt: string
}

interface ShareLinkDialogProps {
  contractId: string
  onClose: () => void
}

const EXPIRY_OPTIONS = [
  { label: '24 hours',  hours: 24 },
  { label: '3 days',   hours: 72 },
  { label: '7 days',   hours: 168 },
  { label: '14 days',  hours: 336 },
  { label: '30 days',  hours: 720 },
]

export function ShareLinkDialog({ contractId, onClose }: ShareLinkDialogProps) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [expiresInHours, setExpiresInHours] = useState(168)
  const [canComment, setCanComment] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)

  const linksQuery = useQuery({
    queryKey: ['share-links', contractId],
    queryFn: () => api.get(`/contracts/${contractId}/share`).then(r => r.data.data as ShareLink[]),
  })

  const createLink = useMutation({
    mutationFn: () => api.post(`/contracts/${contractId}/share`, {
      label: label.trim() || undefined,
      permissions: canComment ? ['read', 'comment'] : ['read'],
      expiresInHours,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['share-links', contractId] })
      setNewLinkUrl(res.data.portalUrl)
      setLabel('')
      setCanComment(false)
    },
  })

  const revokeLink = useMutation({
    mutationFn: (linkId: string) => api.delete(`/contracts/${contractId}/share/${linkId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-links', contractId] }),
  })

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const links: ShareLink[] = linksQuery.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Share Contract</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* New link just created */}
          {newLinkUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-2">Link created! Share this URL:</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={newLinkUrl}
                  className="flex-1 text-xs font-mono bg-white border border-emerald-200 rounded-lg px-2 py-1.5 truncate"
                />
                <button
                  onClick={() => handleCopy(newLinkUrl, 'new')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
                >
                  {copiedId === 'new' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === 'new' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Create form */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">Create new link</p>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Label (optional)</label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Acme Legal Review"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Expires in</label>
              <select
                value={expiresInHours}
                onChange={e => setExpiresInHours(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option key={opt.hours} value={opt.hours}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Permissions</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-700">
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                    Read — view contract
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canComment}
                    onChange={e => setCanComment(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5 text-sm text-gray-700">
                    <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                    Comment — add comments
                  </div>
                </label>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={createLink.isPending}
              onClick={() => createLink.mutate()}
            >
              {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
              Generate link
            </Button>
          </div>

          {/* Existing links */}
          {links.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Active links</p>
              {links.map(link => (
                <div key={link.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {link.label ?? 'Untitled link'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Expires {new Date(link.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{link.viewCount} view{link.viewCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-1">
                        {link.permissions.includes('comment') && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                            comment
                          </span>
                        )}
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                          read
                        </span>
                      </div>
                      <button
                        onClick={() => revokeLink.mutate(link.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors ml-1"
                        title="Revoke link"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
