/**
 * Matters routes (P4.1 / docs/30 D.7.1)
 *
 * A Matter groups contracts + requests + agent threads under one
 * negotiation. Surfaces as first-class nav unit; answers the
 * procurement-RFP "do you support matters?" question with yes.
 *
 * Endpoints:
 *   GET    /api/v1/matters             — list org's matters (filterable)
 *   GET    /api/v1/matters/:id         — detail + children counts
 *   POST   /api/v1/matters             — create
 *   PATCH  /api/v1/matters/:id         — update (rename, status, owner)
 *   DELETE /api/v1/matters/:id         — soft-delete (children unlinked,
 *                                         matterId → null on contracts /
 *                                         requests / threads)
 *
 * Design reference: Ironclad Matters, Harvey Vault Projects,
 * Legal Files matter-centric model.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const MATTER_STATUSES = ['OPEN', 'CLOSED', 'ARCHIVED'] as const

const CreateMatterSchema = z.object({
  name:             z.string().min(1).max(200),
  description:      z.string().max(5_000).optional(),
  status:           z.enum(MATTER_STATUSES).default('OPEN'),
  counterpartyId:   z.string().optional(),
  counterpartyName: z.string().max(200).optional(),
  tags:             z.array(z.string().max(40)).max(20).default([]),
})

const UpdateMatterSchema = CreateMatterSchema.partial().extend({
  ownerId: z.string().optional(),
})

export async function matterRoutes(app: FastifyInstance) {

  // ── GET /api/v1/matters ────────────────────────────────────────────────
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.user
    const q = z.object({
      status:  z.enum([...MATTER_STATUSES, 'all']).default('all'),
      ownerId: z.string().optional(),
      counterpartyName: z.string().optional(),
      limit:   z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query)

    const where: Record<string, unknown> = { orgId, deletedAt: null }
    if (q.status !== 'all')       where.status = q.status
    if (q.ownerId)                where.ownerId = q.ownerId
    if (q.counterpartyName)       where.counterpartyName = {
      contains: q.counterpartyName, mode: 'insensitive',
    }

    const matters = await prisma.matter.findMany({
      where: where as never,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: q.limit,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        counterparty: { select: { id: true, name: true } },
        _count: {
          select: { contracts: true, requests: true, threads: true },
        },
      },
    })
    return reply.send({
      items: matters.map(m => ({
        id:               m.id,
        name:             m.name,
        description:      m.description,
        status:           m.status,
        counterpartyId:   m.counterpartyId,
        counterpartyName: m.counterpartyName ?? m.counterparty?.name ?? null,
        ownerId:          m.ownerId,
        ownerName:        m.owner?.name ?? null,
        tags:             m.tags,
        contractCount:    m._count.contracts,
        requestCount:     m._count.requests,
        threadCount:      m._count.threads,
        createdAt:        m.createdAt,
        updatedAt:        m.updatedAt,
        closedAt:         m.closedAt,
      })),
      total: matters.length,
    })
  })

  // ── GET /api/v1/matters/:id ────────────────────────────────────────────
  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.user
    const { id } = req.params as { id: string }
    const matter = await prisma.matter.findFirst({
      where: { id, orgId, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        counterparty: { select: { id: true, name: true, website: true } },
        contracts: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true, title: true, type: true, status: true,
            value: true, currency: true, riskScore: true,
            counterpartyName: true, effectiveDate: true, expiryDate: true,
            updatedAt: true,
          },
        },
        requests: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, requestNumber: true, title: true, type: true,
            status: true, priority: true, counterpartyName: true,
            requestedById: true, assignedToId: true, createdAt: true,
          },
        },
        threads: {
          where: { archivedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true, title: true, scopeType: true, scopeId: true,
            userId: true, updatedAt: true,
          },
        },
      },
    })
    if (!matter) return reply.status(404).send({ detail: 'Matter not found' })
    return reply.send(matter)
  })

  // ── POST /api/v1/matters ───────────────────────────────────────────────
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId, sub: userId } = req.user
    let body
    try { body = CreateMatterSchema.parse(req.body) }
    catch (err) {
      return reply.status(400).send({ detail: 'Invalid body', issues: (err as { issues?: unknown }).issues })
    }
    const matter = await prisma.matter.create({
      data: {
        orgId,
        name:             body.name,
        description:      body.description,
        status:           body.status,
        counterpartyId:   body.counterpartyId,
        counterpartyName: body.counterpartyName,
        tags:             body.tags,
        ownerId:          userId,
        createdById:      userId,
      },
    })
    return reply.status(201).send(matter)
  })

  // ── PATCH /api/v1/matters/:id ──────────────────────────────────────────
  app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.user
    const { id } = req.params as { id: string }
    let patch
    try { patch = UpdateMatterSchema.parse(req.body) }
    catch (err) {
      return reply.status(400).send({ detail: 'Invalid body', issues: (err as { issues?: unknown }).issues })
    }
    const existing = await prisma.matter.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) return reply.status(404).send({ detail: 'Matter not found' })

    // If transitioning to CLOSED / ARCHIVED, stamp closedAt.
    const closedAt = (patch.status === 'CLOSED' || patch.status === 'ARCHIVED') && existing.status === 'OPEN'
      ? new Date()
      : undefined

    const updated = await prisma.matter.update({
      where: { id },
      data: {
        ...patch,
        ...(closedAt ? { closedAt } : {}),
      },
    })
    return reply.send(updated)
  })

  // ── DELETE /api/v1/matters/:id ─────────────────────────────────────────
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.user
    const { id } = req.params as { id: string }
    const existing = await prisma.matter.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) return reply.status(404).send({ detail: 'Matter not found' })

    // Soft-delete + unlink children (set matterId back to null so the
    // contracts/requests/threads don't dangle).
    await prisma.$transaction([
      prisma.contract.updateMany({ where: { matterId: id }, data: { matterId: null } }),
      prisma.contractRequest.updateMany({ where: { matterId: id }, data: { matterId: null } }),
      prisma.agentThread.updateMany({ where: { matterId: id }, data: { matterId: null } }),
      prisma.matter.update({ where: { id }, data: { deletedAt: new Date() } }),
    ])
    return reply.status(204).send()
  })

  // ── POST /api/v1/matters/:id/attach — link a contract/request/thread ──
  app.post('/:id/attach', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.user
    const { id } = req.params as { id: string }
    const body = z.object({
      kind: z.enum(['contract', 'request', 'thread']),
      entityId: z.string().min(1),
    }).safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ detail: 'Invalid body', issues: body.error.issues })
    }
    const matter = await prisma.matter.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    })
    if (!matter) return reply.status(404).send({ detail: 'Matter not found' })

    if (body.data.kind === 'contract') {
      await prisma.contract.update({
        where: { id: body.data.entityId },
        data:  { matterId: id },
      })
    } else if (body.data.kind === 'request') {
      await prisma.contractRequest.update({
        where: { id: body.data.entityId },
        data:  { matterId: id },
      })
    } else {
      await prisma.agentThread.update({
        where: { id: body.data.entityId },
        data:  { matterId: id },
      })
    }
    return reply.send({ ok: true, matterId: id, kind: body.data.kind, entityId: body.data.entityId })
  })
}
