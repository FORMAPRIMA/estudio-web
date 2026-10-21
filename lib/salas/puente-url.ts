// Direcciones de internal y de Salas vistas la una desde la otra (local o
// producción). Sin secretos: lo usa también la pantalla de entrada de Salas.

/** Dirección del panel de Salas vista desde el host de internal. */
export function urlSalas(hostInternal: string): string {
  const h = hostInternal.toLowerCase()
  if (h.startsWith('localhost') || h.startsWith('127.0.0.1')) return `http://salas.localhost:${h.split(':')[1] ?? '3000'}`
  return 'https://salas.formaprima.es'
}

/** Y al revés: internal visto desde Salas. */
export function urlInternal(hostSalas: string): string {
  const h = hostSalas.toLowerCase()
  if (h.includes('.localhost')) return `http://localhost:${h.split(':')[1] ?? '3000'}`
  return 'https://internal.formaprima.es'
}
