import { Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { tiers, pricingFaqs } from '@/content/pricing'
import { Faq } from '@/components/sections/Faq'
import { CtaStrip } from '@/components/sections/CtaStrip'
import { SEO } from '@/lib/seo'
import { cn, SITE_URL } from '@/lib/utils'

const offerSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Draft Legal',
  url: `${SITE_URL}/pricing`,
  offers: tiers.map((t) => ({
    '@type': 'Offer',
    name: t.name,
    description: t.tagline,
    price: t.price === '$0' ? '0' : undefined,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  })),
}

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing"
        description="Free open source, managed cloud tiers, and enterprise — same product, your choice. No feature gating in OSS."
        path="/pricing"
        schema={offerSchema}
      />

      <section className="bg-white py-20 md:py-24">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Pricing
            </div>
            <h1 className="mt-3 heading-display text-slate-900">
              Same product, your choice.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Self-host the full platform for free, forever. Or let us run it for you on managed
              cloud — same code, plus operational guarantees.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-4">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={cn(
                  'flex flex-col rounded-2xl border bg-white p-6 transition-shadow',
                  t.highlight
                    ? 'border-emerald-700 shadow-lg ring-1 ring-emerald-700/20'
                    : 'border-slate-200 hover:shadow-md'
                )}
              >
                {t.highlight && (
                  <div className="-mt-3 mb-3 inline-flex w-fit rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Most popular
                  </div>
                )}
                <div className="text-base font-semibold text-slate-900">{t.name}</div>
                <div className="mt-1 text-sm text-slate-600">{t.tagline}</div>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-slate-900">
                    {t.price}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{t.priceNote}</div>

                <Button
                  asChild
                  className="mt-6"
                  variant={t.highlight ? 'default' : 'outline'}
                >
                  <a href={t.cta.href}>
                    {t.cta.label} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </a>
                </Button>

                <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-6 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2 text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  No feature gating in OSS
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Cloud earns its price on operations, not crippled OSS.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Same agents. Same UI. Same API. Cloud just means we run it for you — uptime SLA,
                  automatic upgrades, security patches, backups, support — so your team doesn't
                  have to.
                </p>
              </div>
              <div className="text-sm leading-6 text-slate-700">
                <p className="mb-3 font-semibold text-slate-900">The GitLab / Sentry / Mattermost playbook:</p>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Open core, MIT-licensed, full feature set
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Managed cloud for teams that don't want to run infra
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Enterprise tier for single-tenant + dedicated support
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Migrate freely between self-host and cloud
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Faq items={pricingFaqs} title="Pricing questions" eyebrow="Pricing FAQ" />
      <CtaStrip
        title="Try it for free."
        subtitle="No credit card. Self-host in 3 commands or sign up for the cloud waitlist."
      />
    </>
  )
}
