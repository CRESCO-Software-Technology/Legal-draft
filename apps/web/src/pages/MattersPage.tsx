/**
 * MattersPage (P4.2 / docs/30 D.7.2)
 *
 * Matter-centric list view. Card grid/list showing every open matter
 * with the 3-child counts (contracts, requests, threads) + quick
 * filters (status) + a Create button.
 *
 * Design reference:
 *   - Ironclad Matters list
 *   - Harvey Vault Projects
 *   - Legal Files matter board
 */
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Briefcase, Plus, FileText, ClipboardList, MessageSquare,
  Search, X, CheckCircle2,
} from 'lucide-react'

interface MatterRow {
  id: string
  name: string
  description: string | null
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED'
  counterpartyName: string | null
  ownerName: string | null
  tags: string[]
  contractCount: number
  requestCount: number
  threadCount: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export function MattersPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'all' | 'CLOSED' | 'ARCHIVED'>('OPEN')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['matters', statusFilter],
    queryFn: async () => (await api.get<{ items: MatterRow[]; total: number }>('/matters', {
      params: { status: statusFilter, limit: 100 },
    })).data,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.items ?? []).filter(m =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q) ||
      (m.counterpartyName ?? '').toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [data, search])

  return (
    <div className="px-6 py-5 max-w-6xl mx-auto" data-testid="matters-page">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            Matters
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Group contracts, requests, and agent threads under one negotiation.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="matters-create-btn" size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" /> New matter
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, counterparty, tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="matters-search"
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          data-testid="matters-status-filter"
          aria-label="Filter matters by status"
          className="text-sm rounded-md border border-border bg-background px-2 py-1.5"
        >
          <option value="OPEN">Open only</option>
          <option value="all">All</option>
          <option value="CLOSED">Closed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
      {filtered.length === 0 && !isLoading && (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground border border-dashed border-gray-300 rounded-lg">
          No matters match that filter. Create one to start grouping contracts under a negotiation.
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map(m => (
          <li
            key={m.id}
            data-testid={`matter-row-${m.id}`}
            className="border border-border rounded-lg bg-card hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
          >
            <Link to={`/matters/${m.id}`} className="block px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-[14px] text-gray-900 truncate">{m.name}</span>
                <span className={
                  'text-[10px] uppercase tracking-wider font-medium rounded px-1.5 py-0.5 border ' +
                  (m.status === 'OPEN'     ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : m.status === 'CLOSED' ? 'bg-gray-50 text-gray-600 border-gray-200'
                    :                         'bg-amber-50 text-amber-700 border-amber-200')
                }>
                  {m.status}
                </span>
                {m.counterpartyName && (
                  <span className="text-[11px] text-muted-foreground">
                    · {m.counterpartyName}
                  </span>
                )}
                {m.tags.slice(0, 3).map(t => (
                  <span key={t} className="text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5">#{t}</span>
                ))}
              </div>
              {m.description && (
                <div className="text-[12px] text-muted-foreground truncate">{m.description}</div>
              )}
              <div className="mt-1.5 flex items-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{m.contractCount} contract{m.contractCount === 1 ? '' : 's'}</span>
                <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />{m.requestCount} request{m.requestCount === 1 ? '' : 's'}</span>
                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{m.threadCount} thread{m.threadCount === 1 ? '' : 's'}</span>
                <span className="ml-auto">
                  {m.ownerName ?? 'unassigned'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {creating && <CreateMatterDrawer onClose={() => setCreating(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['matters'] })} />}
    </div>
  )
}

function CreateMatterDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', description: '', counterpartyName: '', tags: '',
  })
  const [err, setErr] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: async () => (await api.post<MatterRow>('/matters', {
      name: form.name,
      description: form.description || undefined,
      counterpartyName: form.counterpartyName || undefined,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    })).data,
    onSuccess: (m) => { onCreated(); onClose(); navigate(`/matters/${m.id}`) },
    onError: (e) => setErr((e as Error).message ?? 'Create failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex" data-testid="matter-create-drawer">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-black/30" />
      <div className="w-[520px] max-w-[90vw] bg-card border-l border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-sm flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> New matter
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7"><X className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <Field label="Name">
            <input
              type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              data-testid="matter-create-name"
              placeholder='e.g. "Acme acquisition diligence"'
              className={inputCls}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              data-testid="matter-create-description"
              rows={3}
              className={inputCls + ' resize-y'}
            />
          </Field>
          <Field label="Counterparty name (optional)">
            <input
              type="text" value={form.counterpartyName}
              onChange={e => setForm(f => ({ ...f, counterpartyName: e.target.value }))}
              data-testid="matter-create-counterparty"
              className={inputCls}
            />
          </Field>
          <Field label="Tags (comma-separated)">
            <input
              type="text" value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="ma, diligence, q2"
              className={inputCls}
              data-testid="matter-create-tags"
            />
          </Field>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/30">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || form.name.trim().length === 0}
            data-testid="matter-create-submit"
            className="gap-1"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {create.isPending ? 'Creating…' : 'Create matter'}
          </Button>
        </div>
        {err && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mx-4 mb-3">{err}</div>}
      </div>
    </div>
  )
}

const inputCls = 'w-full text-sm rounded-md border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  )
}
