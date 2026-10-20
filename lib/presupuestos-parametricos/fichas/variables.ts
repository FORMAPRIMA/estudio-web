// Catálogo de variables que piden las fichas. Una variable se define una sola
// vez aunque la usen varios capítulos (la superficie útil la usan casi todos).
// El código es la clave de pp_obra_mediciones.variable: NO renombrar.

import type { Variable } from './tipos'

export const VARIABLES: Variable[] = [
  // ── Express: lo sabe cualquier propietario ─────────────────────────────────
  { codigo: 'sup_construida', nombre: 'Superficie construida', unidad: 'm²', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántos metros construidos tiene la vivienda?',
    ayuda: 'La de la nota simple o el anuncio. El arquitecto la sustituye por la medida real.' },
  { codigo: 'sup_util', nombre: 'Superficie útil', unidad: 'm²', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántos metros útiles tiene?',
    ayuda: 'Si no se sabe, se estima como el 85 % de la construida.' },
  { codigo: 'planta', nombre: 'Planta', unidad: 'nº', tipo: 'numero', nivel: 'express',
    pregunta: '¿En qué planta está? (bajo = 0)' },
  { codigo: 'ascensor_obra', nombre: 'Ascensor utilizable en obra', unidad: '', tipo: 'si_no', nivel: 'express',
    pregunta: '¿Se podrá usar el ascensor del edificio durante la obra?',
    ayuda: 'Depende de los estatutos de la comunidad y del tamaño de la cabina.' },
  { codigo: 'n_estancias', nombre: 'Estancias', unidad: 'ud', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántas estancias tiene, sin contar baños, cocina ni pasillos?' },
  { codigo: 'n_banos', nombre: 'Baños completos', unidad: 'ud', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántos baños completos (con ducha o bañera)?' },
  { codigo: 'n_aseos', nombre: 'Aseos', unidad: 'ud', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántos aseos (solo lavabo e inodoro)?' },
  { codigo: 'n_cocinas', nombre: 'Cocinas', unidad: 'ud', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántas cocinas?', defecto: 1 },
  { codigo: 'n_ventanas', nombre: 'Ventanas', unidad: 'ud', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántas ventanas y balconeras tiene?' },
  { codigo: 'n_puertas', nombre: 'Puertas de paso', unidad: 'ud', tipo: 'numero', nivel: 'express',
    pregunta: '¿Cuántas puertas interiores tiene?',
    ayuda: 'Si no se sabe, se estima como estancias + baños + aseos + cocina.' },
  { codigo: 'falsos_techos', nombre: 'Falsos techos existentes', unidad: '', tipo: 'opcion', nivel: 'express',
    pregunta: '¿La vivienda tiene falsos techos?',
    opciones: [
      { value: 'todos', label: 'En toda la vivienda' },
      { value: 'algunos', label: 'En algunas estancias' },
      { value: 'ninguno', label: 'No, o no lo sé' },
    ] },

  // ── Técnico: el arquitecto lo mide en poco tiempo ──────────────────────────
  { codigo: 'altura_libre', nombre: 'Altura libre', unidad: 'm', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'Altura de suelo acabado a cara inferior del forjado',
    ayuda: 'Una medida representativa. Si hay alturas muy distintas, la media ponderada.', defecto: 2.6 },
  { codigo: 'acceso_facil', nombre: 'Acceso fácil desde la calle', unidad: '', tipo: 'si_no', nivel: 'tecnico',
    pregunta: '¿Se puede cargar y descargar con facilidad?',
    ayuda: 'Calle con sitio para contenedor o camión, portal amplio o portal de servicio. «No» si hay que pedir permisos especiales o subir a mano por una escalera estrecha.' },
  { codigo: 'ml_tabique_demoler', nombre: 'Tabiquería a demoler', unidad: 'ml', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'Metros lineales de tabique a demoler',
    ayuda: 'Longitud en planta sin descontar huecos. La superficie se calcula con la altura libre.' },
  { codigo: 'm2_suelo_levantar', nombre: 'Pavimento a levantar', unidad: 'm²', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'Metros cuadrados de suelo a levantar',
    ayuda: 'En una integral suele ser toda la superficie útil.' },
  { codigo: 'm2_alicatado_levantar', nombre: 'Alicatado a picar', unidad: 'm²', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'Metros cuadrados de alicatado a picar (baños y cocina)' },
  { codigo: 'm2_falso_techo_demoler', nombre: 'Falso techo a demoler', unidad: 'm²', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'Metros cuadrados de falso techo a demoler',
    ayuda: 'Solo techos descolgados. No cuenta el yeso directo a forjado.' },
  { codigo: 'n_ventanas_grandes', nombre: 'Ventanas de suelo a techo', unidad: 'ud', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'De esas ventanas, ¿cuántas son balconeras o de suelo a techo?' },
  { codigo: 'n_armarios_demoler', nombre: 'Armarios empotrados a desmontar', unidad: 'ud', tipo: 'numero', nivel: 'tecnico',
    pregunta: 'Armarios empotrados a desmontar',
    ayuda: 'Por armario completo, no por módulo.' },
]

const POR_CODIGO = new Map(VARIABLES.map(v => [v.codigo, v]))

export function variable(codigo: string): Variable {
  const v = POR_CODIGO.get(codigo)
  if (!v) throw new Error(`Variable desconocida: ${codigo}`)
  return v
}
