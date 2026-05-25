import { lifecycle } from '@/content/lifecycle'
import { ChevronRight } from 'lucide-react'

export function LifecycleScroller() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            The full lifecycle
          </div>
          <h2 className="mt-3 heading-section text-slate-900">
            One platform, six stages, every contract.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
            Replace Ironclad <span className="text-slate-400">+</span> Harvey{' '}
            <span className="text-slate-400">+</span> Spellbook{' '}
            <span className="text-slate-400">+</span> DocuSign with one open codebase.
          </p>
        </div>

        <ol className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lifecycle.map((stage) => (
            <li
              key={stage.slug}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 font-mono text-sm font-bold text-emerald-700">
                  {stage.step}
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  {stage.name}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{stage.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {stage.details.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {stage.agent}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
