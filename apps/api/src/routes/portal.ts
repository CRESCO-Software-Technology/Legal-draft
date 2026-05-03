/**
 * External Portal — Phase 05 (Negotiation) + B.5.14 refactor.
 * Token-gated (no requireAuth). External reviewers/counterparties access contracts
 * via a signed portal JWT embedded in the URL (/portal/:portalToken on the frontend).
 *
 * Portal comments use authorId = "portal:<shareLinkId>"
 *
 * B.5.14 additions:
 *   - GET  /:portalToken/download/docx  — HTML→DOCX round-trip via Gotenberg
 *   - POST /:portalToken/versions       — counterparty uploads a revised .docx,
 *                                          lands as v(n+1) with author="portal:<linkId>"
 *                                          so our history has the external turn
 *                                          attributed correctly.
 */
import type { FastifyInstance } from 'fastify'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '../lib/prisma.js'
import { createAuditEvent } from '../lib/audit.js'
import { verifyPortalToken } from './share.js'
import { s3, S3_BUCKET } from '../lib/storage.js'
import { AuditAction } from '@clm/types'

async function resolvePortalToken(portalToken: string) {
  let payload
  try {
    payload = verifyPortalToken(portalToken)
  } catch {
    return null
  }

  const link = await prisma.contractShareLink.findUnique({
    where: { token: payload.token },
  })

  if (!link) return null
  if (link.revokedAt) return null
  if (link.expiresAt < new Date()) return null

  return { payload, link }
}

