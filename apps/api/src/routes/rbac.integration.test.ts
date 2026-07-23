/**
 * RBAC per role — a permission-scoped role can read but not write; ADMIN can.
 * Permissions resolve from DEFAULT_ROLE_PERMISSIONS: FINANCE = view contract
 * only; ADMIN = everything at org scope.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getApp, closeApp, makeOrg, makeUser, makeContract, auth, cleanupAll, type TestApp } from '../test-support/helpers.js'

let app: TestApp
let org: string, owner: string, contract: string

beforeAll(async () => {
  app = await getApp()
  org = await makeOrg('RBAC Org')
  owner = await makeUser(org)
  contract = await makeContract(org, owner, { title: 'RBAC Contract' })
})

afterAll(async () => {
  await cleanupAll()
  await closeApp()
})

describe('RBAC per role (contracts)', () => {
  it('a view-only role (FINANCE) can read a contract', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/contracts/${contract}`, headers: auth(org, ['FINANCE']),
    })
    expect(res.statusCode).toBe(200)
  })

  it('a view-only role (FINANCE) CANNOT edit a contract (403)', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/contracts/${contract}`,
      headers: auth(org, ['FINANCE']), payload: { title: 'Hacked by finance' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('ADMIN can edit a contract, and the change persists', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/contracts/${contract}`,
      headers: auth(org, ['ADMIN']), payload: { title: 'Edited by admin' },
    })
    expect(res.statusCode).toBe(200)

    const check = await app.inject({
      method: 'GET', url: `/api/v1/contracts/${contract}`, headers: auth(org, ['ADMIN']),
    })
    expect(check.json().title).toBe('Edited by admin')
  })

  it('a role with no permissions at all is denied write', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/contracts/${contract}`,
      headers: auth(org, ['NONEXISTENT_ROLE']), payload: { title: 'nope' },
    })
    expect(res.statusCode).toBe(403)
  })
})
