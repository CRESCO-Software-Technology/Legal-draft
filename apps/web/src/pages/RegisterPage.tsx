/**
 * RegisterPage — B.6.14 adds three enterprise-hygiene affordances:
 *  - Password strength indicator (bar + label, updates live)
 *  - Confirm-password field with inline mismatch warning
 *  - Terms + Privacy checkbox, unchecked by default
 *
 * References: 1Password / Bitwarden (strength meter), GitHub / Stripe
 * (confirm field), Notion / Linear / Vercel (terms checkbox).
 *
 * The strength scoring is intentionally simple — length + character-
 * class variety — so the indicator reads deterministically without
 * shipping a password-dict dependency.
 */
import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

// ─── Password strength (simple, deterministic) ────────────────────────────────

interface Strength {
  score: 0 | 1 | 2 | 3 | 4     // 0 = empty, 1 = weak, 4 = very strong
  label: string
  reasons: string[]            // what the user is missing — for hints
}

function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: '', reasons: [] }

  let points = 0
  const reasons: string[] = []

  if (pw.length >= 8) points += 1
  else reasons.push('at least 8 characters')

  if (pw.length >= 12) points += 1
  else if (pw.length >= 8) reasons.push('12+ characters for stronger')

  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) points += 1
  else reasons.push('mixed upper + lower case')

  if (/\d/.test(pw)) points += 1
  else reasons.push('a number')

  if (/[^A-Za-z0-9]/.test(pw)) points += 1
  else reasons.push('a symbol')

  // Map 0-5 raw points onto the 4-step bar
  const score = Math.min(4, Math.max(1, Math.floor(points * 0.8))) as 1 | 2 | 3 | 4
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return { score, label, reasons }
}

const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
const STRENGTH_TEXT = ['', 'text-red-500', 'text-amber-600', 'text-emerald-600', 'text-emerald-700']

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  const [form, setForm] = useState({
    orgName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = useMemo(() => scorePassword(form.password), [form.password])
  const passwordsMatch =
    form.password.length > 0 &&
    form.confirmPassword.length > 0 &&
    form.password === form.confirmPassword

  const confirmMismatch =
    form.confirmPassword.length > 0 && form.confirmPassword !== form.password

  const canSubmit =
    !!form.orgName.trim() &&
    !!form.name.trim() &&
    !!form.email.trim() &&
    strength.score >= 2 && // ≥ Fair
    passwordsMatch &&
    termsAccepted &&
    !loading

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      await register({
        orgName: form.orgName,
        name: form.name,
        email: form.email,
        password: form.password,
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-10">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg bg-card shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Create account</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your CLM workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orgName">Company name</Label>
            <Input
              id="orgName"
              name="orgName"
              type="text"
              required
              autoComplete="organization"
              value={form.orgName}
              onChange={handleChange}
              placeholder="Acme Corp"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Smith"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="jane@acme.com"
            />
          </div>

          {/* Password + live strength indicator */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-describedby="password-strength"
            />
            {form.password.length > 0 && (
              <div id="password-strength" className="pt-1 space-y-1" data-testid="password-strength">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.score ? STRENGTH_COLORS[strength.score] : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-medium tabular-nums ${STRENGTH_TEXT[strength.score]}`}>
                    {strength.label}
                  </span>
                </div>
                {strength.score < 3 && strength.reasons.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Add: {strength.reasons.slice(0, 3).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              data-testid="confirm-password"
              aria-invalid={confirmMismatch}
              aria-describedby={confirmMismatch ? 'confirm-mismatch' : undefined}
              className={confirmMismatch ? 'border-red-400 focus-visible:ring-red-400' : undefined}
            />
            {confirmMismatch ? (
              <p id="confirm-mismatch" className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                Passwords don&rsquo;t match
              </p>
            ) : passwordsMatch ? (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Passwords match
              </p>
            ) : null}
          </div>

          {/* Terms + privacy */}
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              data-testid="terms-checkbox"
              className="mt-0.5 h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
              required
            />
            <span className="leading-snug">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
