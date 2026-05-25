import type { CompareData } from './types'

export const spellbook: CompareData = {
  slug: 'spellbook',
  competitorName: 'Spellbook',
  competitorOneLiner:
    'Microsoft Word add-in for AI-assisted contract drafting and review. Popular with solo practitioners, small firms, and transactional lawyers. Strong at the drafting moment; not a CLM.',
  tldr:
    'Draft Legal is a full-lifecycle CLM with 12 specialized agents. Spellbook is a Word-native AI assistant focused on drafting and review at the document level. Pick Draft Legal if you need a repository, approvals, signatures, and obligation tracking — not just a smarter Word. Pick Spellbook if your workflow lives entirely inside Word and you don\'t need contract operations or analytics.',
  pickDraftLegalIf: [
    'You need a contract repository and structured search across your portfolio',
    'You need approvals, signatures, and post-signature obligation tracking',
    'Multiple non-lawyer users (sales ops, procurement) touch contracts',
    'You want the AI work to be auditable and citation-backed, not a Word sidebar',
  ],
  pickCompetitorIf: [
    'You\'re a solo lawyer or 2-5 person firm whose work happens entirely in Word',
    'You don\'t need a repository, approvals, or post-signature tracking',
  ],
  migration:
    'Spellbook doesn\'t hold your contracts — it lives in Word. Most teams adopting Draft Legal already have a folder of executed PDFs and DOCX files; bulk import handles that and runs the Review Agent across the portfolio to extract metadata. Drafts continue in your editor of choice.',
  groups: [
    {
      title: 'Product category',
      rows: [
        { label: 'Full CLM (intake → obligations)', draftLegal: 'yes', competitor: 'no' },
        { label: 'Word add-in', draftLegal: 'no', competitor: 'yes', note: 'we\'re a web app + API' },
        { label: 'Contract repository', draftLegal: 'yes', competitor: 'no' },
        { label: 'Drafting assistance', draftLegal: 'yes', competitor: 'yes' },
      ],
    },
    {
      title: 'Lifecycle coverage',
      rows: [
        { label: 'Intake / request triage', draftLegal: 'yes', competitor: 'no' },
        { label: 'Drafting from playbook', draftLegal: 'yes', competitor: 'yes' },
        { label: 'Review / redline', draftLegal: 'yes', competitor: 'yes' },
        { label: 'Approval workflows', draftLegal: 'yes', competitor: 'no' },
        { label: 'eSignature', draftLegal: 'yes', competitor: 'no' },
        { label: 'Obligation tracking', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'AI capabilities',
      rows: [
        { label: 'Specialized agents per stage', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Citations on extracted facts', draftLegal: 'yes', competitor: 'partial' },
        { label: 'Bring your own AI keys', draftLegal: 'yes', competitor: 'no' },
      ],
    },
    {
      title: 'Openness',
      rows: [
        { label: 'Open source', draftLegal: 'yes', competitor: 'no' },
        { label: 'Self-host', draftLegal: 'yes', competitor: 'no' },
        { label: 'Free tier', draftLegal: 'yes', competitor: 'no', note: 'Spellbook trial only' },
      ],
    },
  ],
}
