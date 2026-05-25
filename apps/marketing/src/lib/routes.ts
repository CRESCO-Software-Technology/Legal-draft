export type RouteDef = {
  path: string
  title: string
  description: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

export const learnSlugs = [
  'contract-lifecycle-management',
  'ai-contract-review',
  'ai-contract-drafting',
  'contract-redlining',
  'clause-library',
  'contract-repository',
  'contract-approval-workflow',
  'contract-renewal-tracking',
  'obligation-management',
  'electronic-signature',
  'nda',
  'msa',
  'dpa',
  'baa',
  'sow',
] as const

export const templateSlugs = [
  'nda',
  'msa',
  'dpa',
  'baa',
  'sow',
  'employment-agreement',
  'mta',
] as const

export const industrySlugs = [
  'saas',
  'healthcare',
  'manufacturing',
  'biotech',
  'logistics',
] as const

export const allRoutes: RouteDef[] = [
  { path: '/', title: 'Open-source, agent-first CLM', description: 'Open-source contract lifecycle management with 12 AI agents. Self-host the full platform under MIT.', priority: 1.0 },
  { path: '/product', title: 'Product', description: 'Tour the full lifecycle: intake, drafting, negotiation, approval, signature, obligations.', priority: 0.9 },
  { path: '/security', title: 'Security', description: 'Self-host story, RBAC, audit log, encryption, AI safety, compliance roadmap.', priority: 0.9 },
  { path: '/pricing', title: 'Pricing', description: 'Free, MIT-licensed, self-hosted. Managed cloud later, when we have traction and real SLAs.', priority: 0.9 },
  { path: '/open-source', title: 'Open Source', description: 'MIT-licensed CLM you can read, audit, and run anywhere. Three-step self-host quickstart.', priority: 0.9 },
  { path: '/contact', title: 'Contact', description: 'Talk to the draftLegal team about your contract operations.', priority: 0.5 },
  ...industrySlugs.map((slug) => ({
    path: `/industries/${slug}`,
    title: `CLM for ${slug}`,
    description: `Contract lifecycle management built for ${slug} legal, ops, and procurement teams.`,
    priority: 0.7,
  })),
  { path: '/learn', title: 'Learn', description: 'CLM glossary and explainers — agent-first contract lifecycle management concepts.', priority: 0.7 },
  ...learnSlugs.map((slug) => ({
    path: `/learn/${slug}`,
    title: slug,
    description: `Plain-English guide to ${slug.replace(/-/g, ' ')} for legal, ops, and procurement teams.`,
    priority: 0.6,
  })),
  { path: '/templates', title: 'Free Contract Templates', description: 'Lawyer-reviewed NDA, MSA, DPA, BAA, SOW templates. Free download — or generate one with Draft Legal.', priority: 0.7 },
  ...templateSlugs.map((slug) => ({
    path: `/templates/${slug}`,
    title: `Free ${slug.toUpperCase()} Template`,
    description: `Free, lawyer-reviewed ${slug.toUpperCase()} template with key clauses explained. Download or generate one.`,
    priority: 0.6,
  })),
]

export const includedRoutes = () => allRoutes.map((r) => r.path)
