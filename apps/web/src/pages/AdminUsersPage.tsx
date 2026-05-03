import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users,
  UserPlus,
  X,
  AlertCircle,
  Search,
  MoreVertical,
  Copy,
  Check,
  Link2,
} from 'lucide-react'
import type { User } from '@clm/types'
import { SystemRole } from '@clm/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INVITED: 'bg-yellow-100 text-yellow-700',
  DEACTIVATED: 'bg-red-100 text-red-700',
}

const ROLE_STYLES = 'bg-blue-50 text-blue-700 border border-blue-200'

const ALL_ROLES = Object.values(SystemRole)

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string; inviteToken: string } | null>(null)
  const [search, setSearch] = useState('')
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null)
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ top: number; right: number } | null>(null)
  const [roleDropdownUserId, setRoleDropdownUserId] = useState<string | null>(null)
  const [roleDropdownAnchor, setRoleDropdownAnchor] = useState<{ top: number; right: number } | null>(null)

  const qc = useQueryClient()

  // Close menus on outside click
  useEffect(() => {
    if (!actionMenuUserId && !roleDropdownUserId) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-action-menu]') || target.closest('[data-role-selector]')) return
      setActionMenuUserId(null)
      setRoleDropdownUserId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [actionMenuUserId, roleDropdownUserId])

  // Close menus on scroll
  useEffect(() => {
    if (!actionMenuUserId && !roleDropdownUserId) return
    const handler = () => {
      setActionMenuUserId(null)
      setRoleDropdownUserId(null)
    }
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [actionMenuUserId, roleDropdownUserId])

  // Fetch users
  const { data: usersData, isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  // Mutations
  const inviteUser = useMutation({
    mutationFn: (body: { email: string; name: string; roles: string[] }) =>
      api.post('/admin/users/invite', body).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowInviteModal(false)
      setInviteResult({ email: data.email, inviteToken: data.inviteToken })
    },
  })

  const updateRoles = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      api.patch(`/admin/users/${userId}/roles`, { roles }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setRoleDropdownUserId(null)
    },
  })

  const deactivateUser = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/admin/users/${userId}/deactivate`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setActionMenuUserId(null)
    },
  })

  const reactivateUser = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/admin/users/${userId}/reactivate`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setActionMenuUserId(null)
    },
  })

  const handleActionClick = useCallback((userId: string, buttonEl: HTMLButtonElement) => {
    if (actionMenuUserId === userId) {
      setActionMenuUserId(null)
      return
    }
    const rect = buttonEl.getBoundingClientRect()
    setActionMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setActionMenuUserId(userId)
    setRoleDropdownUserId(null)
  }, [actionMenuUserId])

  const handleChangeRoles = useCallback((userId: string) => {
    // Reuse the same anchor position as the action menu
    setRoleDropdownAnchor(actionMenuAnchor)
    setRoleDropdownUserId(userId)
    setActionMenuUserId(null)
  }, [actionMenuAnchor])

  const users = usersData ?? []
  const filteredUsers = search
    ? users.filter(
        u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users

  const activeUser = filteredUsers.find(u => u.id === actionMenuUserId)
  const roleUser = filteredUsers.find(u => u.id === roleDropdownUserId)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage users, roles, and permissions for your organization.
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Invite Link Banner */}
      {inviteResult && (
        <InviteLinkBanner
          email={inviteResult.email}
          inviteToken={inviteResult.inviteToken}
          onDismiss={() => setInviteResult(null)}
        />
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No users found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? 'Try a different search term.' : 'Invite your first team member to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Email
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Roles
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Last Active
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_STYLES[user.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ROLE_STYLES}`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {user.lastActiveAt
                      ? new Date(user.lastActiveAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={e => handleActionClick(user.id, e.currentTarget)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action menu — rendered as portal so it's not clipped by table overflow */}
      {actionMenuUserId && activeUser && actionMenuAnchor && createPortal(
        <div
          data-action-menu
          className="fixed w-48 bg-white rounded-lg border shadow-lg z-50 py-1"
          style={{ top: actionMenuAnchor.top, right: actionMenuAnchor.right }}
        >
          <button
            onClick={() => handleChangeRoles(actionMenuUserId)}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Change Roles
          </button>
          {(activeUser.status as string) === 'DEACTIVATED' ? (
            <button
              onClick={() => reactivateUser.mutate(actionMenuUserId)}
              className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50"
            >
              Reactivate
            </button>
          ) : (
            <button
              onClick={() => deactivateUser.mutate(actionMenuUserId)}
              className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Deactivate
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Role selector — rendered as portal */}
      {roleDropdownUserId && roleUser && roleDropdownAnchor && createPortal(
        <div
          data-role-selector
          className="fixed w-56 bg-white rounded-lg border shadow-lg z-50 p-3"
          style={{ top: roleDropdownAnchor.top, right: roleDropdownAnchor.right }}
        >
          <RoleSelector
            currentRoles={roleUser.roles as string[]}
            onSave={roles => updateRoles.mutate({ userId: roleDropdownUserId, roles })}
            onCancel={() => setRoleDropdownUserId(null)}
            isPending={updateRoles.isPending}
          />
        </div>,
        document.body
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onSubmit={data => inviteUser.mutate(data)}
          isPending={inviteUser.isPending}
          error={
            inviteUser.error
              ? (inviteUser.error as any).response?.data?.detail ?? 'Failed to invite user'
              : undefined
          }
        />
      )}
    </div>
  )
}

// ─── Role Selector ────────────────────────────────────────────────────────────

function RoleSelector({
  currentRoles,
  onSave,
  onCancel,
  isPending,
}: {
  currentRoles: string[]
  onSave: (roles: string[]) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [selected, setSelected] = useState<string[]>([...currentRoles])

  const toggle = (role: string) => {
    setSelected(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  return (
    <>
      <p className="text-xs font-semibold text-gray-500 mb-2">Select Roles</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {ALL_ROLES.map(role => (
          <label
            key={role}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(role)}
              onChange={() => toggle(role)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">{role}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(selected)}
          disabled={isPending || selected.length === 0}
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </>
  )
}

// ─── Invite Link Banner ──────────────────────────────────────────────────────

function InviteLinkBanner({
  email,
  inviteToken,
  onDismiss,
}: {
  email: string
  inviteToken: string
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/accept-invite/${inviteToken}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
      <Link2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900">
          Invitation sent to {email}
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Share this link with them to accept the invite:
        </p>
        <div className="flex items-center gap-2 mt-2">
          <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 text-blue-800 truncate block flex-1">
            {inviteUrl}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="flex-shrink-0 gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded text-blue-400 hover:text-blue-600 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Invite User Modal ────────────────────────────────────────────────────────

function InviteUserModal({
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  onClose: () => void
  onSubmit: (data: { email: string; name: string; roles: string[] }) => void
  isPending: boolean
  error?: string
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [formError, setFormError] = useState('')

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  const handleSubmit = () => {
    setFormError('')
    if (!email.trim()) return setFormError('Email is required')
    if (!name.trim()) return setFormError('Name is required')
    if (selectedRoles.length === 0) return setFormError('Select at least one role')
    onSubmit({ email, name, roles: selectedRoles })
  }

  const displayError = error || formError

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Invite User</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Email *</Label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Name *</Label>
            <Input
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Roles *</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {ALL_ROLES.map(role => (
                <label
                  key={role}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-xs text-gray-700">{role}</span>
                </label>
              ))}
            </div>
          </div>

          {displayError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{displayError}</p>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {isPending ? 'Inviting...' : 'Send Invite'}
          </Button>
        </div>
      </div>
    </div>
  )
}
