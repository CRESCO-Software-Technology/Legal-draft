import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Building2,
  Users,
  FileText,
  LayoutTemplate,
  GitBranch,
  BookOpen,
  Upload,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  X,
  Plus,
  Trash2,
  Briefcase,
} from 'lucide-react'

// NOTE: industry pack step is appended at the END (before Summary) to avoid
// re-numbering all the existing currentStep === N conditionals downstream.
const STEPS = [
  { title: 'Welcome', icon: Sparkles },
  { title: 'Organization Profile', icon: Building2 },
  { title: 'Invite Team', icon: Users },
  { title: 'Contract Types', icon: FileText },
  { title: 'Templates', icon: LayoutTemplate },
  { title: 'Approval Workflow', icon: GitBranch },
  { title: 'Playbook', icon: BookOpen },
  { title: 'Upload Contract', icon: Upload },
  { title: 'Industry Pack', icon: Briefcase },
  { title: 'Summary', icon: CheckCircle2 },
]

const CONTRACT_TYPES = [
  { value: 'NDA', label: 'NDA', desc: 'Non-Disclosure Agreement' },
  { value: 'MSA', label: 'MSA', desc: 'Master Service Agreement' },
  { value: 'SOW', label: 'SOW', desc: 'Statement of Work' },
  { value: 'SLA', label: 'SLA', desc: 'Service Level Agreement' },
  { value: 'VENDOR_AGREEMENT', label: 'Vendor', desc: 'Vendor Agreement' },
  { value: 'EMPLOYMENT', label: 'Employment', desc: 'Employment Contract' },
  { value: 'PARTNERSHIP', label: 'Partnership', desc: 'Partnership Agreement' },
  { value: 'LICENSE', label: 'License', desc: 'License Agreement' },
  { value: 'OTHER', label: 'Other', desc: 'Other Contract Types' },
]

const ROLE_OPTIONS = [
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'CONTRACT_MANAGER', label: 'Contract Manager' },
  { value: 'LEGAL_COUNSEL', label: 'Legal Counsel' },
  { value: 'LEGAL_OPS', label: 'Legal Ops' },
  { value: 'ADMIN', label: 'Admin' },
]

interface InvitedUser {
  name: string
  email: string
  role: string
  status: 'pending' | 'sent' | 'error'
  error?: string
}

type IndustryPackId = 'saas' | 'healthcare' | 'manufacturing' | 'biotech' | 'logistics'

interface IndustryPackInfo {
  id: IndustryPackId
  label: string
  description: string
}

interface WizardData {
  orgName: string
  logoUrl: string
  brandColor: string
  invitedUsers: InvitedUser[]
  contractTypes: string[]
  approvalSteps: number
  approvers: string[]
  uploadedFile: File | null
  uploadedContractId: string | null
  /** Last industry pack the user installed via the wizard (or null for "skip"). */
  industryPack: IndustryPackId | null
}

