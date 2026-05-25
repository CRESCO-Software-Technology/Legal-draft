import type { CompareData } from './types'

export const docusignClm: CompareData = {
  slug: 'docusign-clm',
  competitorName: 'DocuSign CLM',
  competitorOneLiner:
    'CLM bundled with the DocuSign eSignature platform (formerly SpringCM). Tight DocuSign integration, broad enterprise adoption, but legacy architecture and AI capabilities feel bolted on.',
  tldr:
    'Draft Legal is an open-source, agent-first CLM with a built-in self-hosted signing system. DocuSign CLM is a legacy CLM tightly bundled with DocuSign eSignature, with newer AI features layered on top. Pick Draft Legal if AI-first workflows and openness matter. Pick DocuSign CLM if your org has standardized on DocuSign and the integration depth outweighs other concerns.',
  pickDraftLegalIf: [
    'You want AI-first workflows, not workflows with AI bolted on',
    'You\'d rather not be locked into the DocuSign ecosystem',
    'Self-host or single-tenant cloud is a hard requirement',
    'You want transparent pricing, not a SpringCM-era enterprise contract',
  ],
  pickCompetitorIf: [
    'You\'re already deeply integrated with DocuSign and want a single-vendor procurement story',
    'Your business processes assume DocuSign signing flows that are hard to migrate',
  ],
  migration:
    'DocuSign CLM exports contracts and metadata as ZIP / JSON. Draft Legal\'s import maps SpringCM-era field names automatically. Built-in eSignature means you can drop the DocuSign dependency entirely, or keep DocuSign as a backup signature provider for transition.',
  groups: [
    {
      title: 'Architecture & openness',
      rows: [
        { label: 'Open source', draftLegal: 'yes', competitor: 'no' },
        { label: 'Self-host', draftLegal: 'yes', competitor: 'no' },
        { label: 'Modern cloud-native architecture', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Vendor lock-in risk', draftLegal: 'low', competitor: 'high' },
      ],
    },
    {
      title: 'Signature',
      rows: [
        { label: 'Built-in eSignature', draftLegal: 'yes', competitor: 'yes', note: 'DocuSign' },
        { label: 'Self-hosted signing (no third party)', draftLegal: 'yes', competitor: 'no' },
        { label: 'Bring-your-own signature provider', draftLegal: 'yes', competitor: 'partial' },
      ],
    },
    {
      title: 'AI capabilities',
      rows: [
        { label: 'Agent-first architecture', draftLegal: 'yes', competitor: 'no' },
        { label: 'Specialized agents per stage', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Confidence + citations on extractions', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Bring your own AI keys', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'Implementation',
      rows: [
        { label: 'Time to first contract', draftLegal: 'minutes', competitor: '6-12 months' },
        { label: 'Implementation services required', draftLegal: 'no', competitor: 'yes' },
        { label: 'Self-serve trial', draftLegal: 'yes', competitor: 'no' },
      ],
    },
  ],
}
