/**
 * Template Selector Modal — Phase 4.3 (SCR-004)
 * Triggered from "New Contract" button or chat draft flow.
 * Shows published templates with type filter + match score.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Globe, Loader2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Template } from '@clm/types'

const CONTRACT_TYPES = ['NDA', 'MSA', 'SOW', 'SLA', 'VENDOR_AGREEMENT', 'EMPLOYMENT', 'PARTNERSHIP', 'LICENSE', 'ORDER_FORM', 'OTHER']

interface Props {
  onSelect: (template: Template) => void
  onClose: () => void
  preferredType?: string
}

export function TemplateSelectorModal({ onSelect, onClose, preferredType }: Props) {
  const [filterType, setFilterType] = useState(preferredType ?? '')
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['templates-selector', filterType, q],
    queryFn: () =>
      api.get('/templates', {
        params: {
          published: 'true',
          ...(filterType && { contractType: filterType }),
          ...(q && { q }),
          limit: 50,
        },
      }).then(r => r.data),
  })

  const templates: Template[] = data?.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select Template</h2>
            <p className="text-sm text-gray-500">Choose a template to start your contract draft</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search templates..."
            className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-blue-400 bg-white"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none bg-white"
          >
            <option value="">All Types</option>
            {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Template list */}
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          )}
          {!isLoading && !templates.length && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mb-2" />
              <p className="text-sm">No published templates found</p>
              <p className="text-xs mt-1">Create and publish a template first</p>
            </div>
          )}
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              data-testid={`template-pick-${t.id}`}
              className={cn(
                'w-full text-left px-6 py-4 hover:bg-blue-50 transition-colors',
                preferredType && t.contractType === preferredType && 'bg-green-50 border-l-4 border-green-400',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <Globe className="w-3.5 h-3.5 text-green-500" />
                    {preferredType && t.contractType === preferredType && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Recommended</span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {t.contractType && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{t.contractType}</span>
                    )}
                    <span className="text-xs text-gray-400">{(t.sections?.length ?? 0)} sections</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">used {t.usageCount}×</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-400">{templates.length} templates available</p>
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
