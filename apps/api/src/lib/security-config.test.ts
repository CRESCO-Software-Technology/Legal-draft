import { afterEach, describe, expect, it } from 'vitest'
import { assertProductionSecrets } from './security-config.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('assertProductionSecrets', () => {
  it('no-ops outside production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(() => assertProductionSecrets()).not.toThrow()
  })

  it('throws when production uses placeholder JWT secrets', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'dev-secret-change-me'
    process.env.PORTAL_JWT_SECRET = 'portal-dev-secret'
    process.env.INTERNAL_SERVICE_SECRET = 'change-me-internal-secret-min-32-chars'
    expect(() => assertProductionSecrets()).toThrow(/Production security misconfiguration/)
    expect(() => assertProductionSecrets()).toThrow(/JWT_SECRET/)
  })

  it('passes when production secrets are set to non-default values', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'prod-jwt-' + 'x'.repeat(48)
    process.env.PORTAL_JWT_SECRET = 'prod-portal-' + 'y'.repeat(48)
    process.env.INTERNAL_SERVICE_SECRET = 'prod-internal-' + 'z'.repeat(48)
    expect(() => assertProductionSecrets()).not.toThrow()
  })
})
