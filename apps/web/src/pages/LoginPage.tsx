import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MailCheck } from 'lucide-react'
import { AppLogo } from '@/components/brand/AppLogo'

/**
 * U.6.3 — real "forgot password" round-trip.
 *
 * Until full email-based reset lands (A.6), this dialog notifies every
 * admin in the user's org via the in-app notification system. The user
 * gets one definitive answer ("if an account exists, your admin's been
 * notified") rather than a stub modal that just says "ask your admin".
 */
function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.')
      return
    }
    setErrorMsg('')
    setPending(true)
    try {
      await api.post('/auth/request-password-reset', { email: email.trim() })
      setDone(true)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        setErrorMsg('Please enter a valid email address.')
      } else {
        setErrorMsg('Couldn\'t send the request. Please try again or contact your admin directly.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="forgot-password-dialog"
      >
        {done ? (
          <>
            <div className="flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-foreground">Request sent</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              your administrator has been notified. They&apos;ll send you a new temporary password — usually within a few hours.
            </p>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              Tip: still no email after a day? Reach out to your admin directly. We don&apos;t reveal whether an email is registered, so this prompt looks the same either way.
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={onClose} data-testid="forgot-password-close">
                Back to sign in
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold text-foreground">Reset your password</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Enter your work email and we&apos;ll notify your admin to send a new temporary password.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  data-testid="forgot-password-email"
                  autoFocus
                />
              </div>
              {errorMsg && <p className="text-xs text-destructive" data-testid="forgot-password-error">{errorMsg}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || !email} data-testid="forgot-password-submit">
                  {pending ? (
                    <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</span>
                  ) : (
                    'Notify my admin'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // B.6.20 — restore intended URL (from ?next=…) when present.
      // Only accept same-origin paths; anything else falls back to
      // /dashboard so an attacker can't craft a redirect-to-external
      // phishing link.
      const rawNext = searchParams.get('next')
      const safeNext =
        rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
          ? rawNext
          : '/dashboard'
      navigate(safeNext)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg bg-card shadow-sm">
        <div className="flex flex-col items-center text-center" data-testid="login-brand">
          <AppLogo data-testid="login-logo" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                data-testid="forgot-password-link"
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password"
              data-testid="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" data-testid="login-submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="text-primary underline underline-offset-2 hover:no-underline">
            Create one
          </Link>
        </p>
      </div>

      {forgotOpen && <ForgotPasswordDialog onClose={() => setForgotOpen(false)} />}
    </div>
  )
}
