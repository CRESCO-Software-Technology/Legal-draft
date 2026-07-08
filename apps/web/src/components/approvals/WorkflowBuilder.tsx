/**
 * WorkflowBuilder — Phase 06
 * Visual builder for approval workflow step definitions.
 * Uses up/down buttons for ordering (no external drag-drop dependency).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, ChevronUp, ChevronDown, User } from 'lucide-react'

export interface WorkflowStepDef {
  order:            number
  name:             string
  approverId?:      string
  roleRequired?:    string
  // Wave 3.8 — plural approvers for parallel steps (N run concurrently).
  approverIds?:     string[]
  roleRequireds?:   string[]
  executionMode:    'sequential' | 'parallel'
  requiredApprovals: number
  dueSoonHours:     number
  escalateTo?:      string
}

interface Props {
  steps:    WorkflowStepDef[]
  onChange: (steps: WorkflowStepDef[]) => void
}

const SYSTEM_ROLES = ['ADMIN', 'LEGAL_COUNSEL', 'LEGAL_OPS', 'CONTRACT_MANAGER', 'FINANCE', 'APPROVER']

function newStep(order: number): WorkflowStepDef {
  return { order, name: '', approverId: undefined, roleRequired: undefined, executionMode: 'sequential', requiredApprovals: 1, dueSoonHours: 48 }
}

export function WorkflowBuilder({ steps, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })
  const users: Array<{ id: string; name: string; email: string }> = usersData?.data ?? usersData ?? []

  function update(idx: number, patch: Partial<WorkflowStepDef>) {
    const next = steps.map((s, i) => i === idx ? { ...s, ...patch } : s)
    onChange(next)
  }

  // Wave 3.8 — multi-approver toggles for parallel steps.
  function toggleApprover(idx: number, userId: string) {
    const cur = steps[idx].approverIds ?? []
    update(idx, { approverIds: cur.includes(userId) ? cur.filter(id => id !== userId) : [...cur, userId] })
  }
  function toggleRole(idx: number, role: string) {
    const cur = steps[idx].roleRequireds ?? []
    update(idx, { roleRequireds: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] })
  }

  function addStep() {
    const next = [...steps, newStep(steps.length)]
    onChange(next)
    setExpandedIdx(next.length - 1)
  }

  function removeStep(idx: number) {
    const next = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }))
    onChange(next)
    if (expandedIdx !== null && expandedIdx >= next.length) setExpandedIdx(next.length - 1)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...steps]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next.map((s, i) => ({ ...s, order: i })))
  }

  function moveDown(idx: number) {
    if (idx === steps.length - 1) return
    const next = [...steps]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next.map((s, i) => ({ ...s, order: i })))
  }

  if (steps.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed rounded-lg border-gray-200">
        <User className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400 mb-3">No approval steps yet</p>
        <Button size="sm" variant="outline" onClick={addStep}>
          <Plus className="h-4 w-4 mr-1.5" />Add First Step
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={idx} className="border rounded-lg overflow-hidden">
          {/* Step header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800 truncate">
              {step.name || <span className="text-gray-400">Untitled step</span>}
            </span>
            {step.executionMode === 'parallel' ? (
              (() => {
                const n = (step.approverIds?.length ?? 0)
                const roles = step.roleRequireds ?? []
                const label = [
                  n > 0 ? `${n} approver${n === 1 ? '' : 's'}` : null,
                  roles.length > 0 ? roles.join(', ') : null,
                ].filter(Boolean).join(' + ')
                return label
                  ? <span className="text-xs text-gray-500 hidden sm:block">{`${label} · ${step.requiredApprovals} required`}</span>
                  : null
              })()
            ) : (
              <>
                {step.approverId && (
                  <span className="text-xs text-gray-500 hidden sm:block">
                    {users.find(u => u.id === step.approverId)?.name ?? step.approverId}
                  </span>
                )}
                {step.roleRequired && !step.approverId && (
                  <span className="text-xs text-gray-500 hidden sm:block">{step.roleRequired}</span>
                )}
              </>
            )}
            <div className="flex items-center gap-0.5 ml-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30">
                <ChevronUp className="h-4 w-4 text-gray-500" />
              </button>
              <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30">
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              <button onClick={() => removeStep(idx)} className="p-0.5 rounded hover:bg-red-100 ml-1">
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </button>
            </div>
          </div>

          {/* Step body (expanded) */}
          {expandedIdx === idx && (
            <div className="px-4 py-3 space-y-3 border-t bg-white">
              {/* Step name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Step name</label>
                <Input
                  value={step.name}
                  onChange={e => update(idx, { name: e.target.value })}
                  placeholder="e.g. Legal Review, Finance Approval"
                  className="text-sm"
                />
              </div>

              {/* Approver(s). Sequential → one user OR role. Parallel → pick
                  the full set of concurrent approvers (users and/or roles). */}
              {step.executionMode === 'sequential' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Specific approver</label>
                    <select
                      value={step.approverId ?? ''}
                      onChange={e => update(idx, { approverId: e.target.value || undefined, roleRequired: e.target.value ? undefined : step.roleRequired })}
                      className="w-full rounded-md border border-gray-300 text-sm px-2.5 py-1.5 bg-white"
                    >
                      <option value="">— None —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Or by role</label>
                    <select
                      value={step.roleRequired ?? ''}
                      onChange={e => update(idx, { roleRequired: e.target.value || undefined, approverId: e.target.value ? undefined : step.approverId })}
                      className="w-full rounded-md border border-gray-300 text-sm px-2.5 py-1.5 bg-white"
                      disabled={!!step.approverId}
                    >
                      <option value="">— None —</option>
                      {SYSTEM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Approvers (all run concurrently — every user who holds a selected role is included)
                  </label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-gray-300 divide-y">
                    {users.length === 0 && <div className="px-2.5 py-2 text-xs text-gray-400">No users found</div>}
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={(step.approverIds ?? []).includes(u.id)}
                          onChange={() => toggleApprover(idx, u.id)}
                          className="accent-blue-600"
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SYSTEM_ROLES.map(r => {
                      const on = (step.roleRequireds ?? []).includes(r)
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRole(idx, r)}
                          className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${on ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Due hours + escalation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due in (hours)</label>
                  <Input
                    type="number"
                    min={1}
                    value={step.dueSoonHours}
                    onChange={e => update(idx, { dueSoonHours: Math.max(1, parseInt(e.target.value) || 48) })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Escalate to (on timeout)</label>
                  <select
                    value={step.escalateTo ?? ''}
                    onChange={e => update(idx, { escalateTo: e.target.value || undefined })}
                    className="w-full rounded-md border border-gray-300 text-sm px-2.5 py-1.5 bg-white"
                  >
                    <option value="">— No escalation —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Execution mode */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Execution mode</label>
                <div className="flex gap-3">
                  {(['sequential', 'parallel'] as const).map(mode => (
                    <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                      <input
                        type="radio"
                        name={`mode-${idx}`}
                        value={mode}
                        checked={step.executionMode === mode}
                        onChange={() => update(idx, {
                          executionMode: mode,
                          // Seed the parallel set from a previously-chosen single
                          // approver so switching modes doesn't lose the pick.
                          ...(mode === 'parallel' && !(step.approverIds?.length) && step.approverId
                            ? { approverIds: [step.approverId] }
                            : {}),
                        })}
                        className="accent-blue-600"
                      />
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </label>
                  ))}
                  {step.executionMode === 'parallel' && (
                    <div className="flex items-center gap-1.5 ml-4">
                      <span className="text-xs text-gray-500">Required approvals:</span>
                      <Input
                        type="number"
                        min={1}
                        value={step.requiredApprovals}
                        onChange={e => {
                          const raw = Math.max(1, parseInt(e.target.value) || 1)
                          // Cap at the explicit approver count when no roles are
                          // used (roles resolve to an unknown user count at run
                          // time; the server clamps then). Prevents an
                          // unsatisfiable "5 of 3".
                          const explicit = (step.approverIds ?? []).length
                          const hasRoles = (step.roleRequireds ?? []).length > 0
                          const capped = (!hasRoles && explicit > 0) ? Math.min(raw, explicit) : raw
                          update(idx, { requiredApprovals: capped })
                        }}
                        className="w-16 text-sm"
                      />
                      <span className="text-xs text-gray-400">
                        of {step.approverIds?.length ?? 0}{(step.roleRequireds?.length ?? 0) > 0 ? ' + role members' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addStep} className="w-full mt-1 gap-1.5 text-gray-600">
        <Plus className="h-4 w-4" />Add Step
      </Button>
    </div>
  )
}
