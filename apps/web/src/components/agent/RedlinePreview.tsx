/**
 * RedlinePreview (P1.6 / docs/30 D.5.4)
 *
 * Inline UI for a `redline_propose` tool result. Renders three variant
 * rewrites (least / moderate / aggressive) as tabs, shows each variant's
 * rationale + per-change before/after diffs, and exposes an
 * "Apply variant" button that fires the `redline_apply` Intent Preview.
 *
 * Design reference:
 *   - Cursor's diff preview with Accept/Reject per hunk
 *   - Ironclad Workflow's multi-variant redline picker (Least/Moderate/
 *     Aggressive tabs)
 *   - GitHub Copilot Chat's "Apply in editor" diff panel
 *
 * Lifecycle:
 *   1. SideAgentRail sees `tool_call_result` with name=redline_propose
 *   2. Stores the parsed JSON alongside the tool-trace chip
 *   3. Renders this component INSTEAD of the generic chip's result block
 *   4. User picks a variant tab → reviews → clicks "Apply variant"
 *   5. We dispatch a `rail-inject-action` CustomEvent with a
 *      redline_apply PendingAction, reusing the ActionPreview surface
 */
import { useState } from 'react'
import { Sparkles, ChevronRight, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PendingAction } from './ActionPreview'

export interface RedlineChange {
  before: string
  after:  string
  reason?: string
}

export interface RedlineVariant {
  aggression:   'least' | 'moderate' | 'aggressive'
  proposedText: string
  rationale:    string
  changes:      RedlineChange[]
}

export interface RedlineProposal {
  contract: { id: string; title: string; type: string }
  clause:   { id: string; clauseType: string; sectionRef: string | null; originalText: string }
  category: { id: string; name: string } | null
  hasPlaybook: boolean
  variants: RedlineVariant[]
  error?:   string
}

