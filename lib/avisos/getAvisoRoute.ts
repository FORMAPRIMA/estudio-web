export type LinkeableType =
  | 'factura'
  | 'marketing_post'
  | 'contrato'
  | 'propuesta'
  | 'due_diligencia'

const ROUTES: Record<LinkeableType, (id: string) => string> = {
  contrato:       id => `/team/captacion/contratos/${id}`,
  propuesta:      id => `/team/captacion/propuestas/${id}`,
  factura:        () => `/team/finanzas/facturacion/control`,
  marketing_post: () => `/team/marketing/post-manager`,
  due_diligencia: () => `/team/captacion/due-diligencia`,
}

export function getAvisoRoute(type: string | null, id: string | null): string | null {
  if (!type || !id) return null
  return ROUTES[type as LinkeableType]?.(id) ?? null
}

export function generateLinkLabel(type: LinkeableType | null | undefined): string {
  const labels: Record<LinkeableType, string> = {
    factura:        'Ver en facturación',
    marketing_post: 'Revisar post',
    contrato:       'Ver contrato',
    propuesta:      'Ver propuesta',
    due_diligencia: 'Ver due diligence',
  }
  return (type && labels[type]) ? labels[type] : 'Ver detalles'
}
