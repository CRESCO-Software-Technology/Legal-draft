/**
 * Templates Page — Phase 4.3 (SCR-015)
 * Browse, create, and manage contract templates.
 * Template builder with TipTap section editor + variable definition panel.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Eye, FileText, Globe, Lock, Loader2, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { ContractEditor } from '@/components/editor/ContractEditor'
import type { Template, VariableDef } from '@clm/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONTRACT_TYPES = ['NDA', 'MSA', 'SOW', 'SLA', 'VENDOR_AGREEMENT', 'EMPLOYMENT', 'PARTNERSHIP', 'LICENSE', 'ORDER_FORM', 'OTHER']
const VARIABLE_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const

function RiskBadge({ type }: { type?: string | null }) {
  if (!type) return null
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
      {type}
    </span>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onPreview,
}: {
  template: Template
  onEdit: () => void
  onDelete: () => void
  onPreview: () => void
}) {
  // P7.4.11 / F-60 — usageCount is on Template; surface it as a tag
  // when > 0 so the user knows which templates are battle-tested.
  // P7.4.11 / F-59 — title is now a button → opens editor (industry
  // standard for card UX). Pencil icon stays for discovery + a11y.
  const usageCount = (template as Template & { usageCount?: number }).usageCount ?? 0
  return (
    <div
      data-testid={`template-card-${template.id}`}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <button
              type="button"
              onClick={onEdit}
              data-testid={`template-card-title-${template.id}`}
              className="font-semibold text-gray-900 truncate text-left hover:text-blue-700 hover:underline underline-offset-2 decoration-gray-300 hover:decoration-blue-400"
            >
              {template.name}
            </button>
            {template.isPublished
              ? <span title="Published"><Globe className="w-3.5 h-3.5 text-green-500" /></span>
              : <span title="Draft"><Lock className="w-3.5 h-3.5 text-gray-400" /></span>
            }
            {usageCount >= 5 && (
              <span
                data-testid={`template-most-used-${template.id}`}
                title={`Used ${usageCount} times — frequently used template`}
                className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
              >
                ★ Most used
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {template.contractType && <RiskBadge type={template.contractType} />}
            <span className="text-xs text-gray-400">v{template.version}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{(template.sections?.length ?? 0)} sections</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{(template.variables as VariableDef[])?.length ?? 0} variables</span>
            {usageCount > 0 && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span
                  data-testid={`template-usage-${template.id}`}
                  className="text-xs text-gray-500 tabular-nums"
                >
                  Used {usageCount} {usageCount === 1 ? 'time' : 'times'}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onPreview} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Preview"><Eye className="w-4 h-4" /></button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="Edit"><Edit2 className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}

// ─── Variable Definition Editor ───────────────────────────────────────────────

function VariableEditor({
  variables,
  onChange,
}: {
  variables: VariableDef[]
  onChange: (vars: VariableDef[]) => void
}) {
  const addVar = () =>
    onChange([...variables, { key: '', label: '', type: 'text', required: false }])

  const updateVar = (i: number, patch: Partial<VariableDef>) =>
    onChange(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  const removeVar = (i: number) =>
    onChange(variables.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Variables</p>
        <button
          onClick={addVar}
          className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-gray-600"
        >+ Add</button>
      </div>
      {variables.map((v, i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-1.5">
          {/* Row 1: key + type */}
          <div className="flex gap-1.5">
            <input
              value={v.key}
              onChange={e => updateVar(i, { key: e.target.value.replace(/[^a-z0-9_]/g, '_') })}
              placeholder="variable_key"
              className="flex-1 min-w-0 text-xs font-mono border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
            />
            <select
              value={v.type}
              onChange={e => updateVar(i, { type: e.target.value as VariableDef['type'] })}
              aria-label={`Type for variable ${v.key || i + 1}`}
              className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none bg-white"
            >
              {VARIABLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {/* Row 2: label + required + delete */}
          <div className="flex gap-1.5 items-center">
            <input
              value={v.label}
              onChange={e => updateVar(i, { label: e.target.value })}
              placeholder="Display label"
              className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
            />
            <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap shrink-0">
              <input type="checkbox" checked={v.required} onChange={e => updateVar(i, { required: e.target.checked })} />
              Req.
            </label>
            <button onClick={() => removeVar(i)} className="text-red-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Template Builder Modal ───────────────────────────────────────────────────

function TemplateBuilderModal({
  template,
  onClose,
  onSave,
  onPreview,
}: {
  template?: Template
  onClose: () => void
  onSave: (data: any) => void
  onPreview?: () => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [contractType, setContractType] = useState(template?.contractType ?? '')
  const [isPublished, setIsPublished] = useState(template?.isPublished ?? false)
  const [variables, setVariables] = useState<VariableDef[]>(
    (template?.variables as VariableDef[]) ?? [],
  )
  const [activeSectionIdx, setActiveSectionIdx] = useState(0)
  const [sections, setSections] = useState<any[]>(
    template?.sections ?? [{ title: 'Section 1', content: '', sortOrder: 0, clauseRefs: [], conditionalLogic: null }],
  )
  const [saving, setSaving] = useState(false)

  const updateSectionContent = (idx: number, html: string) => {
    setSections(s => s.map((sec, i) => (i === idx ? { ...sec, content: html } : sec)))
  }

  const addSection = () => {
    setSections(s => [...s, { title: `Section ${s.length + 1}`, content: '', sortOrder: s.length, clauseRefs: [], conditionalLogic: null }])
    setActiveSectionIdx(sections.length)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name, description, contractType: contractType || null, isPublished, variables, sections })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/50">
      <div className="relative m-auto w-full max-w-6xl h-[90vh] bg-white rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {template ? 'Edit Template' : 'New Template'}
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
              Published
            </label>
            {onPreview && (
              <button
                onClick={onPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              data-testid="template-save-btn"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Template
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left panel: metadata + variables */}
          <div className="w-72 shrink-0 border-r border-gray-200 p-4 overflow-y-auto space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Template Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  data-testid="template-name-input"
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                  placeholder="e.g. Mutual NDA — Standard"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Contract Type</label>
                <select
                  value={contractType}
                  onChange={e => setContractType(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm outline-none"
                >
                  <option value="">Generic (all types)</option>
                  {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Sections list */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</p>
                <button onClick={addSection} className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200">+ Add</button>
              </div>
              <div className="space-y-0.5">
                {sections.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSectionIdx(i)}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded truncate transition-colors ${i === activeSectionIdx ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {s.title || `Section ${i + 1}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Variable definitions */}
            <VariableEditor variables={variables} onChange={setVariables} />
          </div>

          {/* Right panel: section editor */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            {sections[activeSectionIdx] && (
              <>
                <input
                  value={sections[activeSectionIdx].title}
                  onChange={e => setSections(s => s.map((sec, i) => i === activeSectionIdx ? { ...sec, title: e.target.value } : sec))}
                  className="text-base font-semibold border-0 border-b border-gray-200 pb-2 mb-3 w-full outline-none focus:border-blue-400"
                  placeholder="Section title..."
                />
                <div className="flex-1">
                  <ContractEditor
                    initialContent={sections[activeSectionIdx].content}
                    onChange={(html) => updateSectionContent(activeSectionIdx, html)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['template-preview', templateId],
    queryFn: () => api.post(`/templates/${templateId}/preview`).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/50">
      <div className="m-auto w-full max-w-4xl h-[80vh] bg-white rounded-xl flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Template Preview (Sample Data)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && <p className="text-gray-400">Loading preview...</p>}
          {data?.html && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type SortKey = 'updated' | 'used' | 'name'

export function TemplatesPage() {
  const qc = useQueryClient()
  const [showBuilder, setShowBuilder] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | undefined>()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterPublished, setFilterPublished] = useState('')
  const [q, setQ] = useState('')
  // P7.4.11 / F-60 — client-side sort. Default to "Most used" so the
  // battle-tested templates float to the top (Notion-like template
  // gallery convention).
  const [sortBy, setSortBy] = useState<SortKey>('used')

  const { data, isLoading } = useQuery({
    queryKey: ['templates', filterType, filterPublished, q],
    queryFn: () =>
      api.get('/templates', {
        params: {
          ...(filterType && { contractType: filterType }),
          ...(filterPublished && { published: filterPublished }),
          ...(q && { q }),
        },
      }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => {
      const { sections, ...templateData } = body
      return api.post('/templates', { ...templateData, sections })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setShowBuilder(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => {
      const { sections, ...templateData } = body
      return Promise.all([
        api.patch(`/templates/${id}`, templateData),
        api.put(`/templates/${id}/sections`, { sections }),
      ])
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setShowBuilder(false); setEditTemplate(undefined) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  const rawTemplates: Template[] = data?.data ?? []
  // Client-side sort — easier than threading a query param through
  // every cache key.
  const templates: Template[] = [...rawTemplates].sort((a, b) => {
    if (sortBy === 'used') {
      const au = (a as Template & { usageCount?: number }).usageCount ?? 0
      const bu = (b as Template & { usageCount?: number }).usageCount ?? 0
      if (au !== bu) return bu - au
      // tie-break on updatedAt
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    // default 'updated'
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500">Contract templates for AI-powered drafting</p>
        </div>
        <button
          onClick={() => { setEditTemplate(undefined); setShowBuilder(true) }}
          data-testid="new-template-btn"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search templates..."
            className="text-sm border border-gray-200 rounded pl-8 pr-3 py-1.5 outline-none focus:border-blue-400 bg-white w-52"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          aria-label="Filter templates by contract type"
          className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none bg-white"
        >
          <option value="">All Types</option>
          {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select
          value={filterPublished}
          onChange={e => setFilterPublished(e.target.value)}
          aria-label="Filter templates by publish status"
          className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none bg-white"
        >
          <option value="">All Status</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          data-testid="template-sort"
          aria-label="Sort templates"
          className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none bg-white"
        >
          <option value="used">Most used</option>
          <option value="updated">Recently updated</option>
          <option value="name">A → Z</option>
        </select>
        <span className="text-sm text-gray-400 ml-auto">{templates.length} templates</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}
        {!isLoading && !templates.length && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No templates yet. Create your first template.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => { setEditTemplate(t); setShowBuilder(true) }}
              onDelete={() => deleteMutation.mutate(t.id)}
              onPreview={() => setPreviewId(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Template Builder Modal */}
      {showBuilder && (
        <TemplateBuilderModal
          template={editTemplate}
          onClose={() => { setShowBuilder(false); setEditTemplate(undefined) }}
          onSave={(data) =>
            editTemplate
              ? updateMutation.mutateAsync({ id: editTemplate.id, body: data })
              : createMutation.mutateAsync(data)
          }
          onPreview={editTemplate ? () => setPreviewId(editTemplate.id) : undefined}
        />
      )}

      {/* Preview Modal */}
      {previewId && (
        <PreviewModal templateId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  )
}
