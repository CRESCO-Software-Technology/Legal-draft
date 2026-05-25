import type { CompareData } from './types'

export const ironclad: CompareData = {
  slug: 'ironclad',
  competitorName: 'Ironclad',
  competitorOneLiner:
    'Enterprise CLM with strong workflow builder, broad lifecycle coverage, and an AI assistant called Jurist. Closed-source, sales-led, six-figure floor for most teams.',
  tldr:
    'Draft Legal is an open-source, agent-first CLM you can self-host or use as managed cloud. Ironclad is a closed-source enterprise CLM with a Gartner-Leader workflow engine and a paid AI assistant. Pick Draft Legal if you want transparency, faster time-to-value, and no procurement-heavy contract. Pick Ironclad if you have a 50+ person legal ops team and a budget that already cleared finance.',
  pickDraftLegalIf: [
    'You want to read every line of code before adopting',
    'Your security team needs self-host or single-tenant cloud',
    'You\'d rather avoid a 4-6 month implementation project',
    'You don\'t want to negotiate a contract to evaluate the product',
  ],
  pickCompetitorIf: [
    'You\'re already deep in Salesforce CPQ + workflow tooling and need exact parity',
    'Your team specifically needs Gartner-validated reference customers for procurement',
  ],
  migration:
    'Ironclad exports contract metadata as JSON / CSV and PDFs as ZIP. Draft Legal\'s bulk import maps your record fields to our universal + type-specific schemas, and our team helps reconstruct your templates and approval rules. Most teams migrate in 2-3 weeks; we have not seen anyone exceed 6 weeks.',
  groups: [
    {
      title: 'Openness & deployment',
      rows: [
        { label: 'Open source', draftLegal: 'yes', competitor: 'no', note: 'MIT license' },
        { label: 'Self-host on your infra', draftLegal: 'yes', competitor: 'no' },
        { label: 'Single-tenant cloud', draftLegal: 'yes', competitor: 'partial', note: 'Enterprise tier only' },
        { label: 'Region selection (US/EU/APAC)', draftLegal: 'yes', competitor: 'yes' },
        { label: 'Code transparency', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'Lifecycle coverage',
      rows: [
        { label: 'Contract intake / request', draftLegal: 'yes', competitor: 'yes' },
        { label: 'AI-assisted drafting from playbook', draftLegal: 'yes', competitor: 'yes' },
        { label: 'Counterparty redline detection', draftLegal: 'yes', competitor: 'yes' },
        { label: 'Approval workflows (sequential / parallel)', draftLegal: 'yes', competitor: 'yes' },
        { label: 'eSignature (built-in)', draftLegal: 'yes', competitor: 'partial', note: 'Ironclad partners with DocuSign' },
        { label: 'Obligation / renewal tracking', draftLegal: 'yes', competitor: 'yes' },
      ],
    },
    {
      title: 'AI capabilities',
      rows: [
        { label: 'Specialized agents per stage', draftLegal: 'yes', competitor: 'partial', note: 'Jurist is one assistant' },
        { label: 'Confidence scores + citations on every extraction', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Bring your own AI keys', draftLegal: 'yes', competitor: 'no' },
        { label: 'Switchable LLM providers', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'Pricing & onboarding',
      rows: [
        { label: 'Transparent pricing', draftLegal: 'yes', competitor: 'no' },
        { label: 'Free tier (self-host)', draftLegal: 'yes', competitor: 'no' },
        { label: 'Self-serve trial', draftLegal: 'yes', competitor: 'no' },
        { label: 'Time to first contract', draftLegal: 'minutes', competitor: '4-6 months' },
        { label: 'Implementation fee', draftLegal: '$0', competitor: 'unknown', note: 'typically high 5-figure' },
      ],
    },
  ],
}
