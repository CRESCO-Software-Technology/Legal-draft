/**
 * StatusPill — the inline status indicator that replaces the horizontal
 * StatusStepper row on the contract detail page (B.1.5a).
 *
 * Renders as: [● <status>] plus a caret, sitting on the header line.
 * Clicking opens a popover with a vertical timeline of all lifecycle states.
 *
 * Per docs/25-CONTRACT-FLOW-FIX-PLAN.md §F5, the horizontal stepper was
 * borrowed from wizard/checkout UX and wrong for a document detail page.
 * Gold-standard CLM / document apps (Linear, Notion, Stripe, Ironclad,
 * Juro, Harvey) all use an inline pill with an on-demand history, not a
 * permanent step track.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Happy-path lifecycle — kept parallel to StatusStepper's STEPS so the
// popover shows the same sequence.
const STEPS: Array<{ key: string; label: string; groupWith?: string[] }> = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_REVIEW', label: 'In Review', groupWith: ['UNDER_NEGOTIATION'] },
  { key: 'PENDING_APPROVAL', label: 'Approval' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PENDING_SIGNATURE', label: 'Signing' },
  { key: 'EXECUTED', label: 'Executed' },
]

const OFF_PATH: Record<string, { label: string; tone: 'red' | 'amber' | 'gray' }> = {
  EXPIRED:    { label: 'Expired',    tone: 'amber' },
  TERMINATED: { label: 'Terminated', tone: 'red' },
  ARCHIVED:   { label: 'Archived',   tone: 'gray' },
  REJECTED:   { label: 'Rejected',   tone: 'red' },
}

// Status → dot color. Kept restrained (3 families) so the pill doesn't
// become a rainbow when everything is colored.
function dotTone(status: string): { dot: string; text: string } {
  if (status in OFF_PATH) {
    const t = OFF_PATH[status].tone
    if (t === 'red')   return { dot: 'bg-red-500',    text: 'text-red-700'    }
    if (t === 'amber') return { dot: 'bg-amber-500',  text: 'text-amber-700'  }
    return { dot: 'bg-gray-400', text: 'text-gray-600' }
  }
  if (status === 'APPROVED' || status === 'EXECUTED') {
    return { dot: 'bg-emerald-500', text: 'text-emerald-700' }
  }
  if (status === 'PENDING_REVIEW' || status === 'UNDER_NEGOTIATION' || status === 'PENDING_APPROVAL' || status === 'PENDING_SIGNATURE') {
    return { dot: 'bg-blue-500', text: 'text-blue-700' }
  }
  // DRAFT and anything else
  return { dot: 'bg-gray-400', text: 'text-gray-700' }
}

function resolveIndex(status: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].key === status) return i
    if (STEPS[i].groupWith?.includes(status)) return i
  }
  return -1
}

function currentLabel(status: string): string {
  const off = OFF_PATH[status]
  if (off) return off.label
  const idx = resolveIndex(status)
  if (idx >= 0) return STEPS[idx].label
  // Fallback: show the raw status with underscores humanized
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b./g, c => c.toUpperCase())
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  // Click-outside to close. Keyboard Escape too.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t)) return
      if (btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const tone = dotTone(status)
  const label = currentLabel(status)
  const currentIdx = resolveIndex(status)
  const isOffPath = status in OFF_PATH

  return (
    <span className={cn('relative inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Contract status: ${label}. Click to see lifecycle.`}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
          'hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          tone.text,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
        <span>{label}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Contract lifecycle"
          className="absolute z-50 left-0 top-full mt-2 w-64 rounded-lg border bg-white p-3 shadow-lg"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Lifecycle</div>

          {isOffPath ? (
            // Off-path: just show the current state and a note.
            <div className="space-y-1">
              <div className={cn('flex items-center gap-2 text-sm font-medium', tone.text)}>
                <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden />
                {label}
              </div>
              <p className="text-xs text-gray-500 pl-4">
                This contract is off the active lifecycle. No further automatic transitions.
              </p>
            </div>
          ) : (
            <ol className="space-y-2.5">
              {STEPS.map((step, i) => {
                const done    = currentIdx > i
                const current = currentIdx === i
                return (
                  <li key={step.key} className="flex items-start gap-2.5">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border',
                          done    && 'bg-blue-600 border-blue-600 text-white',
                          current && 'bg-white border-blue-600 text-blue-600',
                          !done && !current && 'bg-white border-gray-300 text-gray-300',
                        )}
                      >
                        {done ? (
                          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                        ) : (
                          <Circle className={cn('h-1.5 w-1.5', current && 'fill-current')} strokeWidth={0} />
                        )}
                      </div>
                      {i < STEPS.length - 1 && (
                        <span className={cn('w-px flex-1 min-h-[14px] mt-1', done ? 'bg-blue-500/40' : 'bg-gray-200')} aria-hidden />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm leading-4 pt-[1px]',
                      current ? 'text-gray-900 font-medium' : done ? 'text-gray-600' : 'text-gray-400',
                    )}>
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </span>
  )
}
