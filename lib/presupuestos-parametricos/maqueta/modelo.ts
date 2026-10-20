// Maqueta del estado actual — modelo mínimo de la vivienda.
//
// Es la fuente de verdad del flujo: la IA lo levanta desde el plano, la persona
// lo corrige (a mano o por chat) y le da el visto bueno, y las mediciones de las
// fichas salen de aquí. La maqueta 3D (y su GLB) se GENERA desde este modelo; los
// cálculos nunca leen el GLB.
//
// Solo se modela lo que piden los cálculos: muros (y si son estructurales),
// huecos, estancias con su uso, falsos techos y altura libre. Nada de muebles.
//
// Coordenadas en PÍXELES del plano original (y hacia abajo). `pxPorMetro`
// convierte. Así el modelo y el plano nunca se desalinean.

export type Punto = { x: number; y: number }

export type TipoMuro = 'exterior' | 'tabique' | 'estructural'
export type TipoHueco = 'ventana' | 'balconera' | 'puerta' | 'entrada'
export type UsoEstancia = 'bano' | 'aseo' | 'cocina' | 'estancia' | 'paso' | 'exterior'

export type Muro = {
  id: string                     // 'M1'
  a: Punto
  b: Punto
  tipo: TipoMuro
  grosorPx: number
  /** La IA lo marcó como probable estructural. Protegido hasta que alguien lo confirme o lo desmarque. */
  estructuralProbable?: boolean
  nota?: string | null
}

export type Hueco = {
  id: string                     // 'V1' ventanas y balconeras · 'P1' puertas · 'E1' entrada
  tipo: TipoHueco
  muro: string                   // id del muro
  a: Punto
  b: Punto
}

export type Estancia = {
  id: string                     // 'S1'
  nombre: string
  uso: UsoEstancia
  poligono: Punto[]
  falsoTecho: boolean
  /** Armarios empotrados en la estancia. Solo se cuentan, no se modelan. */
  armarios?: number
}

export type OpcionDuda = {
  etiqueta: string               // «Sí, es balconera»
  operaciones: Operacion[]       // lo que se aplica al elegirla (vacío = dejarlo como está)
}

export type Duda = {
  id: string                     // 'D1'
  /** Elementos a los que se refiere (muros, huecos, estancias). Vacío = duda general. */
  elementos: string[]
  pregunta: string
  opciones: OpcionDuda[]
  origen: 'ia' | 'sistema'
  estado: 'pendiente' | 'resuelta'
  respuesta?: string | null
}

export type ModeloEstadoActual = {
  version: number
  imagen: { ancho: number; alto: number }
  escala: {
    pxPorMetro: number
    metodo: 'superficie' | 'cota'
    detalle: string              // «114 m² construidos ÷ contorno» · «cota 6,61 m = 680 px»
  }
  contorno: Punto[]              // borde exterior de fachadas y medianeras
  alturaLibre: number            // m
  muros: Muro[]
  huecos: Hueco[]
  estancias: Estancia[]
  avisos: string[]
  /** Dudas ancladas a elementos, con respuestas de un clic. Las resueltas se conservan como traza. */
  dudas: Duda[]
  /** La IA cree que el plano es un estado reformado o una propuesta, no el actual. */
  dudaEstadoActual: boolean
}

// ── Geometría ────────────────────────────────────────────────────────────────

export const dist = (a: Punto, b: Punto) => Math.hypot(b.x - a.x, b.y - a.y)

