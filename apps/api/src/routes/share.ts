/**
 * Contract Share Links — Phase 05 (Negotiation)
 * Generate time-limited portal tokens for external reviewers/counterparties.
 * Portal JWT is signed with PORTAL_JWT_SECRET (isolated from user JWT_SECRET).
 */
import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { requirePermission } from '../middleware/permissions.js'
import { createAuditEvent } from '../lib/audit.js'
import { AuditAction } from '@clm/types'
import { resolveSecret } from '../lib/secrets.js'

// Portal tokens are signed with PORTAL_JWT_SECRET, isolated from the user
// JWT_SECRET. Resolved lazily + cached; production fails closed if missing/
// weak (lib/secrets.ts). The old chained `?? JWT_SECRET ?? 'portal-dev-secret'`
// fallback is gone — it both leaked a hardcoded default and broke isolation.
let _portalSecret: string | null = null
function portalSecret(): string {
  if (_portalSecret === null) _portalSecret = resolveSecret('PORTAL_JWT_SECRET')
  return _portalSecret
}
const FRONTEND_URL  = process.env.FRONTEND_URL ?? 'http://localhost:5173'

export interface PortalTokenPayload {
  type: 'portal'
  token: string           // ContractShareLink.token (DB lookup key)
  contractId: string
  orgId: string
  permissions: string[]
}

export function signPortalToken(payload: Omit<PortalTokenPayload, 'type'>, expiresInSeconds: number): string {
  return jwt.sign({ ...payload, type: 'portal' }, portalSecret(), { expiresIn: expiresInSeconds })
}

export function verifyPortalToken(token: string): PortalTokenPayload {
  return jwt.verify(token, portalSecret()) as PortalTokenPayload
}

export async function shareRoutes(app: FastifyInstance) {

  // ── Create a share link ───────────────────────────────────────────────────
  app.post('/:id/share', { preHandler: requirePermission('configure', 'contract') }, async (req, reply) => {
    const { orgId, sub: userId } = req.user
    const { id: contractId } = req.params as { id: string }
    const {
      label,
      permissions = ['read'],
      expiresInHours = 168,  // 7 days default
    } = req.body as { label?: string; permissions?: string[]; expiresInHours?: number }

    const contract = await prisma.contract.findFirst({ where: { id: contractId, orgId, deletedAt: null } })
    if (!contract) return reply.status(404).send({ error: 'Contract not found' })

    // Clamp expiry: 1h min, 720h (30d) max
    const clampedHours = Math.min(Math.max(expiresInHours, 1), 720)
    const expiresAt = new Date(Date.now() + clampedHours * 3600 * 1000)
    const rawToken = crypto.randomBytes(32).toString('hex')

    const shareLink = await prisma.contractShareLink.create({
      data: { orgId, contractId, token: rawToken, label, permissions, expiresAt, createdById: userId },
    })

    const portalJwt = signPortalToken(
      { token: rawToken, contractId, orgId, permissions },
      clampedHours * 3600,
    )

    createAuditEvent({ orgId, userId, action: AuditAction.LINK_SHARED, resourceType: 'contract', resourceId: contractId, metadata: { shareLinkId: shareLink.id, permissions, expiresAt } }).catch(() => {})

    return reply.status(201).send({
      shareLink,
      portalUrl: `${FRONTEND_URL}/portal/${portalJwt}`,
    })
  })


  // ── List active share links for a contract ─────────────────────────────────
  app.get('/:id/share', { preHandler: requirePermission('configure', 'contract') }, async (req, reply) => {
    const { orgId } = req.user
    const { id: contractId } = req.params as { id: string }

    const contract = await prisma.contract.findFirst({ where: { id: contractId, orgId, deletedAt: null } })
    if (!contract) return reply.status(404).send({ error: 'Contract not found' })

    const links = await prisma.contractShareLink.findMany({
      where: { contractId, orgId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ data: links })
  })


  // ── Revoke a share link ───────────────────────────────────────────────────
  app.delete('/:id/share/:linkId', { preHandler: requirePermission('configure', 'contract') }, async (req, reply) => {
    const { orgId, sub: userId } = req.user
    const { id: contractId, linkId } = req.params as { id: string; linkId: string }

    const link = await prisma.contractShareLink.findFirst({ where: { id: linkId, contractId, orgId, revokedAt: null } })
    if (!link) return reply.status(404).send({ error: 'Share link not found' })

    await prisma.contractShareLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } })

    createAuditEvent({ orgId, userId, action: AuditAction.LINK_REVOKED, resourceType: 'contract', resourceId: contractId, metadata: { shareLinkId: linkId } }).catch(() => {})

    return reply.status(204).send()
  })
}
