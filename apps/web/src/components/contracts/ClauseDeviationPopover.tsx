/**
 * ClauseDeviationPopover — P6.5 / docs/30 Wave G.5
 *
 * Click a margin badge from P6.2's ClauseClassifier → this popover
 * opens anchored at the badge with the full rationale + 3 actions:
 *
 *   • Rewrite to market — opens the P6.3 BubbleAiPopover on this
 *                         paragraph, seeded with the "simplify" action
 *   • Accept            — dismisses; the author explicitly chose this
 *                         language despite the flag
 *   • Dismiss           — closes without action
 *
 * Listens for the global `clause-deviation-click` CustomEvent that
 * the classifier dispatches on badge click.
 *
 * This is the "focused deviation drawer" moment for margin badges —
 * the equivalent of B.5.6's FocusedReviewDrawer for pre-extracted
 * risks, but for LIVE classifier signals during editing.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, Sparkles, CheckCircle2, X } from 'lucide-react'

type Position = 'market' | 'aggressive' | 'weak' | 'off'

interface DeviationDetail {
  position:       Position | string
  category:       string
  reasoning:      string
  keyTerm:        string
  paragraphText:  string
  anchor:         { top: number; left: number }
}

const POS_HEADLINE: Record<string, { label: string; cls: string; tone: string }> = {
  market:     { label: 'In line with market practice',   cls: 'bg-emerald-50 border-emerald-200 text-emerald-900',  tone: 'emerald' },
  aggressive: { label: 'Aggressive — review before send', cls: 'bg-red-50 border-red-200 text-red-900',              tone: 'red' },
  weak:       { label: 'Weaker than market',             cls: 'bg-amber-50 border-amber-200 text-amber-900',        tone: 'amber' },
  off:        { label: 'Off the standard playbook',      cls: 'bg-gray-50 border-gray-300 text-gray-800',           tone: 'gray' },
}

export function ClauseDeviationPopover({
  onAskRewrite,
}: {
  /**
   * Called with the selected paragraph text when the user clicks
   * "Rewrite to market". The parent page wires this to open the
   * existing P6.3 BubbleAiPopover anchored at the paragraph.
   */
  onAskRewrite?: (paragraphText: string) => void
}) {
  const [detail, setDetail] = useState<DeviationDetail | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<DeviationDetail>
      setDetail(ce.detail)
    }
    window.addEventListener('clause-deviation-click', handler)
    return () => window.removeEventListener('clause-deviation-click', handler)
  }, [])

  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null) }
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest('[data-testid="clause-deviation-popover"]') && !el.classList.contains('clause-classifier-badge')) {
        setDetail(null)
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [detail])

  if (!detail) return null
  const meta = POS_HEADLINE[detail.position] ?? POS_HEADLINE.off

  // Nudge the popover back into the viewport if the anchor is near the right edge.
  const width = 380
  const left = Math.max(16, Math.min(detail.anchor.left, window.innerWidth - width - 16))

  return (
    <div
      className="fixed z-[60] rounded-xl border shadow-xl bg-white"
      style={{ top: detail.anchor.top, left, width }}
      data-testid="clause-deviation-popover"
    >
      <div className={`flex items-center gap-1.5 px-3 py-2 border-b ${meta.cls}`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{meta.label}</span>
        <button
          onClick={() => setDetail(null)}
          className="ml-auto p-0.5 rounded hover:bg-black/5"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500">
          <span className="font-mono">{detail.category || 'clause'}</span>
          {detail.keyTerm && (
            <>
              <span>·</span>
              <span className="font-medium text-gray-700 normal-case tracking-normal">
                Key: <span className="font-mono">{detail.keyTerm}</span>
              </span>
            </>
          )}
        </div>

        {detail.reasoning && (
          <p className="text-[12px] text-gray-800 leading-snug" data-testid="clause-deviation-reasoning">
            {detail.reasoning}
          </p>
        )}

        <div className="flex gap-1.5 pt-1">
          {detail.position !== 'market' && (
            <button
              onClick={() => {
                onAskRewrite?.(detail.paragraphText)
                setDetail(null)
              }}
              data-testid="clause-deviation-rewrite"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700"
            >
              <Sparkles className="h-3 w-3" /> Rewrite to market
            </button>
          )}
          <button
            onClick={() => setDetail(null)}
            data-testid="clause-deviation-accept"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <CheckCircle2 className="h-3 w-3" /> Accept as-is
          </button>
          <button
            onClick={() => setDetail(null)}
            data-testid="clause-deviation-dismiss"
            className="text-[11px] px-2 py-1 rounded-md text-gray-500 hover:bg-gray-50 ml-auto"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
