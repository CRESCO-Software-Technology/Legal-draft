import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  X,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react'
import { SystemRole } from '@clm/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulkImportModalProps {
  open: boolean
  onClose: () => void
}

interface ParsedRow {
  name: string
  email: string
  roles: string[]
  status: 'valid' | 'error'
  error?: string
}

interface ImportResult {
  created: string[]
  skipped: string[]
  errors: Array<{ email: string; reason: string }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_ROLES = new Set(Object.values(SystemRole))
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseCSV(text: string): string[][] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line =>
      line.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''))
    )
}

function validateRow(row: string[]): ParsedRow {
  const [name, email, rolesStr] = row
  const errors: string[] = []

  if (!name?.trim()) errors.push('Name is required')
  if (!email?.trim()) {
    errors.push('Email is required')
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Invalid email format')
  }

  const roles = (rolesStr ?? '')
    .split(';')
    .map(r => r.trim())
    .filter(Boolean)

  if (roles.length === 0) {
    errors.push('At least one role is required')
  } else {
    const invalid = roles.filter(r => !VALID_ROLES.has(r as SystemRole))
    if (invalid.length > 0) {
      errors.push(`Invalid roles: ${invalid.join(', ')}`)
    }
  }

  return {
    name: name?.trim() ?? '',
    email: email?.trim() ?? '',
    roles,
    status: errors.length > 0 ? 'error' : 'valid',
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BulkImportModal({ open, onClose }: BulkImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState('')

  const importMutation = useMutation({
    mutationFn: (users: Array<{ name: string; email: string; roles: string[] }>) =>
      api.post('/admin/users/bulk-import', users).then(r => r.data),
    onSuccess: (data: ImportResult) => {
      setResult(data)
    },
    onError: (err: any) => {
      setParseError(err.response?.data?.detail ?? 'Failed to import users')
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError('')
    setResult(null)
    setFileName(file.name)

    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file')
      setRows([])
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)

      // Detect header row
      let dataRows = parsed
      if (
        parsed.length > 0 &&
        parsed[0][0]?.toLowerCase() === 'name' &&
        parsed[0][1]?.toLowerCase() === 'email'
      ) {
        dataRows = parsed.slice(1)
      }

      if (dataRows.length === 0) {
        setParseError('No data rows found in CSV')
        setRows([])
        return
      }

      setRows(dataRows.map(validateRow))
    }
    reader.onerror = () => {
      setParseError('Failed to read file')
    }
    reader.readAsText(file)
  }

  const validRows = rows.filter(r => r.status === 'valid')
  const errorRows = rows.filter(r => r.status === 'error')

  const handleImport = () => {
    if (validRows.length === 0) return
    setParseError('')
    importMutation.mutate(
      validRows.map(r => ({ name: r.name, email: r.email, roles: r.roles }))
    )
  }

  const handleReset = () => {
    setRows([])
    setFileName('')
    setResult(null)
    setParseError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Users
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Results view */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Import Complete</p>
                  <p className="text-sm text-green-700 mt-0.5">
                    {result.created.length} created, {result.skipped.length} skipped
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err.email}: {err.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Upload area */}
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload a CSV file with columns: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">name, email, roles</code>.
                  Separate multiple roles with semicolons (e.g. <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ADMIN;LEGAL_COUNSEL</code>).
                </p>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {fileName ? fileName : 'Click to upload CSV file'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Supports .csv files only</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Error */}
              {parseError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{parseError}</p>
                </div>
              )}

              {/* Preview table */}
              {rows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Preview ({validRows.length} valid, {errorRows.length} errors)
                    </p>
                    <button
                      onClick={handleReset}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
                              Name
                            </th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
                              Email
                            </th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
                              Roles
                            </th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((row, i) => (
                            <tr
                              key={i}
                              className={row.status === 'error' ? 'bg-red-50/50' : ''}
                            >
                              <td className="px-4 py-2 text-gray-900">{row.name || '-'}</td>
                              <td className="px-4 py-2 text-gray-600">{row.email || '-'}</td>
                              <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {row.roles.map(role => (
                                    <span
                                      key={role}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        VALID_ROLES.has(role as SystemRole)
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-red-50 text-red-700 border border-red-200'
                                      }`}
                                    >
                                      {role}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                {row.status === 'valid' ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Valid
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs text-red-700"
                                    title={row.error}
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    Error
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={result ? handleReset : onClose}>
            {result ? 'Import More' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || importMutation.isPending}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {importMutation.isPending
                ? 'Importing...'
                : `Import ${validRows.length} User${validRows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
          {result && (
            <Button onClick={onClose}>Done</Button>
          )}
        </div>
      </div>
    </div>
  )
}
