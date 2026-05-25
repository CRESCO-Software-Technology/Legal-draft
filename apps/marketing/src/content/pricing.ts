export type PricingTier = {
  name: string
  tagline: string
  price: string
  priceNote: string
  cta: { label: string; href: string }
  highlight?: boolean
  features: string[]
}

export const tiers: PricingTier[] = [
  {
    name: 'Open Source',
    tagline: 'Self-hosted. Free forever.',
    price: '$0',
    priceNote: 'MIT-licensed, full feature set',
    cta: { label: 'Self-host on GitHub', href: 'https://github.com/draft-legal/draft-legal' },
    features: [
      'All 12 agents — same code as Cloud',
      'Unlimited users, unlimited contracts',
      'Run on your infra, in your VPC',
      'Bring your own AI keys (Anthropic, OpenAI, Google)',
      'Community support via GitHub Discussions',
      'MIT license — fork it, modify it, ship it',
    ],
  },
  {
    name: 'Cloud Starter',
    tagline: 'Managed by us. For small teams.',
    price: 'Coming soon',
    priceNote: 'Join the waitlist — early-access pricing locked in',
    cta: { label: 'Join waitlist', href: '/contact?source=cloud_starter' },
    features: [
      'Everything in Open Source',
      'We handle infra, upgrades, backups',
      'Up to 10 users',
      'Email support',
      'Anthropic-backed AI pool included',
      '99.5% uptime',
    ],
  },
  {
    name: 'Cloud Team',
    tagline: 'For growing legal teams.',
    price: 'Coming soon',
    priceNote: 'Per-user, billed annually',
    cta: { label: 'Talk to sales', href: '/contact?source=cloud_team' },
    highlight: true,
    features: [
      'Everything in Cloud Starter',
      'Unlimited users, generous storage',
      'SAML / SSO',
      'Audit log retention (7 years)',
      'Priority support, dedicated Slack channel',
      '99.9% uptime SLA',
    ],
  },
  {
    name: 'Enterprise',
    tagline: 'Single-tenant or on-prem-assisted.',
    price: 'Custom',
    priceNote: 'Annual contract',
    cta: { label: 'Talk to sales', href: '/contact?source=enterprise' },
    features: [
      'Single-tenant infrastructure',
      'Custom data residency (EU, US, APAC)',
      'Dedicated CSM + onboarding',
      'Security review & DPA',
      'SOC 2 Type II reports (target)',
      'Migration assistance from Ironclad / Spellbook',
    ],
  },
]

export const pricingFaqs = [
  {
    q: 'Why pay for Cloud when the Open Source version is free?',
    a: 'Same reason teams pay for GitLab Cloud or Mattermost Cloud — running production infra is real work. Cloud gets you SLA, automatic upgrades, security patches, backups, on-call support, and zero DevOps overhead. The product itself is identical.',
  },
  {
    q: 'Is anything held back from the open-source version?',
    a: 'No feature gating. The full agent stack, full UI, full API are open source. Cloud earns its price on operational excellence — not on crippled OSS.',
  },
  {
    q: 'Can I bring my own AI provider keys?',
    a: 'Yes, on every tier. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY and Draft Legal routes through your account. Cloud also offers a pooled default if you don\'t want to manage keys.',
  },
  {
    q: 'Do you help us migrate from another CLM?',
    a: 'Yes — bulk legacy import is in the product, and Cloud Team / Enterprise plans include hands-on migration: template mapping, playbook setup, approval rules, and historical contract import.',
  },
]
