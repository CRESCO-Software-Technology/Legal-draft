import type { CompareData } from './types'

export const icertis: CompareData = {
  slug: 'icertis',
  competitorName: 'Icertis',
  competitorOneLiner:
    'Procurement-led enterprise CLM with deep ERP integrations (SAP, Oracle). Strong with global manufacturers and supplier-heavy organizations. Long implementations, high ACV.',
  tldr:
    'Draft Legal is an open-source, agent-first CLM that scales from small legal teams to enterprise procurement. Icertis is a procurement-focused enterprise CLM with deep SAP/Oracle integration. Pick Draft Legal if you want transparent pricing, fast deployment, and modern AI. Pick Icertis if you\'re a Fortune 500 manufacturer with thousands of supplier contracts and existing SAP investment.',
  pickDraftLegalIf: [
    'You want a CLM that doesn\'t require a 12+ month implementation',
    'Your AI requirements are best served by modern agent architectures, not retrofitted features',
    'Self-host or open-source matters for security or budget reasons',
    'You serve mixed legal + procurement + sales workloads, not procurement only',
  ],
  pickCompetitorIf: [
    'You\'re a Fortune 500 manufacturer with 10k+ supplier contracts and tight SAP integration needs',
    'You have a dedicated procurement IT team and a multi-year transformation budget',
  ],
  migration:
    'Icertis exports are typically managed by their PS team. Draft Legal\'s import handles ICI metadata schemas, and our team helps map approval policies and supplier hierarchies. We\'ve had teams migrate 5,000+ contract portfolios in 4-6 weeks.',
  groups: [
    {
      title: 'Architecture',
      rows: [
        { label: 'Open source', draftLegal: 'yes', competitor: 'no' },
        { label: 'Self-host', draftLegal: 'yes', competitor: 'partial', note: 'private cloud only' },
        { label: 'Multi-tenant SaaS option', draftLegal: 'yes', competitor: 'yes' },
        { label: 'Modern stack (cloud-native)', draftLegal: 'yes', competitor: 'partial' },
      ],
    },
    {
      title: 'AI',
      rows: [
        { label: 'Agent-first architecture', draftLegal: 'yes', competitor: 'no' },
        { label: 'Specialized agents per stage', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Bring your own AI keys', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'Use cases',
      rows: [
        { label: 'Sales contracts (MSA, NDA)', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Procurement / supplier', draftLegal: 'yes', competitor: 'yes' },
        { label: 'SAP / Oracle ERP integration depth', draftLegal: 'partial', competitor: 'yes' },
        { label: 'Mid-market friendly', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'Onboarding',
      rows: [
        { label: 'Time to first contract', draftLegal: 'minutes', competitor: '12+ months' },
        { label: 'Implementation fee', draftLegal: '$0', competitor: '6-figure' },
        { label: 'Self-serve trial', draftLegal: 'yes', competitor: 'no' },
      ],
    },
  ],
}
