import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  UsersRound,
  X,
  AlertCircle,
  CalendarOff,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  roles: string[]
  lastActiveAt: string | null
  outOfOffice: boolean
  outOfOfficeUntil: string | null
  delegateToId: string | null
  activeContracts: number
  pendingApprovals: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function workloadColor(count: number): string {
  if (count < 5) return 'bg-green-500'
  if (count <= 10) return 'bg-yellow-500'
  return 'bg-red-500'
}

function workloadPercent(count: number): number {
  return Math.min(count / 15, 1) * 100
}

const ROLE_STYLES = 'bg-blue-50 text-blue-700 border border-blue-200'

// ─── Component ───────────────────────────────────────────────────────────────

export function TeamPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showOooModal, setShowOooModal] = useState(false)

  const qc = useQueryClient()

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['team-workload'],
    queryFn: () => api.get('/team/workload').then(r => r.data),
  })

  const team = members ?? []

  const handleSetOoo = (userId: string) => {
    setSelectedUserId(userId)
    setShowOooModal(true)
  }

  const selectedMember = team.find(m => m.id === selectedUserId)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            Team Workload
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor team capacity, workload, and out-of-office status.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedUserId(null)
            setShowOooModal(true)
          }}
          variant="outline"
          className="gap-2"
        >
          <CalendarOff className="h-4 w-4" />
          Set OOO
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <UsersRound className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No team members found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.map(member => (
            <div
              key={member.id}
              className="bg-white rounded-xl border shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow"
            >
              {/* Avatar + Info */}
              <div className="flex items-start gap-3">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {getInitials(member.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {member.name}
                    </p>
                    {member.outOfOffice && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 shrink-0">
                        OOO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{member.email}</p>
                  {member.outOfOffice && member.outOfOfficeUntil && (
                    <p className="text-[11px] text-orange-600 mt-0.5">
                      Returns {new Date(member.outOfOfficeUntil).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSetOoo(member.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                  title="Set out-of-office"
                >
                  <CalendarOff className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Role badges */}
              <div className="flex flex-wrap gap-1">
                {member.roles.map(role => (
                  <span
                    key={role}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ROLE_STYLES}`}
                  >
                    {role}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span>
                  <span className="font-semibold text-gray-900">{member.activeContracts}</span>{' '}
                  contracts
                </span>
                <span>
                  <span className="font-semibold text-gray-900">{member.pendingApprovals}</span>{' '}
                  approvals pending
                </span>
              </div>

              {/* Workload bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span>Workload</span>
                  <span>{member.activeContracts} active</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${workloadColor(member.activeContracts)}`}
                    style={{ width: `${workloadPercent(member.activeContracts)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OOO Modal */}
      {showOooModal && (
        <OooModal
          members={team}
          selectedMember={selectedMember ?? null}
          onClose={() => {
            setShowOooModal(false)
            setSelectedUserId(null)
          }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['team-workload'] })
            setShowOooModal(false)
            setSelectedUserId(null)
          }}
        />
      )}
    </div>
  )
}

// ─── OOO Modal ───────────────────────────────────────────────────────────────

function OooModal({
  members,
  selectedMember,
  onClose,
  onSuccess,
}: {
  members: TeamMember[]
  selectedMember: TeamMember | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [userId, setUserId] = useState(selectedMember?.id ?? '')
  const [outOfOffice, setOutOfOffice] = useState(selectedMember?.outOfOffice ?? true)
  const [returnDate, setReturnDate] = useState(
    selectedMember?.outOfOfficeUntil
      ? new Date(selectedMember.outOfOfficeUntil).toISOString().split('T')[0]
      : ''
  )
  const [delegateId, setDelegateId] = useState(selectedMember?.delegateToId ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (body: { outOfOffice: boolean; outOfOfficeUntil: string | null; delegateToId: string | null }) =>
      api.patch(`/team/${userId}/ooo`, body).then(r => r.data),
    onSuccess,
    onError: (err: any) => {
      setError(err.response?.data?.detail ?? 'Failed to update out-of-office status')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!userId) return setError('Please select a team member')
    mutation.mutate({
      outOfOffice,
      outOfOfficeUntil: returnDate || null,
      delegateToId: delegateId || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Set Out-of-Office</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* User selector */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Team Member *</Label>
            <select
              value={userId}
              onChange={e => {
                setUserId(e.target.value)
                const m = members.find(x => x.id === e.target.value)
                if (m) {
                  setOutOfOffice(m.outOfOffice || true)
                  setReturnDate(
                    m.outOfOfficeUntil
                      ? new Date(m.outOfOfficeUntil).toISOString().split('T')[0]
                      : ''
                  )
                  setDelegateId(m.delegateToId ?? '')
                }
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={outOfOffice}
                onChange={e => setOutOfOffice(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Mark as out-of-office</span>
            </label>
          </div>

          {/* Return date */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Return Date</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
            />
          </div>

          {/* Delegate */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Delegate To</Label>
            <select
              value={delegateId}
              onChange={e => setDelegateId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {members
                .filter(m => m.id !== userId)
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} className="gap-2">
            <CalendarOff className="h-4 w-4" />
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