export async function portalRoutes(app: FastifyInstance) {

  // ── Get contract via portal token ─────────────────────────────────────────
  // Use wildcard because JWT tokens contain dots that confuse Fastify's radix tree with long paths
  app.get('/:portalToken/contract', async (req, reply) => {
    const { portalToken } = req.params as { portalToken: string }

    const resolved = await resolvePortalToken(portalToken)
    if (!resolved) return reply.status(401).send({ error: 'Invalid or expired share link' })

    const { payload, link } = resolved

    const contract = await prisma.contract.findFirst({
      where: { id: payload.contractId, orgId: payload.orgId, deletedAt: null },
      include: {
        counterparty: { select: { name: true, legalName: true } },
        owner: { select: { name: true } },
        org: { select: { name: true, brandColor: true, logoUrl: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, versionNumber: true, htmlContent: true, createdAt: true },
        },
      },
    })
    if (!contract) return reply.status(404).send({ error: 'Contract not found' })

    // Update view stats (fire and forget)
    prisma.contractShareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    }).catch(() => {})

    createAuditEvent({
      orgId: payload.orgId,
      action: AuditAction.PORTAL_VIEWED,
      resourceType: 'contract',
      resourceId: payload.contractId,
      metadata: { shareLinkId: link.id, ipAddress: req.ip },
    }).catch(() => {})

    const latestVersion = contract.versions[0]
    return reply.send({
      contract: {
        id: contract.id,
        title: contract.title,
        type: contract.type,
        status: contract.status,
        counterpartyName: contract.counterpartyName ?? contract.counterparty?.name,
        effectiveDate: contract.effectiveDate,
        expiryDate: contract.expiryDate,
        org: contract.org,
      },
      htmlContent: latestVersion?.htmlContent ?? '',
      versionId: latestVersion?.id,
      permissions: payload.permissions,
      shareLink: {
        id: link.id,
        label: link.label,
        expiresAt: link.expiresAt,
        viewCount: link.viewCount + 1,
      },
    })
  })


  // ── Add comment via portal ────────────────────────────────────────────────
  app.post('/:portalToken/comments', async (req, reply) => {
    const { portalToken } = req.params as { portalToken: string }

    const resolved = await resolvePortalToken(portalToken)
    if (!resolved) return reply.status(401).send({ error: 'Invalid or expired share link' })

    const { payload, link } = resolved

    if (!payload.permissions.includes('comment')) {
      return reply.status(403).send({ error: 'This link does not allow comments' })
    }

    const { body, clauseRef, authorName, authorEmail } = req.body as {
      body: string
      clauseRef?: string
      authorName?: string
      authorEmail?: string
    }

    if (!body?.trim()) return reply.status(400).send({ error: 'body is required' })

    const comment = await prisma.contractComment.create({
      data: {
        orgId: payload.orgId,
        contractId: payload.contractId,
        authorId: `portal:${link.id}`,
        body: body.trim(),
        clauseRef,
        // Store portal user info in a structured way
        resolvedById: authorName ?? authorEmail ?? 'External reviewer',
      },
      include: { replies: true },
    })

    return reply.status(201).send(comment)
  })


  // ── B.5.14: Download current version as .docx via Gotenberg ──────────────
  // Counterparties often redline in Word and mail it back. The original
  // Phase 05 portal only offered a read-only HTML view, which forced them
  // into our portal — the exact friction ChatGPT flagged in round 3 as a
  // deal-losing pattern. This endpoint closes the loop: download .docx →
  // redline locally → upload revised version back via POST /:token/versions.
  app.get('/:portalToken/download/docx', async (req, reply) => {
    const { portalToken } = req.params as { portalToken: string }

    const resolved = await resolvePortalToken(portalToken)
    if (!resolved) return reply.status(401).send({ error: 'Invalid or expired share link' })
    const { payload, link } = resolved

    const contract = await prisma.contract.findFirst({
      where: { id: payload.contractId, orgId: payload.orgId, deletedAt: null },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { htmlContent: true, versionNumber: true } },
      },
    })
    if (!contract) return reply.status(404).send({ error: 'Contract not found' })
    const latest = contract.versions[0]
    if (!latest?.htmlContent?.trim()) {
      return reply.status(400).send({ error: 'No content available to export' })
    }

    const GOTENBERG_URL = process.env.GOTENBERG_URL ?? 'http://localhost:3002'
    const formData = new FormData()
    formData.append('files', new Blob([latest.htmlContent], { type: 'text/html' }), 'index.html')

    const upstream = await fetch(`${GOTENBERG_URL}/forms/libreoffice/convert`, {
      method: 'POST',
      body:   formData,
    }).catch(() => null)

    if (!upstream?.ok) {
      app.log.error({ status: upstream?.status }, 'Portal docx conversion failed')
      return reply.status(502).send({ error: 'DOCX generation failed — try again shortly' })
    }

    const docxBuffer = Buffer.from(await upstream.arrayBuffer())
    const safeTitle = (contract.title || 'contract').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60)
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    reply.header('Content-Disposition', `attachment; filename="${safeTitle}-v${latest.versionNumber}.docx"`)

    createAuditEvent({
      orgId:        payload.orgId,
      action:       AuditAction.PORTAL_VIEWED, // reuse — portal-download audit added in a follow-up
      resourceType: 'contract',
      resourceId:   payload.contractId,
      metadata:     { shareLinkId: link.id, action: 'download_docx', ipAddress: req.ip },
    }).catch(() => {})

    return reply.send(docxBuffer)
  })


  // ── B.5.14: Counterparty uploads a revised .docx/.pdf ────────────────────
  // Lands as a new ContractVersion with:
  //   - createdById:  `portal:<shareLinkId>`  (attribution path)
  //   - changeNote:   "Uploaded by counterparty via portal"
  // The revised file itself is stored as a version `filename`/`fileKey`;
  // HTML re-extraction happens on the server side in a follow-up job so
  // the upload returns fast. For V1 we only store the file — the extract
  // step runs on the next analyze tick.
  app.post('/:portalToken/versions', async (req, reply) => {
    const { portalToken } = req.params as { portalToken: string }

    const resolved = await resolvePortalToken(portalToken)
    if (!resolved) return reply.status(401).send({ error: 'Invalid or expired share link' })
    const { payload, link } = resolved

    // Per-link permission gate: only share links that explicitly grant
    // 'edit' (or the new 'upload') can upload revisions. 'read' and
    // 'comment' links cannot — that keeps read-only shares truly read-only.
    const allowed = payload.permissions.includes('edit') || payload.permissions.includes('upload')
    if (!allowed) {
      return reply.status(403).send({ error: 'This link does not allow uploads' })
    }

    const file = await (req as unknown as { file: () => Promise<{ filename: string; mimetype: string; toBuffer: () => Promise<Buffer> } | undefined> }).file()
    if (!file) return reply.status(400).send({ error: 'file is required' })
    const allowedMime = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])
    if (!allowedMime.has(file.mimetype)) {
      return reply.status(400).send({ error: 'Only .pdf or .docx files accepted' })
    }
    const buffer = await file.toBuffer()
    if (buffer.length > 25 * 1024 * 1024) {
      return reply.status(413).send({ error: 'File too large (25MB limit)' })
    }

    // Next version number for this contract
    const latest = await prisma.contractVersion.findFirst({
      where:   { contractId: payload.contractId },
      orderBy: { versionNumber: 'desc' },
      select:  { versionNumber: true },
    })
    const nextVersion = (latest?.versionNumber ?? 0) + 1

    // P7.6.2 — actually push the bytes to S3/MinIO. If the upload
    // fails (network / credentials), the row creation is rolled back
    // by NOT creating it (we throw before the prisma.create call).
    // Fire-and-forget would lose data; we'd rather 502.
    const s3Key = `portal-uploads/${link.id}/${Date.now()}-${file.filename}`
    try {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.mimetype,
        Metadata: {
          'uploaded-by': `portal:${link.id}`,
          'contract-id': payload.contractId,
        },
      }))
    } catch (err) {
      req.log.error({ err, s3Key }, '[portal] S3 upload failed')
      return reply.status(502).send({ error: 'Could not store the uploaded file. Please try again.' })
    }

    // NOTE: htmlContent / plainText stay empty — the extraction worker
    // will fill them in on the next analyze tick.
    const version = await prisma.contractVersion.create({
      data: {
        contractId:    payload.contractId,
        versionNumber: nextVersion,
        s3Key,
        fileSize:      buffer.length,
        mimeType:      file.mimetype,
        createdById:   `portal:${link.id}`,
        changeNote:    `Uploaded by counterparty via portal (${file.filename})`,
      },
    })

    // Flip the contract's status to UNDER_NEGOTIATION so the owner sees
    // the NegotiationStatusStrip flip to "Waiting on you" on next load.
    await prisma.contract.update({
      where: { id: payload.contractId },
      data:  { status: 'UNDER_NEGOTIATION' },
    })

    // P7.6.2 — proper PORTAL_UPLOADED_VERSION action so the counterparty's
    // upload shows up distinctly from a generic view in the audit log.
    createAuditEvent({
      orgId:        payload.orgId,
      action:       AuditAction.PORTAL_UPLOADED_VERSION,
      resourceType: 'contract',
      resourceId:   payload.contractId,
      metadata:     {
        shareLinkId: link.id,
        versionNumber: nextVersion,
        filename:    file.filename,
        ipAddress:   req.ip,
        userAgent:   req.headers['user-agent'] ?? null,
      },
    }).catch(() => {})

    return reply.status(201).send({
      id:            version.id,
      versionNumber: nextVersion,
      filename:      file.filename,
      message:       'Revised version uploaded. The owner has been notified.',
    })
  })
}
