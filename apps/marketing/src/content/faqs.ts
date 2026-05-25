export type FAQ = { q: string; a: string }

export const homeFaqs: FAQ[] = [
  {
    q: 'Is Draft Legal really free?',
    a: 'Yes. The full product is MIT-licensed and free to self-host forever — no feature gating, no seat caps. Our managed cloud is the paid offering for teams that don\'t want to run their own infra.',
  },
  {
    q: 'Can I self-host on my own servers or VPC?',
    a: 'Yes. Clone the repo, run docker compose up, and you have the full platform on your infrastructure. Your contracts and data never leave your network. We provide the same code we run in our cloud — no commercial-only modules.',
  },
  {
    q: 'Where does my data go?',
    a: 'Self-host: your data stays in your VPC. Cloud: data is encrypted at rest (AES-256) and in transit (TLS 1.3), processed in the region you choose, and isolated per tenant. Enterprise plans get single-tenant infrastructure.',
  },
  {
    q: 'Which AI models does Draft Legal use?',
    a: 'Anthropic Claude (default), OpenAI GPT, and Google Gemini are all switchable per agent. Bring your own API keys to control spend and data routing, or use our pooled keys.',
  },
  {
    q: 'Can I migrate from Ironclad or Spellbook?',
    a: 'Yes. We have bulk import for legacy contracts, and our team helps map your existing templates, playbooks, and approval rules in the first 2 weeks. See the comparison pages for what\'s similar and what\'s different.',
  },
  {
    q: 'What contract types are supported?',
    a: 'Out of the box: NDA, MSA, SOW, DPA, BAA, vendor agreement, employment, IP assignment, MTA, license, customer SLA, and more. Add your own contract types with custom fields and playbooks in the admin panel.',
  },
]
