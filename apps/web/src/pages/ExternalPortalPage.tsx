/**
 * ExternalPortalPage — Phase 05 (Negotiation) + B.5.14 trust refactor.
 *
 * Token-gated portal for external reviewers/counterparties. No auth —
 * accessed via /portal/:portalToken. The B.5.14 refactor (docs/26 §6.9
 * and ChatGPT round-3 feedback) added:
 *
 *   - Trust header band: "✓ Shared by <orgName>" + clock + link label,
 *     calming the "is this legit?" anxiety that blocks engagement.
 *   - Primary actions: [Download .docx to redline] + [Upload revised]
 *     — closes the loop so counterparties don't have to be forced into
 *     our portal to get things done. Deal-losing friction point fixed.
 *   - Existing comments tab stays for in-portal back-and-forth.
 *
 * What stays hidden from the counterparty: internal AI summary, risk
 * scores, approvals, precedents, review progress. This is THEIR view —
 * all our analysis is our own.
 */
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { api } from '@/lib/api'
import { CommentsPanel } from '@/components/contracts/CommentsPanel'
import {
  AlertCircle, Loader2, MessageSquare, FileText, Clock, Upload, Download,
  ChevronRight, Building2, ShieldCheck, CheckCircle2,
} from 'lucide-react'

interface PortalContract {
  id: string
  title: string
  type: string
  status: string
  counterpartyName?: string | null
  effectiveDate?: string | null
  expiryDate?: string | null
  org: {
    name: string
    brandColor?: string | null
    logoUrl?: string | null
  }
}

interface PortalData {
  contract: PortalContract
  htmlContent: string
  versionId?: string
  permissions: string[]
  shareLink: {
    id: string
    label?: string | null
    expiresAt: string
    viewCount: number
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return null
  }
}

