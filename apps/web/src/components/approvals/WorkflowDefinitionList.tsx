/**
 * WorkflowDefinitionList — Phase 06
 * Table of org workflow definitions with Edit / Set Default / Delete actions.
 * Edit opens a Sheet with WorkflowBuilder.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorkflowBuilder, type WorkflowStepDef } from './WorkflowBuilder'
import { Pencil, Star, Trash2, Loader2, Plus, CheckCircle2 } from 'lucide-react'

interface WorkflowDef {
  id:          string
  name:        string
  description: string | null
  steps:       WorkflowStepDef[]
  isDefault:   boolean
  isActive:    boolean
  triggerRules: Record<string, unknown>
}

export function WorkflowDefinitionList() {
  const queryClient = useQueryClient()
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDef | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftSteps, setDraftSteps] = useState<WorkflowStepDef[]>([])
  const [draftIsDefault, setDraftIsDefault] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const { data: workflows, isLoading } = useQuery<WorkflowDef[]>({
    queryKey: ['approval-workflows'],
    queryFn: () => api.get('/approvals/workflows').then(r => r.data),
  })

  const saveWorkflow = useMutation({
    mutationFn: (payload: { id?: string; name: string; description: string; steps: WorkflowStepDef[]; isDefault: boolean }) => {
      if (payload.id) {
        return api.patch(`/approvals/workflows/${payload.id}`, payload).then(r => r.data)
      }
      return api.post('/approvals/workflows', payload).then(r => r.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      setEditingWorkflow(null)
      setShowNew(false)
    },
  })

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/approvals/workflows/${id}`, { isDefault: true }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-workflows'] }),
  })

  const deleteWorkflow = useMutation({
    mutationFn: (id: string) => api.delete(`/approvals/workflows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-workflows'] }),
  })

  function openEdit(wf: WorkflowDef) {
    setEditingWorkflow(wf)
    setDraftName(wf.name)
    setDraftDesc(wf.description ?? '')
    setDraftSteps(wf.steps ?? [])
    setDraftIsDefault(wf.isDefault)
    setShowNew(false)
  }

  function openNew() {
    setEditingWorkflow(null)
    setDraftName('')
    setDraftDesc('')
    setDraftSteps([])
    setDraftIsDefault(false)
    setShowNew(true)
  }

  function handleSave() {
    if (!draftName.trim() || draftSteps.length === 0) return
    saveWorkflow.mutate({
      id:          editingWorkflow?.id,
      name:        draftName,
      description: draftDesc,
      steps:       draftSteps,
      isDefault:   draftIsDefault,
    })
  }

  const sheetOpen = !!editingWorkflow || showNew

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Workflow Definitions</h3>
        <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" />New Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : !workflows?.length ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg border-gray-200">
          <p className="text-sm text-gray-400 mb-3">No workflows yet. Create one to route approvals.</p>
          <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Create Workflow</Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Steps</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {workflows.map(wf => (
                <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{wf.name}</span>
                      {wf.isDefault && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          <Star className="h-3 w-3" />Default
                        </span>
                      )}
                    </div>
                    {wf.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{wf.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {Array.isArray(wf.steps) ? wf.steps.length : 0} step{(Array.isArray(wf.steps) ? wf.steps.length : 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                      wf.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {wf.isActive ? <><CheckCircle2 className="h-3 w-3" />Active</> : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(wf)} className="h-7 px-2 text-gray-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!wf.isDefault && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => setDefault.mutate(wf.id)}
                          disabled={setDefault.isPending}
                          className="h-7 px-2 text-amber-500"
                          title="Set as default"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (confirm(`Delete "${wf.name}"?`)) deleteWorkflow.mutate(wf.id) }}
                        className="h-7 px-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / New slide-over panel */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setEditingWorkflow(null); setShowNew(false) }}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-white shadow-xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">
                {editingWorkflow ? 'Edit Workflow' : 'New Workflow'}
              </h2>
              <button
                onClick={() => { setEditingWorkflow(null); setShowNew(false) }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Workflow name *</label>
                <Input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. Standard Contract Approval" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <Input value={draftDesc} onChange={e => setDraftDesc(e.target.value)} placeholder="Optional" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draftIsDefault}
                  onChange={e => setDraftIsDefault(e.target.checked)}
                  className="accent-blue-600"
                />
                Set as default workflow
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Approval steps *</label>
                <WorkflowBuilder steps={draftSteps} onChange={setDraftSteps} />
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t bg-gray-50">
              <Button
                onClick={handleSave}
                disabled={saveWorkflow.isPending || !draftName.trim() || draftSteps.length === 0}
                className="gap-1.5"
              >
                {saveWorkflow.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingWorkflow ? 'Save Changes' : 'Create Workflow'}
              </Button>
              <Button variant="outline" onClick={() => { setEditingWorkflow(null); setShowNew(false) }}>
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
