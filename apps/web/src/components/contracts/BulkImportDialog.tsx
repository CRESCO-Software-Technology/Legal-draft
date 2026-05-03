/**
 * BulkImportDialog (P10D) — drop-zone for CSV import of contracts.
 *
 * Posts the file to /contracts/bulk-import and renders the per-row
 * result summary (total / created / failed) so the user can see
 * exactly which rows took.
 */
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Upload, X, Loader2, CheckCircle2, AlertCircle, FileText, Download,
} from 'lucide-react'

interface RowResult {
  row:    number
  ok:     boolean
  id?:    string
  title?: string
  error?: string
}

interface ImportResponse {
  total:   number
  created: number
  failed:  number
  results: RowResult[]
}

const SAMPLE_CSV = `title,type,counterpartyName,value,currency,effectiveDate,expiryDate,jurisdiction
Acme Master Services Agreement,MSA,Acme Corp,250000,USD,2026-05-01,2027-04-30,Delaware
SaaSCo Annual License,LICENSE,SaaSCo Ltd,48000,USD,2026-05-15,2027-05-14,California
Brex Mutual NDA,NDA,Brex,,USD,,,
"Project Falcon, SOW #1",SOW,Falcon LLC,80000,USD,2026-06-01,2026-12-31,New York`

export function BulkImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [result, setResult] = useState<ImportResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('no file')
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/contracts/bulk-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return r.data as ImportResponse
    },
    onSuccess: (data) => {
      setResult(data)
      if (data.failed === 0) onSuccess()
    },
  })

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'contracts-import-sample.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      role="dialog"
      aria-label="Bulk import contracts"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
      data-testid="bulk-import-dialog"
    >
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              Bulk import contracts
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Upload a CSV with one row per contract. Up to 1,000 rows per file.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!result ? (
          <div className="px-6 py-5 space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
              onDrop={(e) => {
                e.preventDefault(); setDragActive(false)
                const f = e.dataTransfer.files?.[0]
                if (f) setFile(f)
              }}
              data-testid="csv-drop-zone"
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-300 hover:border-emerald-300 hover:bg-emerald-50/30'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-gray-900">{file.name}</span>
                  <span className="text-xs text-gray-500">({Math.round(file.size / 1024)} KB)</span>
                  <button onClick={() => setFile(null)} className="ml-2 text-xs text-red-600">remove</button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">Drop a CSV here or click to browse</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Required column: <code className="bg-gray-100 px-1 rounded">title</code>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Upload className="h-4 w-4" /> Browse
                  </Button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="text-xs text-gray-500">
              <p className="mb-1">Supported columns:</p>
              <code className="block bg-gray-50 border border-gray-200 rounded px-2 py-1.5 font-mono text-[10.5px] leading-relaxed">
                title (required) · type · status · counterpartyName · value · currency · effectiveDate · expiryDate · jurisdiction
              </code>
              <button
                onClick={downloadSample}
                className="text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 mt-2"
              >
                <Download className="h-3 w-3" /> Download sample CSV
              </button>
            </div>

            {upload.error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {(upload.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Upload failed.'}
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">
                  Imported {result.created} of {result.total} contracts
                </div>
                {result.failed > 0 && (
                  <div className="text-xs text-red-700">{result.failed} row(s) failed — see below</div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs" data-testid="bulk-import-results">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-12">Row</th>
                    <th className="text-left px-3 py-2 font-medium">Title / Error</th>
                    <th className="text-left px-3 py-2 font-medium w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.results.map(r => (
                    <tr key={r.row}>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">{r.row}</td>
                      <td className="px-3 py-2">
                        {r.ok ? (
                          <span className="text-gray-900">{r.title}</span>
                        ) : (
                          <span className="text-red-700">{r.title ?? '—'} — {r.error}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> created
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <AlertCircle className="h-3 w-3" /> failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          {!result ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => upload.mutate()}
                disabled={!file || upload.isPending}
                data-testid="bulk-import-confirm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {upload.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Importing…</>
                ) : (
                  <><Upload className="h-4 w-4 mr-1" /> Import CSV</>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => { onClose(); setResult(null); setFile(null) }}>Done</Button>
          )}
        </div>
      </div>
    </div>
  )
}
