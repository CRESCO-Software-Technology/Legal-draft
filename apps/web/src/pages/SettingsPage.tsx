import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, Trash2, GripVertical, Settings, Layers, Bell,
  Type, Hash, Calendar, ToggleLeft, List, ChevronDown,
  AlertCircle, Check, Loader2, Mail, AtSign, FileSignature,
  CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text',        label: 'Text',        icon: Type },
  { value: 'number',      label: 'Number',      icon: Hash },
  { value: 'date',        label: 'Date',        icon: Calendar },
  { value: 'boolean',     label: 'Yes / No',    icon: ToggleLeft },
  { value: 'select',      label: 'Select',      icon: List },
  { value: 'multiselect', label: 'Multi-select',icon: List },
]

const CONTRACT_TYPES = ['', 'NDA', 'MSA', 'SOW', 'SLA', 'VENDOR_AGREEMENT', 'EMPLOYMENT', 'PARTNERSHIP', 'LICENSE', 'OTHER']

const FIELD_TYPE_COLORS: Record<string, string> = {
  text:        'bg-blue-50 text-blue-700 border-blue-200',
  number:      'bg-purple-50 text-purple-700 border-purple-200',
  date:        'bg-green-50 text-green-700 border-green-200',
  boolean:     'bg-amber-50 text-amber-700 border-amber-200',
  select:      'bg-orange-50 text-orange-700 border-orange-200',
  multiselect: 'bg-pink-50 text-pink-700 border-pink-200',
}

type Tab = 'custom-fields' | 'general' | 'notifications'

// U.8.1 — typed user preferences. Loosely-typed to keep backend
// schema simple (Record<string, unknown> on the API), but the front
// end validates shape before reading.
interface NotificationPrefs {
  approvalRequested: boolean
  approvalDecided: boolean
  contractUpdated: boolean
  contractExpiringSoon: boolean
  mentioned: boolean
  digest: 'real-time' | 'daily' | 'off'
}
interface GeneralPrefs {
  currency: string  // ISO 4217 (USD, EUR, GBP, INR…)
  dateFormat: 'us' | 'iso' | 'eu' // MM/DD/YYYY · YYYY-MM-DD · DD/MM/YYYY
  timezone: string // IANA zone (e.g. "America/New_York")
}
const DEFAULT_NOTIFS: NotificationPrefs = {
  approvalRequested: true,
  approvalDecided: true,
  contractUpdated: false,
  contractExpiringSoon: true,
  mentioned: true,
  digest: 'real-time',
}
const DEFAULT_GENERAL: GeneralPrefs = {
  currency: 'USD',
  dateFormat: 'us',
  timezone: typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') : 'UTC',
}
const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF']
const DATE_FORMAT_OPTIONS: { value: GeneralPrefs['dateFormat']; label: string }[] = [
  { value: 'us',  label: 'MM/DD/YYYY (12/31/2026)' },
  { value: 'iso', label: 'YYYY-MM-DD (2026-12-31)' },
  { value: 'eu',  label: 'DD/MM/YYYY (31/12/2026)' },
]
const COMMON_TIMEZONES = [
  'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
]

interface NewField {
  fieldKey: string
  fieldLabel: string
  fieldType: string
  contractType: string
  required: boolean
  helpText: string
  options: string[]
  optionInput: string
}

