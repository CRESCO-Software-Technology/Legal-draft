/**
 * Workflow Engine — Phase 06
 * Central state machine for approval workflows.
 * Production pattern: DB-backed state machine (used by Ironclad, DocuSign CLM, SAP Ariba).
 * All state lives in Postgres (approval_instances + approval_steps).
 * Escalation timers are BullMQ delayed jobs with deterministic IDs for clean cancellation.
 */
import type { PrismaClient } from '@prisma/client'
import { notificationQueue, queueEscalation, queueNotification } from './queue.js'
import { createAuditEvent } from './audit.js'
import { AuditAction } from '@clm/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStepDef {
  order:            number
  name:             string
  approverId?:      string   // specific user
  roleRequired?:    string   // fallback: first org user with matching role
  executionMode:    'sequential' | 'parallel'
  requiredApprovals: number  // for parallel: how many of N must approve (1 = any-one)
  dueSoonHours:     number   // default 48 — used to set escalateAt
  escalateTo?:      string   // userId to reassign to on timeout
}

// ─── Helper: cancel escalation job ────────────────────────────────────────────

async function cancelEscalation(stepId: string): Promise<void> {
  try {
    await notificationQueue.remove(`escalate-${stepId}`)
  } catch {
    // No-op — job may have already run or never existed
  }
}

// ─── Helper: create ApprovalStep rows for a step definition ──────────────────

async function createStepsForDef(
  prisma: PrismaClient,
  instanceId: string,
  orgId: string,
  stepDef: WorkflowStepDef,
  resolvedApproverId: string,
): Promise<string> {
  const escalateAt = new Date(Date.now() + stepDef.dueSoonHours * 60 * 60 * 1000)

  const step = await prisma.approvalStep.create({
    data: {
      approvalInstanceId: instanceId,
      orgId,
      stepOrder:  stepDef.order,
      stepName:   stepDef.name,
      approverId: resolvedApproverId,
      status:     'PENDING',
      escalateAt,
    },
  })

  // Queue escalation delayed job
  const delayMs = stepDef.dueSoonHours * 60 * 60 * 1000
  const job = await queueEscalation({
    instanceId,
    stepId:     step.id,
    orgId,
    escalateTo: stepDef.escalateTo,
  }, delayMs)

  // Store job ID on the step so we can cancel it on decision
  await prisma.approvalStep.update({
    where: { id: step.id },
    data:  { escalationJobId: job.id?.toString() },
  })

  return step.id
}

// ─── Main engine: advanceWorkflow ─────────────────────────────────────────────
//
// Called after every step decision. Reads current state and transitions the
// instance (and contract) to the next state. All DB writes in a single transaction.

