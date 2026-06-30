import type { CompareData } from './types'

export const docusignClm: CompareData = {
  slug: 'docusign-clm',
  competitorName: 'DocuSign CLM',
  competitorOneLiner:
    'DocuSign\'s contract lifecycle management product, sold as part of the broader DocuSign Agreement Cloud. Mature workflow engine and tight integration with DocuSign eSignature.',
  tldr:
    'DocuSign CLM is a strong fit for teams already standardised on DocuSign for eSignature who want the rest of the lifecycle on the same vendor. CRESCO Legal is an open-source alternative that bundles eSignature in the core product and lets you self-host the whole platform. Pick whichever matches your existing vendor footprint and openness requirements.',
  pickProductIf: [
    'You want eSignature as a built-in feature of your CLM, not an add-on',
    'You want to self-host the platform under AGPL-3.0 and audit the code',
    'You want to avoid platform lock-in to a single eSignature vendor',
    'You want procurement-aware workflows on the roadmap',
  ],
  pickCompetitorIf: [
    'You are already deeply standardised on DocuSign eSignature and want one vendor for the lifecycle',
    'Your procurement team requires a vendor with established enterprise tenure',
    'You need pre-built integrations into the broader DocuSign Agreement Cloud',
  ],
  migration:
    'DocuSign CLM exports contract metadata and PDFs in standard formats. CRESCO Legal\'s bulk import maps your records into our schemas. If you continue to use DocuSign eSignature for some flows, our signature module can co-exist.',
  groups: [
    {
      title: 'Openness & deployment',
      rows: [
        { label: 'Open source (AGPL-3.0)', product: 'yes', competitor: 'no' },
        { label: 'Self-host on your infra', product: 'yes', competitor: 'no' },
        { label: 'Code transparency (full repo)', product: 'yes', competitor: 'no' },
        { label: 'Free self-host tier', product: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'AI & extensibility',
      rows: [
        { label: 'Bring your own AI provider keys', product: 'yes', competitor: 'unknown' },
        { label: 'Switchable LLM provider per agent', product: 'yes', competitor: 'unknown' },
      ],
    },
    {
      title: 'Lifecycle coverage',
      rows: [
        { label: 'Intake / request', product: 'yes', competitor: 'yes' },
        { label: 'Drafting from playbook + templates', product: 'yes', competitor: 'yes' },
        { label: 'Counterparty redline analysis', product: 'yes', competitor: 'yes' },
        { label: 'Approval workflows', product: 'yes', competitor: 'yes' },
        { label: 'eSignature built into core product', product: 'yes', competitor: 'yes', note: 'DocuSign\'s native eSignature is its strength' },
        { label: 'Obligation / renewal tracking', product: 'yes', competitor: 'yes' },
      ],
    },
  ],
}
