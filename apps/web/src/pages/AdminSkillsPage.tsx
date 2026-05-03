/**
 * AdminSkillsPage (D.4.3)
 *
 * The admin-facing library for reusable agent workflows. Lists every
 * skill visible to this user's org (built-ins + org-authored), with an
 * edit drawer for the ones an admin can modify.
 *
 * Design reference:
 *   - Claude.ai Skills manager — slug-keyed list + rich editor
 *   - OpenAI Custom GPTs — card grid with "Configure" button
 *   - Notion Agents — sidebar list + inline editor
 *
 * Not in v1: creating user skills from this page (D.6), skill
 * marketplace (D.6.3), A/B testing (D.6.5). Those are backlog; this
 * page intentionally ships narrow so admins can audit + tune.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Pencil, Plus, X, Save, AlertCircle, Search, Tag, Lock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillRow {
  id:            string
  name:          string
  slug:          string
  description:   string
  ownerType:     'built_in' | 'org' | 'user'
  contextScope:  string
  modelTier:     string
  triggerTypes:  string[]
  allowedTools:  string[]
  followUps:     string[]
  requiresRole:  string[]
  version:       number
  updatedAt:     string
}
interface SkillDetail extends SkillRow {
  systemPrompt: string
}

const CONTEXT_SCOPES = [
  'dashboard', 'current_contract', 'current_request',
  'selection', 'portfolio', 'any',
] as const

const MODEL_TIERS = ['reasoning', 'default', 'fast'] as const

const TRIGGER_TYPES = ['mention', 'chip', 'button'] as const

const OWNER_BADGE: Record<SkillRow['ownerType'], { label: string; cls: string }> = {
  built_in: { label: 'Built-in', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  org:      { label: 'Org',      cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  user:     { label: 'You',      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSkillsPage() {
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [editing, setEditing] = useState<string | null>(null) // skill id
  const [creating, setCreating] = useState(false)

  const qc = useQueryClient()

  const listQ = useQuery({
    queryKey: ['skills'],
    queryFn: async (): Promise<SkillRow[]> => {
      const r = await api.get<{ skills: SkillRow[] }>('/skills')
      return r.data.skills
    },
  })

  const filtered = useMemo(() => {
    const items = listQ.data ?? []
    const q = search.trim().toLowerCase()
    return items.filter(s => {
      if (scopeFilter !== 'all' && s.contextScope !== scopeFilter) return false
      if (!q) return true
      return (
        s.slug.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      )
    })
  }, [listQ.data, search, scopeFilter])

  return (
    <div className="px-6 py-5 max-w-5xl mx-auto" data-testid="admin-skills-page">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Skills
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Reusable agent workflows. Built-ins ship with the product;
            org skills are created by admins and shared with everyone.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          data-testid="admin-skills-create"
          size="sm"
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          New org skill
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by slug, name, description"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="admin-skills-search"
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={e => setScopeFilter(e.target.value)}
          data-testid="admin-skills-scope-filter"
          className="text-sm rounded-md border border-border bg-background px-2 py-1.5"
        >
          <option value="all">All scopes</option>
          {CONTEXT_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {listQ.isLoading && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
      {listQ.error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          <AlertCircle className="h-4 w-4" /> Failed to load skills.
        </div>
      )}

      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
        {filtered.map(s => (
          <div
            key={s.id}
            data-testid={`admin-skill-row-${s.slug.slice(1)}`}
            className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
          >
            <Sparkles className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px] text-blue-700">{s.slug}</span>
                <span className="text-[12px] font-medium text-gray-900">{s.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${OWNER_BADGE[s.ownerType].cls}`}>
                  {OWNER_BADGE[s.ownerType].label}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Tag className="h-2.5 w-2.5" />
                  {s.contextScope}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">v{s.version}</span>
              </div>
              <div className="text-[11.5px] text-gray-600 mt-0.5">{s.description}</div>
              <div className="text-[10.5px] text-muted-foreground mt-1 flex items-center gap-2">
                <span>Tools: <span className="font-mono">{s.allowedTools.join(', ') || '—'}</span></span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(s.id)}
              data-testid={`admin-skill-edit-${s.slug.slice(1)}`}
              className="gap-1"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
        ))}
        {filtered.length === 0 && !listQ.isLoading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No skills match that filter.
          </div>
        )}
      </div>

      {editing && (
        <SkillEditDrawer
          skillId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['skills'] })}
        />
      )}
      {creating && (
        <SkillCreateDrawer
          onClose={() => setCreating(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['skills'] })}
        />
      )}
    </div>
  )
}

// ─── Edit drawer ──────────────────────────────────────────────────────────────

function SkillEditDrawer({ skillId, onClose, onSaved }: {
  skillId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['skills', skillId],
    queryFn: async (): Promise<SkillDetail> => (await api.get<SkillDetail>(`/skills/${skillId}`)).data,
  })

  const [form, setForm] = useState<Partial<SkillDetail> | null>(null)
  useEffect(() => { if (detail) setForm({ ...detail }) }, [detail])

  const save = useMutation({
    mutationFn: async (patch: Partial<SkillDetail>) => {
      const r = await api.patch<SkillDetail>(`/skills/${skillId}`, patch)
      return r.data
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  const hidden = detail?.systemPrompt === '[hidden — admin-only]'

  return (
    <Drawer onClose={onClose} testId="admin-skill-edit-drawer">
      {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
      {error && (
        <div className="p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Failed to load skill.
        </div>
      )}
      {detail && form && (
        <>
          <DrawerHeader title={`Edit ${detail.slug}`} onClose={onClose} />
          {hidden && (
            <div className="mx-4 mt-3 text-[11px] flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              <Lock className="h-3 w-3" /> You don't have permission to view this prompt (admin role required).
            </div>
          )}
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            <Field label="Name">
              <input
                type="text"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="admin-skill-edit-name"
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <input
                type="text"
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                data-testid="admin-skill-edit-description"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Context scope">
                <select
                  value={form.contextScope ?? 'any'}
                  onChange={e => setForm(f => ({ ...f, contextScope: e.target.value }))}
                  data-testid="admin-skill-edit-scope"
                  className={inputCls}
                >
                  {CONTEXT_SCOPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Model tier">
                <select
                  value={form.modelTier ?? 'default'}
                  onChange={e => setForm(f => ({ ...f, modelTier: e.target.value }))}
                  data-testid="admin-skill-edit-tier"
                  className={inputCls}
                >
                  {MODEL_TIERS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Triggers">
              <div className="flex gap-3 text-sm">
                {TRIGGER_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={(form.triggerTypes ?? []).includes(t)}
                      onChange={e => {
                        const next = new Set(form.triggerTypes ?? [])
                        if (e.target.checked) next.add(t)
                        else next.delete(t)
                        setForm(f => ({ ...f, triggerTypes: [...next] }))
                      }}
                      data-testid={`admin-skill-edit-trigger-${t}`}
                    />
                    <span className="font-mono text-[11px]">{t}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Allowed tools (comma-separated)">
              <input
                type="text"
                value={(form.allowedTools ?? []).join(', ')}
                onChange={e => setForm(f => ({
                  ...f,
                  allowedTools: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                }))}
                data-testid="admin-skill-edit-tools"
                placeholder="contract_get, clause_search"
                className={`${inputCls} font-mono text-[12px]`}
              />
            </Field>
            <Field label="System prompt">
              <textarea
                value={form.systemPrompt ?? ''}
                onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                disabled={hidden}
                rows={18}
                data-testid="admin-skill-edit-prompt"
                className={`${inputCls} font-mono text-[11.5px] leading-relaxed resize-y min-h-[18em]`}
              />
              <div className="text-[10.5px] text-muted-foreground mt-1">
                Changes bump the skill version on save. Past invocations keep their snapshot.
              </div>
            </Field>
          </div>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose} data-testid="admin-skill-edit-cancel">Cancel</Button>
            <Button
              onClick={() => save.mutate({
                name: form.name,
                description: form.description,
                contextScope: form.contextScope as (typeof CONTEXT_SCOPES)[number],
                modelTier: form.modelTier as (typeof MODEL_TIERS)[number],
                triggerTypes: form.triggerTypes,
                allowedTools: form.allowedTools,
                // systemPrompt stays undefined on the edit payload when the
                // admin didn't actually touch the hidden placeholder.
                systemPrompt: hidden ? undefined : form.systemPrompt,
              })}
              disabled={save.isPending}
              data-testid="admin-skill-edit-save"
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DrawerFooter>
          {save.error && (
            <div className="mx-4 mb-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {(save.error as Error).message}
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}

// ─── Create drawer ────────────────────────────────────────────────────────────

function SkillCreateDrawer({ onClose, onCreated }: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    slug: '@',
    description: '',
    contextScope: 'current_contract' as (typeof CONTEXT_SCOPES)[number],
    modelTier: 'default' as (typeof MODEL_TIERS)[number],
    triggerTypes: ['mention'] as string[],
    allowedTools: [] as string[],
    systemPrompt: '',
  })
  const [err, setErr] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.post('/skills', form)
      return r.data
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: (e: unknown) => {
      const resp = (e as { response?: { data?: { detail?: string } } }).response
      setErr(resp?.data?.detail ?? (e as Error).message)
    },
  })

  return (
    <Drawer onClose={onClose} testId="admin-skill-create-drawer">
      <DrawerHeader title="New org skill" onClose={onClose} />
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            data-testid="admin-skill-create-name"
            placeholder="Weekly compliance sweep"
            className={inputCls}
          />
        </Field>
        <Field label="Slug">
          <input
            type="text"
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            data-testid="admin-skill-create-slug"
            placeholder="@weekly-compliance"
            className={`${inputCls} font-mono`}
          />
          <div className="text-[10.5px] text-muted-foreground mt-1">
            Start with <span className="font-mono">@</span>, lowercase kebab-case, unique across your org.
          </div>
        </Field>
        <Field label="Description">
          <input
            type="text"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            data-testid="admin-skill-create-description"
            placeholder="Scan last week's contracts for playbook deviations"
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Context scope">
            <select
              value={form.contextScope}
              onChange={e => setForm(f => ({ ...f, contextScope: e.target.value as (typeof CONTEXT_SCOPES)[number] }))}
              className={inputCls}
              data-testid="admin-skill-create-scope"
            >
              {CONTEXT_SCOPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Model tier">
            <select
              value={form.modelTier}
              onChange={e => setForm(f => ({ ...f, modelTier: e.target.value as (typeof MODEL_TIERS)[number] }))}
              className={inputCls}
              data-testid="admin-skill-create-tier"
            >
              {MODEL_TIERS.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Allowed tools (comma-separated)">
          <input
            type="text"
            value={form.allowedTools.join(', ')}
            onChange={e => setForm(f => ({
              ...f,
              allowedTools: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
            }))}
            placeholder="contract_search, clause_search"
            className={`${inputCls} font-mono text-[12px]`}
            data-testid="admin-skill-create-tools"
          />
        </Field>
        <Field label="System prompt">
          <textarea
            value={form.systemPrompt}
            onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
            rows={12}
            placeholder="You are running the '…' skill. …"
            className={`${inputCls} font-mono text-[11.5px] leading-relaxed resize-y min-h-[12em]`}
            data-testid="admin-skill-create-prompt"
          />
        </Field>
      </div>
      <DrawerFooter>
        <Button variant="ghost" onClick={onClose} data-testid="admin-skill-create-cancel">Cancel</Button>
        <Button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          data-testid="admin-skill-create-submit"
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          {create.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DrawerFooter>
      {err && (
        <div className="mx-4 mb-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" />
          {err}
        </div>
      )}
    </Drawer>
  )
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm rounded-md border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  )
}

function Drawer({ onClose, testId, children }: {
  onClose: () => void
  testId?: string
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex" data-testid={testId}>
      <button
        aria-label="Close drawer"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <div className="w-[520px] max-w-[90vw] bg-card border-l border-border flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <div className="font-semibold text-sm flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
        {title}
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function DrawerFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/30">
      {children}
    </div>
  )
}
