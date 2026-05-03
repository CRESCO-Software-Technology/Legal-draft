/**
 * artifact-from-tool — converts agent tool-call results into Artifacts
 * for the right-side pane (U.5.2).
 *
 * The agent today emits tool-call results during a stream. Some of
 * them are structurally rich enough to deserve their own canvas (the
 * five JTBDs from doc 32 §3). We pattern-match on tool name and
 * shape an Artifact accordingly.
 *
 * Returning null = the result is just text; render inline as before.
 */
import type { Artifact, DocArtifact, TableArtifact, CardArtifact } from './ArtifactPane'

interface ToolResult {
  /** Tool slug, e.g. "contract_search", "obligations_list", "approval_list" */
  name: string
  /** The JSON payload the tool returned. Shape varies per tool. */
  result?: unknown
}

let _seq = 0
function nextId(prefix: string): string {
  _seq += 1
  return `${prefix}_${Date.now()}_${_seq}`
}

/**
 * Build a stable content-based key so the artifact pane can dedupe
 * when the same tool fires again with the same payload (or replace
 * the prior result when shape matches but data differs). Without
 * this, every retry / repeat tool-call in a single turn appends a
 * fresh artifact and the right pane fills with near-duplicates.
 */
function stableKey(toolName: string, fingerprint: string): string {
  return `${toolName}::${fingerprint}`
}

