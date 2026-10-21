// Ventanas y balconeras de fachada: qué se cambia y con qué medidas.
//
// El ancho sale medido de la maqueta; el alto y el antepecho, por defecto según el
// tipo (un plano no da alturas) y el arquitecto los corrige en los alzados. Cada
// ventana se elige una a una: se cambia o no, con persiana o sin ella.

import { ALTURAS_HUECO, dist, type ModeloEstadoActual, type Hueco } from './modelo'

export type EleccionVentana = { cambiar: boolean; persiana: boolean; alto?: number; antepecho?: number }
export type Elecciones = Record<string, EleccionVentana>

export type VentanaFachada = { hueco: Hueco; ancho: number; alto: number; antepecho: number; eleccion: EleccionVentana }

export const ELECCION_DEFECTO: EleccionVentana = { cambiar: true, persiana: false }

export function ventanasFachada(m: ModeloEstadoActual, elecciones: Elecciones = {}): VentanaFachada[] {
  const ext = new Set(m.muros.filter(w => w.tipo === 'exterior').map(w => w.id))
  return m.huecos
    .filter(h => (h.tipo === 'ventana' || h.tipo === 'balconera') && ext.has(h.muro))
    .map(h => {
      const e = elecciones[h.id] ?? ELECCION_DEFECTO
      const def = ALTURAS_HUECO[h.tipo]
      return {
        hueco: h,
        ancho: dist(h.a, h.b) / m.escala.pxPorMetro,
        alto: e.alto ?? Math.min(def.alto, m.alturaLibre - def.antepecho),
        antepecho: e.antepecho ?? def.antepecho,
        eleccion: e,
      }
    })
    .sort((a, b) => a.hueco.id.localeCompare(b.hueco.id, 'es', { numeric: true }))
}

export function medicionesVentanas(m: ModeloEstadoActual, elecciones: Elecciones = {}) {
  const vs = ventanasFachada(m, elecciones)
  const cambian = vs.filter(v => v.eleccion.cambiar)
  return {
    m2_ventanas_cambiar: Math.round(cambian.reduce((s, v) => s + v.ancho * v.alto, 0) * 100) / 100,
    n_ventanas_cambiar: cambian.length,
    n_persianas: cambian.filter(v => v.eleccion.persiana).length,
    total: vs.length,
  }
}
