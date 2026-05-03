/**
 * AdminIntegrationsPage — Phase 10A — manage API keys + webhooks.
 *
 * Two tabs:
 *   1. API Keys — create / list / revoke (full key shown ONCE on create)
 *   2. Webhooks — create / list / edit / test / delete + delivery log
 *
 * Lives at /admin/integrations.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermission } from '@/lib/permissions'
import {
  Plug, Plus, Loader2, Copy, Check, Trash2, X, Send, AlertCircle, Lock,
  Key, Webhook as WebhookIcon, ChevronRight, ChevronDown,
} from 'lucide-react'

interface ApiKey {
  id:         string
  name:       string
  prefix:     string
  scopes:     string[]
  lastUsedAt: string | null
  expiresAt:  string | null
  revokedAt:  string | null
  createdAt:  string
}

interface Webhook {
  id:                 string
  name:               string
  url:                string
  events:             string[]
  enabled:            boolean
  type:               'generic' | 'slack'
  lastDeliveryAt:     string | null
  lastDeliveryStatus: string | null
  failureCount:       number
  createdAt:          string
  secret:             string
}

interface Delivery {
  id:             string
  event:          string
  attempts:       number
  succeeded:      boolean
  responseStatus: number | null
  errorMessage:   string | null
  createdAt:      string
  deliveredAt:    string | null
}

type Tab = 'keys' | 'webhooks'

export function AdminIntegrationsPage() {
  const [tab, setTab] = useState<Tab>('keys')
  // P14 audit (2026-04-29). Without this gate, non-admin users hitting
  // /admin/integrations triggered a 403 GET /api/v1/admin/integrations/
  // api-keys flood that surfaced in the rail console + felt broken.
  // Render a clean access-denied state instead — the route is reachable
  // by URL even though the sidebar hides the nav item for non-admins.
  const canConfigureIntegrations = usePermission('configure', 'integration')

  if (!canConfigureIntegrations) {
    return (
      <div className="px-6 py-6 max-w-2xl mx-auto" data-testid="admin-integrations-page">
        <div className="flex items-center gap-3 mb-2">
          <Plug className="h-5 w-5 text-indigo-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <Lock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900">Admin access required</p>
            <p className="text-gray-500 mt-1">
              Integrations (API keys, webhooks) are managed by your organization
              admin. Contact your admin to enable an API key or webhook for your team.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto" data-testid="admin-integrations-page">
      <div className="flex items-center gap-3 mb-1">
        <Plug className="h-5 w-5 text-indigo-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        API keys for external systems to call CLM, and webhooks for CLM to push events to you.
      </p>

      <div className="flex items-center gap-1 mb-5 border-b border-gray-200">
        <TabButton active={tab === 'keys'} onClick={() => setTab('keys')} testId="tab-api-keys">
          <Key className="h-4 w-4" /> API Keys
        </TabButton>
        <TabButton active={tab === 'webhooks'} onClick={() => setTab('webhooks')} testId="tab-webhooks">
          <WebhookIcon className="h-4 w-4" /> Webhooks
        </TabButton>
      </div>

      {tab === 'keys' ? <ApiKeysSection /> : <WebhooksSection />}
    </div>
  )
}

function TabButton({ active, onClick, children, testId }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`px-4 py-2 text-sm border-b-2 transition-colors flex items-center gap-2 -mb-px ${
        active
          ? 'border-indigo-600 text-indigo-700 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

// ─── API Keys ────────────────────────────────────────────────────────

function ApiKeysSection() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [revealKey, setRevealKey] = useState<{ id: string; key: string } | null>(null)

  const { data, isLoading } = useQuery<{ data: ApiKey[] }>({
    queryKey: ['api-keys'],
    queryFn:  () => api.get('/admin/integrations/api-keys').then(r => r.data),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/integrations/api-keys/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  if (isLoading) return <div className="py-12 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>

  const keys = data?.data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700">{keys.length} {keys.length === 1 ? 'key' : 'keys'}</h2>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-key-btn" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          New API key
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-gray-200 rounded-xl">
          <Key className="h-7 w-7 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">No API keys yet.</p>
          <p className="text-xs text-gray-400">
            Create one to let an external system call <code className="text-[10.5px] bg-gray-100 px-1 rounded">/api/v1/*</code> with Bearer auth.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm" data-testid="api-keys-table">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Prefix</th>
                <th className="text-left px-4 py-3 font-medium">Last used</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map(k => (
                <tr key={k.id} data-testid={`api-key-row-${k.id}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{k.prefix}…</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}
                  </td>
                  <td className="px-4 py-3">
                    {k.revokedAt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-red-50 border-red-200 text-red-700">Revoked</span>
                    ) : k.expiresAt && new Date(k.expiresAt) < new Date() ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-gray-100 border-gray-200 text-gray-600">Expired</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-emerald-50 border-emerald-200 text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!k.revokedAt && (
                      <button
                        onClick={() => {
                          if (confirm('Revoke this API key? Any system using it will stop working immediately.')) revoke.mutate(k.id)
                        }}
                        data-testid={`revoke-${k.id}`}
                        className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateApiKeyDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(id, key) => {
            qc.invalidateQueries({ queryKey: ['api-keys'] })
            setRevealKey({ id, key })
          }}
        />
      )}
      {revealKey && <RevealKeyModal id={revealKey.id} keyValue={revealKey.key} onClose={() => setRevealKey(null)} />}
    </div>
  )
}

function CreateApiKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, key: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: async () => (await api.post('/admin/integrations/api-keys', { name: name.trim() })).data as { id: string; key: string },
    onSuccess: (data) => { onCreated(data.id, data.key); onClose() },
    onError: (err: { response?: { data?: { detail?: string } } }) => setError(err.response?.data?.detail ?? 'Failed to create.'),
  })
  return (
    <div role="dialog" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="h-5 w-5 text-indigo-600" /> New API key</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Salesforce sync"
              data-testid="api-key-name"
              autoFocus
            />
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
            data-testid="create-key-confirm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating…</> : 'Create key'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RevealKeyModal({ id: _id, keyValue, onClose }: { id: string; keyValue: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div role="dialog" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="reveal-key-modal">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-700">
            <Check className="h-5 w-5" /> API key created
          </h2>
          <p className="text-xs text-amber-700 mt-1">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            This is the only time you'll see the full key. Copy it now — we don't store it.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 font-mono break-all" data-testid="key-value">
              {keyValue}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(keyValue); setCopied(true) }}
              className="gap-1.5 flex-shrink-0"
              data-testid="copy-key"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            Use it as <code className="text-[10.5px] bg-gray-100 px-1 rounded">Authorization: Bearer {keyValue.slice(0, 20)}…</code>
          </p>
        </div>
        <div className="px-6 py-4 border-t flex justify-end bg-gray-50 rounded-b-xl">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Webhooks ────────────────────────────────────────────────────────

function WebhooksSection() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: Webhook[] }>({
    queryKey: ['webhooks'],
    queryFn:  () => api.get('/admin/integrations/webhooks').then(r => r.data),
    refetchInterval: 30_000,
  })
  const { data: eventsData } = useQuery<{ events: string[] }>({
    queryKey: ['webhook-events'],
    queryFn:  () => api.get('/admin/integrations/events').then(r => r.data),
  })

  const test = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/integrations/webhooks/${id}/test`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/integrations/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/admin/integrations/webhooks/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  if (isLoading) return <div className="py-12 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>

  const webhooks = data?.data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700">{webhooks.length} {webhooks.length === 1 ? 'webhook' : 'webhooks'}</h2>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-webhook-btn" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          New webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-gray-200 rounded-xl">
          <WebhookIcon className="h-7 w-7 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">No webhooks configured.</p>
          <p className="text-xs text-gray-400">
            Add a webhook to receive HMAC-signed POSTs when events fire (contract executed, signature completed, etc.).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id} className="bg-white border border-gray-200 rounded-xl" data-testid={`webhook-row-${w.id}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  {expandedId === w.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                      {w.name}
                      {!w.enabled && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Disabled</span>}
                      {w.lastDeliveryStatus === 'failed' && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                          {w.failureCount} failure{w.failureCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate font-mono">{w.url}</div>
                    <div className="text-[10.5px] text-gray-400 mt-0.5">
                      {w.events.length} event{w.events.length === 1 ? '' : 's'} ·
                      {w.lastDeliveryAt ? ` last fired ${new Date(w.lastDeliveryAt).toLocaleString()}` : ' never fired'}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => test.mutate(w.id)}
                    disabled={test.isPending}
                    className="text-xs text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
                    title="Send a test event"
                    data-testid={`test-${w.id}`}
                  >
                    <Send className="h-3.5 w-3.5" /> Test
                  </button>
                  <button
                    onClick={() => toggle.mutate({ id: w.id, enabled: !w.enabled })}
                    className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    {w.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete ${w.name}?`)) remove.mutate(w.id) }}
                    className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {expandedId === w.id && <WebhookDetail webhook={w} />}
            </div>
          ))}
        </div>
      )}

      {createOpen && eventsData && (
        <CreateWebhookDialog
          events={eventsData.events}
          onClose={() => setCreateOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['webhooks'] })}
        />
      )}
    </div>
  )
}

function WebhookDetail({ webhook }: { webhook: Webhook }) {
  const { data } = useQuery<{ data: Delivery[] }>({
    queryKey: ['webhook-deliveries', webhook.id],
    queryFn:  () => api.get(`/admin/integrations/webhooks/${webhook.id}/deliveries`).then(r => r.data),
    refetchInterval: 5_000,
  })
  const items = data?.data ?? []
  return (
    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
      <div className="text-xs font-medium text-gray-700 mb-2">Subscribed events</div>
      <div className="flex flex-wrap gap-1 mb-3">
        {webhook.events.map(e => (
          <span key={e} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-white border border-gray-200 text-gray-700">
            {e}
          </span>
        ))}
      </div>
      <div className="text-xs font-medium text-gray-700 mb-2">Recent deliveries ({items.length})</div>
      {items.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic">No deliveries yet — fire a test event to verify connectivity.</div>
      ) : (
        <div className="space-y-1">
          {items.map(d => (
            <div key={d.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-gray-100 last:border-b-0">
              <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.succeeded ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="font-mono text-gray-700 w-44 truncate">{d.event}</span>
              <span className="text-gray-500 w-32">{new Date(d.createdAt).toLocaleString()}</span>
              <span className={d.succeeded ? 'text-emerald-700' : 'text-red-700'}>
                {d.responseStatus ?? '—'} · {d.attempts} attempt{d.attempts === 1 ? '' : 's'}
              </span>
              {d.errorMessage && <span className="text-red-600 truncate text-[10.5px]">{d.errorMessage}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-gray-400 mt-2 font-mono">
        Signing secret: {webhook.secret.slice(0, 16)}… (use to verify <code>X-CLM-Signature</code>)
      </div>
    </div>
  )
}

function CreateWebhookDialog({ events, onClose, onCreated }: {
  events: string[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<'generic' | 'slack'>('generic')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  // Auto-detect: paste a Slack URL and we'll flip the type for them.
  const detectedSlack = /^https:\/\/hooks\.slack\.com\//.test(url.trim())
  const effectiveType = detectedSlack ? 'slack' : type

  const create = useMutation({
    mutationFn: async () => api.post('/admin/integrations/webhooks', {
      name: name.trim(), url: url.trim(), events: selectedEvents, type: effectiveType,
    }),
    onSuccess: () => { onCreated(); onClose() },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      setError(err.response?.data?.detail ?? 'Failed to create webhook.'),
  })
  const valid = name.trim() && /^https?:\/\//.test(url.trim()) && selectedEvents.length > 0

  return (
    <div role="dialog" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><WebhookIcon className="h-5 w-5 text-indigo-600" /> New webhook</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Slack notifications"
              data-testid="webhook-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <Input
              value={url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              placeholder="https://your.app/clm-webhook  or  https://hooks.slack.com/services/…"
              data-testid="webhook-url"
            />
            {detectedSlack && (
              <p className="text-[11px] text-emerald-700 mt-1 inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Slack URL detected — events will be formatted as Slack messages.
              </p>
            )}
          </div>

          {!detectedSlack && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('generic')}
                  className={`flex-1 text-left p-2.5 rounded-md border text-sm transition-colors ${
                    type === 'generic' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid="type-generic"
                >
                  <div className="font-medium text-gray-900">Generic JSON</div>
                  <div className="text-[11px] text-gray-500">Standard envelope: {'{ event, timestamp, data }'}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setType('slack')}
                  className={`flex-1 text-left p-2.5 rounded-md border text-sm transition-colors ${
                    type === 'slack' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid="type-slack"
                >
                  <div className="font-medium text-gray-900">Slack blocks</div>
                  <div className="text-[11px] text-gray-500">Pretty rendering for Slack-compatible receivers</div>
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-2 border border-gray-200 rounded-md">
              {events.map(e => (
                <label key={e} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 px-1.5 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(e)}
                    onChange={(ev) => setSelectedEvents(ev.target.checked
                      ? [...selectedEvents, e]
                      : selectedEvents.filter(x => x !== e))
                    }
                    data-testid={`event-${e}`}
                    className="h-3.5 w-3.5"
                  />
                  <span className="font-mono">{e}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!valid || create.isPending}
            data-testid="create-webhook-confirm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating…</> : 'Create webhook'}
          </Button>
        </div>
      </div>
    </div>
  )
}