export function areaPoligono(p: Punto[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export function perimetro(p: Punto[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) s += dist(p[i], p[(i + 1) % p.length])
  return s
}

export function centroide(p: Punto[]): Punto {
  return { x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length }
}

/** Posición (0..1) de un punto proyectado sobre un segmento. */
export function proyeccion(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy || 1
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
}

// ── Alturas de huecos (convención de la maqueta, no se piden) ────────────────

export const ALTURAS_HUECO: Record<TipoHueco, { antepecho: number; alto: number }> = {
  ventana:   { antepecho: 0.9, alto: 1.2 },
  balconera: { antepecho: 0,   alto: 2.2 },
  puerta:    { antepecho: 0,   alto: 2.03 },
  entrada:   { antepecho: 0,   alto: 2.1 },
}

// ── Mediciones para las fichas ───────────────────────────────────────────────

/** Alturas de alicatado que se suponen al demoler (m). */
export const ALICATADO = {
  bano: { altura: 2.2, nota: 'baños y aseos alicatados hasta ~2,2 m' },
  cocina: { altura: 1.2, nota: 'cocinas: media entre frente de encimera (0,6) y alicatado completo antiguo' },
}

export type MedicionesModelo = {
  valores: Record<string, number>
  detalle: { variable: string; valor: number; unidad: string; formula: string }[]
}

export function medicionesDesdeModelo(m: ModeloEstadoActual): MedicionesModelo {
  const ppm = m.escala.pxPorMetro
  const m1 = (px: number) => px / ppm
  const m2 = (px2: number) => px2 / (ppm * ppm)
  const H = m.alturaLibre
  const interiores = m.estancias.filter(e => e.uso !== 'exterior')
  const det: MedicionesModelo['detalle'] = []
  const v: Record<string, number> = {}
  const set = (variable: string, valor: number, unidad: string, formula: string) => {
    v[variable] = valor
    det.push({ variable, valor, unidad, formula })
  }
  const r2 = (n: number) => Math.round(n * 100) / 100

  set('sup_construida', r2(m2(areaPoligono(m.contorno))), 'm²', 'área del contorno exterior')
  const util = interiores.reduce((s, e) => s + m2(areaPoligono(e.poligono)), 0)
  set('sup_util', r2(util), 'm²', `suma de ${interiores.length} estancias interiores`)
  set('altura_libre', H, 'm', 'altura confirmada en la maqueta')

  const tabiques = m.muros.filter(w => w.tipo === 'tabique')
  const mlTab = tabiques.reduce((s, w) => s + m1(dist(w.a, w.b)), 0)
  set('ml_tabique_demoler', r2(mlTab), 'ml', `${tabiques.length} tabiques (sin exteriores ni estructurales)`)

  set('m2_suelo_levantar', r2(util), 'm²', 'toda la superficie útil (reforma integral)')

  const humedas = interiores.filter(e => e.uso === 'bano' || e.uso === 'aseo')
  const cocinas = interiores.filter(e => e.uso === 'cocina')
  const alic =
    humedas.reduce((s, e) => s + m1(perimetro(e.poligono)) * Math.min(ALICATADO.bano.altura, H), 0) +
    cocinas.reduce((s, e) => s + m1(perimetro(e.poligono)) * Math.min(ALICATADO.cocina.altura, H), 0)
  set('m2_alicatado_levantar', r2(alic), 'm²', `perímetro de baños × ${ALICATADO.bano.altura} m + cocinas × ${ALICATADO.cocina.altura} m`)

  const ft = interiores.filter(e => e.falsoTecho).reduce((s, e) => s + m2(areaPoligono(e.poligono)), 0)
  set('m2_falso_techo_demoler', r2(ft), 'm²', 'estancias marcadas con falso techo')

  const nVentanas = m.huecos.filter(h => h.tipo === 'ventana' || h.tipo === 'balconera').length
  const nBalconeras = m.huecos.filter(h => h.tipo === 'balconera').length
  const nPuertas = m.huecos.filter(h => h.tipo === 'puerta' || h.tipo === 'entrada').length
  set('n_ventanas', nVentanas, 'ud', 'ventanas + balconeras')
  set('n_ventanas_grandes', nBalconeras, 'ud', 'balconeras')
  set('n_puertas', nPuertas, 'ud', 'puertas interiores + entrada')
  set('n_armarios_demoler', interiores.reduce((s, e) => s + (e.armarios ?? 0), 0), 'ud', 'armarios empotrados contados por estancia')

  set('n_banos', humedas.filter(e => e.uso === 'bano').length, 'ud', 'estancias de uso baño')
  set('n_aseos', humedas.filter(e => e.uso === 'aseo').length, 'ud', 'estancias de uso aseo')
  set('n_cocinas', cocinas.length, 'ud', 'estancias de uso cocina')
  set('n_estancias', interiores.filter(e => e.uso === 'estancia').length, 'ud', 'dormitorios, salón y similares')

  return { valores: v, detalle: det }
}

// ── Operaciones de edición (las usan la UI y la IA de correcciones) ──────────

export type Operacion =
  | { op: 'actualizar_muro'; id: string; tipo?: TipoMuro; a?: Punto; b?: Punto }
  | { op: 'eliminar_muro'; id: string }
  | { op: 'confirmar_estructural'; id: string }
  | { op: 'crear_muro'; tipo: TipoMuro; a: Punto; b: Punto; grosorPx?: number }
  | { op: 'actualizar_hueco'; id: string; tipo?: TipoHueco; a?: Punto; b?: Punto }
  | { op: 'eliminar_hueco'; id: string }
  | { op: 'crear_hueco'; tipo: TipoHueco; muro: string; a: Punto; b: Punto }
  | { op: 'actualizar_estancia'; id: string; nombre?: string; uso?: UsoEstancia; falsoTecho?: boolean; poligono?: Punto[]; armarios?: number }
  | { op: 'eliminar_estancia'; id: string }
  | { op: 'crear_estancia'; nombre: string; uso: UsoEstancia; poligono: Punto[]; falsoTecho?: boolean }
  | { op: 'altura'; valor: number }
  | { op: 'resolver_duda'; id: string; respuesta: string }

function siguienteId(prefijo: string, ids: string[]): string {
  const n = ids.filter(i => i.startsWith(prefijo)).map(i => Number(i.slice(prefijo.length)) || 0)
  return `${prefijo}${(n.length ? Math.max(...n) : 0) + 1}`
}

const prefijoHueco = (t: TipoHueco) => (t === 'puerta' ? 'P' : t === 'entrada' ? 'E' : 'V')

/** Aplica operaciones sobre una copia. Devuelve el modelo nuevo y lo que no se pudo aplicar. */
export function aplicarOperaciones(modelo: ModeloEstadoActual, ops: Operacion[]): { modelo: ModeloEstadoActual; errores: string[] } {
  const m: ModeloEstadoActual = structuredClone(modelo)
  const errores: string[] = []
  for (const o of ops) {
    switch (o.op) {
      case 'actualizar_muro': {
        const w = m.muros.find(x => x.id === o.id)
        if (!w) { errores.push(`No existe ${o.id}`); break }
        if (o.tipo) { w.tipo = o.tipo; if (o.tipo !== 'estructural') w.estructuralProbable = false }
        if (o.a) w.a = o.a
        if (o.b) w.b = o.b
        break
      }
      case 'confirmar_estructural': {
        const w = m.muros.find(x => x.id === o.id)
        if (!w) { errores.push(`No existe ${o.id}`); break }
        w.tipo = 'estructural'
        w.estructuralProbable = false
        break
      }
      case 'eliminar_muro':
        if (!m.muros.some(x => x.id === o.id)) { errores.push(`No existe ${o.id}`); break }
        m.muros = m.muros.filter(x => x.id !== o.id)
        m.huecos = m.huecos.filter(h => h.muro !== o.id)
        break
      case 'crear_muro':
        m.muros.push({ id: siguienteId('M', m.muros.map(x => x.id)), tipo: o.tipo, a: o.a, b: o.b, grosorPx: o.grosorPx ?? m.escala.pxPorMetro * 0.1 })
        break
      case 'actualizar_hueco': {
        const h = m.huecos.find(x => x.id === o.id)
        if (!h) { errores.push(`No existe ${o.id}`); break }
        if (o.tipo) h.tipo = o.tipo
        if (o.a) h.a = o.a
        if (o.b) h.b = o.b
        break
      }
      case 'eliminar_hueco':
        if (!m.huecos.some(x => x.id === o.id)) { errores.push(`No existe ${o.id}`); break }
        m.huecos = m.huecos.filter(x => x.id !== o.id)
        break
      case 'crear_hueco':
        if (!m.muros.some(x => x.id === o.muro)) { errores.push(`No existe el muro ${o.muro}`); break }
        m.huecos.push({ id: siguienteId(prefijoHueco(o.tipo), m.huecos.map(x => x.id)), tipo: o.tipo, muro: o.muro, a: o.a, b: o.b })
        break
      case 'actualizar_estancia': {
        const e = m.estancias.find(x => x.id === o.id)
        if (!e) { errores.push(`No existe ${o.id}`); break }
        if (o.nombre) e.nombre = o.nombre
        if (o.uso) e.uso = o.uso
        if (o.falsoTecho != null) e.falsoTecho = o.falsoTecho
        if (o.poligono && o.poligono.length >= 3) e.poligono = o.poligono
        if (o.armarios != null && o.armarios >= 0) e.armarios = Math.round(o.armarios)
        break
      }
      case 'eliminar_estancia':
        m.estancias = m.estancias.filter(x => x.id !== o.id)
        break
      case 'crear_estancia':
        if (o.poligono.length < 3) { errores.push('Estancia sin polígono'); break }
        m.estancias.push({ id: siguienteId('S', m.estancias.map(x => x.id)), nombre: o.nombre, uso: o.uso, poligono: o.poligono, falsoTecho: o.falsoTecho ?? false })
        break
      case 'resolver_duda': {
        const d = m.dudas.find(x => x.id === o.id)
        if (!d) { errores.push(`No existe ${o.id}`); break }
        d.estado = 'resuelta'
        d.respuesta = o.respuesta
        break
      }
      case 'altura':
        if (o.valor >= 2 && o.valor <= 6) m.alturaLibre = Math.round(o.valor * 100) / 100
        else errores.push(`Altura fuera de rango: ${o.valor}`)
        break
    }
  }
  m.version = modelo.version + 1
  return { modelo: m, errores }
}

/** Huecos ordenados a lo largo de su muro, con posición en metros desde el extremo A. */
export function huecosDeMuro(m: ModeloEstadoActual, muro: Muro) {
  const L = dist(muro.a, muro.b)
  return m.huecos
    .filter(h => h.muro === muro.id)
    .map(h => {
      const t0 = proyeccion(h.a, muro.a, muro.b), t1 = proyeccion(h.b, muro.a, muro.b)
      return { hueco: h, desde: Math.min(t0, t1) * L, hasta: Math.max(t0, t1) * L }
    })
    .sort((x, y) => x.desde - y.desde)
}

export const COLORES_USO: Record<UsoEstancia, string> = {
  bano: '#9FD3F5',
  aseo: '#B8E0F7',
  cocina: '#F7D59F',
  estancia: '#E9E4DA',
  paso: '#F2EFE9',
  exterior: '#D8E8CF',
}

export const COLORES_MURO: Record<TipoMuro, string> = {
  exterior: '#4A4A4A',
  tabique: '#D85A30',
  estructural: '#7B3FB0',
}

export const COLORES_HUECO: Record<TipoHueco, string> = {
  ventana: '#00A0C8',
  balconera: '#0B5E8C',
  puerta: '#1E9650',
  entrada: '#C8A000',
}


// ── Dudas ────────────────────────────────────────────────────────────────────

/**
 * Dudas que el sistema genera solo, aunque la IA no las pida: muros marcados como
 * probables estructurales y muros sin trazo claro en el plano. No duplica las que
 * ya cubre una duda existente del mismo elemento.
 */
export function dudasDelSistema(m: ModeloEstadoActual, sinAjustar: string[] = []): Duda[] {
  const existentes = m.dudas ?? []
  const cubiertos = new Set(existentes.flatMap(d => d.elementos))
  const ids = existentes.map(d => d.id)
  const nueva = () => { const id = siguienteId('D', ids); ids.push(id); return id }
  const out: Duda[] = []
  for (const w of m.muros) {
    if (w.tipo !== 'estructural' || !w.estructuralProbable || cubiertos.has(w.id)) continue
    out.push({
      id: nueva(), elementos: [w.id], origen: 'sistema', estado: 'pendiente',
      pregunta: `¿${w.id} es un muro estructural?${w.nota ? ` ${w.nota}` : ''} Si lo es, no se demuele.`,
      opciones: [
        { etiqueta: 'Sí, es estructural', operaciones: [{ op: 'confirmar_estructural', id: w.id }] },
        { etiqueta: 'No, es un tabique', operaciones: [{ op: 'actualizar_muro', id: w.id, tipo: 'tabique' }] },
      ],
    })
  }
  for (const id of sinAjustar) {
    if (cubiertos.has(id) || !m.muros.some(w => w.id === id)) continue
    out.push({
      id: nueva(), elementos: [id], origen: 'sistema', estado: 'pendiente',
      pregunta: `${id} no se ve claro en el plano: está donde lo ha supuesto la IA. ¿Existe ese muro?`,
      opciones: [
        { etiqueta: 'Sí, está bien', operaciones: [] },
        { etiqueta: 'No existe, quitarlo', operaciones: [{ op: 'eliminar_muro', id }] },
      ],
    })
  }
  return out
}

/** Duda general si el plano parece un estado reformado. */
export function dudaEstadoActual(ids: string[]): Duda {
  return {
    id: siguienteId('D', ids), elementos: [], origen: 'sistema', estado: 'pendiente',
    pregunta: 'Este plano parece un estado reformado o una propuesta (mobiliario de diseño, cotas de proyecto). Para demoler hay que levantar lo que hay HOY. ¿Es el estado actual?',
    opciones: [
      { etiqueta: 'Sí, es como está hoy', operaciones: [] },
      { etiqueta: 'No: lo cambiaré o corregiré', operaciones: [] },
    ],
  }
}

/** Modelos guardados antes de que existieran las dudas. */
export function normalizarModelo(m: ModeloEstadoActual): ModeloEstadoActual {
  if (Array.isArray(m.dudas)) return m
  const base = { ...m, dudas: [] as Duda[] }
  return { ...base, dudas: dudasDelSistema(base) }
}

/** Punto (px del plano) donde se pinta el indicador de una duda. Null si es general. */
export function anclaDuda(m: ModeloEstadoActual, d: Duda): Punto | null {
  const pts: Punto[] = []
  for (const id of d.elementos) {
    const w = m.muros.find(x => x.id === id) ?? m.huecos.find(x => x.id === id)
    if (w) { pts.push({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }); continue }
    const e = m.estancias.find(x => x.id === id)
    if (e) pts.push(centroide(e.poligono))
  }
  return pts.length ? centroide(pts) : null
}

/** id de elemento → id de la duda pendiente que lo menciona. */
export function dudasPorElemento(m: ModeloEstadoActual): Map<string, string> {
  const r = new Map<string, string>()
  for (const d of m.dudas ?? []) if (d.estado === 'pendiente') for (const e of d.elementos) if (!r.has(e)) r.set(e, d.id)
  return r
}

export const COLOR_DUDA = '#F5A000'
