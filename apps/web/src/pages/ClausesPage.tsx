/**
 * Clause Library Page — Phase 4.3 (SCR-016)
 * Category tree (left) + clause list (center) + clause editor (right)
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight, ChevronDown, Plus, Trash2,
  CheckCircle, Loader2, BookOpen,
} from 'lucide-react'
import { api } from '@/lib/api'
import { ContractEditor } from '@/components/editor/ContractEditor'
import type { ClauseCategory, ClauseLibraryItem } from '@clm/types'
import { cn } from '@/lib/utils'

// ─── Category Tree ────────────────────────────────────────────────────────────

function CategoryTreeNode({
  category,
  selected,
  onSelect,
  onAdd,
}: {
  category: ClauseCategory & { children?: ClauseCategory[] }
  selected: string | null
  onSelect: (id: string) => void
  onAdd: (parentId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = (category.children?.length ?? 0) > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group text-sm',
          selected === category.id
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100',
        )}
        onClick={() => { onSelect(category.id); if (hasChildren) setOpen(o => !o) }}
      >
        {hasChildren
          ? (open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />)
          : <span className="w-3.5 h-3.5" />}
        <span className="flex-1 truncate">{category.name}</span>
        <button
          onClick={e => { e.stopPropagation(); onAdd(category.id) }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {hasChildren && open && (
        <div className="pl-4">
          {category.children!.map(child => (
            <CategoryTreeNode
              key={child.id}
              category={child as any}
              selected={selected}
              onSelect={onSelect}
              onAdd={onAdd}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Clause Row ───────────────────────────────────────────────────────────────

function ClauseRow({
  clause,
  selected,
  onSelect,
  onApprove,
  onDelete,
}: {
  clause: ClauseLibraryItem
  selected: boolean
  onSelect: () => void
  onApprove: (approved: boolean) => void
  onDelete: () => void
}) {
  const RISK_COLORS: Record<string, string> = {
    favorable: 'bg-green-100 text-green-700',
    unfavorable: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-gray-600',
    standard: 'bg-blue-100 text-blue-700',
  }

  return (
    <div
      data-testid={`clause-row-${clause.id}`}
      data-clause-title={clause.title}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() }
      }}
      className={cn(
        'px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        selected && 'bg-blue-50 border-l-2 border-l-blue-500',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{clause.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {clause.riskRating && (
              <span className={cn('text-xs px-1.5 py-0.5 rounded', RISK_COLORS[clause.riskRating])}>
                {clause.riskRating}
              </span>
            )}
            {clause.isApproved && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">approved</span>
            )}
            <span className="text-xs text-gray-400">used {clause.usageCount}×</span>
          </div>
          {clause.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {clause.tags.slice(0, 3).map(t => (
                <span key={t} className="text-xs px-1 py-0.5 bg-gray-100 text-gray-500 rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onApprove(!clause.isApproved) }}
            className={cn(
              'p-1 rounded hover:bg-gray-100 transition-colors',
              clause.isApproved ? 'text-green-500 hover:text-green-700' : 'text-gray-300 hover:text-green-500',
            )}
            title={clause.isApproved ? 'Click to unapprove' : 'Click to approve'}
          >
            <CheckCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Clause Detail Panel ──────────────────────────────────────────────────────

function ClauseDetailPanel({
  clause,
  onSave,
  onCancel,
}: {
  clause?: ClauseLibraryItem
  onSave: (data: Partial<ClauseLibraryItem>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(clause?.title ?? '')
  const [content, setContent] = useState(clause?.content ?? '')
  const [tags, setTags] = useState(clause?.tags.join(', ') ?? '')
  const [riskRating, setRiskRating] = useState(clause?.riskRating ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title,
        content,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        riskRating: (riskRating || null) as any,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{clause ? 'Edit Clause' : 'New Clause'}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save
          </button>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
        </div>
      </div>

      <div className="p-4 space-y-3 border-b border-gray-100">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Clause title..."
          className="w-full text-sm font-medium border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-400"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Risk Rating</label>
            <select
              value={riskRating}
              onChange={e => setRiskRating(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none"
            >
              <option value="">None</option>
              <option value="favorable">Favorable</option>
              <option value="neutral">Neutral</option>
              <option value="unfavorable">Unfavorable</option>
              <option value="standard">Standard</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. mutual, standard"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <ContractEditor
          initialContent={content}
          onSave={setContent}
        />
      </div>

      {clause && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            {Array.isArray(clause.versions) ? clause.versions.length : 0} version(s) · used {clause.usageCount}×
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ClausesPage() {
  const qc = useQueryClient()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedClause, setSelectedClause] = useState<ClauseLibraryItem | null>(null)
  const [showNewClause, setShowNewClause] = useState(false)
  const [q, setQ] = useState('')

  const { data: categoriesData } = useQuery({
    queryKey: ['clause-categories'],
    queryFn: () => api.get('/clauses/categories').then(r => r.data),
  })

  const { data: clausesData, isLoading: clausesLoading } = useQuery({
    queryKey: ['clauses', selectedCategoryId, q],
    queryFn: () =>
      api.get('/clauses', {
        params: {
          ...(selectedCategoryId && { categoryId: selectedCategoryId }),
          ...(q && { q }),
          limit: 100,
        },
      }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/clauses', { ...body, categoryId: selectedCategoryId! }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clauses'] }); setShowNewClause(false); setSelectedClause(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/clauses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clauses'] }); setSelectedClause(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clauses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clauses'] }); setSelectedClause(null) },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.post(`/clauses/${id}/approve`, { approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clauses'] }),
  })

  const addCategory = useMutation({
    mutationFn: (body: any) => api.post('/clauses/categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clause-categories'] }),
  })

  const categories: (ClauseCategory & { children?: ClauseCategory[] })[] = categoriesData?.data ?? []
  const clauses: ClauseLibraryItem[] = clausesData?.data ?? []

  const handleAddCategory = (parentId?: string) => {
    const name = prompt('Category name:')
    if (!name?.trim()) return
    addCategory.mutate({ name, parentCategoryId: parentId ?? null })
  }

  return (
    <div className="flex h-full">
      {/* ── Category Tree (Left) ── */}
      <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</p>
          <button onClick={() => handleAddCategory()} className="text-gray-400 hover:text-blue-600">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div
            onClick={() => setSelectedCategoryId(null)}
            className={cn(
              'px-2 py-1.5 rounded text-sm cursor-pointer mb-1',
              !selectedCategoryId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            All Clauses
          </div>
          {categories.map(cat => (
            <CategoryTreeNode
              key={cat.id}
              category={cat}
              selected={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              onAdd={handleAddCategory}
            />
          ))}
        </div>
      </div>

      {/* ── Clause List (Center) ── */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search clauses..."
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400"
          />
          {/*
            B.6.18 — "New clause" button is always visible when at
            least one category exists. If no category is currently
            selected we auto-pick the first one so the user isn't
            blocked with an obscure prerequisite.
          */}
          <button
            onClick={() => {
              if (!selectedCategoryId && categories[0]) setSelectedCategoryId(categories[0].id)
              setShowNewClause(true)
              setSelectedClause(null)
            }}
            disabled={categories.length === 0}
            data-testid="new-clause-button"
            title={categories.length === 0 ? 'Create a category first, then add clauses to it' : undefined}
            className="flex items-center gap-1 text-xs px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> New clause
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {clausesLoading && (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
          {!clausesLoading && !clauses.length && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <BookOpen className="w-8 h-8 mb-1" />
              <p className="text-xs">No clauses yet</p>
            </div>
          )}
          {clauses.map(c => (
            <ClauseRow
              key={c.id}
              clause={c}
              selected={selectedClause?.id === c.id}
              onSelect={() => { setSelectedClause(c); setShowNewClause(false) }}
              onApprove={(approved) => approveMutation.mutate({ id: c.id, approved })}
              onDelete={() => deleteMutation.mutate(c.id)}
            />
          ))}
        </div>
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">{clauses.length} clauses</p>
        </div>
      </div>

      {/* ── Clause Editor (Right) ── */}
      <div className="flex-1 min-w-0">
        {(selectedClause || showNewClause) ? (
          <ClauseDetailPanel
            key={showNewClause ? '__new__' : selectedClause?.id}
            clause={showNewClause ? undefined : selectedClause ?? undefined}
            onSave={(data) =>
              showNewClause
                ? createMutation.mutateAsync(data)
                : updateMutation.mutateAsync({ id: selectedClause!.id, data })
            }
            onCancel={() => { setShowNewClause(false); setSelectedClause(null) }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <BookOpen className="w-12 h-12 text-gray-300" />
            <p className="text-sm">Select a clause to edit, or create a new one.</p>
            {categories.length > 0 && (
              <button
                onClick={() => {
                  if (!selectedCategoryId && categories[0]) setSelectedCategoryId(categories[0].id)
                  setShowNewClause(true)
                }}
                data-testid="empty-new-clause-button"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              >
                <Plus className="w-3.5 h-3.5" /> New clause
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
