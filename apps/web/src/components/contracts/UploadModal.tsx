import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2, Plus, Link, ExternalLink } from 'lucide-react'

const CONTRACT_TYPES = [
  'NDA', 'MSA', 'SOW', 'SLA', 'VENDOR_AGREEMENT',
  'EMPLOYMENT', 'PARTNERSHIP', 'LICENSE', 'OTHER',
]

const RELATIONSHIP_TYPES = [
  { value: 'amendment',    label: 'Amendment' },
  { value: 'sow',          label: 'Statement of Work (SOW)' },
  { value: 'order_form',   label: 'Order Form' },
  { value: 'renewal',      label: 'Renewal' },
  { value: 'nda',          label: 'NDA' },
  { value: 'exhibit_only', label: 'Exhibit / Schedule' },
]

interface FileEntry {
  file: File
  title: string
  type: string
  counterpartyName: string
  parentContractId: string
  relationshipType: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface Props {
  onClose: () => void
  onSuccess: () => void
  defaultParentContractId?: string
}

export function UploadModal({ onClose, onSuccess, defaultParentContractId = '' }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [parentSearch, setParentSearch] = useState('')
  const [uploadedIds, setUploadedIds] = useState<string[]>([])

  // Search for existing contracts to link as parent
  const { data: parentSearchResults } = useQuery({
    queryKey: ['contracts-search', parentSearch],
    queryFn: () => api.get('/contracts', { params: { q: parentSearch, limit: 8 } }).then(r => {
      const list = r.data?.data ?? r.data ?? []
      return Array.isArray(list) ? list : []
    }),
    enabled: parentSearch.length >= 2,
    staleTime: 5000,
  })

  const onDrop = useCallback((accepted: File[]) => {
    const newEntries: FileEntry[] = accepted.map(f => ({
      file: f,
      title: f.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim(),
      type: 'OTHER',
      counterpartyName: '',
      parentContractId: defaultParentContractId,
      relationshipType: defaultParentContractId ? 'amendment' : '',
      status: 'pending',
    }))
    setEntries(prev => {
      const next = [...prev, ...newEntries]
      setActiveIdx(next.length - 1)
      return next
    })
  }, [defaultParentContractId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024,
  })

  const update = (idx: number, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))

  const remove = (idx: number) => {
    setEntries(prev => {
      const next = prev.filter((_, i) => i !== idx)
      setActiveIdx(Math.min(activeIdx, next.length - 1))
      return next
    })
  }

