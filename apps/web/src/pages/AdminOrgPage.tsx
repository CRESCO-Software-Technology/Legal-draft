import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/common/Toaster'
import {
  Building2,
  Save,
  AlertCircle,
  Check,
  Bell,
  Cpu,
  BarChart3,
  Database,
} from 'lucide-react'
import { AiConfigTab } from '@/components/admin/AiConfigTab'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'alerts' | 'ai-config' | 'system' | 'data'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'alerts', label: 'Alert Rules', icon: Bell },
  { id: 'ai-config', label: 'AI Config', icon: Cpu },
  { id: 'system', label: 'System Dashboard', icon: BarChart3 },
  { id: 'data', label: 'Data Management', icon: Database },
]

// B.6.24 — accept both #RGB and #RRGGBB
function isValidHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminOrgPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization').then(r => r.data),
  })

  // Form state — seed from org data
  const [orgName, setOrgName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandColor, setBrandColor] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Initialize form from fetched org data
  useEffect(() => {
    if (org) {
      setOrgName(org.name ?? '')
      setLogoUrl(org.logoUrl ?? '')
      setBrandColor(org.brandColor ?? '')
    }
  }, [org])

  const saveOrg = useMutation({
    mutationFn: (body: { name: string; logoUrl: string; brandColor: string }) =>
      api.patch('/organization', body).then(r => r.data),
    onSuccess: () => {
      setSuccessMsg('Organization settings saved.')
      setErrorMsg('')
      setTimeout(() => setSuccessMsg(''), 3000)
      toast.success('Organization settings saved')
    },
    onError: (e: any) => {
      const detail = e.response?.data?.detail ?? 'Failed to save settings'
      setErrorMsg(detail)
      setSuccessMsg('')
      toast.error('Save failed', { description: detail })
    },
  })

  const handleSave = () => {
    setErrorMsg('')
    setSuccessMsg('')
    saveOrg.mutate({ name: orgName, logoUrl, brandColor })
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar tabs */}
      <aside className="w-52 border-r bg-white flex-shrink-0 p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Organization
        </p>
        <nav className="space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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
        {/* ─── General ──────────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Organization Settings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your organization profile and branding.
              </p>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Organization Name</Label>
                <Input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Logo</Label>
                <div className="flex items-start gap-3">
                  {/* Preview — shows uploaded/URLed logo or a subtle placeholder */}
                  <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt="Organization logo preview"
                        data-testid="logo-preview"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={logoUrl}
                      onChange={e => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      data-testid="logo-url"
                    />
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Paste a URL to your logo (PNG or SVG). Direct file
                      upload lands in v1.1 — for now host on your own CDN
                      or intranet.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Brand Color</Label>
                {/*
                  B.6.24 — native color picker + synced hex input. The
                  picker is the primary affordance (click the swatch to
                  open the OS color UI); the hex input is for power
                  users and still supports copy-paste from design
                  tools. Invalid hex falls back to the stored value
                  without mutating state.
                */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-block cursor-pointer">
                    <input
                      type="color"
                      value={isValidHex(brandColor) ? brandColor : '#3b82f6'}
                      onChange={e => setBrandColor(e.target.value)}
                      data-testid="brand-color-picker"
                      aria-label="Pick brand color"
                      className="sr-only"
                    />
                    <span
                      className="block w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                      style={{ backgroundColor: isValidHex(brandColor) ? brandColor : '#3B82F6' }}
                      aria-hidden
                    />
                  </label>
                  <Input
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="max-w-36 font-mono tabular-nums"
                    data-testid="brand-color-hex"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Click the swatch to pick, or paste a hex.
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Subscription Tier</Label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg border text-sm text-gray-700">
                  {org?.subscriptionTier ?? 'FREE'}
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-700">{successMsg}</p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button onClick={handleSave} disabled={saveOrg.isPending} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saveOrg.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Placeholder tabs ─────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <PlaceholderTab icon={Bell} title="Alert Rules" />
        )}
        {activeTab === 'ai-config' && <AiConfigTab />}
        {activeTab === 'system' && (
          <PlaceholderTab icon={BarChart3} title="System Dashboard" />
        )}
        {activeTab === 'data' && (
          <PlaceholderTab icon={Database} title="Data Management" />
        )}
      </div>
    </div>
  )
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function PlaceholderTab({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">{title}</h1>
      <div className="bg-white rounded-xl border shadow-sm p-6 text-center py-16">
        <Icon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Coming soon</p>
      </div>
    </div>
  )
}