const TONE: Record<RedlineVariant['aggression'], { label: string; hint: string; color: string }> = {
  least:      { label: 'Least',      hint: 'Minimal edits; preserves counterparty language', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  moderate:   { label: 'Moderate',   hint: 'Balanced rewrite toward playbook acceptable',    color: 'bg-amber-50 border-amber-200 text-amber-800' },
  aggressive: { label: 'Aggressive', hint: 'Full rewrite to playbook preferred position',    color: 'bg-red-50 border-red-200 text-red-800' },
}

export function RedlinePreview({
  proposal,
  onApplyVariant,
}: {
  proposal: RedlineProposal
  /** Called when user clicks "Apply variant" — caller injects a redline_apply PendingAction. */
  onApplyVariant: (variant: RedlineVariant, action: PendingAction) => void
}) {
  const variants = proposal.variants ?? []
  const [activeIdx, setActiveIdx] = useState(
    Math.max(0, variants.findIndex(v => v.aggression === 'moderate')),
  )
  const active = variants[activeIdx] ?? variants[0]

  if (proposal.error || variants.length === 0) {
    return (
      <div
        data-testid="redline-preview-error"
        className="rounded-lg border border-red-200 bg-red-50 text-red-900 text-[11px] px-2.5 py-1.5 flex items-center gap-1.5"
      >
        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
        <span>Redline generation failed{proposal.error ? `: ${proposal.error}` : ''}</span>
      </div>
    )
  }

  function fireApply(variant: RedlineVariant) {
    const action: PendingAction = {
      id: `redline_apply_${proposal.clause.id}_${variant.aggression}_${Date.now()}`,
      toolName: 'redline_apply',
      summary: `Apply ${variant.aggression} redline to ${proposal.clause.clauseType}${proposal.clause.sectionRef ? ` (${proposal.clause.sectionRef})` : ''}.`,
      args: {
        contractId:   proposal.contract.id,
        clauseId:     proposal.clause.id,
        proposedText: variant.proposedText,
        aggression:   variant.aggression,
        rationale:    variant.rationale,
        changes:      variant.changes,
      },
      target: `${proposal.contract.title} · ${proposal.clause.sectionRef ?? proposal.clause.clauseType}`,
      reversible: true,
      status: 'awaiting_confirmation',
      diff: [
        { field: 'clause content', before: 'original', after: `rewritten (${variant.aggression})` },
      ],
    }
    onApplyVariant(variant, action)
  }

  return (
    <div
      data-testid="redline-preview"
      data-clause-id={proposal.clause.id}
      className="rounded-xl border border-purple-200 bg-purple-50/60 text-[12px] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-purple-200/80">
        <Sparkles className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
        <span className="font-semibold text-purple-900">Redline proposal</span>
        <span className="font-mono text-[10.5px] text-purple-700 truncate">
          {proposal.clause.clauseType}
          {proposal.clause.sectionRef && ` · ${proposal.clause.sectionRef}`}
        </span>
        {!proposal.hasPlaybook && (
          <span className="ml-auto text-[9.5px] uppercase tracking-wider font-medium text-amber-800 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
            No playbook
          </span>
        )}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Redline aggression" className="flex gap-1 px-3 pt-2 pb-1.5">
        {variants.map((v, i) => {
          const active = i === activeIdx
          const tone = TONE[v.aggression]
          return (
            <button
              key={v.aggression}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveIdx(i)}
              data-testid={`redline-preview-tab-${v.aggression}`}
              className={`text-[11px] rounded-md border px-2 py-1 font-medium transition-colors ${
                active ? tone.color + ' ring-2 ring-purple-400/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title={tone.hint}
            >
              {tone.label}
            </button>
          )
        })}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Rationale */}
        <div className="text-[11px] text-gray-800 leading-relaxed">
          <span className="text-[9.5px] font-medium uppercase tracking-wider text-gray-400 block mb-0.5">
            Rationale
          </span>
          {active?.rationale}
        </div>

        {/* Changes */}
        {active?.changes && active.changes.length > 0 && (
          <div className="rounded-md border border-purple-100 bg-white/80 divide-y divide-purple-100">
            <div className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-wider text-gray-500">
              Changes ({active.changes.length})
            </div>
            {active.changes.map((ch, i) => (
              <div
                key={i}
                className="px-2 py-1.5 text-[11px] space-y-0.5"
                data-testid={`redline-change-${i}`}
              >
                <div className="text-[10.5px] font-mono flex items-start gap-1.5">
                  <span className="line-through text-red-700 bg-red-50 px-1 rounded flex-1 break-words">
                    {ch.before || '∅'}
                  </span>
                </div>
                <div className="text-[10.5px] font-mono flex items-start gap-1.5">
                  <span className="text-emerald-700 bg-emerald-50 px-1 rounded flex-1 break-words">
                    {ch.after || '∅'}
                  </span>
                </div>
                {ch.reason && (
                  <div className="text-[10px] text-gray-500 italic">
                    <ChevronRight className="inline h-2.5 w-2.5" /> {ch.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Proposed full text — collapsed by default */}
        <ProposedText text={active?.proposedText ?? ''} />

        {/* Apply button */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-[10.5px] text-gray-500">
            Applying creates ContractVersion (n+1). Reversible via Undo.
          </div>
          <Button
            size="sm"
            onClick={() => active && fireApply(active)}
            data-testid={`redline-preview-apply-${active?.aggression}`}
            className="h-7 gap-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px]"
          >
            <Check className="h-3 w-3" />
            Apply {TONE[active?.aggression ?? 'moderate'].label}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProposedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        data-testid="redline-preview-proposed-toggle"
        className="w-full px-2 py-1 text-left text-[10.5px] font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        Full proposed text ({text.length} chars)
      </button>
      {open && (
        <pre
          data-testid="redline-preview-proposed-text"
          className="px-2 py-1.5 text-[10.5px] font-mono whitespace-pre-wrap break-words border-t border-gray-100 max-h-60 overflow-y-auto text-gray-800"
        >
          {text}
        </pre>
      )}
    </div>
  )
}
