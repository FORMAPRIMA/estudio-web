import type { FpRole } from '@/lib/types'

// Default visible_roles value for financial/billing notifications (partner-only)
export const VISIBLE_ROLES_FINANZAS: FpRole[] = ['fp_partner']

// Default visible_roles value for general team notifications
export const VISIBLE_ROLES_EQUIPO: FpRole[] = ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev']

/**
 * Returns whether an aviso with the given visible_roles should be shown to a role.
 * null / empty = legacy aviso with no restriction, visible to all (backward compatible).
 */
export function esAvisoVisiblePara(
  visibleRoles: string[] | null | undefined,
  rol: FpRole,
): boolean {
  if (!visibleRoles || visibleRoles.length === 0) return true
  return visibleRoles.includes(rol)
}
