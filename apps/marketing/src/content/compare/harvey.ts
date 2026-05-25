import type { CompareData } from './types'

export const harvey: CompareData = {
  slug: 'harvey',
  competitorName: 'Harvey',
  competitorOneLiner:
    'Generative AI assistant for large law firms and corporate legal departments. Strong at legal research and complex matter work. Enterprise pricing, opaque, designed for Big Law and Fortune 500 in-house teams.',
  tldr:
    'Draft Legal is an open-source, agent-first CLM that covers the full contract lifecycle — intake to obligations. Harvey is an enterprise generative-AI assistant focused on legal research, drafting, and analysis for large firms. Pick Draft Legal if you need a CLM (workflow, approvals, signature, repository). Pick Harvey if you primarily need a research/analysis copilot for a 100+ lawyer firm.',
  pickDraftLegalIf: [
    'You need a CLM, not just a chat-style legal assistant',
    'You want approvals, signatures, and obligation tracking, not just drafting',
    'Your budget is "we want to evaluate this on a card" not "let\'s talk to procurement"',
    'You want to know what the AI does — code, prompts, and all',
  ],
  pickCompetitorIf: [
    'You\'re a 100+ lawyer firm needing deep legal-research workflows across statutes and case law',
    'Your work is litigation- or M&A-research-heavy, not contract-operations-heavy',
  ],
  migration:
    'Harvey is primarily a layer on top of your documents — there\'s usually no contract metadata to migrate. Most teams adopt Draft Legal alongside Harvey rather than replacing: Draft Legal owns contract operations, Harvey stays as the research copilot. Many of our customers run both.',
  groups: [
    {
      title: 'Product category',
      rows: [
        { label: 'Full CLM (intake → obligations)', draftLegal: 'yes', competitor: 'no' },
        { label: 'Generative-AI legal copilot', draftLegal: 'partial', competitor: 'yes' },
        { label: 'Contract repository with structured metadata', draftLegal: 'yes', competitor: 'no' },
        { label: 'Legal research (case law / statutes)', draftLegal: 'no', competitor: 'yes' },
      ],
    },
    {
      title: 'Openness & deployment',
      rows: [
        { label: 'Open source', draftLegal: 'yes', competitor: 'no' },
        { label: 'Self-host on your infra', draftLegal: 'yes', competitor: 'no' },
        { label: 'Bring your own AI keys', draftLegal: 'yes', competitor: 'no' },
        { label: 'Single-tenant deployment', draftLegal: 'yes', competitor: 'partial' },
      ],
    },
    {
      title: 'Contract operations',
      rows: [
        { label: 'Approval workflows', draftLegal: 'yes', competitor: 'no' },
        { label: 'eSignature (built-in)', draftLegal: 'yes', competitor: 'no' },
        { label: 'Obligation / renewal tracking', draftLegal: 'yes', competitor: 'no' },
        { label: 'Clause library + playbook enforcement', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Counterparty redline negotiation', draftLegal: 'yes', competitor: 'partial' },
      ],
    },
    {
      title: 'Pricing',
      rows: [
        { label: 'Transparent pricing', draftLegal: 'yes', competitor: 'no' },
        { label: 'Free / self-serve tier', draftLegal: 'yes', competitor: 'no' },
        { label: 'Per-user cost', draftLegal: 'low', competitor: 'high', note: 'Harvey reportedly $200-500+/seat' },
      ],
    },
  ],
}
