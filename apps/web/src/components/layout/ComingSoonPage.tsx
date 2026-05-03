/**
 * ComingSoonPage — shared layout for stubbed features that are routable
 * but not yet built out.
 *
 * JTBD: "I followed a link to /analytics or /signatures — help me
 * understand what this feature does, when it's coming, and how to get
 * back to the app. Don't strand me."
 *
 * Used by AnalyticsPage + SignaturesPage. B.6.2.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BellPlus, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ComingSoonPageProps {
  icon: LucideIcon
  title: string
  /** One-sentence description of what this feature does. */
  description: string
  /** Bullet list of concrete capabilities. Shown under the description. */
  capabilities?: string[]
  /** Short label like "Launching in v1.1" or "Q2 2026". */
  eta?: string
  /** localStorage key used to remember that the user signed up for notify. */
  notifyKey: string
}

export function ComingSoonPage({
  icon: Icon,
  title,
  description,
  capabilities,
  eta,
  notifyKey,
}: ComingSoonPageProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(notifyKey) !== null
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    // For now, localStorage only. Wire to API in v1.1.
    localStorage.setItem(notifyKey, trimmed)
    setSubmitted(true)
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {eta && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              {eta}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{description}</p>

        {capabilities && capabilities.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            {capabilities.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 rounded-md border border-dashed border-border/70 bg-muted/30 p-4">
          {submitted ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              We&rsquo;ll email you as soon as {title.toLowerCase()} ships.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              <label htmlFor="notify-email" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BellPlus className="h-4 w-4" />
                Notify me when this launches
              </label>
              <div className="flex gap-2">
                <input
                  id="notify-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Button type="submit" size="sm">
                  Notify me
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <span className="text-xs text-muted-foreground">
            Questions? <a href="mailto:support@clmplatform.test" className="text-primary hover:underline">Contact us</a>
          </span>
        </div>
      </div>
    </div>
  )
}
