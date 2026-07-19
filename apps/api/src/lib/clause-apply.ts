/**
 * Apply proposed clause language — splice a rewrite into the document and land
 * it as a new ContractVersion.
 *
 * Extracted out of internal-ai's /tools/redline_apply so a user-facing endpoint
 * can reuse it. That route sits behind the x-internal-secret hook and was only
 * reachable through the agent-thread apply flow, which hard-fails without an
 * existing conversation — so a reviewer looking at proposed language in the
 * review drawer had no way to apply it.
 *
 * Reversible: undo flips currentVersionId back and annotates the reverted
 * version's changeNote; the row itself stays as an audit trail.
 */
import { prisma } from './prisma.js'

/**
 * Minimal HTML escape for splicing text into contract HTML.
 *
 * Deliberately escapes ONLY & < > — do not "improve" this by adding quote
 * escaping. It is used to MATCH existing stored content
 * (htmlContent.replace(escapeHtml(before), …)); escaping more characters than
 * the stored HTML contains makes the match miss, and the splice then silently
 * falls through to appending an amendment block instead of replacing the clause.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface ApplyClauseArgs {
  orgId:        string
  userId:       string
  contractId:   string
  clauseId:     string
  proposedText: string
  aggression?:  string
  rationale?:   string
  changes?:     Array<{ before: string; after: string; reason?: string }>
}

export interface ApplyClausePayload {
  ok:                true
  reversible:        true
  contractId:        string
  previousVersionId: string
  newVersionId:      string
  newVersionNumber:  number
  clauseId:          string
  /** false when the original text couldn't be located and it was appended instead. */
  spliced:           boolean
  diff:              Array<{ field: string; before: unknown; after: unknown }>
}

export type ApplyClauseResult =
  | { ok: true;  data: ApplyClausePayload }
  | { ok: false; status: number; detail: string }

export async function applyClauseProposal(args: ApplyClauseArgs): Promise<ApplyClauseResult> {
  const contract = await prisma.contract.findFirst({
    where:  { id: args.contractId, orgId: args.orgId, deletedAt: null },
    select: { id: true, title: true, type: true, currentVersionId: true },
  })
  if (!contract) return { ok: false, status: 404, detail: 'Contract not found' }
  if (!contract.currentVersionId) {
    return { ok: false, status: 400, detail: 'Contract has no current version' }
  }

  const currentVersion = await prisma.contractVersion.findUnique({
    where:  { id: contract.currentVersionId },
    select: { id: true, versionNumber: true, htmlContent: true, plainText: true },
  })
  if (!currentVersion) return { ok: false, status: 404, detail: 'Current version missing' }

  let clause = await prisma.contractClause.findFirst({
    where:  { id: args.clauseId, versionId: currentVersion.id },
    select: { id: true, clauseType: true, content: true, sectionRef: true },
  })

  // P1.6 — resilience to version churn. The caller may hold a clauseId from an
  // earlier version (the editor's autosave creates versions without re-running
  // clause extraction, so the current version can have zero clause rows):
  //   1) match by (clauseType, sectionRef) on the current version;
  //   2) else fall back to the prior clause's own data — the splice runs
  //      against version.htmlContent anyway, and falls through to an amendment
  //      note if the text is no longer present.
  if (!clause) {
    const priorClause = await prisma.contractClause.findFirst({
      where:  { id: args.clauseId },
      select: { id: true, clauseType: true, content: true, sectionRef: true },
    })
    if (priorClause) {
      const byType = await prisma.contractClause.findFirst({
        where: {
          versionId:  currentVersion.id,
          isSubChunk: false,
          clauseType: priorClause.clauseType,
          ...(priorClause.sectionRef ? { sectionRef: priorClause.sectionRef } : {}),
        },
        orderBy: { sortOrder: 'asc' },
        select:  { id: true, clauseType: true, content: true, sectionRef: true },
      })
      clause = byType ?? priorClause
    }
  }
  if (!clause) return { ok: false, status: 404, detail: 'Clause not found on current version' }

  // Splice the clause content verbatim. If it can't be located cleanly (the
  // text was rewritten after extraction), append as an addendum rather than
  // corrupting the document.
  const before = clause.content
  const newParagraph = `<p>${escapeHtml(args.proposedText)}</p>`
  let nextHtml  = currentVersion.htmlContent
  let nextPlain = currentVersion.plainText
  let spliced = false
  if (currentVersion.htmlContent.includes(before)) {
    nextHtml = currentVersion.htmlContent.replace(before, args.proposedText)
    spliced = true
  } else if (currentVersion.htmlContent.includes(escapeHtml(before))) {
    nextHtml = currentVersion.htmlContent.replace(escapeHtml(before), escapeHtml(args.proposedText))
    spliced = true
  } else {
    nextHtml += `\n<hr/>\n<p><strong>Amendment (via redline_apply):</strong></p>${newParagraph}`
  }
  nextPlain = currentVersion.plainText.includes(before)
    ? currentVersion.plainText.replace(before, args.proposedText)
    : currentVersion.plainText + '\n\n[Amendment via redline_apply]\n' + args.proposedText

  const nextVersionNumber = currentVersion.versionNumber + 1
  const aggressionLabel = args.aggression ?? 'custom'

  const newVersion = await prisma.$transaction(async (tx) => {
    const v = await tx.contractVersion.create({
      data: {
        contractId:    contract.id,
        versionNumber: nextVersionNumber,
        htmlContent:   nextHtml,
        plainText:     nextPlain,
        changeNote: args.rationale
          ? `redline_apply (${aggressionLabel}): ${args.rationale}`
          : `redline_apply (${aggressionLabel}) on ${clause!.clauseType}`,
        createdById: args.userId,
        // Kept structured so a future OOXML serializer can emit real Word
        // tracked changes from these rows without re-running the LLM.
        metadata: {
          redline: {
            sourceClauseId: clause!.id,
            clauseType:     clause!.clauseType,
            sectionRef:     clause!.sectionRef,
            originalText:   clause!.content,
            proposedText:   args.proposedText,
            aggression:     aggressionLabel,
            rationale:      args.rationale,
            changes:        args.changes ?? [],
            spliced,
            generatedBy:    'redline_apply',
            appliedAt:      new Date().toISOString(),
          },
        },
      },
    })
    await tx.contract.update({
      where: { id: contract.id },
      data:  { currentVersionId: v.id },
    })
    return v
  })

  return {
    ok: true,
    data: {
      ok:                true,
      reversible:        true,
      contractId:        contract.id,
      previousVersionId: currentVersion.id,
      newVersionId:      newVersion.id,
      newVersionNumber:  nextVersionNumber,
      clauseId:          clause.id,
      spliced,
      diff: [
        { field: 'currentVersionId', before: currentVersion.id, after: newVersion.id },
        { field: 'versionNumber',    before: currentVersion.versionNumber, after: nextVersionNumber },
      ],
    },
  }
}
