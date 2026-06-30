/**
 * Production startup guard — refuse to boot with known-insecure defaults.
 * Dev/test keep their fallbacks in jwt.ts / share.ts; production must set
 * strong secrets via env.
 */

const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'change-me-to-a-long-random-secret-min-32-chars',
])

const INSECURE_PORTAL_SECRETS = new Set([
  'portal-dev-secret',
  'change-me-portal-secret-min-32-chars',
  ...INSECURE_JWT_SECRETS,
])

const INSECURE_INTERNAL_SECRETS = new Set([
  'change-me-internal-secret-min-32-chars',
])

function isInsecure(value: string | undefined, blocklist: Set<string>): boolean {
  if (!value?.trim()) return true
  return blocklist.has(value.trim())
}

/**
 * Call at API boot. Throws in production when critical secrets are missing
 * or still set to documented placeholder values.
 */
export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return

  const errors: string[] = []

  if (isInsecure(process.env.JWT_SECRET, INSECURE_JWT_SECRETS)) {
    errors.push('JWT_SECRET must be set to a strong random value (not a dev/placeholder default)')
  }
  if (isInsecure(process.env.PORTAL_JWT_SECRET, INSECURE_PORTAL_SECRETS)) {
    errors.push('PORTAL_JWT_SECRET must be set to a strong random value (not a dev/placeholder default)')
  }
  if (isInsecure(process.env.INTERNAL_SERVICE_SECRET, INSECURE_INTERNAL_SECRETS)) {
    errors.push('INTERNAL_SERVICE_SECRET must be set to a strong random value (not a placeholder default)')
  }

  if (errors.length > 0) {
    throw new Error(
      'Production security misconfiguration — refusing to start:\n' +
      errors.map(e => `  • ${e}`).join('\n'),
    )
  }
}