export function ExternalPortalPage() {
  const { portalToken } = useParams<{ portalToken: string }>()
  const [activeTab, setActiveTab] = useState<'document' | 'comments'>('document')
  const qc = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portal', portalToken],
    queryFn: () =>
      api.get(`/portal/${portalToken}/contract`).then(r => r.data as PortalData),
    enabled: !!portalToken,
    retry: false,
  })

  // B.5.14 — upload a revised version mutation (multipart).
  const uploadRevision = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(`/portal/${portalToken}/versions`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data as { versionNumber: number; filename: string; message: string }
    },
    onSuccess: (res) => {
      setUploadSuccess(`v${res.versionNumber} · ${res.filename}`)
      qc.invalidateQueries({ queryKey: ['portal', portalToken] })
    },
  })

  const editor = useEditor({
    extensions: [StarterKit],
    content: data?.htmlContent ?? '',
    editable: false,
  }, [data?.htmlContent])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading contract…</p>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Link unavailable</h1>
          <p className="text-sm text-gray-500">
            This share link is invalid, has expired, or has been revoked. Please contact the sender for a new link.
          </p>
        </div>
      </div>
    )
  }

  const { contract, permissions, shareLink } = data
  const brandColor = contract.org?.brandColor ?? '#2563eb'
  const expiresDate = formatDate(shareLink.expiresAt)
  const canComment = permissions.includes('comment')
  // B.5.14 — upload is gated on an explicit 'edit' or 'upload' permission
  // so read-only shares stay truly read-only. Download is allowed for any
  // active link (a read-only link can still be taken home to print).
  const canUpload = permissions.includes('edit') || permissions.includes('upload')
  const isExpiringSoon = shareLink.expiresAt
    ? Date.now() > new Date(shareLink.expiresAt).getTime() - 48 * 3600 * 1000
    : false
  const daysToExpiry = shareLink.expiresAt
    ? Math.max(0, Math.ceil((new Date(shareLink.expiresAt).getTime() - Date.now()) / 86_400_000))
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Branded header */}
      <header
        className="px-6 py-4 flex items-center justify-between shadow-sm"
        style={{ backgroundColor: brandColor }}
      >
        <div className="flex items-center gap-3">
          {contract.org.logoUrl ? (
            <img
              src={contract.org.logoUrl}
              alt={contract.org.name}
              className="h-8 w-auto rounded object-contain bg-white/10 p-1"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
              <Building2 className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="text-white font-semibold text-sm">{contract.org.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {shareLink.label && (
            <span className="text-white/70 text-xs">{shareLink.label}</span>
          )}
          <div className="flex items-center gap-1 text-white/70 text-xs">
            <Clock className="h-3.5 w-3.5" />
            {expiresDate ? `Expires ${expiresDate}` : 'Link active'}
          </div>
        </div>
      </header>

      {/*
        B.5.14 — TRUST BAND. One row of "this is legit" signals + the
        primary actions. Appears between the branded header and the
        contract title so the counterparty sees them before deciding
        whether to engage.
      */}
      <div
        role="region"
        aria-label="Portal trust and actions"
        className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-2.5"
      >
        <div className="max-w-5xl mx-auto flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Shared by {contract.org.name}</span>
          </div>

          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span>
              {daysToExpiry != null && daysToExpiry > 0
                ? <>Expires in <span className="font-medium">{daysToExpiry}d</span></>
                : expiresDate ? <>Expires {expiresDate}</> : 'Link active'}
            </span>
          </div>

          {shareLink.label && (
            <span className="text-gray-500 truncate">· {shareLink.label}</span>
          )}

          {/* Primary CTAs pushed right. Download is always available on an
              active link; upload requires an 'edit' / 'upload' permission. */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <a
              href={`/api/v1/portal/${portalToken}/download/docx`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              title="Download this version as a Word document you can redline"
            >
              <Download className="h-3.5 w-3.5" />
              Download .docx
            </a>
            {canUpload && (
              <>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadRevision.mutate(f)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploadRevision.isPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors disabled:opacity-50"
                  title="Upload your revised version — lands in our history attributed to this link"
                >
                  {uploadRevision.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />}
                  Upload revised
                </button>
              </>
            )}
          </div>
        </div>

        {/* Secondary status lines sit just below the trust band. */}
        {uploadSuccess && (
          <div className="max-w-5xl mx-auto mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Uploaded {uploadSuccess}. The owner has been notified.
          </div>
        )}
        {uploadRevision.isError && (
          <div className="max-w-5xl mx-auto mt-1.5 flex items-center gap-1.5 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5" />
            {(uploadRevision.error as { response?: { data?: { error?: string } } })?.response?.data?.error
              ?? 'Upload failed — try again.'}
          </div>
        )}
      </div>

      {/* Expiry warning */}
      {isExpiringSoon && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          This link expires soon. Contact the sender to get a new link before it expires.
        </div>
      )}

      {/* Contract header */}
      <div className="bg-white border-b px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{contract.title}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">
                  {contract.type.replace(/_/g, ' ')}
                </span>
                {contract.counterpartyName && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    {contract.counterpartyName}
                  </span>
                )}
                {contract.effectiveDate && (
                  <span className="text-xs text-gray-400">
                    Effective {formatDate(contract.effectiveDate)}
                  </span>
                )}
                {contract.expiryDate && (
                  <span className="text-xs text-gray-400">
                    Expires {formatDate(contract.expiryDate)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className="text-xs text-gray-400 italic">
                {canUpload ? 'View + comment + redline' : 'Read-only view'}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('document')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'document'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Document
            </button>
            {canComment && (
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'comments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comments
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'document' && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-8 md:p-12">
                {editor ? (
                  <EditorContent
                    editor={editor}
                    className="prose prose-sm md:prose max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px]"
                  />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && canComment && (
            <CommentsPanel
              contractId={contract.id}
              versionId={data.versionId}
              portalMode={true}
              portalToken={portalToken}
              permissions={permissions}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 border-t bg-white text-center">
        <p className="text-xs text-gray-400">
          Shared securely via {contract.org.name} · View only · Do not distribute
        </p>
      </footer>
    </div>
  )
}
