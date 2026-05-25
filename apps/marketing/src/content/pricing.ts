export type PricingTier = {
  name: string
  tagline: string
  price: string
  priceNote: string
  cta: { label: string; href: string }
  highlight?: boolean
  features: string[]
}

// Open Source is the only published tier today. Cloud and Enterprise will
// surface here once we have traction and real SLAs to stand behind — not a
// "coming soon" placeholder.
export const tiers: PricingTier[] = [
  {
    name: 'Open Source',
    tagline: 'Self-hosted. Free forever.',
    price: '$0',
    priceNote: 'MIT-licensed, full feature set',
    cta: { label: 'Self-host on GitHub', href: 'https://github.com/AniketTati/draft-legal' },
    highlight: true,
    features: [
      'All 12 agents — same code as our public demo',
      'Unlimited users, unlimited contracts',
      'Run on your infra, in your VPC',
      'Bring your own AI keys (Anthropic, OpenAI, Google)',
      'Postgres + pgvector, Redis, S3-compat storage, ES/OpenSearch — all standard',
      'MIT license — fork it, modify it, ship it',
    ],
  },
]

export const pricingFaqs = [
  {
    q: 'Is there a managed cloud option?',
    a: 'Not yet — we publicly run draftLegal at app.draft-legal.com so you can evaluate the product without installing anything, but that demo runs on free-tier infrastructure with deliberate scale and speed limits. It is not intended for production data. Once we have traction we will publish managed-cloud and enterprise tiers with real SLAs. In the meantime, reach out via the Contact page if you need a managed deployment.',
  },
  {
    q: 'Is anything held back from the open-source version?',
    a: 'No. Every agent, every screen, every API endpoint is in the public repo under MIT. Self-host the same code we run.',
  },
  {
    q: 'Can I bring my own AI provider keys?',
    a: 'Yes. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY and draftLegal routes through your account. Switchable per agent / per tier.',
  },
  {
    q: 'What does the public demo at app.draft-legal.com cost?',
    a: 'Nothing — try it free. It runs on free-tier infrastructure (scale-to-zero compute, sandbox search, free Postgres) so the first request after idle is slow and large jobs may queue. Production teams should self-host until our managed cloud ships.',
  },
  {
    q: 'How do I deploy it myself?',
    a: 'docker-compose for local dev, Dockerfiles + a deploy script for Cloud Run / Fly / Render / any container host. See README.md and docs/operations in the repo.',
  },
]
