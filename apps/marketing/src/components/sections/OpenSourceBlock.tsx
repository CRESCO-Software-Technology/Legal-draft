import { Eye, Unlock, Server } from 'lucide-react'
import { Link } from 'react-router-dom'

const pillars = [
  {
    icon: Eye,
    title: 'Inspectable',
    body: 'Every agent prompt, every data flow, every security boundary is on GitHub. Audit before you adopt — no vendor pinky-promises.',
  },
  {
    icon: Unlock,
    title: 'No lock-in',
    body: 'Export your data anytime. Or take the code with you and run it forever. MIT license, no commercial-only modules holding you hostage.',
  },
  {
    icon: Server,
    title: 'Run it your way',
    body: 'Self-host on your infra in 3 commands, or use our managed cloud. Same code either way — cloud earns its keep on operations, not crippled OSS.',
  },
]

export function OpenSourceBlock() {
  return (
    <section className="relative isolate bg-slate-950 py-20 text-white md:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(80%_50%_at_50%_0%,rgba(16,185,129,0.18),transparent_60%)]"
      />
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
            Why open source
          </div>
          <h2 className="mt-3 heading-section text-white">
            The GitLab playbook, for contracts.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
            Same model as GitLab, Mattermost, and Sentry: open core you can read and run, with a
            managed cloud for teams that want operational guarantees instead of running their own
            infra.
          </p>
        </div>
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <li
              key={p.title}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-emerald-700/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-700/15 text-emerald-400">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <Link
            to="/open-source"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            See the self-host quickstart →
          </Link>
        </div>
      </div>
    </section>
  )
}
