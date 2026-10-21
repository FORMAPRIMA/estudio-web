// Orden de las pantallas del dossier de prospección por perfil. Es un resumen
// ejecutivo: lo justo para conseguir la reunión; el resto va en la versión
// extendida que se enseña en ella. El mismo orden lo usa el panel de Salas para
// el mapa de calor (las etiquetas son las de la medición).

import type { Perfil } from './textos'

export type PantallaId =
  | 'portada' | 'estudio' | 'mapa' | 'obra' | 'equipo'
  | 'producto' | 'ejecucion' | 'colaboracion'
  | 'maqueta' | 'dossier' | 'vr' | 'portal' | 'portalvideo'
  | 'porque' | 'hablemos'

export const ETIQUETA: Record<PantallaId, string> = {
  portada: 'Portada', estudio: 'El estudio', mapa: 'Mapa de obra', obra: 'Obra seleccionada', equipo: 'Equipo',
  producto: 'Producto residencial', ejecucion: 'Proyecto de ejecución', colaboracion: 'Colaboración en obra',
  maqueta: 'Maqueta digital', dossier: 'Dossier digital', vr: 'Realidad virtual', portal: 'Portal de cliente', portalvideo: 'Portal · vídeo',
  porque: 'Por qué Forma Prima', hablemos: 'Hablemos',
}

const TRONCO: PantallaId[] = ['portada', 'estudio', 'mapa', 'obra', 'equipo']
const CIERRE: PantallaId[] = ['porque', 'hablemos']

export const PANTALLAS: Record<Perfil, PantallaId[]> = {
  // Al developer le interesa vender: producto primero y después las herramientas comerciales.
  developer: [...TRONCO, 'producto', 'maqueta', 'dossier', 'vr', 'portal', 'portalvideo', ...CIERRE],
  // A la constructora, que la obra se construya sin dudas: ejecución, portal y obra; lo comercial, como valor añadido.
  constructora: [...TRONCO, 'ejecucion', 'portal', 'portalvideo', 'colaboracion', 'maqueta', 'dossier', 'vr', ...CIERRE],
}

export const etiquetasPara = (perfil: Perfil) => PANTALLAS[perfil].map((p) => ETIQUETA[p])
