/**
 * Signature routes (P7.6.1).
 *
 * Endpoints:
 *   POST /api/v1/contracts/:id/send-for-signature
 *     Body: { signers: [{name, email, role?, signOrder?}], message?,
 *             signOrder: 'ANY'|'SEQUENTIAL', expiresInDays? }
 *     Creates a SignatureRequest + Signer rows + per-signer tokens.
 *     Sets contract.status = PENDING_SIGNATURE.
 *
 *   GET /api/v1/sign/:token
 *     Public — no auth. Returns the contract + signature request envelope
 *     for the signer at this token. Records a VIEWED event.
 *
 *   POST /api/v1/sign/:token/sign
 *     Public. Body: { signedName }. Records the signature, emits a
 *     SIGNED event, advances the request. When all signers are done,
 *     marks the contract EXECUTED + emits COMPLETED.
 *
 *   POST /api/v1/sign/:token/decline
 *     Public. Body: { reason? }. Marks signer as DECLINED + voids
 *     the request.
 *
 *   GET /api/v1/contracts/:id/signature-requests
 *     Auth. Returns all SignatureRequests for a contract (admin view).
 *
 * No PDF signing yet (X.509 + pdf-lib lands in V1.5). For now the
 * digital trail is: typed name + IP + UA + timestamp, anchored in the
 * audit log + persisted on the Signer row.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { createAuditEvent } from '../lib/audit.js'
import { AuditAction } from '@clm/types'
import { sendSigningEmailForSigner } from '../lib/signing-email.js'
import { generateAndStoreSignedPdf } from '../lib/pdf-signing.js'
import { renderHtmlToPdfAndStore } from '../lib/gotenberg.js'
import { queueSigningReminder } from '../lib/queue.js'
import { extractObligationsForContract, CostCapExceededError } from '../lib/obligation-extract.js'
import { fireWebhook } from '../lib/webhook-events.js'

const SignersSchema = z.object({
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().optional(),
    signOrder: z.number().int().min(1).optional(),
    userId: z.string().optional(),
  })).min(1).max(20),
  message: z.string().max(2000).optional(),
  signOrder: z.enum(['ANY', 'SEQUENTIAL']).default('ANY'),
  expiresInDays: z.number().int().min(1).max(180).default(14),
})

const SignBodySchema = z.object({
  signedName: z.string().min(1).max(200),
  // Wave 2.7 — explicit ESIGN/UETA consent to conduct business electronically.
  // Optional for backward-compat with older clients, but recorded in the
  // signature event so the audit trail shows affirmative consent when present.
  consent: z.boolean().optional(),
})

const DeclineBodySchema = z.object({
  reason: z.string().max(500).optional(),
})

function newToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function signatureRoutes(app: FastifyInstance) {

  // ── POST /contracts/:id/send-for-signature ────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/contracts/:id/send-for-signature',
    { preHandler: requirePermission('sign', 'contract') },
    async (req, reply) => {
      const { id } = req.params
      const { orgId, sub: userId } = req.user
      const body = SignersSchema.parse(req.body)

      const contract = await prisma.contract.findFirst({
        where: { id, orgId, deletedAt: null },
        select: { id: true, currentVersionId: true, status: true, title: true, type: true },
      })
      if (!contract) return reply.status(404).send({ detail: 'Contract not found' })
      if (!contract.currentVersionId) {
        return reply.status(400).send({ detail: 'Contract has no version to sign' })
      }
      if (contract.status === 'EXECUTED') {
        return reply.status(409).send({ detail: 'Contract already executed' })
      }

      const expiresAt = new Date(Date.now() + body.expiresInDays * 86_400_000)

      // Wrap creation so a partial signers insert doesn't leave a half-built request.
      const created = await prisma.$transaction(async (tx) => {
        const sr = await tx.signatureRequest.create({
          data: {
            orgId,
            contractId: id,
            versionId: contract.currentVersionId!,
            status: 'PENDING',
            signOrder: body.signOrder,
            expiresAt,
            message: body.message,
            createdById: userId,
          },
        })
        for (const s of body.signers) {
          await tx.signer.create({
            data: {
              signatureRequestId: sr.id,
              email: s.email,
              name: s.name,
              role: s.role,
              signOrder: s.signOrder ?? 1,
              userId: s.userId,
              token: newToken(),
              status: 'PENDING',
            },
          })
        }
        await tx.signatureEvent.create({
          data: {
            signatureRequestId: sr.id,
            kind: 'SENT',
            metadata: { signerCount: body.signers.length },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          },
        })
        // Move the contract into PENDING_SIGNATURE so the dashboard reflects it.
        await tx.contract.update({
          where: { id },
          data: { status: 'PENDING_SIGNATURE' },
        })
        return sr
      })

      const fresh = await prisma.signatureRequest.findUnique({
        where: { id: created.id },
        include: { signers: true },
      })

      // Send the signing link email to each signer. For SEQUENTIAL flows
      // we only email the first-bucket signer initially — others get
      // notified after their predecessors sign (see /sign/:token/sign
      // completion handler — TODO when reminders + sequential email
      // chain land in step 8).
      if (fresh) {
        const orgRow = await prisma.organization.findUnique({
          where: { id: orgId }, select: { name: true },
        })
        const sender = await prisma.user.findUnique({
          where: { id: userId }, select: { name: true },
        })
        const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:5173'
        const minSignOrder = body.signOrder === 'SEQUENTIAL'
          ? Math.min(...fresh.signers.map(s => s.signOrder))
          : Infinity   // ANY → email everyone
        for (const s of fresh.signers) {
          const shouldEmail = body.signOrder === 'ANY' || s.signOrder === minSignOrder
          if (!shouldEmail) continue
          sendSigningEmailForSigner({
            signer: s,
            baseUrl,
            senderName: sender?.name ?? null,
            orgName: orgRow?.name ?? 'draftLegal',
            contractTitle: contract.title,
            contractType: contract.type,
            message: fresh.message,
            expiresAt: fresh.expiresAt,
          })
        }
      }

      // P10A — fire webhook for signature.sent
      fireWebhook(orgId, 'signature.sent', {
        contractId: id,
        signatureRequestId: created.id,
        signerCount: body.signers.length,
        signOrder: body.signOrder,
        expiresAt: created.expiresAt?.toISOString() ?? null,
      })

      await createAuditEvent({
        orgId, userId,
        action: AuditAction.SIGNATURE_SENT,
        resourceType: 'contract',
        resourceId: id,
        metadata: {
          signatureRequestId: created.id,
          signerCount: body.signers.length,
          signers: body.signers.map(s => ({ name: s.name, email: s.email, role: s.role })),
          signOrder: body.signOrder,
        },
        ipAddress: req.ip,
      })

      // Phase 07 Step 8 — schedule reminder nudges. We fire two:
      //   T-3d before expiry → "first" reminder
      //   T-1d before expiry → "final" reminder
      // The worker rechecks status at fire time, so a request that's
      // already COMPLETED/VOIDED before the reminder fires is a no-op.
      // Both jobs use deterministic ids — re-sending the same request
      // (e.g. user clicks "Resend for signature") would replace them.
      if (created.expiresAt) {
        const now = Date.now()
        const exp = created.expiresAt.getTime()
        const firstDelay = exp - now - 3 * 24 * 60 * 60 * 1000   // T-3d
        const finalDelay = exp - now - 1 * 24 * 60 * 60 * 1000   // T-1d
        if (firstDelay > 60_000) {  // skip if already in the past
          queueSigningReminder({ signatureRequestId: created.id, kind: 'first' }, firstDelay)
            .catch(err => app.log.warn({ err }, 'failed to enqueue first signing reminder'))
        }
        if (finalDelay > 60_000) {
          queueSigningReminder({ signatureRequestId: created.id, kind: 'final' }, finalDelay)
            .catch(err => app.log.warn({ err }, 'failed to enqueue final signing reminder'))
        }
      }

      return reply.status(201).send(fresh)
    },
  )

  // ── GET /signature-requests (org-wide) ─────────────────────────────────
  // Powers the /signatures admin page: list every signature request in the
  // org, with the contract title + signer summary needed to render the table.
  // Filterable by status. Authenticated users see their own org only.
  app.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    '/signature-requests',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { orgId } = req.user
      const limit = Math.min(100, parseInt(req.query.limit ?? '50', 10) || 50)
      const offset = Math.max(0, parseInt(req.query.offset ?? '0', 10) || 0)
      const where: Record<string, unknown> = { orgId }
      if (req.query.status && ['PENDING', 'COMPLETED', 'VOIDED', 'EXPIRED'].includes(req.query.status)) {
        where.status = req.query.status
      }
      const [items, total] = await Promise.all([
        prisma.signatureRequest.findMany({
          where: where as never,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            signers: { select: { id: true, name: true, email: true, role: true, status: true, signedAt: true, signOrder: true } },
          },
        }),
        prisma.signatureRequest.count({ where: where as never }),
      ])
      // Hydrate contract title + type via a single batch query.
      const contractIds = [...new Set(items.map(i => i.contractId))]
      const contracts = contractIds.length === 0 ? [] : await prisma.contract.findMany({
        where: { id: { in: contractIds }, orgId },
        select: { id: true, title: true, type: true, counterpartyName: true },
      })
      const contractById = new Map(contracts.map(c => [c.id, c]))
      const data = items.map(it => ({
        id: it.id,
        status: it.status,
        signOrder: it.signOrder,
        createdAt: it.createdAt,
        completedAt: it.completedAt,
        voidedAt: it.voidedAt,
        expiresAt: it.expiresAt,
        signedCount: it.signers.filter(s => s.status === 'SIGNED').length,
        totalSigners: it.signers.length,
        signers: it.signers,
        contract: contractById.get(it.contractId) ?? null,
      }))
      return reply.send({ data, total, limit, offset })
    },
  )

  // ── GET /contracts/:id/signature-requests ─────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/contracts/:id/signature-requests',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params
      const { orgId } = req.user
      const requests = await prisma.signatureRequest.findMany({
        where: { contractId: id, orgId },
        orderBy: { createdAt: 'desc' },
        include: { signers: true, events: { orderBy: { createdAt: 'desc' }, take: 20 } },
      })
      return reply.send({ data: requests })
    },
  )

  // ── GET /sign/:token (public) ─────────────────────────────────────────
  app.get<{ Params: { token: string } }>(
    '/sign/:token',
    async (req: FastifyRequest, reply) => {
      const { token } = req.params as { token: string }
      const signer = await prisma.signer.findUnique({
        where: { token },
        include: {
          signatureRequest: {
            include: {
              signers: { select: { id: true, name: true, role: true, status: true, signOrder: true } },
            },
          },
        },
      })
      if (!signer) return reply.status(404).send({ detail: 'Invalid signing link' })
      const sr = signer.signatureRequest
      if (sr.status !== 'PENDING') return reply.status(410).send({ detail: 'This signing request is no longer active' })
      if (sr.expiresAt && sr.expiresAt < new Date()) {
        // Lazy-expire the request the first time someone hits a stale link.
        await prisma.signatureRequest.update({
          where: { id: sr.id },
          data: { status: 'EXPIRED' },
        })
        return reply.status(410).send({ detail: 'This signing link has expired' })
      }

      // Record a VIEWED event the first time this signer opens the link.
      const alreadyViewed = await prisma.signatureEvent.findFirst({
        where: { signatureRequestId: sr.id, signerId: signer.id, kind: 'VIEWED' },
      })
      if (!alreadyViewed) {
        await prisma.signatureEvent.create({
          data: {
            signatureRequestId: sr.id,
            signerId: signer.id,
            kind: 'VIEWED',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          },
        })
      }

      // Pull the contract + version htmlContent
      const version = await prisma.contractVersion.findUnique({
        where: { id: sr.versionId },
        select: { id: true, versionNumber: true, htmlContent: true },
      })
      const contract = await prisma.contract.findUnique({
        where: { id: sr.contractId },
        select: {
          id: true, title: true, type: true, status: true, counterpartyName: true,
          org: { select: { name: true, brandColor: true, logoUrl: true } },
        },
      })

      return reply.send({
        signer: {
          id: signer.id,
          name: signer.name,
          email: signer.email,
          role: signer.role,
          status: signer.status,
          signedAt: signer.signedAt,
        },
        signatureRequest: {
          id: sr.id,
          status: sr.status,
          message: sr.message,
          expiresAt: sr.expiresAt,
          signOrder: sr.signOrder,
          totalSigners: sr.signers.length,
          signedCount: sr.signers.filter(s => s.status === 'SIGNED').length,
        },
        contract,
        version,
      })
    },
  )

  // ── POST /sign/:token/sign (public) ───────────────────────────────────
  app.post<{ Params: { token: string } }>(
    '/sign/:token/sign',
    async (req, reply) => {
      const body = SignBodySchema.parse(req.body)
      const { token } = req.params

      const signer = await prisma.signer.findUnique({
        where: { token },
        include: { signatureRequest: { include: { signers: true } } },
      })
      if (!signer) return reply.status(404).send({ detail: 'Invalid signing link' })
      const sr = signer.signatureRequest
      if (sr.status !== 'PENDING') return reply.status(410).send({ detail: 'Signing request is no longer active' })
      if (signer.status === 'SIGNED')  return reply.status(409).send({ detail: 'Already signed' })
      if (signer.status === 'DECLINED') return reply.status(409).send({ detail: 'Already declined' })

      // Sequential gating: a signer can only sign if every earlier
      // signOrder bucket has finished.
      if (sr.signOrder === 'SEQUENTIAL') {
        const earlier = sr.signers.filter(s => s.signOrder < signer.signOrder)
        const allEarlierSigned = earlier.every(s => s.status === 'SIGNED')
        if (!allEarlierSigned) {
          return reply.status(403).send({
            detail: 'Earlier signers have not yet signed. You will be notified when it is your turn.',
          })
        }
      }

      const now = new Date()
      const updated = await prisma.signer.update({
        where: { id: signer.id },
        data: {
          status: 'SIGNED',
          signedAt: now,
          signedName: body.signedName,
          signedIp: req.ip,
          signedUserAgent: req.headers['user-agent'] ?? null,
        },
      })
      await prisma.signatureEvent.create({
        data: {
          signatureRequestId: sr.id,
          signerId: signer.id,
          kind: 'SIGNED',
          metadata: {
            signedName: body.signedName,
            // ESIGN/UETA affirmative consent (Wave 2.7).
            consentGiven: body.consent === true,
            consentText: 'Signer agreed to conduct business and sign electronically.',
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        },
      })

      // Check if everyone has signed → flip request COMPLETED + contract EXECUTED.
      const fresh = await prisma.signatureRequest.findUnique({
        where: { id: sr.id },
        include: { signers: true },
      })
      const allSigned = fresh!.signers.every(s => s.status === 'SIGNED')
      if (allSigned) {
        const completedAt = new Date()
        await prisma.$transaction([
          prisma.signatureRequest.update({
            where: { id: sr.id },
            data: { status: 'COMPLETED', completedAt },
          }),
          prisma.contract.update({
            where: { id: sr.contractId },
            data: { status: 'EXECUTED' },
          }),
          prisma.signatureEvent.create({
            data: {
              signatureRequestId: sr.id,
              kind: 'COMPLETED',
              metadata: { signerCount: fresh!.signers.length },
            },
          }),
        ])
        await createAuditEvent({
          orgId: sr.orgId,
          userId: sr.createdById,
          action: AuditAction.SIGNATURE_COMPLETED,
          resourceType: 'contract',
          resourceId: sr.contractId,
          metadata: { signatureRequestId: sr.id, signerCount: fresh!.signers.length },
        })

        // P10A — fire signature.completed + contract.executed webhooks
        fireWebhook(sr.orgId, 'signature.completed', {
          contractId: sr.contractId,
          signatureRequestId: sr.id,
          signerCount: fresh!.signers.length,
          completedAt: completedAt.toISOString(),
        })
        fireWebhook(sr.orgId, 'contract.executed', {
          contractId: sr.contractId,
          executedAt: completedAt.toISOString(),
        })

        // ── PDF binding (Step 6) ───────────────────────────────────
        // Pull the canonical PDF for the signed version (renderedPdfKey
        // wins per A.5; falls back to the original upload's s3Key).
        // pdf-lib appends a signature certificate page; the result is
        // uploaded under signed/<contractId>/<srId>.pdf and saved as a
        // new ContractVersion (versionNumber++) which becomes the
        // canonical for the contract going forward.
        ;(async () => {
          try {
            const ver = await prisma.contractVersion.findUnique({
              where: { id: sr.versionId },
              select: { id: true, versionNumber: true, s3Key: true, renderedPdfKey: true, plainText: true, htmlContent: true },
            })
            if (!ver) return
            let sourceKey = ver.renderedPdfKey ?? ver.s3Key
            // If neither exists (common for AI-drafted HTML contracts that
            // never went through the editor's render-on-save path), render
            // via Gotenberg now from the HTML so we have something to stamp.
            if (!sourceKey && ver.htmlContent?.trim()) {
              try {
                const { s3Key: rk } = await renderHtmlToPdfAndStore({
                  html: ver.htmlContent,
                  keyPrefix: `${sr.orgId}/contracts/${sr.contractId}/rendered`,
                })
                await prisma.contractVersion.update({
                  where: { id: ver.id },
                  data: { renderedPdfKey: rk, renderedAt: new Date() },
                })
                sourceKey = rk
              } catch (err) {
                app.log.warn({ srId: sr.id, err: (err as Error).message }, 'pdf-signing: failed to render HTML→PDF')
              }
            }
            if (!sourceKey) {
              app.log.warn({ srId: sr.id }, 'pdf-signing: no source PDF for version — skipped certificate generation')
              return
            }
            const cMeta = await prisma.contract.findUnique({
              where: { id: sr.contractId },
              select: { title: true, type: true, org: { select: { name: true } } },
            })
            if (!cMeta) return
            const { signedKey, documentHash } = await generateAndStoreSignedPdf({
              sourceKey,
              signedKeyPrefix: `signed/${sr.contractId}`,
              contractTitle: cMeta.title,
              contractType: cMeta.type,
              orgName: cMeta.org?.name ?? 'draftLegal',
              signatureRequestId: sr.id,
              completedAt,
              signers: fresh!.signers
                .map(s => ({
                  name: s.name, role: s.role, email: s.email,
                  signedName: s.signedName, signedAt: s.signedAt,
                  signedIp: s.signedIp, signOrder: s.signOrder,
                }))
                .sort((a, b) => (a.signOrder - b.signOrder) || ((a.signedAt?.getTime() ?? 0) - (b.signedAt?.getTime() ?? 0))),
            })

            const nSigners = fresh!.signers.length
            const nextVersionNumber = (ver.versionNumber ?? 0) + 1
            const newVersion = await prisma.contractVersion.create({
              data: {
                contractId: sr.contractId,
                versionNumber: nextVersionNumber,
                htmlContent: ver.htmlContent ?? '',
                plainText: ver.plainText ?? '',
                s3Key: signedKey,
                mimeType: 'application/pdf',
                changeNote: `Signed by ${nSigners} signer${nSigners === 1 ? '' : 's'} — sealed with PAdES/X.509 (SHA-256 ${documentHash.slice(0, 12)}…)`,
                // Wave 2.7 — the tamper-evidence hash of the sealed PDF, so the
                // executed document can be independently verified later.
                metadata: {
                  _signature: {
                    sha256: documentHash,
                    algorithm: 'SHA-256',
                    format: 'PAdES/X.509 (adbe.pkcs7.detached)',
                    sealedAt: completedAt.toISOString(),
                    signatureRequestId: sr.id,
                  },
                },
                createdById: sr.createdById,
              },
            })
            // Anchor the seal hash in the tamper-evident audit chain too.
            await createAuditEvent({
              orgId: sr.orgId,
              userId: sr.createdById,
              action: AuditAction.SIGNATURE_COMPLETED,
              resourceType: 'contract',
              resourceId: sr.contractId,
              metadata: { event: 'document_sealed', sha256: documentHash, algorithm: 'SHA-256', signatureRequestId: sr.id },
            }).catch(() => { /* audit best-effort; seal already stored on the version */ })
            await prisma.contract.update({
              where: { id: sr.contractId },
              data: { currentVersionId: newVersion.id },
            })
            app.log.info({ srId: sr.id, signedKey, versionId: newVersion.id }, 'pdf-signing: signed PDF stored')
          } catch (err) {
            // Don't fail the signing call — the legal record exists in
            // the audit trail + Signer rows even without a stamped PDF.
            app.log.warn({ err: (err as Error).message, srId: sr.id }, 'pdf-signing: failed to generate certificate')
          }
        })().catch(() => { /* swallow */ })

        // ── P8 Step 2: auto-extract obligations on signature completion ──
        // Fire-and-forget — the signed contract becomes the system of
        // record for what was promised, and we want a structured list of
        // those promises ready for the obligations rail / list view as
        // soon as the signing flow settles. Failures (cost cap, agents
        // service down, etc.) are logged but never block the sign call.
        ;(async () => {
          try {
            const result = await extractObligationsForContract({
              orgId:      sr.orgId,
              contractId: sr.contractId,
              userId:     'system',
            })
            app.log.info(
              { contractId: sr.contractId, count: result.count, skipped: result.skippedReason ?? null },
              '[obligations] auto-extracted on signature.completed',
            )
          } catch (err) {
            if (err instanceof CostCapExceededError) {
              app.log.info({ contractId: sr.contractId }, '[obligations] auto-extract skipped: daily cost cap reached')
            } else {
              app.log.warn(
                { contractId: sr.contractId, err: (err as Error).message },
                '[obligations] auto-extract failed',
              )
            }
          }
        })().catch(() => { /* swallow */ })
      }

      return reply.send({
        ok: true,
        signedAt: updated.signedAt,
        allSigned,
      })
    },
  )

  // ── POST /sign/:token/decline (public) ────────────────────────────────
  app.post<{ Params: { token: string } }>(
    '/sign/:token/decline',
    async (req, reply) => {
      const body = DeclineBodySchema.parse(req.body)
      const { token } = req.params

      const signer = await prisma.signer.findUnique({
        where: { token },
        include: { signatureRequest: true },
      })
      if (!signer) return reply.status(404).send({ detail: 'Invalid signing link' })
      const sr = signer.signatureRequest
      if (sr.status !== 'PENDING') return reply.status(410).send({ detail: 'Signing request is no longer active' })
      if (signer.status !== 'PENDING') return reply.status(409).send({ detail: 'Signer already responded' })

      await prisma.$transaction([
        prisma.signer.update({
          where: { id: signer.id },
          data: { status: 'DECLINED', declinedAt: new Date(), declinedReason: body.reason },
        }),
        prisma.signatureEvent.create({
          data: {
            signatureRequestId: sr.id,
            signerId: signer.id,
            kind: 'DECLINED',
            metadata: { reason: body.reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          },
        }),
        prisma.signatureRequest.update({
          where: { id: sr.id },
          data: { status: 'VOIDED', voidedAt: new Date(), voidedReason: `${signer.name} declined: ${body.reason ?? '(no reason given)'}` },
        }),
      ])

      await createAuditEvent({
        orgId: sr.orgId,
        userId: sr.createdById,
        action: AuditAction.SIGNATURE_VOIDED,
        resourceType: 'contract',
        resourceId: sr.contractId,
        metadata: { signatureRequestId: sr.id, declinedBy: signer.email, reason: body.reason },
      })

      return reply.send({ ok: true })
    },
  )

  // ── POST /contracts/:id/signature-requests/:srId/remind ───────────────
  // Manual nudge — sender can fire a reminder email at any time. Idempotent
  // by virtue of the worker's status-recheck. No effect on a non-PENDING SR.
  app.post<{ Params: { id: string; srId: string } }>(
    '/contracts/:id/signature-requests/:srId/remind',
    { preHandler: requirePermission('sign', 'contract') },
    async (req, reply) => {
      const { id, srId } = req.params
      const { orgId } = req.user
      const sr = await prisma.signatureRequest.findFirst({
        where: { id: srId, contractId: id, orgId },
        include: { signers: true },
      })
      if (!sr) return reply.status(404).send({ detail: 'Signature request not found' })
      if (sr.status !== 'PENDING') {
        return reply.status(409).send({ detail: `Request is ${sr.status} — cannot send reminder` })
      }
      const pending = sr.signers.filter(s => s.status === 'PENDING')
      if (pending.length === 0) {
        return reply.status(409).send({ detail: 'All signers have already responded' })
      }
      // Mirror the worker's nudge logic so the response count is honest:
      // SEQUENTIAL → only the lowest-signOrder bucket of pending is emailed.
      const nudgeCount = sr.signOrder === 'SEQUENTIAL'
        ? (() => {
            const minOrder = Math.min(...pending.map(s => s.signOrder))
            return pending.filter(s => s.signOrder === minOrder).length
          })()
        : pending.length
      // Fire immediately (delay=0). Worker handles the rest.
      await queueSigningReminder({ signatureRequestId: srId, kind: 'manual' }, 0)
        .catch(err => req.log.warn({ err }, 'failed to enqueue manual reminder'))
      return reply.send({ ok: true, signersNotified: nudgeCount })
    },
  )

  // ── POST /contracts/:id/signature-requests/:srId/void ─────────────────
  app.post<{ Params: { id: string; srId: string } }>(
    '/contracts/:id/signature-requests/:srId/void',
    { preHandler: requirePermission('sign', 'contract') },
    async (req, reply) => {
      const { id, srId } = req.params
      const { orgId, sub: userId } = req.user
      const sr = await prisma.signatureRequest.findFirst({
        where: { id: srId, contractId: id, orgId },
      })
      if (!sr) return reply.status(404).send({ detail: 'Signature request not found' })
      if (sr.status !== 'PENDING') return reply.status(409).send({ detail: 'Already terminated' })

      await prisma.$transaction([
        prisma.signatureRequest.update({
          where: { id: srId },
          data: { status: 'VOIDED', voidedAt: new Date(), voidedReason: 'Voided by sender' },
        }),
        prisma.signatureEvent.create({
          data: { signatureRequestId: srId, kind: 'VOIDED', metadata: { actor: userId } },
        }),
      ])

      await createAuditEvent({
        orgId, userId,
        action: AuditAction.SIGNATURE_VOIDED,
        resourceType: 'contract',
        resourceId: id,
        metadata: { signatureRequestId: srId },
      })

      return reply.send({ ok: true })
    },
  )
}