export async function advanceWorkflow(instanceId: string, prisma: PrismaClient): Promise<void> {
  // Load instance + all steps + workflow definition
  const instance = await prisma.approvalInstance.findUnique({
    where:   { id: instanceId },
    include: { steps: true, definition: true },
  })
  if (!instance) throw new Error(`advanceWorkflow: instance not found: ${instanceId}`)
  if (instance.status !== 'PENDING' && instance.status !== 'ESCALATED') return // already terminal

  const stepDefs: WorkflowStepDef[] = Array.isArray(instance.definition.steps)
    ? (instance.definition.steps as unknown as WorkflowStepDef[])
    : []

  const currentDef = stepDefs.find(d => d.order === instance.currentStepOrder)
  const currentSteps = instance.steps.filter(s => s.stepOrder === instance.currentStepOrder)

  // ── Case 1: Any step REJECTED → reject the whole workflow ─────────────────
  const anyRejected = currentSteps.some(s => s.decision === 'REJECTED')
  if (anyRejected) {
    // Cancel all pending escalation jobs at this step
    await Promise.all(currentSteps.filter(s => s.status === 'PENDING').map(s => cancelEscalation(s.id)))

    await prisma.$transaction([
      // Reject all still-pending steps
      prisma.approvalStep.updateMany({
        where: { approvalInstanceId: instanceId, status: 'PENDING' },
        data:  { status: 'REJECTED', decidedAt: new Date() },
      }),
      // Close the instance
      prisma.approvalInstance.update({
        where: { id: instanceId },
        data:  { status: 'REJECTED', decidedAt: new Date() },
      }),
      // Revert contract to DRAFT so submitter can edit and resubmit
      prisma.contract.update({
        where: { id: instance.contractId },
        data:  { status: 'DRAFT' },
      }),
    ])

    createAuditEvent({
      orgId:        instance.orgId,
      action:       AuditAction.APPROVAL_DECIDED,
      resourceType: 'approval_instance',
      resourceId:   instanceId,
      metadata:     { decision: 'REJECTED', contractId: instance.contractId },
    }).catch(() => {})

    // Notify submitter
    const contract = await prisma.contract.findUnique({ where: { id: instance.contractId } })
    queueNotification({
      orgId:        instance.orgId,
      userId:       instance.submittedById,
      type:         'APPROVAL_DECIDED',
      title:        'Contract approval rejected',
      body:         `"${contract?.title ?? 'Contract'}" was rejected and returned to Draft.`,
      resourceType: 'approval_instance',
      resourceId:   instanceId,
    })
    return
  }

  // ── Case 2: Check if current batch is resolved (all required approvals met) ─
  const approvedCount = currentSteps.filter(s => s.decision === 'APPROVED').length
  const executionMode = currentDef?.executionMode ?? 'sequential'
  const requiredApprovals = currentDef?.requiredApprovals ?? 1

  // DELEGATED steps at this order are still in-flight (delegatee has a new PENDING step)
  const pendingCount = currentSteps.filter(s => s.status === 'PENDING').length

  let batchResolved = false
  if (executionMode === 'parallel') {
    batchResolved = approvedCount >= requiredApprovals && pendingCount === 0
  } else {
    // Sequential: single approver must have approved; no pending left
    batchResolved = approvedCount >= 1 && pendingCount === 0
  }

  if (!batchResolved) return // still waiting for more decisions at this step

  // ── Case 3: Batch resolved as APPROVED — advance or complete ──────────────
  const nextStepDef = stepDefs.find(d => d.order === instance.currentStepOrder + 1)

  if (!nextStepDef) {
    // All steps complete — approve the contract
    await prisma.$transaction([
      prisma.approvalInstance.update({
        where: { id: instanceId },
        data:  { status: 'APPROVED', decidedAt: new Date() },
      }),
      prisma.contract.update({
        where: { id: instance.contractId },
        data:  { status: 'APPROVED' },
      }),
    ])

    createAuditEvent({
      orgId:        instance.orgId,
      action:       AuditAction.APPROVAL_DECIDED,
      resourceType: 'approval_instance',
      resourceId:   instanceId,
      metadata:     { decision: 'APPROVED', contractId: instance.contractId },
    }).catch(() => {})

    const contract = await prisma.contract.findUnique({ where: { id: instance.contractId } })
    queueNotification({
      orgId:        instance.orgId,
      userId:       instance.submittedById,
      type:         'APPROVAL_DECIDED',
      title:        'Contract approved',
      body:         `"${contract?.title ?? 'Contract'}" has been fully approved.`,
      resourceType: 'approval_instance',
      resourceId:   instanceId,
    })
    return
  }

  // Advance to the next step — resolve approverId from def
  let nextApproverId = nextStepDef.approverId
  if (!nextApproverId && nextStepDef.roleRequired) {
    // Find first active user in org with this role
    const userRole = await prisma.userRole.findFirst({
      where: {
        user: { orgId: instance.orgId, deletedAt: null },
        role: { name: nextStepDef.roleRequired },
      },
      include: { user: true },
    })
    nextApproverId = userRole?.userId
  }
  if (!nextApproverId) {
    console.warn('[workflow-engine] no approver found for step %d (def: %j) — skipping', nextStepDef.order, nextStepDef)
    return
  }

  await prisma.approvalInstance.update({
    where: { id: instanceId },
    data:  { currentStepOrder: nextStepDef.order },
  })

  const newStepId = await createStepsForDef(prisma, instanceId, instance.orgId, nextStepDef, nextApproverId)

  // Notify next approver
  const contract = await prisma.contract.findUnique({ where: { id: instance.contractId } })
  const nextApprover = await prisma.user.findUnique({ where: { id: nextApproverId } })
  queueNotification({
    orgId:        instance.orgId,
    userId:       nextApproverId,
    type:         'APPROVAL_REQUEST',
    title:        'Contract awaiting your approval',
    body:         `"${contract?.title ?? 'Contract'}" requires your approval (${nextStepDef.name}).`,
    resourceType: 'approval_step',
    resourceId:   newStepId,
    email:        nextApprover?.email ?? undefined,
  })
}

// ─── Auto-approval check ─────────────────────────────────────────────────────
// Called before creating an instance. Returns true if the contract matches an
// auto-approve rule in the workflow's triggerRules.

export function checkAutoApprove(
  contractType: string,
  contractValue: number | null | undefined,
  triggerRules: Record<string, unknown>,
): boolean {
  const rules = (triggerRules.autoApproveRules as Array<{ contractType: string; maxValue: number }>) ?? []
  for (const rule of rules) {
    const typeMatch = rule.contractType === 'ANY' || rule.contractType === contractType
    // Wave 1.6 — fail CLOSED on unknown value. Previously `contractValue == null
    // || contractValue <= rule.maxValue` meant a contract with no value matched
    // ANY threshold and auto-approved — an editor could clear the value to skip
    // human approval entirely. An unknown value must route to human review.
    const valueMatch = contractValue != null && contractValue <= rule.maxValue
    if (typeMatch && valueMatch) return true
  }
  return false
}

// ─── Resolve approverId from a step definition ────────────────────────────────
// Exported so the submit-approval route can use the same logic when creating step 0.

export async function resolveApprover(
  stepDef: WorkflowStepDef,
  orgId: string,
  prisma: PrismaClient,
): Promise<string | null> {
  if (stepDef.approverId) return stepDef.approverId

  if (stepDef.roleRequired) {
    const userRole = await prisma.userRole.findFirst({
      where: {
        user: { orgId, deletedAt: null },
        role: { name: stepDef.roleRequired },
      },
      include: { user: true },
    })
    return userRole?.userId ?? null
  }

  return null
}