  const uploadAll = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].status === 'done') continue
        update(i, { status: 'uploading' })
        try {
          const e = entries[i]
          const form = new FormData()
          form.append('file', e.file)
          form.append('title', e.title)
          form.append('type', e.type)
          form.append('counterpartyName', e.counterpartyName)
          if (e.parentContractId) form.append('parentContractId', e.parentContractId)
          if (e.relationshipType) form.append('relationshipType', e.relationshipType)
          const res = await api.post('/contracts/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (res.data?.id) setUploadedIds(prev => [...prev, res.data.id])
          update(i, { status: 'done' })
        } catch (err: any) {
          update(i, { status: 'error', error: err?.response?.data?.detail ?? err?.message ?? 'Upload failed' })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      const hasErrors = entries.some(e => e.status === 'error')
      if (!hasErrors) onSuccess()
    },
  })

  const activeEntry = entries[activeIdx]
  const allDone = entries.length > 0 && entries.every(e => e.status === 'done')
  const anyUploading = entries.some(e => e.status === 'uploading')
  const showParentDropdown = parentSearch.length >= 2 && (parentSearchResults?.length ?? 0) > 0

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Upload Contracts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* File list sidebar */}
          {entries.length > 0 && (
            <div className="w-52 border-r flex-shrink-0 flex flex-col">
              <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
                {entries.map((e, i) => (
                  // P50 a11y — outer is a div with click handler so the
                  // inner remove <button> isn't nested-interactive. The
                  // entry name itself is a real <button> for keyboard a11y.
                  <div
                    key={i}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs transition-colors ${
                      i === activeIdx ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="flex-shrink-0">
                      {e.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      {e.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                      {e.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                      {e.status === 'pending' && <FileText className="h-3.5 w-3.5 text-gray-400" />}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className="truncate font-medium leading-tight text-left flex-1 min-w-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
                    >
                      {e.title || e.file.name}
                    </button>
                    {e.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label={`Remove ${e.title || e.file.name}`}
                        className="ml-auto text-gray-300 hover:text-gray-500 flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-2 border-t">
                <div {...getRootProps()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
                  <input {...getInputProps()} />
                  <Plus className="h-3.5 w-3.5" /> Add files
                </div>
              </div>
            </div>
          )}

          {/* Main area */}
          <div className="flex-1 p-5 overflow-y-auto">
            {entries.length === 0 ? (
              <div
                {...getRootProps()}
                data-testid="upload-modal-dropzone"
                className={`h-full min-h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} data-testid="upload-modal-input" />
                <Upload className="h-10 w-10 text-gray-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">
                    {isDragActive ? 'Drop files here' : 'Drag & drop or click to browse'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, or TXT · up to 50 MB each · multiple files supported</p>
                </div>
              </div>
            ) : activeEntry ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{activeEntry.file.name}</span>
                  <span className="text-gray-300">·</span>
                  <span>{(activeEntry.file.size / 1024).toFixed(0)} KB</span>
                </div>

                {activeEntry.status === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{activeEntry.error}</span>
                  </div>
                )}
                {activeEntry.status === 'done' && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>Uploaded — AI analysis queued in background</span>
                  </div>
                )}

                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={activeEntry.title}
                    onChange={e => update(activeIdx, { title: e.target.value })}
                    placeholder="e.g. Acme Corp NDA 2026"
                    disabled={activeEntry.status !== 'pending'}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Contract Type</Label>
                  <select
                    id="type"
                    value={activeEntry.type}
                    onChange={e => update(activeIdx, { type: e.target.value })}
                    disabled={activeEntry.status !== 'pending'}
                    className="w-full mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    {CONTRACT_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="cp">Counterparty Name</Label>
                  <Input
                    id="cp"
                    value={activeEntry.counterpartyName}
                    onChange={e => update(activeIdx, { counterpartyName: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                    disabled={activeEntry.status !== 'pending'}
                  />
                </div>

                {/* ── Link to parent contract ─────────────────────────────── */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">Link to existing contract</span>
                    <span className="text-xs text-gray-400">(optional)</span>
                  </div>

                  {activeEntry.parentContractId ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1.5 truncate">
                        {(parentSearchResults as any[])?.find((c: any) => c.id === activeEntry.parentContractId)?.title
                          ?? `Contract ${activeEntry.parentContractId.slice(0, 8)}…`}
                      </span>
                      <button
                        onClick={() => update(activeIdx, { parentContractId: '', relationshipType: '' })}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={activeEntry.status !== 'pending'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Search by contract title…"
                        value={parentSearch}
                        onChange={e => setParentSearch(e.target.value)}
                        disabled={activeEntry.status !== 'pending'}
                        className="text-xs"
                      />
                      {showParentDropdown && (
                        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg overflow-hidden">
                          {(parentSearchResults as any[]).map((c: any) => (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b last:border-0"
                              onClick={() => {
                                update(activeIdx, { parentContractId: c.id, relationshipType: 'amendment' })
                                setParentSearch('')
                              }}
                            >
                              <span className="font-medium text-gray-800">{c.title}</span>
                              <span className="ml-2 text-gray-400">{c.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeEntry.parentContractId && (
                    <div>
                      <select
                        value={activeEntry.relationshipType}
                        onChange={e => update(activeIdx, { relationshipType: e.target.value })}
                        disabled={activeEntry.status !== 'pending'}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      >
                        <option value="">Select relationship…</option>
                        {RELATIONSHIP_TYPES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          {allDone ? (
            <>
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {entries.length} contract{entries.length > 1 ? 's' : ''} uploaded successfully
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Close</Button>
                {uploadedIds.length === 1 && (
                  <Button onClick={() => { onClose(); navigate(`/contracts/${uploadedIds[0]}`) }}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />View Contract
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {entries.length === 0
                  ? 'No files selected'
                  : `${entries.length} file${entries.length > 1 ? 's' : ''} queued`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={anyUploading}>Cancel</Button>
                <Button
                  onClick={() => uploadAll.mutate()}
                  disabled={entries.length === 0 || anyUploading || entries.every(e => e.status === 'done')}
                  data-testid="upload-modal-submit"
                >
                  {anyUploading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Uploading…</>
                    : `Upload ${entries.length > 1 ? `${entries.length} contracts` : 'contract'}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
