/**
 * AI demo seed — deterministic contracts with real bodies for smoke tests.
 *
 * Existing prisma/seed.ts creates contract rows with metadata only
 * (title + short summary as plainText). That makes it impossible to tell
 * whether the agent's `contract_get` tool is actually reading the document
 * or just regurgitating the title/type. This seed fixes that by loading
 * four full contract bodies from fixtures/ai-demo/*.txt and attaching them
 * as ContractVersion.plainText + htmlContent.
 *
 * Runs against admin@demo.com's org by default. Wipes prior AI-demo
 * artifacts (the four contracts it created) so re-runs are idempotent.
 *
 * Smoke scripts call this before running so the fact assertions
 * ("mentions $500,000 liability cap", "99.9% uptime", etc.) reference
 * real text that's guaranteed to be in the DB.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/seed-ai-demo.ts          # default: seed
 *   pnpm tsx --env-file=.env scripts/seed-ai-demo.ts clear    # remove only
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderHtmlToPdfAndStore } from '../src/lib/gotenberg.js'
import { seedBuiltInSkills } from './seed-skills.js'
import { seedPlaybookRules } from './seed-playbook-rules.js'
import { ensureBucket } from '../src/lib/storage.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures/ai-demo')

const prisma = new PrismaClient()

// Canonical title → fixture file. Titles are the idempotency key — prior
// runs delete any contract matching these titles before re-creating.
interface FixtureContract {
  title: string
  fixture: string
  type: string
  status: string
  counterpartyName: string
  value: number | null
  currency: string
  effectiveDate: Date | null
  expiryDate: Date | null
  riskScore: number | null
  summary: string
  keyTerms: Record<string, unknown>
  tags: string[]
  // Facts smoke tests can assert are present in plainText. These live with
  // the fixture so tests can grep for them authoritatively.
  factsCallout: string[]
}

const FIXTURES_LIST: FixtureContract[] = [
  {
    title: 'Globex — Mutual NDA',
    fixture: 'nda-globex.txt',
    type: 'NDA',
    status: 'EXECUTED',
    counterpartyName: 'Globex Industries',
    value: null,
    currency: 'USD',
    effectiveDate: new Date('2026-03-01'),
    expiryDate:    new Date('2028-03-01'),
    riskScore: 0.12,
    summary: 'Mutual non-disclosure agreement between Demo Org and Globex Industries. 2-year term, $50,000 liquidated damages per breach, California governing law.',
    keyTerms: {
      governingLaw: 'California',
      term: '2 years',
      liquidatedDamages: '$50,000',
      confidentialityDuration: '5 years post-termination',
      noticePeriod: '30 days',
    },
    tags: ['nda', 'ai-demo', 'executed'],
    factsCallout: [
      '$50,000 liquidated damages per breach',
      '2-year term',
      'California governing law',
      '30-day termination notice',
    ],
  },
  {
    title: 'Acme Corporation — Master Services Agreement',
    fixture: 'msa-acme.txt',
    type: 'MSA',
    status: 'EXECUTED',
    counterpartyName: 'Acme Corporation',
    value: 250_000,
    currency: 'USD',
    effectiveDate: new Date('2026-01-15'),
    expiryDate:    new Date('2028-01-14'),
    riskScore: 0.28,
    summary: 'Master services agreement with Acme Corporation. Delaware law, $500,000 liability cap with carve-outs for confidentiality and indemnification, auto-renews 1-year with 90-day notice of non-renewal, JAMS arbitration in Wilmington.',
    keyTerms: {
      governingLaw: 'Delaware',
      initialTerm: '2 years',
      autoRenew: true,
      noticeOfNonRenewal: '90 days',
      liabilityCap: '$500,000',
      liabilityCarveOuts: ['indemnification', 'confidentiality', 'gross negligence or willful misconduct'],
      paymentTerms: 'Net 30',
      disputeResolution: 'JAMS arbitration (Wilmington, DE)',
    },
    tags: ['msa', 'ai-demo', 'executed', 'enterprise'],
    factsCallout: [
      '$500,000 liability cap',
      '90-day notice of non-renewal',
      'Net 30 payment terms',
      'Delaware governing law',
      'JAMS arbitration',
      'Professional liability insurance of $5,000,000',
    ],
  },
  {
    title: 'Umbrella Corporation — SLA',
    fixture: 'sla-umbrella.txt',
    type: 'SLA',
    status: 'EXECUTED',
    counterpartyName: 'Umbrella Corporation',
    value: null,
    currency: 'USD',
    effectiveDate: new Date('2026-02-01'),
    expiryDate:    null,
    riskScore: 0.45,
    summary: 'Service level agreement with Umbrella Corporation for the analytics platform. 99.9% monthly uptime target, tiered service credits (10% / 25% / 50%), 15-minute Sev 1 response, 4-hour RPO / 12-hour RTO, SOC 2 Type II.',
    keyTerms: {
      uptimeTarget: '99.9%',
      sev1ResponseTime: '15 minutes',
      sev1ResolutionTarget: '4 hours',
      serviceCreditTiers: { '<99.9%': '10%', '<99.0%': '25%', '<95.0%': '50%' },
      rpo: '4 hours',
      rto: '12 hours',
      securityCertification: 'SOC 2 Type II',
      incidentNotificationWindow: '48 hours',
    },
    tags: ['sla', 'ai-demo', 'executed'],
    factsCallout: [
      '99.9% monthly uptime target',
      '15-minute Sev 1 response',
      '4-hour Recovery Point Objective',
      '12-hour Recovery Time Objective',
      'SOC 2 Type II certification',
      '48-hour incident notification',
    ],
  },
  {
    title: 'Stark Industries — SOW #12 (Arc Reactor Integration)',
    fixture: 'sow-stark.txt',
    type: 'SOW',
    status: 'EXECUTED',
    counterpartyName: 'Stark Industries',
    value: 85_000,
    currency: 'USD',
    effectiveDate: new Date('2026-01-15'),
    expiryDate:    new Date('2026-03-31'),
    riskScore: 0.18,
    summary: 'Fixed-fee statement of work for the Arc Reactor Integration project. 5 milestones, $85,000 total fee, Net 30 payment, 90-day warranty on integration code.',
    keyTerms: {
      totalFee: '$85,000',
      milestones: 5,
      paymentTerms: 'Net 30',
      warrantyPeriod: '90 days',
      duration: 'Jan 15 – Mar 31, 2026',
      keyPersonnel: ['Jessica Wu', 'Raj Patel'],
    },
    tags: ['sow', 'ai-demo', 'executed', 'consulting'],
    factsCallout: [
      '5 milestones',
      '$85,000 total fixed fee',
      'Net 30 payment terms',
      '90-day warranty on integration code',
      'Jessica Wu is a Key Personnel',
    ],
  },
]

async function findSeedAdmin() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@demo.com' },
    select: { id: true, orgId: true },
  })
  if (!admin) {
    throw new Error('seed user admin@demo.com not found — run the baseline `pnpm prisma db seed` first')
  }
  // Wave E.3 — the fixture bodies write "Demo Org, Inc." as the user's
  // side of every contract. The counterparty-pick heuristic in the review
  // agent filters out parties whose name matches the Organization row's
  // name. If the DB org name is anything else (the admin seed historically
  // set it to "Acme" in some runs) the filter can't identify "us" and ends
  // up saving "Demo Org, Inc." as the counterparty. Realign here so the
  // AI-demo seed is the authoritative source of truth for the user org.
  await prisma.organization.update({
    where: { id: admin.orgId },
    data: { name: 'Demo Org, Inc.' },
  })
  return admin
}

async function clearAiDemoContracts(orgId: string) {
  // Find every contract matching our canonical titles.
  const titles = FIXTURES_LIST.map(f => f.title)
  const toDelete = await prisma.contract.findMany({
    where: { orgId, title: { in: titles } },
    select: { id: true },
  })
  const ids = toDelete.map(c => c.id)
  if (ids.length === 0) return 0

  // Wipe dependent rows before the contracts themselves.
  //
  // Order matters:
  //   1. ContractClause is keyed to versionId (not contractId) — delete via
  //      version lookup
  //   2. ContractShareLink / ContractComment / VersionDiffCache / ApprovalInstance
  //      are keyed directly on contractId
  //   3. Null out Contract.currentVersionId before deleting ContractVersion
  //      so the self-referential FK doesn't block deletion
  //   4. Delete ContractVersion by contractId
  //   5. Delete Contract
  const versionIds = (await prisma.contractVersion.findMany({
    where: { contractId: { in: ids } },
    select: { id: true },
  })).map(v => v.id)

  if (versionIds.length > 0) {
    await prisma.contractClause.deleteMany({ where: { versionId: { in: versionIds } } })
  }
  await prisma.contractComment.deleteMany({   where: { contractId: { in: ids } } })
  await prisma.contractShareLink.deleteMany({ where: { contractId: { in: ids } } })
  await prisma.versionDiffCache.deleteMany({  where: { contractId: { in: ids } } })
  await prisma.approvalInstance.deleteMany({  where: { contractId: { in: ids } } })
  await prisma.contract.updateMany({ where: { id: { in: ids } }, data: { currentVersionId: null } })
  await prisma.contractVersion.deleteMany({   where: { contractId: { in: ids } } })
  await prisma.contract.deleteMany({ where: { id: { in: ids } } })
  return ids.length
}

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

function plainToHtml(text: string, title: string): string {
  // Keep it simple — one <h1>, then <p> per blank-line-separated paragraph.
  const paragraphs = text.split(/\n\s*\n/)
  return `<h1>${escapeHtml(title)}</h1>\n` + paragraphs.map(p =>
    `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`
  ).join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string))
}

async function seed(orgId: string, ownerId: string) {
  // Ensure counterparties exist (the demo seed creates them; if an AI-demo
  // run removed them earlier, we re-create with the minimal shape).
  for (const f of FIXTURES_LIST) {
    await prisma.counterparty.upsert({
      where: { orgId_name: { orgId, name: f.counterpartyName } },
      update: {},
      create: { orgId, name: f.counterpartyName },
    })
  }

  const cpLookup = new Map(
    (await prisma.counterparty.findMany({ where: { orgId } })).map(c => [c.name, c.id])
  )

  for (const f of FIXTURES_LIST) {
    const plainText = loadFixture(f.fixture)
    const htmlContent = plainToHtml(plainText, f.title)

    const contract = await prisma.contract.create({
      data: {
        orgId,
        ownerId,
        title: f.title,
        type: f.type,
        status: f.status,
        counterpartyId: cpLookup.get(f.counterpartyName),
        counterpartyName: f.counterpartyName,
        value: f.value ?? undefined,
        currency: f.currency,
        effectiveDate: f.effectiveDate,
        expiryDate: f.expiryDate,
        riskScore: f.riskScore,
        summary: f.summary,
        keyTerms: f.keyTerms,
        tags: f.tags,
        analysisStatus: 'DONE',
      },
    })

    // Render a real PDF from the fixture HTML via Gotenberg + upload to
    // MinIO. If Gotenberg is down we fall back to a text-only version so
    // the seed still completes (the tool tests don't need the PDF — only
    // the user-facing "Original" toggle does).
    let s3Key: string | null = null
    let fileSize: number | null = null
    try {
      const res = await renderHtmlToPdfAndStore({
        html: htmlContent,
        keyPrefix: `${orgId}/contracts/${contract.id}/original`,
        filename: `${f.type.toLowerCase()}.pdf`,
      })
      s3Key = res.s3Key
      fileSize = res.size
    } catch (e) {
      console.warn(`  ⚠ Gotenberg render failed for ${f.title}: ${(e as Error).message} — skipping PDF`)
    }

    const version = await prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        versionNumber: 1,
        htmlContent,
        plainText,
        changeNote: 'AI-demo seed — fixture body',
        createdById: ownerId,
        s3Key,
        mimeType: s3Key ? 'application/pdf' : null,
        fileSize,
      },
    })

    await prisma.contract.update({
      where: { id: contract.id },
      data: { currentVersionId: version.id },
    })

    const lenKb = (plainText.length / 1024).toFixed(1)
    const pdfInfo = s3Key ? `, PDF ${(fileSize! / 1024).toFixed(1)} KB → ${s3Key}` : ', no PDF'
    console.log(`  ✓ ${f.type.padEnd(4)} ${f.title}  (${lenKb} KB plainText${pdfInfo})`)
  }
}

async function main() {
  const mode = process.argv[2] ?? 'seed'
  if (!['seed', 'clear'].includes(mode)) {
    console.error('Usage: seed-ai-demo.ts [seed|clear]')
    process.exit(1)
  }

  const admin = await findSeedAdmin()
  const removed = await clearAiDemoContracts(admin.orgId)
  if (removed > 0) console.log(`  (removed ${removed} prior AI-demo contract(s))`)

  if (mode === 'clear') {
    console.log('✓ AI-demo contracts cleared')
    await prisma.$disconnect()
    return
  }

  // Make sure the MinIO bucket exists before any upload — a fresh dev box
  // without prior /health probes hasn't triggered this yet.
  try { await ensureBucket() } catch (e) {
    console.warn(`  ⚠ ensureBucket failed: ${(e as Error).message} — PDFs will be skipped`)
  }

  await seed(admin.orgId, admin.id)
  console.log(`✓ AI-demo seed complete: ${FIXTURES_LIST.length} contract(s) created in org ${admin.orgId}`)

  // D.4.2 — also refresh the built-in skill catalog so a fresh demo env
  // boots with the 9 built-ins registered (the hero chips + rail @mention
  // autocomplete depend on this).
  await seedBuiltInSkills(prisma, msg => console.log(`  ${msg}`))

  // P1.2 — structured playbook rules for the Limitation of Liability
  // category so playbook_check emits concrete violations, not just prose
  // comparison.
  await seedPlaybookRules(prisma, msg => console.log(`  ${msg}`))

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('seed-ai-demo failed:', e)
  await prisma.$disconnect()
  process.exit(1)
})
