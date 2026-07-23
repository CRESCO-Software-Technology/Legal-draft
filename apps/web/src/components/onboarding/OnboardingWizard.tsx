/**
 * OnboardingWizard — first-login flow.
 *
 * Replaces the previous 10-step wizard. The job-to-be-done is "get me to one
 * moment of value as fast as possible, then defer everything else". So we
 * do exactly two screens:
 *
 *   1. Pick your industry  → installs the industry pack which auto-seeds
 *                            contract types, templates, clauses, playbook
 *                            positions in one call.
 *   2. First contract      → upload your own or try a sample; either path
 *                            lands you on the contract detail page mid-AI-
 *                            analysis (the actual "aha" moment). Or skip and
 *                            explore.
 *
 * After screen 2 we mark `org.settings.onboardingCompleted = true` and unmount.
 * Everything else (invite team, configure approvals, customise playbook,
 * brand colour, logo) moves to the WelcomeChecklist on the dashboard so the
 * user is never blocked from using the product.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/common/Toaster'
import {
  Briefcase,
  HeartPulse,
  Factory,
  FlaskConical,
  Truck,
  CircleHelp,
  Upload as UploadIcon,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

type IndustryPackId = 'saas' | 'healthcare' | 'manufacturing' | 'biotech' | 'logistics' | null

const INDUSTRY_OPTIONS: Array<{
  id: Exclude<IndustryPackId, null>
  label: string
  blurb: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'saas',          label: 'SaaS',          blurb: 'MSAs, DPAs, SLAs, customer + vendor agreements.',        icon: Briefcase    },
  { id: 'healthcare',    label: 'Healthcare',    blurb: 'BAAs, clinical trial agreements, vendor contracts.',     icon: HeartPulse   },
  { id: 'manufacturing', label: 'Manufacturing', blurb: 'Supplier agreements, purchase orders, distribution.',    icon: Factory      },
  { id: 'biotech',       label: 'Biotech',       blurb: 'CDAs, MTAs, research collaborations, licensing.',        icon: FlaskConical },
  { id: 'logistics',     label: 'Logistics',     blurb: 'Carrier agreements, freight terms, 3PL contracts.',      icon: Truck        },
]

export function OnboardingWizard() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [picked, setPicked] = useState<IndustryPackId>(null)

  const installIndustryPack = useMutation({
    mutationFn: (packId: Exclude<IndustryPackId, null>) =>
      api.post('/organization/install-industry-pack', { packId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['clauses'] })
    },
  })

  const finish = useMutation({
    mutationFn: () =>
      api.patch('/organization', { settings: { onboardingCompleted: true } }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  })

  async function pickIndustry(id: Exclude<IndustryPackId, null> | 'other') {
    if (id === 'other') {
      setPicked(null)
      setStep(2)
      return
    }
    try {
      await installIndustryPack.mutateAsync(id)
      setPicked(id)
      setStep(2)
    } catch {
      toast.error('Could not install pack', { description: 'Please try again.' })
    }
  }

  async function complete(thenNavigateTo: string | null) {
    await finish.mutateAsync()
    if (thenNavigateTo) navigate(thenNavigateTo)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Top bar: 2-dot step indicator + skip */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Dot active={step === 1} done={step > 1} />
            <span className={step === 1 ? 'font-medium text-foreground' : ''}>Industry</span>
            <span className="mx-1 text-muted-foreground/40">·</span>
            <Dot active={step === 2} done={false} />
            <span className={step === 2 ? 'font-medium text-foreground' : ''}>First contract</span>
          </div>
          <button
            onClick={() => complete(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="onboarding-skip-all"
          >
            Skip setup
          </button>
        </div>

        {step === 1 && (
          <Step1Industry onPick={pickIndustry} loading={installIndustryPack.isPending} />
        )}
        {step === 2 && (
          <Step2FirstContract
            picked={picked}
            onBack={() => setStep(1)}
            onFinish={complete}
          />
        )}
      </div>
    </div>
  )
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1Industry({
  onPick,
  loading,
}: {
  onPick: (id: Exclude<IndustryPackId, null> | 'other') => void
  loading: boolean
}) {
  return (
    <div className="px-6 py-10 sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        What does your team work on?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We&apos;ll preload the right contract types, templates, clauses, and playbook positions — you
        can change anything later.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRY_OPTIONS.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              onClick={() => onPick(opt.id)}
              disabled={loading}
              data-testid={`onboarding-industry-${opt.id}`}
              className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="grid h-9 w-9 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">{opt.label}</span>
              <span className="text-xs leading-5 text-muted-foreground">{opt.blurb}</span>
            </button>
          )
        })}
        <button
          onClick={() => onPick('other')}
          disabled={loading}
          data-testid="onboarding-industry-other"
          className="group flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-background p-4 text-left transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-600">
            <CircleHelp className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">Other / not sure</span>
          <span className="text-xs leading-5 text-muted-foreground">
            Skip the pack — you can install one later from Settings.
          </span>
        </button>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing pack…
        </div>
      )}
    </div>
  )
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2FirstContract({
  picked,
  onBack,
  onFinish,
}: {
  picked: IndustryPackId
  onBack: () => void
  onFinish: (thenNavigateTo: string | null) => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const { data: contracts } = useQuery<{ data: Array<{ id: string; title: string }> }>({
    queryKey: ['contracts', 'first-contract-probe'],
    queryFn: () => api.get('/contracts?limit=1').then(r => r.data),
    staleTime: 30_000,
  })
  const firstContractId = contracts?.data?.[0]?.id ?? null

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('title', file.name.replace(/\.[^.]+$/, ''))
      form.append('type', 'OTHER')
      const { data } = await api.post('/contracts/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data as { id: string }
    },
  })

  const onDrop = async (files: File[]) => {
    if (!files[0]) return
    setUploading(true)
    try {
      const c = await uploadMut.mutateAsync(files[0])
      await onFinish(`/contracts/${c.id}`)
    } catch {
      toast.error('Upload failed', { description: 'Try again or pick the sample.' })
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      // No legacy .doc — the extraction pipeline can't read OLE, so the server
      // rejects it. Don't let onboarding offer a format that always fails.
      'text/plain': ['.txt'],
    },
  })

  async function useSample() {
    setSeeding(true)
    try {
      if (firstContractId) await onFinish(`/contracts/${firstContractId}`)
      else await onFinish('/contracts')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="px-6 py-10 sm:px-10">
      {picked && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {picked} pack installed
        </span>
      )}
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        See what an agent does with a real contract.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Drop a PDF or DOCX — our agents parse, classify, extract key terms, score risk, and index
        it for search. Takes about 30 seconds.
      </p>

      <div
        {...getRootProps()}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragActive
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-border bg-background hover:border-emerald-300 hover:bg-emerald-50/40'
        }`}
        data-testid="onboarding-dropzone"
      >
        <input {...getInputProps()} />
        <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadIcon className="h-5 w-5" />}
        </span>
        <div className="mt-3 text-sm font-medium text-foreground">
          {uploading ? 'Uploading…' : 'Drop a contract here, or click to browse'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">PDF, DOCX, or TXT</div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={uploading || seeding}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {firstContractId && (
            <Button
              variant="outline"
              onClick={useSample}
              disabled={uploading || seeding}
              data-testid="onboarding-try-sample"
            >
              {seeding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              Try a sample contract
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onFinish(null)}
            disabled={uploading || seeding}
            data-testid="onboarding-skip-to-dashboard"
          >
            Skip — explore first <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── tiny atoms ──────────────────────────────────────────────────────────────

function Dot({ active, done }: { active: boolean; done: boolean }) {
  if (done) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? 'bg-emerald-600' : 'bg-muted-foreground/30'
      }`}
    />
  )
}
