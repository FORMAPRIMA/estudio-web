import { leerDetalles, leerInvitado, leerPlano } from './data'
import { aPublico } from './domain'
import type { InvitadoProps } from '@/components/recorrido/Invitado'

/** Datos de la pantalla del invitado. Solo campos públicos: nada de notas del guía. */
export async function datosInvitado(token: string): Promise<InvitadoProps> {
  const [detalles, plano, inv] = await Promise.all([leerDetalles(), leerPlano(), token ? leerInvitado(token) : Promise.resolve(null)])
  return {
    token: inv ? token : '',
    invitado: inv ? { nombre: inv.nombre, slot: inv.slot, grupo: inv.grupo } : null,
    detalles: detalles.map(aPublico),
    plano,
    ahoraServidor: Date.now(),
  }
}
