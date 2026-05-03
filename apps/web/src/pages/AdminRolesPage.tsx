import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShieldCheck, ChevronRight, Lock, EyeOff, Eye } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Permission {
  action: string
  resource: string
  scope: string
}

interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
  isSystem: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminRolesPage() {
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  // B.6.22 — show not-yet-configured roles by default but let admins
  // hide them so the list is tidy for operating use.
  const [showUnconfigured, setShowUnconfigured] = useState(true)

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/admin/users/roles').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { visibleRoles, unconfiguredCount } = useMemo(() => {
    const all = roles ?? []
    const unconfigured = all.filter((r) => r.permissions.length === 0).length
    const filtered = showUnconfigured ? all : all.filter((r) => r.permissions.length > 0)
    return { visibleRoles: filtered, unconfiguredCount: unconfigured }
  }, [roles, showUnconfigured])

  const toggleRole = (roleId: string) => {
    setExpandedRoleId(prev => (prev === roleId ? null : roleId))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Roles &amp; Permissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View system roles and their associated permissions. Custom role editing is coming soon.
          </p>
        </div>
        {unconfiguredCount > 0 && (
          <button
            onClick={() => setShowUnconfigured((v) => !v)}
            data-testid="toggle-unconfigured"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent shrink-0"
            title={showUnconfigured
              ? 'Hide roles with no permissions yet'
              : 'Show roles with no permissions yet'}
          >
            {showUnconfigured
              ? <><EyeOff className="h-3.5 w-3.5" /> Hide {unconfiguredCount} unconfigured</>
              : <><Eye className="h-3.5 w-3.5" /> Show {unconfiguredCount} unconfigured</>}
          </button>
        )}
      </div>

      {/* Roles list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : !roles || roles.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <ShieldCheck className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No roles configured</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm divide-y">
          {visibleRoles.map(role => {
            const isExpanded = expandedRoleId === role.id
            const unconfigured = role.permissions.length === 0
            return (
              <div key={role.id} className={unconfigured ? 'bg-muted/20' : undefined}>
                <button
                  onClick={() => toggleRole(role.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <ChevronRight
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${unconfigured ? 'text-gray-500' : 'text-gray-900'}`}>{role.name}</p>
                      {role.isSystem && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                          <Lock className="h-2.5 w-2.5" />
                          System
                        </span>
                      )}
                      {unconfigured && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                          Not yet configured
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Expanded permissions */}
                {isExpanded && (
                  <div className="px-5 pb-4 pl-14">
                    {role.permissions.length === 0 ? (
                      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
                        <strong className="font-semibold">No permissions yet.</strong>{' '}
                        This role exists so you can plan for the seat, but it
                        hasn't been granted any permissions. Assigning it
                        today gives the user the same access as no role at
                        all. Custom role editing (to add permissions here)
                        lands with v1.1.
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg border p-3">
                        <table className="w-full">
                          <thead>
                            <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              <th className="text-left pb-2 pr-4">Action</th>
                              <th className="text-left pb-2 pr-4">Resource</th>
                              <th className="text-left pb-2">Scope</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {role.permissions.map((perm, i) => (
                              <tr key={i}>
                                <td className="py-1.5 pr-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    {perm.action}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                    {perm.resource}
                                  </span>
                                </td>
                                <td className="py-1.5">
                                  <span className="text-xs text-gray-600">{perm.scope}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