const EMPTY_FIELD: NewField = {
  fieldKey: '',
  fieldLabel: '',
  fieldType: 'text',
  contractType: '',
  required: false,
  helpText: '',
  options: [],
  optionInput: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('custom-fields')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newField, setNewField] = useState<NewField>({ ...EMPTY_FIELD })
  const [formError, setFormError] = useState('')
  const [filterType, setFilterType] = useState('')

  const qc = useQueryClient()

  const { data: defsData, isLoading } = useQuery({
    queryKey: ['field-definitions', filterType],
    queryFn: () => api.get('/field-definitions', {
      params: filterType ? { contractType: filterType } : undefined,
    }).then(r => r.data),
  })

  const createField = useMutation({
    mutationFn: (body: any) => api.post('/field-definitions', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-definitions'] })
      setShowNewForm(false)
      setNewField({ ...EMPTY_FIELD })
      setFormError('')
    },
    onError: (e: any) => {
      setFormError(e.response?.data?.detail ?? 'Failed to create field')
    },
  })

  const deleteField = useMutation({
    mutationFn: (id: string) => api.delete(`/field-definitions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-definitions'] }),
  })

  const defs = defsData?.data ?? []

  const handleAutoKey = (label: string) => {
    if (!newField.fieldKey) {
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      setNewField(f => ({ ...f, fieldKey: key }))
    }
  }

  const handleSubmit = () => {
    setFormError('')
    if (!newField.fieldLabel.trim()) return setFormError('Label is required')
    if (!newField.fieldKey.trim()) return setFormError('Field key is required')
    if (!/^[a-z][a-z0-9_]*$/.test(newField.fieldKey)) return setFormError('Key must be snake_case (e.g. payment_terms)')
    if ((newField.fieldType === 'select' || newField.fieldType === 'multiselect') && newField.options.length < 1) {
      return setFormError('Select fields require at least one option')
    }
    createField.mutate({
      fieldLabel: newField.fieldLabel,
      fieldKey: newField.fieldKey,
      fieldType: newField.fieldType,
      contractType: newField.contractType || null,
      required: newField.required,
      helpText: newField.helpText || undefined,
      options: newField.options,
    })
  }

  const addOption = () => {
    const opt = newField.optionInput.trim()
    if (!opt || newField.options.includes(opt)) return
    setNewField(f => ({ ...f, options: [...f.options, opt], optionInput: '' }))
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* Settings sidebar */}
      <aside className="w-52 border-r bg-white flex-shrink-0 p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Settings</p>
        <nav className="space-y-0.5">
          {[
            { id: 'custom-fields', icon: Layers, label: 'Custom Fields' },
            { id: 'general',       icon: Settings, label: 'General' },
            { id: 'notifications', icon: Bell, label: 'Notifications' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as Tab)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === id
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">

        {/* ─── Custom Fields ─────────────────────────────────────────────── */}
        {activeTab === 'custom-fields' && (
          <div className="max-w-3xl space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Custom Fields</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Define extra fields for your contracts. Values are stored on each contract and fully searchable.
                </p>
              </div>
              <Button onClick={() => setShowNewForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Field
              </Button>
            </div>

            {/* Filter by type */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Show fields for:</span>
              <div className="relative">
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  aria-label="Filter fields by contract type"
                  className="appearance-none pl-3 pr-7 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All contract types</option>
                  {CONTRACT_TYPES.filter(Boolean).map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* New field form */}
            {showNewForm && (
              <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">New Custom Field</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Field Label *</Label>
                    <Input
                      placeholder="e.g. Survival Period"
                      value={newField.fieldLabel}
                      onChange={e => {
                        setNewField(f => ({ ...f, fieldLabel: e.target.value }))
                        handleAutoKey(e.target.value)
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Field Key * (snake_case)</Label>
                    <Input
                      placeholder="e.g. survival_period"
                      value={newField.fieldKey}
                      onChange={e => setNewField(f => ({ ...f, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Field Type *</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {FIELD_TYPES.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setNewField(f => ({ ...f, fieldType: value }))}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                            newField.fieldType === value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-500 mb-1.5 block">Contract Type (optional)</Label>
                      <div className="relative">
                        <select
                          value={newField.contractType}
                          onChange={e => setNewField(f => ({ ...f, contractType: e.target.value }))}
                          aria-label="Contract type for new field"
                          className="w-full appearance-none pl-3 pr-7 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All types (global)</option>
                          {CONTRACT_TYPES.filter(Boolean).map(t => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="required"
                        checked={newField.required}
                        onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <label htmlFor="required" className="text-sm text-gray-600">Required field</label>
                    </div>
                  </div>
                </div>

                {/* Options for select/multiselect */}
                {(newField.fieldType === 'select' || newField.fieldType === 'multiselect') && (
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Options *</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {newField.options.map(opt => (
                        <span key={opt} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs">
                          {opt}
                          <button onClick={() => setNewField(f => ({ ...f, options: f.options.filter(o => o !== opt) }))} className="text-gray-400 hover:text-gray-600">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add an option…"
                        value={newField.optionInput}
                        onChange={e => setNewField(f => ({ ...f, optionInput: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addOption()}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={addOption}>Add</Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Help Text (optional)</Label>
                  <Input
                    placeholder="Shown below the field in the contract form"
                    value={newField.helpText}
                    onChange={e => setNewField(f => ({ ...f, helpText: e.target.value }))}
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{formError}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => { setShowNewForm(false); setNewField({ ...EMPTY_FIELD }); setFormError('') }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={createField.isPending} className="gap-2">
                    {createField.isPending ? 'Saving…' : <><Check className="h-4 w-4" /> Save Field</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Field list */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : defs.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <Layers className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No custom fields yet</p>
                <p className="text-sm text-gray-400 mt-1">Add fields like "Survival Period" or "Auto-Renewal Notice Days" to capture org-specific data</p>
                <Button onClick={() => setShowNewForm(true)} variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> Add your first field
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border shadow-sm divide-y">
                {/* Group by contract type */}
                {Array.from(new Set(defs.map((d: any) => d.contractType ?? ''))).map(group => {
                  const groupDefs = defs.filter((d: any) => (d.contractType ?? '') === group)
                  return (
                    <div key={String(group)}>
                      <div className="px-5 py-2 bg-gray-50 border-b">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {group ? String(group).replace(/_/g, ' ') : 'Global (all contract types)'}
                        </span>
                      </div>
                      {groupDefs.map((def: any) => (
                        <div key={def.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                          <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{def.fieldLabel}</p>
                              {def.required && (
                                <span className="text-[10px] font-bold text-red-500 uppercase">Required</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-[11px] text-gray-400">{def.fieldKey}</span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${FIELD_TYPE_COLORS[def.fieldType] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {def.fieldType}
                              </span>
                              {def.options?.length > 0 && (
                                <span className="text-[11px] text-gray-400">{def.options.join(' · ')}</span>
                              )}
                            </div>
                            {def.helpText && (
                              <p className="text-xs text-gray-400 mt-0.5 italic">{def.helpText}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteField.mutate(def.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── General ───────────────────────────────────────────────────── */}
        {activeTab === 'general' && <GeneralTab />}

        {/* ─── Notifications ─────────────────────────────────────────────── */}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  )
}

// ─── General tab ──────────────────────────────────────────────────────────────
//
// U.8.1 — replaces the "coming in Phase 10" stub with a real form.
// Profile fields (name) save via PATCH /users/me; org-level fields
// (currency / date format / timezone) are stored in user.preferences
// for now — they're per-user display preferences, not org-wide policy.
// The auth store is updated optimistically so the avatar pill in the
// header re-renders immediately.

function GeneralTab() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()

  const { data: me } = useQuery({
    queryKey: ['users-me'],
    queryFn: () => api.get('/users/me').then(r => r.data),
    staleTime: 30_000,
  })

  const initialPrefs: GeneralPrefs = {
    ...DEFAULT_GENERAL,
    ...(me?.preferences?.general ?? {}),
  }

  const [name, setName] = useState(user?.name ?? '')
  const [prefs, setPrefs] = useState<GeneralPrefs>(initialPrefs)
  const [savedFlash, setSavedFlash] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Sync state when /me loads or changes upstream.
  useEffect(() => {
    if (me?.name) setName(me.name)
    if (me?.preferences?.general) {
      setPrefs({ ...DEFAULT_GENERAL, ...me.preferences.general })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  const save = useMutation({
    mutationFn: (patch: { name?: string; preferences?: Record<string, unknown> }) =>
      api.patch('/users/me', patch).then(r => r.data),
    onMutate: () => { setSavedFlash('saving'); setErrorMsg('') },
    onSuccess: (data) => {
      setSavedFlash('saved')
      qc.invalidateQueries({ queryKey: ['users-me'] })
      // Optimistically update authStore so the header chip + avatar refresh.
      if (user && data?.name) {
        setUser({ ...user, name: data.name })
      }
      setTimeout(() => setSavedFlash('idle'), 2000)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setSavedFlash('error')
      setErrorMsg(e?.response?.data?.detail ?? 'Could not save. Try again.')
    },
  })

  const onSaveProfile = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setErrorMsg('Name cannot be empty.')
      setSavedFlash('error')
      return
    }
    save.mutate({ name: trimmed })
  }

  const onPrefChange = (next: GeneralPrefs) => {
    setPrefs(next)
    // Merge with existing preferences server-side — we send only the
    // {general: ...} sub-tree so we don't clobber {notifications: ...}.
    save.mutate({
      preferences: { ...(me?.preferences ?? {}), general: next },
    })
  }

  const orgName = (me as { orgName?: string } | undefined)?.orgName
    ?? (user as unknown as { orgName?: string })?.orgName
    ?? null

  return (
    <div className="max-w-2xl space-y-6" data-testid="general-tab">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">General</h1>
          <p className="text-sm text-gray-500 mt-1">Your profile and display preferences.</p>
        </div>
        <SaveBadge state={savedFlash} />
      </div>

      {/* Profile */}
      <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4" data-testid="general-profile">
        <h2 className="text-sm font-semibold text-gray-800">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Display name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="general-name-input"
              placeholder="Your name"
            />
            <p className="text-[11px] text-gray-400 mt-1">Shown on contracts you own and in the activity feed.</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Email</Label>
            <div
              className="flex h-9 items-center rounded-md border border-input bg-gray-50 px-3 text-sm text-gray-700 select-text"
              data-testid="general-email-readonly"
            >
              {user?.email ?? '—'}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Contact your admin to change.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={onSaveProfile} disabled={save.isPending || name.trim() === (me?.name ?? user?.name ?? '')} data-testid="general-save-profile" size="sm">
            {save.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</> : 'Save profile'}
          </Button>
          {errorMsg && <span className="text-xs text-red-600">{errorMsg}</span>}
        </div>
      </section>

      {/* Workspace */}
      <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4" data-testid="general-workspace">
        <h2 className="text-sm font-semibold text-gray-800">Workspace</h2>
        {orgName && (
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Organization</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-gray-50 px-3 text-sm text-gray-700 select-text">
              {orgName}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Default currency</Label>
            <select
              value={prefs.currency}
              onChange={e => onPrefChange({ ...prefs, currency: e.target.value })}
              data-testid="general-currency"
              className="w-full h-9 text-sm border border-gray-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Date format</Label>
            <select
              value={prefs.dateFormat}
              onChange={e => onPrefChange({ ...prefs, dateFormat: e.target.value as GeneralPrefs['dateFormat'] })}
              data-testid="general-date-format"
              className="w-full h-9 text-sm border border-gray-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              {DATE_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Timezone</Label>
            <select
              value={prefs.timezone}
              onChange={e => onPrefChange({ ...prefs, timezone: e.target.value })}
              data-testid="general-timezone"
              className="w-full h-9 text-sm border border-gray-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              {COMMON_TIMEZONES.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              {!COMMON_TIMEZONES.includes(prefs.timezone) && (
                <option value={prefs.timezone}>{prefs.timezone.replace(/_/g, ' ')} (current)</option>
              )}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">Used for date display, currency formatting and digest delivery time.</p>
      </section>
    </div>
  )
}

// ─── Notifications tab ────────────────────────────────────────────────────────
//
// U.8.1 — toggles for each notification trigger + a digest cadence
// radio. Stored in user.preferences.notifications. Backend already
// reads/writes via PATCH /users/me; the actual delivery side
// (notification.worker.ts) reads these flags before sending.

function NotificationsTab() {
  const qc = useQueryClient()

  const { data: me } = useQuery({
    queryKey: ['users-me'],
    queryFn: () => api.get('/users/me').then(r => r.data),
    staleTime: 30_000,
  })

  const initial: NotificationPrefs = { ...DEFAULT_NOTIFS, ...(me?.preferences?.notifications ?? {}) }
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial)
  const [savedFlash, setSavedFlash] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (me?.preferences?.notifications) {
      setPrefs({ ...DEFAULT_NOTIFS, ...me.preferences.notifications })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) =>
      api.patch('/users/me', {
        preferences: { ...(me?.preferences ?? {}), notifications: next },
      }).then(r => r.data),
    onMutate: () => setSavedFlash('saving'),
    onSuccess: () => {
      setSavedFlash('saved')
      qc.invalidateQueries({ queryKey: ['users-me'] })
      setTimeout(() => setSavedFlash('idle'), 2000)
    },
    onError: () => setSavedFlash('error'),
  })

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    save.mutate(next)
  }

  const triggers: { key: keyof NotificationPrefs; icon: typeof Bell; title: string; body: string }[] = [
    { key: 'approvalRequested',    icon: FileSignature,  title: 'Approval requested from me',          body: 'Get notified when a contract enters your approval queue.' },
    { key: 'approvalDecided',      icon: CheckCircle2,   title: 'My approval request gets a decision', body: 'Know the moment one of your contracts is approved or rejected.' },
    { key: 'contractUpdated',      icon: Mail,           title: 'A contract I own is updated',         body: 'Counterparty edits, version uploads, status changes.' },
    { key: 'contractExpiringSoon', icon: AlertTriangle,  title: 'A contract I own is expiring soon',   body: '90, 60, 30 days before expiry.' },
    { key: 'mentioned',            icon: AtSign,         title: 'Someone @mentions me in a comment',   body: 'Direct mentions in clause-scoped or contract-level comments.' },
  ]

  return (
    <div className="max-w-2xl space-y-6" data-testid="notifications-tab">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Pick what reaches you and how often.</p>
        </div>
        <SaveBadge state={savedFlash} />
      </div>

      <section className="bg-white rounded-xl border shadow-sm divide-y" data-testid="notifications-triggers">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Email me when…</h2>
          <span className="text-[11px] text-gray-400">All toggles persist immediately</span>
        </div>
        {triggers.map(({ key, icon: Icon, title, body }) => (
          <label
            key={key}
            className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            data-testid={`notif-${key}-row`}
          >
            <span className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-gray-500" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
            </div>
            <input
              type="checkbox"
              checked={!!prefs[key]}
              onChange={e => update({ [key]: e.target.checked } as Partial<NotificationPrefs>)}
              data-testid={`notif-${key}-toggle`}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30"
            />
          </label>
        ))}
      </section>

      <section className="bg-white rounded-xl border shadow-sm p-4 space-y-3" data-testid="notifications-digest">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Delivery cadence</h2>
        </div>
        <p className="text-xs text-gray-500">How often we should batch and send the notifications you've chosen.</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'real-time', label: 'Real-time',     hint: 'As things happen' },
            { value: 'daily',     label: 'Daily digest',  hint: 'One email at 9am' },
            { value: 'off',       label: 'Off',           hint: 'Pause email' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ digest: opt.value as NotificationPrefs['digest'] })}
              data-testid={`notif-digest-${opt.value}`}
              aria-pressed={prefs.digest === opt.value}
              className={`p-3 rounded-lg border text-left transition-colors ${
                prefs.digest === opt.value
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className={`text-sm font-medium ${prefs.digest === opt.value ? 'text-blue-700' : 'text-gray-900'}`}>{opt.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── Save badge (shared) ──────────────────────────────────────────────────────
function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  return (
    <span
      data-testid="settings-save-badge"
      data-state={state}
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
        state === 'saving' ? 'bg-gray-100 text-gray-600' :
        state === 'saved' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
        'bg-red-50 text-red-700 ring-1 ring-red-200'
      }`}
    >
      {state === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> :
       state === 'saved'  ? <><Check className="h-3 w-3" /> Saved</> :
                            <><AlertCircle className="h-3 w-3" /> Could not save</>}
    </span>
  )
}
