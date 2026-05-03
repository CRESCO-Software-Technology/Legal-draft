/**
 * CitationPills (P3.1 / docs/30 D.5.8)
 *
 * Inline UI for a `contract_cite` tool result. Renders each citation
 * as a clickable pill: "§9.2 · p.2 · 'capped at 12 months of fees'".
 * Clicking routes to the contract page with ?section=9.2, which the
 * detail page reads to scroll + highlight the matching TOC entry.
 *
 * Design reference:
 *   - Hebbia inline citations — click → PDF highlight
 *   - Claude.ai citations — hover shows quote, click jumps to source
 *   - Harvey citation badges — per-claim backing
 */
import { useState } from 'react'
import { Quote, ExternalLink } from 'lucide-react'

export interface Citation {
  quote:        string
  page:         number | null
  bbox:         number[] | null
  sectionRef:   string | null
  sectionTitle: string
  score:        number
  exact:        boolean
}

export interface CitationBundle {
  contractId:   string
  title:        string
  query?:       string
  citations:    Citation[]
  warning?:     string
}

export function CitationPills({ bundle }: { bundle: CitationBundle }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  if (!bundle.citations || bundle.citations.length === 0) {
    return (
      <div
        data-testid="citation-pills-empty"
        className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5"
      >
        {bundle.warning ?? 'No matching passages found in this contract.'}
      </div>
    )
  }

  return (
    <div
      data-testid="citation-pills"
      data-contract-id={bundle.contractId}
      className="rounded-xl border border-blue-200 bg-blue-50/60 text-[12px] overflow-hidden"
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-blue-200/70">
        <Quote className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
        <span className="font-semibold text-blue-900 text-[11.5px]">
          Citations
        </span>
        <span className="font-mono text-[10.5px] text-blue-700 truncate">
          · {bundle.title}
        </span>
        <span className="ml-auto text-[10px] text-blue-500 tabular-nums">
          {bundle.citations.length}
        </span>
      </div>

      <ul className="divide-y divide-blue-100">
        {bundle.citations.map((c, i) => {
          const targetPath = `/contracts/${bundle.contractId}` + (
            c.sectionRef ? `?section=${encodeURIComponent(c.sectionRef)}` : ''
          )
          const isExpanded = expandedIdx === i
          return (
            <li
              key={i}
              data-testid={`citation-${i}`}
              data-ref={c.sectionRef || undefined}
              data-page={c.page ?? undefined}
              data-exact={c.exact ? '1' : '0'}
              className="px-3 py-1.5 hover:bg-blue-100/40 transition-colors"
            >
              <div className="flex items-start gap-2">
                <a
                  href={targetPath}
                  target="_self"
                  data-testid={`citation-link-${i}`}
                  className="flex items-baseline gap-1.5 min-w-0 flex-1 group"
                  title={`Open contract at ${c.sectionRef ? `§${c.sectionRef}` : c.sectionTitle}`}
                >
                  {c.sectionRef && (
                    <span className="font-mono text-[10.5px] text-blue-700 flex-shrink-0">
                      §{c.sectionRef}
                    </span>
                  )}
                  <span className="truncate text-[11.5px] text-gray-900 group-hover:text-blue-800">
                    {c.sectionTitle || c.quote.slice(0, 60)}
                  </span>
                  {c.page != null && (
                    <span className="font-mono text-[9.5px] text-blue-500 flex-shrink-0 tabular-nums">
                      p.{c.page}
                    </span>
                  )}
                  {c.exact && (
                    <span
                      className="text-[9px] uppercase tracking-wider font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 flex-shrink-0"
                      title="Exact substring match of the query"
                    >
                      exact
                    </span>
                  )}
                  <ExternalLink className="h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  data-testid={`citation-toggle-${i}`}
                  className="text-[10px] text-blue-600 hover:underline flex-shrink-0"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? 'hide' : 'quote'}
                </button>
              </div>
              {isExpanded && (
                <div
                  data-testid={`citation-quote-${i}`}
                  className="mt-1 text-[11px] text-gray-700 bg-white/70 border border-blue-100 rounded px-2 py-1 italic"
                >
                  “{c.quote}”
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