export function artifactFromToolResult(call: ToolResult): Artifact | null {
  const r = call.result as Record<string, unknown> | undefined
  if (!r) return null

  // ── Table artifacts ─────────────────────────────────────────────
  if (call.name === 'approval_list') {
    const items = (r.items ?? r.data ?? r) as Array<Record<string, unknown>>
    if (!Array.isArray(items)) return null
    const a: TableArtifact = {
      kind: 'table',
      id: nextId('art'),
      dedupeKey: stableKey(call.name, `count=${items.length}:first=${(items[0] as { contractId?: string })?.contractId ?? ''}`),
      title: 'Pending approvals',
      subtitle: `${items.length} awaiting your decision`,
      columns: [
        { key: 'contractTitle',     label: 'Contract',  align: 'left' },
        { key: 'counterpartyName',  label: 'Counterparty', align: 'left' },
        { key: 'value',             label: 'Value',     align: 'right', format: 'currency' },
        { key: 'submittedAt',       label: 'Submitted', align: 'right', format: 'date' },
      ],
      rows: items,
      rowHref: '/contracts/:contractId',
      actions: [
        { id: 'export', label: 'Export CSV', variant: 'secondary' },
      ],
    }
    return a
  }

  if (call.name === 'obligations_list') {
    const items = (r.items ?? []) as Array<Record<string, unknown>>
    if (!Array.isArray(items) || items.length === 0) return null
    const a: TableArtifact = {
      kind: 'table',
      id: nextId('art'),
      dedupeKey: stableKey(call.name, `count=${items.length}:first=${(items[0] as { id?: string })?.id ?? ''}`),
      title: 'Obligations',
      subtitle: `${items.length} tracked`,
      columns: [
        { key: 'description', label: 'Obligation', align: 'left' },
        { key: 'type',        label: 'Type',       align: 'left' },
        { key: 'dueDate',     label: 'Due',        align: 'right', format: 'date' },
        { key: 'severity',    label: 'Severity',   align: 'left' },
      ],
      rows: items,
      actions: [{ id: 'export', label: 'Export CSV', variant: 'secondary' }],
    }
    return a
  }

  if (call.name === 'contract_search' || call.name === 'portfolio_search') {
    // A10 — portfolio_search returns `hits[]` (with `contractId/contractTitle`),
    // contract_search returns `results[]` (with `id/title`). Normalize both
    // shapes so the artifact mounts in either case. Previously `hits` was
    // missing from the chain so cross-doc-rich threads (I4 RFP diligence)
    // never opened the right pane.
    const rawHits = (r.contracts ?? r.results ?? r.items ?? r.hits ?? []) as Array<Record<string, unknown>>
    if (!Array.isArray(rawHits) || rawHits.length === 0) return null
    const items = rawHits.map(h => ({
      // portfolio_search shape — flatten for the table
      id:               (h.id ?? h.contractId) as string | undefined,
      title:            (h.title ?? h.contractTitle) as string | undefined,
      counterpartyName: h.counterpartyName,
      status:           h.status,
      value:            h.value,
      currency:         h.currency,
      ...h, // keep original fields too (excerpt, sectionRef, score)
    }))
    const a: TableArtifact = {
      kind: 'table',
      id: nextId('art'),
      dedupeKey: stableKey(call.name, `count=${items.length}:first=${items[0]?.id ?? ''}`),
      title: 'Search results',
      subtitle: `${items.length} matching contracts`,
      columns: [
        { key: 'title',            label: 'Contract',     align: 'left' },
        { key: 'counterpartyName', label: 'Counterparty', align: 'left' },
        { key: 'status',           label: 'Status',       align: 'left' },
        { key: 'value',            label: 'Value',        align: 'right', format: 'currency' },
      ],
      rows: items,
      rowHref: '/contracts/:id',
    }
    return a
  }

  if (call.name === 'renewal_advice') {
    // Either a single-contract recommendation (Card) or a portfolio list (Table).
    if (r.contracts && Array.isArray(r.contracts)) {
      const a: TableArtifact = {
        kind: 'table',
        id: nextId('art'),
        dedupeKey: stableKey(call.name, `pipeline:count=${(r.contracts as unknown[]).length}`),
        title: 'Renewal pipeline',
        subtitle: `${(r.contracts as unknown[]).length} contracts up for renewal`,
        columns: [
          { key: 'title',          label: 'Contract',     align: 'left' },
          { key: 'expiryDate',     label: 'Expires',      align: 'right', format: 'date' },
          { key: 'recommendation', label: 'Recommend',    align: 'left' },
          { key: 'confidence',     label: 'Confidence',   align: 'left' },
        ],
        rows: r.contracts as Array<Record<string, unknown>>,
        rowHref: '/contracts/:id',
      }
      return a
    }
    if (r.recommendation || r.advice) {
      const advice = (r.advice ?? r) as Record<string, unknown>
      const a: CardArtifact = {
        kind: 'card',
        id: nextId('art'),
        dedupeKey: stableKey(call.name, `recommendation:${typeof r.contractId === 'string' ? r.contractId : ''}`),
        title: 'Renewal recommendation',
        subtitle: typeof r.contractTitle === 'string' ? r.contractTitle : undefined,
        headline: String(advice.recommendation ?? 'Renew with changes'),
        details: Array.isArray(advice.negotiationPoints) ? (advice.negotiationPoints as string[]) : [],
        actions: [
          { id: 'open',   label: 'Open contract', variant: 'primary',
            href: typeof r.contractId === 'string' ? `/contracts/${r.contractId}` : undefined },
          { id: 'export', label: 'Export memo', variant: 'secondary' },
        ],
      }
      return a
    }
  }

  // ── counterparty_memory → Card artifact ─────────────────────────
  // Surfaces total exposure, deal count, and a deal-list link so the user
  // gets a one-glance summary on the right pane instead of having to read
  // the agent's prose. Closes the gap where every other "show me X" tool
  // produced an artifact except this one.
  if (call.name === 'counterparty_memory') {
    const cpName = typeof r.counterpartyName === 'string' ? r.counterpartyName : 'Counterparty'
    const dealCount = typeof r.dealCount === 'number' ? r.dealCount : (Array.isArray(r.deals) ? r.deals.length : 0)
    const aggregate = (r.aggregate ?? {}) as Record<string, unknown>
    const totalValue = typeof aggregate.totalValue === 'number' ? aggregate.totalValue : 0
    const types = Array.isArray(aggregate.types) ? aggregate.types as string[] : []
    if (dealCount === 0) {
      // Empty Card — keeps the right pane informative even on no-results
      const a: CardArtifact = {
        kind: 'card',
        id: nextId('art'),
        dedupeKey: stableKey(call.name, `empty:${cpName}`),
        title: cpName,
        subtitle: 'No prior deals on file',
        headline: '0 contracts',
        details: ['No matching contracts in the portfolio for this counterparty.'],
        actions: [],
      }
      return a
    }
    const fmtUsd = (n: number) =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` :
      n >= 1_000     ? `$${(n / 1_000).toFixed(0)}K` :
      `$${n}`
    const a: CardArtifact = {
      kind: 'card',
      id: nextId('art'),
      dedupeKey: stableKey(call.name, `${cpName}:deals=${dealCount}`),
      title: cpName,
      subtitle: `${dealCount} deal${dealCount === 1 ? '' : 's'} on file`,
      headline: totalValue > 0 ? `${fmtUsd(totalValue)} total contract value` : `${dealCount} active relationships`,
      details: [
        ...(types.length > 0 ? [`Types: ${types.join(', ')}`] : []),
        ...(typeof aggregate.lastSignedAt === 'string'
              ? [`Last signed: ${new Date(aggregate.lastSignedAt).toISOString().slice(0, 10)}`]
              : []),
        ...(Array.isArray(r.deals) && r.deals.length > 0
              ? [`Recent: ${(r.deals as Array<Record<string, unknown>>).slice(0, 3).map(d => String(d.title ?? '')).filter(Boolean).join(' · ')}`]
              : []),
      ].filter(Boolean) as string[],
      actions: [
        { id: 'open', label: 'View counterparty', variant: 'primary',
          href: typeof r.counterpartyId === 'string' ? `/counterparties/${r.counterpartyId}` : undefined },
      ],
    }
    return a
  }

  // ── Doc artifacts ───────────────────────────────────────────────
  if (call.name === 'contract_create_from_template' || call.name === 'draft_clause') {
    const html = String(r.html ?? r.content ?? '')
    if (!html) return null
    // Hash the first 200 chars of the html so two regenerations with
    // different content produce different dedupeKeys (replacement),
    // but identical regenerations dedupe.
    let h = 0
    for (let i = 0; i < Math.min(html.length, 200); i++) h = ((h << 5) - h + html.charCodeAt(i)) | 0
    const a: DocArtifact = {
      kind: 'doc',
      id: nextId('art'),
      dedupeKey: stableKey(call.name, `${typeof r.contractId === 'string' ? r.contractId : 'no-id'}:${h.toString(36)}`),
      title: typeof r.title === 'string' ? r.title : 'Draft',
      subtitle: typeof r.subtitle === 'string' ? r.subtitle : undefined,
      html,
      actions: [
        { id: 'save', label: 'Save as draft', variant: 'primary', tool: 'save_draft' },
        { id: 'send', label: 'Send for review', variant: 'secondary', tool: 'send_for_review' },
        ...(typeof r.contractId === 'string'
          ? [{ id: 'open', label: 'Open in Contracts', variant: 'secondary' as const, href: `/contracts/${r.contractId}` }]
          : []),
      ],
    }
    return a
  }

  return null
}
