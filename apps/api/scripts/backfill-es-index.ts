/**
 * backfill-es-index.ts — one-shot recovery: index EVERY non-deleted
 * contract (all orgs) into Elasticsearch.
 *
 * Referenced by BUILD_TRACKER (2026-04-30 ADL: "every contract-create
 * path must call indexContract; backfill script lives here") but the
 * file was never committed — recreated during the 2026-06-10 screen
 * review when the local ES index turned out to hold 1 doc vs 19+ in
 * Postgres, so the contracts-list search returned 0 rows for "Acme".
 *
 * Generalises reindex-personas.ts: no org allowlist, just everything.
 *
 * Usage:
 *   cd apps/api && npx tsx --env-file=../../.env scripts/backfill-es-index.ts
 */
import { PrismaClient } from '@prisma/client'
import { indexContract } from '../src/lib/elasticsearch.js'

const prisma = new PrismaClient()

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: {
      id: true, orgId: true, title: true, type: true, status: true,
      counterpartyName: true, jurisdiction: true,
      riskScore: true, effectiveDate: true, expiryDate: true,
      createdAt: true, summary: true, tags: true, keyTerms: true,
      versions: {
        select: { plainText: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  })
  console.log(`Backfilling ${contracts.length} contracts into Elasticsearch…`)

  let ok = 0, fail = 0
  for (const c of contracts) {
    try {
      await indexContract(c.id, {
        orgId: c.orgId,
        title: c.title,
        type: c.type,
        status: c.status,
        counterpartyName: c.counterpartyName ?? undefined,
        jurisdiction: c.jurisdiction ?? undefined,
        plainText: c.versions[0]?.plainText ?? '',
        summary: c.summary ?? undefined,
        tags: c.tags,
        riskScore: c.riskScore ?? undefined,
        effectiveDate: c.effectiveDate?.toISOString(),
        expiryDate:    c.expiryDate?.toISOString(),
        createdAt:     c.createdAt.toISOString(),
        keyTerms: (c.keyTerms ?? {}) as Record<string, unknown>,
      })
      ok++
    } catch (e) {
      fail++
      console.error(`  ✗ ${c.id} ${c.title.slice(0, 40)}: ${(e as Error).message.slice(0, 120)}`)
    }
  }
  console.log(`Done: ${ok} indexed, ${fail} failed.`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main()