export function OnboardingWizard() {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [wizardData, setWizardData] = useState<WizardData>({
    orgName: '',
    logoUrl: '',
    brandColor: '#2563eb',
    invitedUsers: [],
    contractTypes: ['NDA', 'MSA', 'SOW'],
    approvalSteps: 1,
    approvers: [],
    uploadedFile: null,
    uploadedContractId: null,
    industryPack: null,
  })

  // Invite form state
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('VIEWER')

  // Fetch org data
  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization').then((r) => r.data),
  })

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then((r) => r.data),
    enabled: currentStep === 4,
  })

  // Fetch users for approver selection
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: currentStep === 5,
  })

  // Fetch available industry packs (only loaded when user reaches the step)
  const { data: industryPacksData } = useQuery<{ data: IndustryPackInfo[] }>({
    queryKey: ['industry-packs'],
    queryFn: () => api.get('/organization/industry-packs').then((r) => r.data),
    enabled: currentStep === 8,
  })

  // Install an industry pack on top of the universal seed
  const installIndustryPack = useMutation({
    mutationFn: (packId: IndustryPackId) =>
      api.post('/organization/install-industry-pack', { packId }).then((r) => r.data),
    onSuccess: (_, packId) => {
      setWizardData((d) => ({ ...d, industryPack: packId }))
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      queryClient.invalidateQueries({ queryKey: ['clauses'] })
    },
  })

  // Initialize org name from fetched data
  useEffect(() => {
    if (org?.name && !wizardData.orgName) {
      setWizardData((d) => ({ ...d, orgName: org.name }))
    }
  }, [org?.name])

  // Save org profile
  const saveOrgProfile = useMutation({
    mutationFn: () =>
      api.patch('/organization', {
        name: wizardData.orgName,
        settings: {
          logoUrl: wizardData.logoUrl,
          brandColor: wizardData.brandColor,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  })

  // Invite user
  const inviteUser = useMutation({
    mutationFn: (data: { name: string; email: string; roles: string[] }) =>
      api.post('/admin/users/invite', data),
  })

  // Save contract types to org settings
  const saveContractTypes = useMutation({
    mutationFn: () =>
      api.patch('/organization', {
        settings: { contractTypes: wizardData.contractTypes },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  })

  // Complete onboarding
  const completeOnboarding = useMutation({
    mutationFn: () =>
      api.patch('/organization', {
        settings: { onboardingCompleted: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] })
    },
  })

  // Upload contract
  const uploadContract = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('title', file.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim())
      form.append('type', 'OTHER')
      return api.post('/contracts/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res) => {
      setWizardData((d) => ({ ...d, uploadedContractId: res.data?.id ?? null }))
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
  })

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setWizardData((d) => ({ ...d, uploadedFile: accepted[0] }))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    multiple: false,
    maxSize: 50 * 1024 * 1024,
  })

  const handleAddInvite = () => {
    if (!inviteEmail.trim()) return
    setWizardData((d) => ({
      ...d,
      invitedUsers: [
        ...d.invitedUsers,
        { name: inviteName, email: inviteEmail, role: inviteRole, status: 'pending' },
      ],
    }))
    setInviteName('')
    setInviteEmail('')
    setInviteRole('VIEWER')
  }

  const handleSendInvites = async () => {
    for (let i = 0; i < wizardData.invitedUsers.length; i++) {
      const u = wizardData.invitedUsers[i]
      if (u.status === 'sent') continue
      try {
        await inviteUser.mutateAsync({ name: u.name, email: u.email, roles: [u.role] })
        setWizardData((d) => ({
          ...d,
          invitedUsers: d.invitedUsers.map((usr, idx) =>
            idx === i ? { ...usr, status: 'sent' as const } : usr
          ),
        }))
      } catch (err: any) {
        setWizardData((d) => ({
          ...d,
          invitedUsers: d.invitedUsers.map((usr, idx) =>
            idx === i
              ? { ...usr, status: 'error' as const, error: err?.response?.data?.detail ?? 'Failed' }
              : usr
          ),
        }))
      }
    }
  }

  const handleRemoveInvite = (idx: number) => {
    setWizardData((d) => ({
      ...d,
      invitedUsers: d.invitedUsers.filter((_, i) => i !== idx),
    }))
  }

  const handleNext = async () => {
    // Save on specific steps before advancing
    if (currentStep === 1) {
      await saveOrgProfile.mutateAsync()
    }
    if (currentStep === 3) {
      await saveContractTypes.mutateAsync()
    }
    if (currentStep === 7 && wizardData.uploadedFile && !wizardData.uploadedContractId) {
      await uploadContract.mutateAsync(wizardData.uploadedFile)
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  const handleComplete = async () => {
    await completeOnboarding.mutateAsync()
  }

  const isLastStep = currentStep === STEPS.length - 1
  const isSaving =
    saveOrgProfile.isPending ||
    saveContractTypes.isPending ||
    uploadContract.isPending ||
    completeOnboarding.isPending

  const templates = Array.isArray(templatesData) ? templatesData : []
  const users = Array.isArray(usersData) ? usersData : []

  const toggleContractType = (type: string) => {
    setWizardData((d) => ({
      ...d,
      contractTypes: d.contractTypes.includes(type)
        ? d.contractTypes.filter((t) => t !== type)
        : [...d.contractTypes, type],
    }))
  }

  const toggleApprover = (userId: string) => {
    setWizardData((d) => ({
      ...d,
      approvers: d.approvers.includes(userId)
        ? d.approvers.filter((id) => id !== userId)
        : [...d.approvers, userId],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Step indicator */}
      <div className="border-b bg-gray-50 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const Icon = step.icon
              const isActive = idx === currentStep
              const isCompleted = idx < currentStep
              return (
                <div key={idx} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] mt-1 hidden sm:block ${
                        isActive ? 'text-blue-600 font-medium' : 'text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-6 sm:w-10 h-px mx-1 ${
                        idx < currentStep ? 'bg-emerald-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome to Draft Legal
              </h1>
              <p className="text-lg text-gray-500 max-w-md mx-auto">
                Let's set up your workspace in just a few minutes. We'll walk you through the
                essentials to get your team started with contract management.
              </p>
              {org?.name && (
                <div className="inline-flex items-center gap-2 bg-gray-50 border rounded-lg px-4 py-2 text-sm text-gray-700">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {org.name}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Org Profile */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Organization Profile</h2>
                <p className="text-gray-500 mt-1">
                  Customize your organization's identity within the platform.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={wizardData.orgName || org?.name || ''}
                    onChange={(e) => setWizardData((d) => ({ ...d, orgName: e.target.value }))}
                    placeholder="Your organization name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={wizardData.logoUrl}
                    onChange={(e) => setWizardData((d) => ({ ...d, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter a URL pointing to your organization's logo image.
                  </p>
                </div>
                <div>
                  <Label htmlFor="brandColor">Brand Color</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="color"
                      id="brandColor"
                      value={wizardData.brandColor}
                      onChange={(e) =>
                        setWizardData((d) => ({ ...d, brandColor: e.target.value }))
                      }
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <Input
                      value={wizardData.brandColor}
                      onChange={(e) =>
                        setWizardData((d) => ({ ...d, brandColor: e.target.value }))
                      }
                      placeholder="#2563eb"
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Invite Team */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Invite Your Team</h2>
                <p className="text-gray-500 mt-1">
                  Add team members to collaborate on contracts. You can always add more later.
                </p>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                  <div>
                    <Label htmlFor="invName" className="text-xs">Name</Label>
                    <Input
                      id="invName"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Doe"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="invEmail" className="text-xs">Email</Label>
                    <Input
                      id="invEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="invRole" className="text-xs">Role</Label>
                    <select
                      id="invRole"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button size="sm" onClick={handleAddInvite} className="mb-px">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {wizardData.invitedUsers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Invites ({wizardData.invitedUsers.length})
                  </p>
                  {wizardData.invitedUsers.map((u, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="font-medium text-gray-800">{u.name || u.email}</span>
                          {u.name && (
                            <span className="text-gray-400 ml-2">{u.email}</span>
                          )}
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {u.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.status === 'sent' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                        {u.status === 'error' && (
                          <span className="text-xs text-red-500">{u.error}</span>
                        )}
                        {u.status === 'pending' && (
                          <button
                            onClick={() => handleRemoveInvite(idx)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {wizardData.invitedUsers.some((u) => u.status === 'pending') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSendInvites}
                      disabled={inviteUser.isPending}
                    >
                      {inviteUser.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Sending...
                        </>
                      ) : (
                        'Send All Invites'
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Contract Types */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Contract Types</h2>
                <p className="text-gray-500 mt-1">
                  Select the types of contracts your organization works with.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {CONTRACT_TYPES.map((ct) => {
                  const selected = wizardData.contractTypes.includes(ct.value)
                  return (
                    <button
                      key={ct.value}
                      onClick={() => toggleContractType(ct.value)}
                      className={`border rounded-lg p-4 text-left transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${
                            selected ? 'text-blue-700' : 'text-gray-800'
                          }`}
                        >
                          {ct.label}
                        </span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{ct.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Templates */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Templates</h2>
                <p className="text-gray-500 mt-1">
                  Review your available contract templates. You can manage templates in detail later.
                </p>
              </div>
              {templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between border rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <LayoutTemplate className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{t.name || t.title}</p>
                          {t.type && (
                            <p className="text-xs text-gray-400">{t.type}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <LayoutTemplate className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No templates yet. You can create templates later.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Approval Workflow */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Approval Workflow</h2>
                <p className="text-gray-500 mt-1">
                  Set up a simple approval flow for your contracts. A default workflow is already
                  configured -- you can customize it further in Settings.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="approvalSteps">Number of Approval Steps</Label>
                  <select
                    id="approvalSteps"
                    value={wizardData.approvalSteps}
                    onChange={(e) =>
                      setWizardData((d) => ({ ...d, approvalSteps: Number(e.target.value) }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} step{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Approvers</Label>
                  <p className="text-xs text-gray-400 mb-2">
                    Select team members who can approve contracts.
                  </p>
                  {users.length > 0 ? (
                    <div className="space-y-1">
                      {users.map((u: any) => {
                        const selected = wizardData.approvers.includes(u.id)
                        return (
                          <button
                            key={u.id}
                            onClick={() => toggleApprover(u.id)}
                            className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm transition-colors ${
                              selected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span className={selected ? 'text-blue-700 font-medium' : 'text-gray-700'}>
                              {u.name || u.email}
                            </span>
                            {selected && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No team members found. Invite your team first.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Playbook */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Playbook</h2>
                <p className="text-gray-500 mt-1">
                  Playbooks define your negotiation rules and guidelines for each contract type.
                </p>
              </div>
              <div className="border rounded-lg p-6 bg-gray-50 space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Smart Negotiation Playbooks
                </h3>
                <p className="text-sm text-gray-600">
                  Playbooks help your AI assistant understand your preferred terms, fallback
                  positions, and red lines during contract reviews and negotiations. Each contract
                  type can have its own playbook with specific rules.
                </p>
                <p className="text-sm text-gray-500">
                  You can configure playbooks later from the{' '}
                  <span className="font-medium text-blue-600">Playbook</span> section in the main
                  navigation.
                </p>
              </div>
            </div>
          )}

          {/* Step 7: Upload Contract */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Upload a Contract</h2>
                <p className="text-gray-500 mt-1">
                  Optionally upload your first contract to get started right away.
                </p>
              </div>

              {wizardData.uploadedContractId ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Contract uploaded</p>
                    <p className="text-xs text-emerald-600">
                      AI analysis has been queued in the background.
                    </p>
                  </div>
                </div>
              ) : wizardData.uploadedFile ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-700">
                        {wizardData.uploadedFile.name}
                      </span>
                      <span className="text-gray-400">
                        ({(wizardData.uploadedFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setWizardData((d) => ({ ...d, uploadedFile: null }))
                      }
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    This file will be uploaded when you proceed to the next step.
                  </p>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-10 w-10 text-gray-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">
                      {isDragActive ? 'Drop file here' : 'Drag & drop or click to browse'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, DOCX, or TXT -- up to 50 MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 8: Industry Pack */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pick Your Industry (Optional)</h2>
                <p className="text-gray-500 mt-1">
                  We've already installed our universal library — 20 templates, 100+ clauses,
                  and a full 4-tier playbook across 18 categories. Select an industry pack below
                  to layer in vertical-specific extras (or skip to keep the universal library only).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(industryPacksData?.data ?? []).map((pack) => {
                  const isInstalled = wizardData.industryPack === pack.id
                  const isInstalling = installIndustryPack.isPending && installIndustryPack.variables === pack.id
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      disabled={installIndustryPack.isPending}
                      onClick={() => installIndustryPack.mutate(pack.id)}
                      className={`text-left p-4 border rounded-lg transition-colors ${
                        isInstalled
                          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:border-gray-400 bg-white'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-gray-500" />
                          <span className="font-semibold text-gray-900">{pack.label}</span>
                        </div>
                        {isInstalled && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        {isInstalling && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">{pack.description}</p>
                    </button>
                  )
                })}
              </div>

              {wizardData.industryPack && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  Installed <strong>{industryPacksData?.data.find((p) => p.id === wizardData.industryPack)?.label}</strong> pack.
                  Additional clauses and playbook positions are now available.
                </div>
              )}

              <p className="text-xs text-gray-400">
                You can install or change packs anytime from Settings → Industry Packs.
              </p>
            </div>
          )}

          {/* Step 9: Summary */}
          {currentStep === 9 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">You're All Set!</h2>
                <p className="text-gray-500 mt-1">
                  Here's a summary of your setup. You can change any of these in Settings later.
                </p>
              </div>

              <div className="space-y-3">
                <SummaryRow
                  icon={Building2}
                  label="Organization"
                  value={wizardData.orgName || org?.name || '--'}
                />
                <SummaryRow
                  icon={Users}
                  label="Team Invites"
                  value={
                    wizardData.invitedUsers.length > 0
                      ? `${wizardData.invitedUsers.filter((u) => u.status === 'sent').length} sent, ${wizardData.invitedUsers.filter((u) => u.status === 'pending').length} pending`
                      : 'Skipped'
                  }
                />
                <SummaryRow
                  icon={FileText}
                  label="Contract Types"
                  value={
                    wizardData.contractTypes.length > 0
                      ? wizardData.contractTypes.join(', ')
                      : 'None selected'
                  }
                />
                <SummaryRow
                  icon={GitBranch}
                  label="Approval Steps"
                  value={`${wizardData.approvalSteps} step${wizardData.approvalSteps > 1 ? 's' : ''}`}
                />
                <SummaryRow
                  icon={Briefcase}
                  label="Industry Pack"
                  value={
                    wizardData.industryPack
                      ? industryPacksData?.data.find((p) => p.id === wizardData.industryPack)?.label || 'Installed'
                      : 'Universal library only'
                  }
                />
                <SummaryRow
                  icon={Upload}
                  label="Contract Upload"
                  value={wizardData.uploadedContractId ? 'Uploaded' : 'Skipped'}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t bg-gray-50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button variant="ghost" onClick={handleBack} disabled={isSaving}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStep > 0 && !isLastStep && (
              <Button
                variant="ghost"
                onClick={() => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))}
                disabled={isSaving}
              >
                Skip
              </Button>
            )}
            {isLastStep ? (
              <Button onClick={handleComplete} disabled={isSaving}>
                {completeOnboarding.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Completing...
                  </>
                ) : (
                  <>
                    Go to Dashboard
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : currentStep === 0 ? (
                  <>
                    Let's Get Started
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 border rounded-lg px-4 py-3">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <span className="text-sm font-medium text-gray-600 w-36">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}
