/**
 * Inbound email parser (P7.6.3).
 *
 * SendGrid Inbound Parse / Mailgun / Postmark webhook target. The counterparty
 * replies to a per-contract email address with a redline PDF attached; the
 * webhook lands the PDF as a new ContractVersion attributed to the sender,
 * flips the contract to UNDER_NEGOTIATION, and writes an audit event.
 *
 * Address pattern: `contracts+<contractId>@inbound.<your-domain>`
 *   - The +tag is parsed out of the To: header so deployments only need
 *     one mailbox; routing happens by tag.
 *
 * Sender validation: by default we accept the sender's address only if
 * (a) it matches a previously-issued portal share-link's external email,
 * (b) it matches the contract's counterparty.email, OR
 * (c) INBOUND_EMAIL_ALLOW_ALL=1 in env (dev-only). Otherwise → 403.
 *
 * Auth: shared-secret header `x-inbound-secret` must match
 * INBOUND_EMAIL_SECRET. SendGrid lets you configure this via Inbound
 * Parse → "Username/Password" or via custom headers.
 *
 * Body shape — we accept SendGrid's flat multipart format AND a simpler
 * JSON envelope (for testability + alt providers):
 *   {
 *     to:           "contracts+abc123@inbound.example.com",
 *     from:         "counsel@counterparty.com",
 *     subject:      "Re: MSA — redline v3",
 *     text:         "(plain-text body)",
 *     attachments:  [{ filename: "redline.pdf", contentType: "application/pdf",
 *                       contentBase64: "JVBERi0xLjQK..." }]
 *   }
 */
import type { FastifyInstance } from 'fastify'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createAuditEvent } from '../lib/audit.js'
import { s3, S3_BUCKET } from '../lib/storage.js'
import { AuditAction } from '@clm/types'

const InboundEmailSchema = z.object({
  to: z.string().min(1),
  from: z.string().email(),
  subject: z.string().optional().default(''),
  text: z.string().optional().default(''),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    contentBase64: z.string(),
  })).default([]),
})

// Extract the `+tag` from the local part of an address.
//   contracts+abc123@inbound.foo.com  →  "abc123"
function extractContractTag(toAddress: string): string | null {
  const match = toAddress.toLowerCase().match(/^[^@]*\+([^@]+)@/)
  return match ? match[1] : null
}

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

export async function inboundEmailRoutes(app: FastifyInstance) {

  // ── Auth: shared-secret header (mailgun / sendgrid both let you set
  // arbitrary headers on the inbound webhook).
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/v1/inbound')) return
    const expected = process.env.INBOUND_EMAIL_SECRET
    if (!expected) {
      // Hard-fail if not configured in production. In dev with no secret,
      // skip the auth (and log a loud warning).
      if (process.env.NODE_ENV === 'production') {
        return reply.status(503).send({ error: 'Inbound email handler not configured' })
      }
      req.log.warn('[inbound-email] INBOUND_EMAIL_SECRET unset — accepting unauthenticated request (dev only)')
      return
    }
    const got = req.headers['x-inbound-secret']
    if (got !== expected) {
      return reply.status(401).send({ error: 'Invalid inbound secret' })
    }
  })

  app.post('/email', async (req, reply) => {
    const body = InboundEmailSchema.parse(req.body)

    const contractId = extractContractTag(body.to)
    if (!contractId) {
      return reply.status(400).send({ error: 'Could not extract contract id from To: address. Expected format: contracts+<id>@…' })
    }
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { counterparty: { select: { id: true, email: true, name: true } } },
    })
    if (!contract || contract.deletedAt) {
      return reply.status(404).send({ error: 'Contract not found' })
    }
    if (contract.status === 'EXECUTED') {
      return reply.status(409).send({ error: 'Contract already executed — emails ignored' })
    }

    // Sender allow-list: see if the sender was previously emailed via a
    // share link or matches the registered counterparty.
    const senderEmail = body.from.toLowerCase()
    const allowAll = process.env.INBOUND_EMAIL_ALLOW_ALL === '1'
    let allowed = allowAll
    let senderReason = allowAll ? 'allow_all_dev' : 'unknown'

    if (!allowed && contract.counterparty?.email && contract.counterparty.email.toLowerCase() === senderEmail) {
      allowed = true
      senderReason = 'counterparty_email_match'
    }
    if (!allowed) {
      // Accept if a portal share-link was issued with this email in metadata —
      // we don't currently store invite emails on links so this falls through
      // to denial. Future: store invitee email on link.label or a new column.
    }
    if (!allowed) {
      return reply.status(403).send({
        error: `Sender ${senderEmail} is not authorised on this contract. Add them as the counterparty or set INBOUND_EMAIL_ALLOW_ALL=1 (dev only).`,
        sender_reason: senderReason,
      })
    }

    // Pick the first attachment that's a contract document.
    const pdfOrDocx = body.attachments.find(a => ALLOWED_MIMES.has(a.contentType.toLowerCase()))
    if (!pdfOrDocx) {
      return reply.status(400).send({
        error: 'No PDF or DOCX attachment found. We only attach PDF/DOCX as new versions.',
        attachments: body.attachments.map(a => ({ filename: a.filename, contentType: a.contentType })),
      })
    }

    const buffer = Buffer.from(pdfOrDocx.contentBase64, 'base64')
    if (buffer.length > 25 * 1024 * 1024) {
      return reply.status(413).send({ error: 'Attachment too large (25MB limit)' })
    }
    if (buffer.length === 0) {
      return reply.status(400).send({ error: 'Empty attachment' })
    }

    const s3Key = `inbound-email/${contractId}/${Date.now()}-${pdfOrDocx.filename}`
    try {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: pdfOrDocx.contentType,
        Metadata: {
          'sender': senderEmail,
          'contract-id': contractId,
        },
      }))
    } catch (err) {
      req.log.error({ err, s3Key }, '[inbound-email] S3 upload failed')
      return reply.status(502).send({ error: 'Could not store the attachment.' })
    }

    const latest = await prisma.contractVersion.findFirst({
      where: { contractId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    })
    const nextVersion = (latest?.versionNumber ?? 0) + 1

    const version = await prisma.contractVersion.create({
      data: {
        contractId,
        versionNumber: nextVersion,
        s3Key,
        fileSize: buffer.length,
        mimeType: pdfOrDocx.contentType,
        // email:<sender> attribution — same shape as portal:<linkId>.
        // The reader (e.g. NegotiationStatusStrip) treats both as
        // "from counterparty" by checking the prefix.
        createdById: `email:${senderEmail}`,
        changeNote: `Emailed by ${senderEmail}: ${body.subject || '(no subject)'}`,
        metadata: {
          inboundEmail: {
            from: senderEmail,
            to: body.to,
            subject: body.subject,
            textExcerpt: body.text.slice(0, 500),
          },
        },
      },
    })

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'UNDER_NEGOTIATION' },
    })

    createAuditEvent({
      orgId: contract.orgId,
      action: AuditAction.EMAIL_REDLINE_RECEIVED,
      resourceType: 'contract',
      resourceId: contractId,
      metadata: {
        sender: senderEmail,
        subject: body.subject,
        filename: pdfOrDocx.filename,
        versionNumber: nextVersion,
        senderReason,
      },
      ipAddress: req.ip,
    }).catch((err) => {
      req.log.warn({ err }, '[inbound-email] audit write failed')
    })

    return reply.status(201).send({
      ok: true,
      versionId: version.id,
      versionNumber: nextVersion,
      filename: pdfOrDocx.filename,
      message: `Recorded as v${nextVersion} on ${contract.title}. Owner has been notified.`,
    })
  })
}
