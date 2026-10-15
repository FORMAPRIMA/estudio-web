'use client'

// Propuesta de honorarios de Isla Creta para Grupo RSA: una presentación
// horizontal (lienzo 1920×1080 escalado) cuyo escenario, cuando se habla de la
// isla, es la vista previa 3D en tiempo real. La interacción sigue limitada a la
// manzana 1 (la muestra del teaser), con estados y precios de ejemplo; del resto
// de la isla no viajan datos al navegador.
//
// Criterio comercial (no negociable): todo lo que se ve es una DEMOSTRACIÓN. Ni
// textos ni notas pueden dar a entender que la maqueta está hecha: el trabajo
// que se propone (maqueta completa, casas tipo, casa club) está por delante.
//
// Se presenta en directo (flechas, mando, rueda: un gesto, una diapositiva) y
// queda como sala. «N» abre las notas del orador; «G» suelta la cámara; «F»
// pantalla completa. Estética y escala tipográfica de Torre del Mangle / NE 56th.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { registrarEventoPropuestaWeb, progresoPropuestaWeb } from '@/app/actions/propuestasWeb'
import { useMedicionSala } from '../medicionSala'
import type { EscenaIsla, Lote, Vista, Capas, Estado, Lado } from './escena'
import type { VisorCasas } from './casas3d'

const W = 1920, H = 1080
/** Semanas del cronograma. */
const SEM = 17

const CAPITULOS = ['El estudio', 'La isla', 'La herramienta', 'Casas tipo y casa club', 'Honorarios']

const COLOR: Record<Estado, string> = { disponible: '#19e27a', reservada: '#ffb000', vendida: '#ff2d55' }
const NOMBRE_ESTADO: Record<Estado, string> = { disponible: 'Disponible', reservada: 'Reservada', vendida: 'Vendida' }

const usd = (n: number) => n.toLocaleString('es-EC', { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions)

type Tipo = 'opaco' | 'isla' | 'velado' | 'casas'
type Velo = 'izq' | 'fuerte' | 'abajo' | 'cierre'
interface EscenaCfg {
  vista: Vista
  lado?: Lado
  dur?: number
  /** Encuadre desde el que arranca si se llega desde una diapositiva sin 3D. */
  desde?: Vista
  capas?: Partial<Capas>
  filtro?: ((l: Lote) => boolean) | null
  tipo?: number | null
  atardecer?: boolean
  deriva?: number
}
interface Ctx {
  paso: number
  lotes: Lote[]
  A: string
  filtros: string[]
  alternarFiltro: (id: string) => void
  irPaso: (n: number) => void
  refCasas: (n: HTMLDivElement | null) => void
  casasListas: boolean
  club: number
}
interface Diapo {
  id: string
  cap: number
  titulo: string
  tipo: Tipo
  tono?: 'claro' | 'oscuro'
  velo?: Velo
  pasos?: number
  /** Se puede tocar una parcela de la muestra: la cámara se acerca y abre su ficha. */
  tocable?: boolean
  sinCabecera?: boolean
  escena?: (paso: number) => EscenaCfg
  notas: string
  render: (c: Ctx) => ReactNode
}

// Filtros de la demostración (sobre la manzana 1). Se combinan: Y lógico.
const FILTROS: { id: string; etiqueta: string; f: (l: Lote) => boolean }[] = [
  { id: 'precio', etiqueta: 'Hasta 800.000 USD', f: (l) => l.precio <= 800000 },
  { id: 'agua', etiqueta: 'Junto al agua', f: (l) => l.agua },
  { id: 'grande', etiqueta: 'Más de 1.500 m²', f: (l) => l.area >= 1500 },
  { id: 'libre', etiqueta: 'Solo disponibles', f: (l) => l.estado === 'disponible' },
]
const combinar = (ids: string[]) => {
  const fs = FILTROS.filter((x) => ids.includes(x.id)).map((x) => x.f)
  return fs.length ? (l: Lote) => fs.every((f) => f(l)) : null
}

const OBRAS = [
  { img: 'cc38-salon', nombre: 'Claudio Coello 38', lugar: 'Madrid', dato: '320 m²' },
  { img: 'mia-322-lounge', nombre: '322 SW 18th Rd', lugar: 'Miami', dato: '260 m²' },
  { img: 'airapi-sala', nombre: 'Airapi Memorial Park', lugar: 'Monterrey', dato: '2.300 m²' },
  { img: 'nwl-fachada', nombre: 'Colegio NWL', lugar: 'Querétaro', dato: '3.200 m²' },
  { img: 'columela6-comedor', nombre: 'Columela 6', lugar: 'Madrid', dato: '235 m²' },
  { img: 'jade-fachada', nombre: 'JADE Matcha Gallery', lugar: 'Madrid', dato: '50 m²' },
]
const EQUIPO = [
  { img: 'team-jose-lora', nombre: 'José Lora', rol: 'Socio fundador · Arquitecto' },
  { img: 'team-gabriela-hidalgo', nombre: 'Gabriela Hidalgo', rol: 'Socia fundadora · Arquitecta' },
  { img: 'team-jose-antonio', nombre: 'José Antonio', rol: 'Director de proyectos · Arquitecto' },
  { img: 'team-aitana', nombre: 'Aitana', rol: 'Arquitecta' },
  { img: 'team-daniel', nombre: 'Daniel', rol: 'Arquitecto' },
  { img: 'team-ariana', nombre: 'Ariana', rol: 'Diseñadora de interiores' },
  { img: 'team-ana-cristina', nombre: 'Ana Cristina', rol: 'Desarrollo de negocio y marketing' },
]
const CASAS = [
  { nombre: 'Original', lema: 'Dos plantas, terraza volada y pérgola de llegada' },
  { nombre: 'Horizonte', lema: 'Pastilla alargada y gran terraza sobre la piscina' },
  { nombre: 'Escuadra', lema: 'Dos alas en L que abrazan el jardín' },
  { nombre: 'Puente', lema: 'Un volumen alto que cruza entre dos patios' },
]
const CLUB = [
  ['club-entrada', 'Acceso abierto al paisaje, con piedra, madera y agua'],
  ['club-piscina', 'Piscina y terraza bajo grandes voladizos'],
  ['club-gimnasio', 'Gimnasio volcado al jardín'],
  ['club-spa', 'Spa con patio ajardinado'],
]

// Panel del comercial (ejemplo): interés de un comprador por parcela.
const CALOR: Record<string, number> = { 'MZ1-7': 1, 'MZ1-11': 0.58, 'MZ1-16': 0.4, 'MZ1-8': 0.3, 'MZ1-6': 0.24, 'MZ1-12': 0.18, 'MZ1-5': 0.12, 'MZ1-4': 0.1 }

// ─────────────────────────────────────────────────────────────────────────────

function Mapa({ lotes }: { lotes: Lote[] }) {
  if (!lotes.length) return null
  const xs = lotes.map((l) => l.c[0]), zs = lotes.map((l) => l.c[2])
  const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, z0 = Math.min(...zs) - 30, z1 = Math.max(...zs) + 30
  const w = 420, h = (w * (z1 - z0)) / (x1 - x0)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="pic-mapa" aria-hidden="true">
      {lotes.map((l) => {
        const x = ((l.c[0] - x0) / (x1 - x0)) * w, y = ((l.c[2] - z0) / (z1 - z0)) * h
        const k = CALOR[l.id] ?? 0.04
        return (
          <g key={l.id}>
            {k > 0.05 && <circle cx={x} cy={y} r={10 + k * 34} fill={k > 0.6 ? '#ff2d55' : k > 0.25 ? '#ff8a00' : '#ffb000'} opacity={0.18 + k * 0.32} />}
            <circle cx={x} cy={y} r={4.5} fill={k > 0.6 ? '#ff2d55' : k > 0.05 ? '#ff8a00' : 'rgba(20,20,20,.25)'} />
          </g>
        )
      })}
    </svg>
  )
}

function Leyenda({ lotes, filtro }: { lotes: Lote[]; filtro?: ((l: Lote) => boolean) | null }) {
  const ok = lotes.filter((l) => !filtro || filtro(l))
  return (
    <div className="pic-leyenda">
      {(['disponible', 'reservada', 'vendida'] as Estado[]).map((e) => {
        const n = ok.filter((l) => l.estado === e).length
        return (
          <div key={e} className="pic-estado" style={{ ['--c' as string]: COLOR[e] }}>
            <i /><b>{n}</b><span>{NOMBRE_ESTADO[e]}{n === 1 ? '' : 's'}</span>
          </div>
        )
      })}
    </div>
  )
}

// Paneles del equipo comercial (maqueta de pantalla, datos de ejemplo).
const AGENTES = [
  { n: 'Andrea Molina', d: 46, s: 28, c: 9, v: 4 },
  { n: 'Carlos Vera', d: 38, s: 24, c: 7, v: 3 },
  { n: 'Daniela Ortiz', d: 33, s: 19, c: 4, v: 2 },
  { n: 'Luis Andrade', d: 27, s: 13, c: 2, v: 1 },
  { n: 'Paula Cedeño', d: 20, s: 8, c: 1, v: 1 },
]
const CALIENTES = [
  ['Comprador 014', 'MZ1-7', 6, 'hace 2 h', 92],
  ['Comprador 021', 'MZ1-11', 4, 'hace 5 h', 81],
  ['Comprador 009', 'MZ1-16', 5, 'ayer', 74],
  ['Comprador 032', 'MZ1-4', 3, 'ayer', 66],
  ['Comprador 027', 'MZ1-13', 2, 'hace 2 días', 61],
] as const

function Ventana({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="pv">
      <div className="pv-barra"><i /><i /><i /><span>{url}</span></div>
      <div className="pv-cuerpo">{children}</div>
    </div>
  )
}

function PanelAgente() {
  return (
    <Ventana url="salas.formaprima.es/isla-creta/mi-cartera">
      <div className="pv-cab">
        <div><span className="pv-lbl">Panel del agente · Isla Creta</span><b>Mi cartera</b></div>
        <div className="pv-yo"><i>CV</i><div><b>Carlos Vera</b><span>Agente comercial</span></div></div>
      </div>
      <div className="pv-kpis">
        <div><b>38</b><span>Dossiers enviados</span><em>+6 esta semana</em></div>
        <div><b>24</b><span>Leads en seguimiento</span><em>+3 esta semana</em></div>
        <div className="hot"><b>7</b><span>Leads calientes</span><em>2 nuevos hoy</em></div>
        <div><b>3</b><span>Ventas cerradas</span><em>octubre</em></div>
      </div>
      <div className="pv-dos">
        <div>
          <span className="pv-lbl">Leads calientes</span>
          <div className="pv-tabla">
            <div className="pv-th"><span>Comprador</span><span>Parcela</span><span>Visitas</span><span>Última</span><span>Temp.</span></div>
            {CALIENTES.map(([n, p, v, u, t]) => (
              <div key={n} className="pv-tr"><span>{n}</span><span>{p}</span><span>{v}</span><span>{u}</span><span><em className="pv-temp" style={{ ['--t' as string]: `${t}%` }}>{t}</em></span></div>
            ))}
          </div>
        </div>
        <div>
          <span className="pv-lbl">Actividad reciente</span>
          <ul className="pv-act">
            <li><i className="r" /><div><b>Comprador 014 volvió a abrir su dossier</b><span>Miró MZ1-7 y la comparó con MZ1-11 · hace 2 h</span></div></li>
            <li><i className="a" /><div><b>Comprador 021 pasó 9 min en la maqueta</b><span>Se detuvo en la casa club · hace 5 h</span></div></li>
            <li><i className="v" /><div><b>Reserva confirmada · MZ1-10</b><span>Comprador 017 · ayer</span></div></li>
            <li><i /><div><b>Dossier enviado a Comprador 036</b><span>Parcela MZ1-19 · ayer</span></div></li>
          </ul>
        </div>
      </div>
      <div className="pv-embudo">
        <span className="pv-lbl">Embudo de este mes</span>
        <div>{[['Dossiers enviados', 38], ['Los abrieron', 31], ['Volvieron a entrar', 18], ['Calientes', 7], ['Ventas', 3]].map(([t, n], k) => (
          <div key={t as string} className={k === 3 ? 'hot' : k === 4 ? 'ok' : ''}><b>{n as number}</b><span>{t as string}</span><i style={{ width: `${((n as number) / 38) * 100}%` }} /></div>
        ))}</div>
      </div>
    </Ventana>
  )
}

function PanelDirector() {
  const max = Math.max(...AGENTES.map((a) => a.d))
  return (
    <Ventana url="salas.formaprima.es/isla-creta/equipo">
      <div className="pv-cab">
        <div><span className="pv-lbl">Panel de dirección comercial · Isla Creta</span><b>Equipo comercial</b></div>
        <div className="pv-filtro"><span>Octubre 2026</span><span>5 agentes</span></div>
      </div>
      <div className="pv-kpis cinco">
        <div><b>164</b><span>Dossiers enviados</span></div>
        <div><b>92</b><span>Leads en seguimiento</span></div>
        <div className="hot"><b>23</b><span>Leads calientes</span></div>
        <div><b>11</b><span>Ventas cerradas</span></div>
        <div><b>12 %</b><span>Conversión</span></div>
      </div>
      <span className="pv-lbl">Rendimiento por agente</span>
      <div className="pv-agentes">
        <div className="pv-th"><span>Agente</span><span>Dossiers</span><span>Seguimiento</span><span>Calientes</span><span>Ventas</span><span>Conv.</span></div>
        {AGENTES.map((a) => (
          <div key={a.n} className="pv-tr">
            <span className="pv-ag"><i>{a.n.split(' ').map((x) => x[0]).join('')}</i>{a.n}</span>
            <span className="pv-bar"><u style={{ width: `${(a.d / max) * 100}%` }} /><b>{a.d}</b></span>
            <span>{a.s}</span>
            <span className="hot">{a.c}</span>
            <span>{a.v}</span>
            <span>{Math.round((a.v / a.s) * 100)} %</span>
          </div>
        ))}
      </div>
      <div className="pv-pie">
        <div>
          <span className="pv-lbl">Ventas por semana</span>
          <div className="pv-semanas">{[1, 2, 1, 3, 2, 2].map((v, k) => <div key={k}><i style={{ height: v * 16 }} /><span>S{k + 36}</span></div>)}</div>
        </div>
        <div>
          <span className="pv-lbl">Parcelas más vistas</span>
          <ol className="pv-top">{[['MZ1-7', 41], ['MZ1-11', 29], ['MZ1-16', 22], ['MZ1-4', 17]].map(([p, n]) => <li key={p as string}><span>{p}</span><b>{n} visitas</b></li>)}</ol>
        </div>
      </div>
    </Ventana>
  )
}

const DIAPOS: Diapo[] = [
  // ── 01 · El estudio ──────────────────────────────────────────────────────
  {
    id: 'portada', cap: 0, titulo: 'Portada', tipo: 'isla', velo: 'fuerte', sinCabecera: true,
    escena: () => ({ vista: 'rio', lado: 'derecha', deriva: 0.012, capas: { parcelas: 'base' } }),
    notas: 'Abrir con la vista previa en directo. Agradecer el tiempo de Grupo RSA. Tres servicios: la maqueta comercial, las casas tipo y la casa club.',
    render: ({ A }) => (
      <div className="pic-portada">
        <div className="pic-logos r">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/propuestas/logo-fp.png" alt="Forma Prima" className="fp" />
          <i />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/logo-rsa-claro.png`} alt="Grupo RSA" className="rsa" />
        </div>
        <div>
          <span className="pic-it r">Propuesta de honorarios · Octubre 2026</span>
          <h1 className="pic-t1 r">Isla Creta</h1>
          <p className="pic-p r">Maqueta digital comercial, casas tipo y casa club para Grupo RSA.</p>
        </div>
        <div className="pic-portada-pie r"><span>Samborondón, Ecuador</span><span>Documento confidencial</span></div>
      </div>
    ),
  },
  {
    id: 'indice', cap: 0, titulo: 'Contenido', tipo: 'opaco', tono: 'claro',
    notas: 'El orden de la reunión: quiénes somos, la vista previa de la isla, cómo se vendería con ella, las casas tipo y la casa club, y al final los honorarios.',
    render: ({ A }) => (
      <div className="pic-indice">
        <ol>
          {CAPITULOS.map((c, i) => (
            <li key={c} className="r">
              <b>0{i + 1}</b>
              <span>{c}</span>
              <em>{['Trayectoria · equipo · obra', 'Una vista previa en 3D', 'Estados, filtros y fichas, en directo', 'El producto y el corazón de la isla', 'Alcance, honorarios y calendario'][i]}</em>
            </li>
          ))}
        </ol>
        <figure className="pic-marco r">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/portada.webp`} alt="" />
        </figure>
      </div>
    ),
  },
  {
    id: 'estudio', cap: 0, titulo: 'El estudio', tipo: 'opaco', tono: 'claro',
    notas: 'Forma Prima: arquitectura e interiorismo como un solo oficio. El mismo equipo de principio a fin. Proyectos en España, EE. UU., México y Ecuador.',
    render: () => (
      <div className="pic-estudio">
        <div>
          <h2 className="pic-t2 r">Un estudio de arquitectura e interiorismo que diseña el proyecto completo.</h2>
          <p className="pic-p r">Trabajamos desde Madrid con proyectos en España, Estados Unidos, México y Ecuador. El mismo equipo lleva cada proyecto de principio a fin: dibuja el edificio, resuelve su detalle constructivo, diseña sus interiores y entrega los planos con los que la constructora lo levanta. Y, con FP Visual Lab, prepara las herramientas para venderlo.</p>
        </div>
        <dl className="pic-cifras">
          <div className="r"><dt data-cuenta="60" data-pre="+">+60</dt><dd>proyectos de arquitectura e interiorismo</dd></div>
          <div className="r"><dt data-cuenta="4">4</dt><dd>países · España, EE. UU., México y Ecuador</dd></div>
          <div className="r"><dt data-cuenta="1">1</dt><dd>equipo para todas las fases, sin intermediarios</dd></div>
        </dl>
      </div>
    ),
  },
  {
    id: 'capacidades', cap: 0, titulo: 'Capacidades', tipo: 'opaco', tono: 'oscuro',
    notas: 'Cuatro capacidades bajo el mismo techo. Subrayar producto residencial y FP Visual Lab: es lo que hoy venimos a proponer.',
    render: () => (
      <div className="pic-pad">
        <h2 className="pic-t2 r" style={{ maxWidth: 820 }}>Diseñamos el producto y las herramientas para venderlo.</h2>
        <div className="pic-cuatro">
          {[
            ['Arquitectura', ['Anteproyecto y viabilidad', 'Proyecto de ejecución', 'Coordinación de ingenierías', 'Seguimiento de obra']],
            ['Interiorismo', ['Áreas comunes y amenidades', 'Tipologías y amueblamiento', 'Materialidad y detalle', 'Compras y recepción']],
            ['Producto residencial', ['Mix de unidades', 'Superficie vendible', 'Estándares repetibles', 'Control de coste por m²']],
            ['FP Visual Lab', ['Maquetas digitales comerciales', 'Renders y vídeos', 'Dossiers y salas digitales', 'Realidad virtual']],
          ].map(([t, items], i) => (
            <div key={t as string} className={`r${i === 3 ? ' oro' : ''}`}>
              <span className="pic-n">0{i + 1}</span>
              <h3>{t as string}</h3>
              <ul>{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'equipo', cap: 0, titulo: 'Equipo', tipo: 'opaco', tono: 'oscuro',
    notas: 'Quién estaría en el proyecto: los dos socios al frente, arquitectura, interiorismo y visualización en el mismo equipo.',
    render: ({ A }) => (
      <div className="pic-pad pic-equipo">
        <div className="pic-equipo-cab">
          <div>
            <h2 className="pic-t2 r">Quiénes estarían en Isla Creta.</h2>
            <p className="pic-p r">Arquitectura, interiorismo y visualización en un mismo equipo, con los socios fundadores al frente.</p>
          </div>
          <figure className="pic-marco r">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${A}/equipo-fp.webp`} alt="Equipo de Forma Prima" />
          </figure>
        </div>
        <div className="pic-equipo-fila">
          {EQUIPO.map((p) => (
            <div key={p.img} className="r">
              <figure className="pic-marco">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${A}/${p.img}.webp?v=2`} alt={p.nombre} />
              </figure>
              <strong>{p.nombre}</strong><span>{p.rol}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'obra', cap: 0, titulo: 'Obra seleccionada', tipo: 'opaco', tono: 'claro',
    notas: 'Obra 2021–2026: residencial de lujo, terciario y educativo, en cuatro países.',
    render: ({ A }) => (
      <div className="pic-pad">
        <div className="pic-fila-cab r"><h2 className="pic-t2">Obra seleccionada</h2><span>2021 — 2026</span></div>
        <div className="pic-obras">
          {OBRAS.map((o, i) => (
            <figure key={o.img} className={`r${i < 2 ? ' grande' : ''}`}>
              <span className="pic-marco">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${A}/${o.img}.webp`} alt={o.nombre} />
              </span>
              <figcaption><span>{o.nombre} <em>{o.lugar}</em></span><em>{o.dato}</em></figcaption>
            </figure>
          ))}
        </div>
      </div>
    ),
  },

  // ── 02 · La isla ─────────────────────────────────────────────────────────
  {
    id: 'apertura', cap: 1, titulo: 'Isla Creta', tipo: 'isla', velo: 'abajo',
    escena: () => ({ vista: 'isla', desde: 'rio', dur: 6500, deriva: 0.016, capas: { parcelas: 'base' } }),
    notas: 'Dejar que la cámara vuele unos segundos. A partir de aquí, todo es una vista previa en tiempo real: geometría simplificada y datos de ejemplo, para enseñar cómo funcionaría la maqueta comercial.',
    render: () => (
      <div className="pic-apertura">
        <span className="pic-it r">02 · Vista previa en tiempo real</span>
        <h1 className="pic-t1 grande r">Isla Creta</h1>
        <p className="pic-p r">Cómo podría venderse la isla con una maqueta digital comercial. Una demostración con geometría simplificada y datos de ejemplo.</p>
      </div>
    ),
  },
  {
    id: 'metodo', cap: 1, titulo: 'Cómo construiremos la maqueta', tipo: 'isla', velo: 'izq', pasos: 4,
    escena: (p) => ({
      vista: p === 3 ? 'manzana' : 'isla', lado: 'derecha', deriva: 0.014,
      capas: { parcelas: p >= 1 ? 'todas' : 'base', vegetacion: p >= 2, arquitectura: p >= 3 },
    }),
    notas: 'Pulsar para recorrer las capas con las que se construiría la maqueta comercial, sobre los planos definitivos de RSA. Insistir: esta vista previa usa geometría simplificada; la maqueta completa es el trabajo que proponemos.',
    render: ({ paso }) => (
      <div className="pic-panel">
        <h2 className="pic-t2 r">Así construiremos la maqueta.</h2>
        <p className="pic-p r">Por capas, sobre los planos definitivos y el inventario de Grupo RSA. Lo que ven es una vista previa con geometría simplificada.</p>
        <ol className="pic-capas r">
          {[
            ['Base', 'Suelo, calles y agua, a partir del CAD de implantación'],
            ['Parcelas e inventario', 'Las 173 parcelas, cada una con su ficha conectada a su inventario'],
            ['Paisaje', 'Vegetación, ribera y entorno'],
            ['Arquitectura', 'Casas tipo, torres y casa club, a medida que se diseñen'],
          ].map(([t, d], i) => (
            <li key={t} className={i <= paso ? 'on' : ''}><i>0{i + 1}</i><div><b>{t}</b><span>{d}</span></div></li>
          ))}
        </ol>
        <p className="pic-nota r">Vista previa conceptual · no es la maqueta definitiva ni un proyecto aprobado.</p>
      </div>
    ),
  },

  // ── 03 · La herramienta ──────────────────────────────────────────────────
  {
    id: 'muestra', cap: 2, titulo: 'Una manzana de muestra', tipo: 'isla', velo: 'izq', tocable: true,
    escena: () => ({ vista: 'manzana', lado: 'derecha', deriva: 0.01, capas: { parcelas: 'muestra' } }),
    notas: 'Para esta conversación hemos activado una manzana con datos de ejemplo. Tocar una parcela dorada: la cámara se acerca y se abre su ficha. En la maqueta completa, así con las 173.',
    render: () => (
      <div className="pic-panel">
        <h2 className="pic-t2 r">Una manzana de muestra.</h2>
        <p className="pic-p r">Para esta conversación hemos activado una sola manzana, con datos de ejemplo. Toque cualquier parcela dorada: la cámara se acerca y se abre su ficha.</p>
        <div className="pic-dos r">
          <div><b data-cuenta="23">23</b><span>parcelas en esta muestra</span></div>
          <div className="off"><b data-cuenta="173">173</b><span>en la maqueta completa</span></div>
        </div>
        <p className="pic-pista r">Toque una parcela dorada</p>
      </div>
    ),
  },
  {
    id: 'estados', cap: 2, titulo: 'Estados comerciales', tipo: 'isla', velo: 'izq', tocable: true,
    escena: () => ({ vista: 'manzana', lado: 'derecha', deriva: 0.008, capas: { parcelas: 'estados' } }),
    notas: 'Verde disponible, ámbar reservada, rojo vendida. El vendedor lo ve al instante. Tocar cualquier parcela para abrir su ficha.',
    render: ({ lotes }) => (
      <div className="pic-panel">
        <h2 className="pic-t2 r">Qué queda libre, de un vistazo.</h2>
        <p className="pic-p r">Disponible, reservada o vendida. El estado de cada parcela vendría de su inventario y la maqueta cambiaría de color al instante.</p>
        <div className="r"><Leyenda lotes={lotes} /></div>
        <p className="pic-pista r">Toque cualquier parcela de color</p>
        <p className="pic-nota r">Manzana de muestra · estados y precios de ejemplo.</p>
      </div>
    ),
  },
  {
    id: 'filtros', cap: 2, titulo: 'Filtros', tipo: 'isla', velo: 'izq', tocable: true,
    escena: () => ({ vista: 'manzana', lado: 'derecha', deriva: 0.008, capas: { parcelas: 'estados' } }),
    notas: 'Pulsar los filtros: se combinan y la maqueta responde. Es la conversación de la sala de ventas: «busco algo de menos de 800 mil junto al agua».',
    render: ({ lotes, filtros, alternarFiltro }) => {
      const f = combinar(filtros)
      const n = lotes.filter((l) => !f || f(l)).length
      return (
        <div className="pic-panel">
          <h2 className="pic-t2 r">Lo que busca el comprador, en un segundo.</h2>
          <p className="pic-p r">Los filtros se combinan y la maqueta responde: lo que no cumple se apaga.</p>
          <div className="pic-chips r">
            {FILTROS.map((x) => (
              <button key={x.id} type="button" className={filtros.includes(x.id) ? 'on' : ''} onClick={() => alternarFiltro(x.id)} aria-pressed={filtros.includes(x.id)}>{x.etiqueta}</button>
            ))}
          </div>
          <div className="pic-resultado r"><b key={n}>{n}</b><span>{n === 1 ? 'parcela cumple' : 'parcelas cumplen'}{filtros.length ? '' : ' · sin filtro'}</span></div>
          <div className="r"><Leyenda lotes={lotes} filtro={f} /></div>
          <p className="pic-nota r">Manzana de muestra · estados y precios de ejemplo.</p>
        </div>
      )
    },
  },
  {
    id: 'dossier', cap: 2, titulo: 'Un enlace para cada comprador', tipo: 'velado',
    escena: () => ({ vista: 'manzana', lado: 'centro', deriva: 0.02, capas: { parcelas: 'estados' } }),
    notas: 'Cada comprador recibe un enlace único a su parcela. Su equipo comercial ve cuántas veces entra, qué otras parcelas mira, cuánto tiempo pasa en la maqueta y dónde se detiene. Sabe a quién llamar y cuándo.',
    render: ({ lotes }) => (
      <div className="pic-pad pic-dossier">
        <div className="pic-dossier-txt">
          <h2 className="pic-t2 r">Un enlace único para cada comprador.</h2>
          <p className="pic-p r">El asesor envía a cada interesado su propio enlace a la maqueta. Desde ese momento, su equipo sabe qué hace con él.</p>
          <ol className="pic-flujo">
            <li className="r"><i>01</i><div><b>El asesor envía el enlace</b><span>Un dossier digital con la parcela, la casa y la maqueta, a nombre del comprador.</span></div></li>
            <li className="r"><i>02</i><div><b>El comprador explora desde casa</b><span>Vuelve a su parcela, gira la isla, compara con otras.</span></div></li>
            <li className="r"><i>03</i><div><b>Su equipo lo ve todo</b><span>Visitas, parcelas que compara, tiempo en cada una y mapa de calor de su interés.</span></div></li>
          </ol>
        </div>
        <div className="pic-panelcom r">
          <div className="pc-cab">
            <div><span className="pic-lbl">Panel comercial · ejemplo</span><b>Comprador 014</b><em>Enlace personal · parcela MZ1-7</em></div>
            <span className="pc-temp"><i />Caliente</span>
          </div>
          <div className="pc-kpis">
            <div><b data-cuenta="6">6</b><span>visitas</span></div>
            <div><b data-cuenta="18">18</b><span>min en la maqueta</span></div>
            <div><b data-cuenta="3">3</b><span>parcelas comparadas</span></div>
            <div><b>2 h</b><span>última visita</span></div>
          </div>
          <div className="pc-cuerpo">
            <div>
              <span className="pic-lbl">Parcelas que mira</span>
              {[['MZ1-7', 62, 'disponible'], ['MZ1-11', 24, 'disponible'], ['MZ1-16', 14, 'vendida']].map(([id, pct, e]) => (
                <div key={id as string} className="pc-barra">
                  <span>{id as string}</span>
                  <div><i style={{ width: `${pct}%`, background: COLOR[e as Estado] }} /></div>
                  <em>{pct as number} %</em>
                </div>
              ))}
              <span className="pic-lbl" style={{ marginTop: 26 }}>Visitas · últimos 14 días</span>
              <div className="pc-dias">{[0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 1, 0, 1].map((v, k) => <i key={k} style={{ height: 6 + v * 16, opacity: v ? 1 : 0.25 }} />)}</div>
            </div>
            <div>
              <span className="pic-lbl">Mapa de calor · manzana</span>
              <Mapa lotes={lotes} />
            </div>
          </div>
          <p className="pc-pie">Ejemplo ilustrativo · comprador y datos ficticios</p>
        </div>
      </div>
    ),
  },
  {
    id: 'paneles', cap: 2, titulo: 'Paneles del equipo comercial', tipo: 'velado',
    escena: () => ({ vista: 'manzana', lado: 'centro', deriva: 0.02, capas: { parcelas: 'estados' } }),
    notas: 'Cada agente tiene su panel: su cartera, sus leads calientes y la actividad de sus compradores en tiempo real. La dirección comercial ve a todo el equipo: dossiers enviados, leads en seguimiento y calientes, ventas y conversión por agente.',
    render: () => (
      <div className="pic-pad pic-paneles">
        <div className="pic-paneles-cab">
          <h2 className="pic-t2 r">Un panel para cada agente, y otro para la dirección.</h2>
          <p className="pic-p r">Cada agente ve su cartera y sus leads calientes. La dirección comercial ve el rendimiento de todo el equipo: dossiers enviados, seguimiento, ventas y conversión por agente.</p>
        </div>
        <div className="pic-paneles-dos">
          <div className="r"><span className="pic-lbl">Agente comercial</span><PanelAgente /></div>
          <div className="r"><span className="pic-lbl">Director comercial</span><PanelDirector /></div>
        </div>
        <p className="pic-nota r">Datos de ejemplo · agentes y compradores ficticios.</p>
      </div>
    ),
  },
  {
    id: 'usos', cap: 2, titulo: 'Para qué sirve', tipo: 'isla', velo: 'izq',
    escena: () => ({ vista: 'isla', lado: 'derecha', deriva: 0.016, capas: { parcelas: 'base' } }),
    notas: 'Tres momentos de venta. Y el remate: esta presentación es una sala digital; es la misma tecnología que tendría su equipo con cada comprador.',
    render: () => (
      <div className="pic-panel ancho">
        <h2 className="pic-t2 r">Una sola maqueta para todo el ciclo de venta.</h2>
        <div className="pic-usos">
          <div className="r"><span className="pic-n">01</span><h3>En la sala de ventas</h3><p>La isla a pantalla completa, con el estado de cada parcela al día.</p></div>
          <div className="r"><span className="pic-n">02</span><h3>En la visita</h3><p>El asesor recorre la isla en una tablet y abre cada ficha donde está.</p></div>
          <div className="r"><span className="pic-n">03</span><h3>En casa del comprador</h3><p>Un enlace personal para volver a su parcela y compararla.</p></div>
        </div>
        <div className="pic-meta r">
          <i />
          <p><strong>Esta presentación funciona igual.</strong> Es una sala digital: cada persona de Grupo RSA entra con su código. Es la tecnología que tendría su equipo con cada comprador.</p>
        </div>
      </div>
    ),
  },

  // ── 04 · Casas tipo y casa club ─────────────────────────────────────────
  {
    id: 'casas', cap: 3, titulo: 'Casas tipo', tipo: 'casas', tono: 'claro', pasos: 4,
    notas: 'Un lote se vende mejor cuando se ve la casa. Pasar por las cuatro direcciones (o tocar las pestañas) y girar la maqueta con el ratón. Dejar claro: son referencias volumétricas, no nuestro diseño; las casas no se han diseñado y se definirán con su equipo.',
    render: ({ paso, irPaso, refCasas, casasListas }) => (
      <div className="pic-casas">
        <div className="pic-casas-txt">
          <h2 className="pic-t2 r">Cuatro casas tipo.</h2>
          <p className="pic-p r">Un lote se vende mejor cuando se ve la casa. Diseñaremos con su equipo cuatro casas tipo: distintas superficies y programas, un mismo lenguaje para toda la isla.</p>
          <div className="pic-tabs r">
            {CASAS.map((c, k) => (
              <button key={c.nombre} type="button" className={paso === k ? 'on' : ''} onClick={() => irPaso(k)}>
                <i>0{k + 1}</i><b>{c.nombre}</b><span>{c.lema}</span>
              </button>
            ))}
          </div>
          <div className="pic-aviso r">
            <b>Referencia volumétrica</b>
            <p>Volúmenes de referencia para imaginar el lenguaje. Las casas de Isla Creta aún no se han diseñado: se definirán con su equipo, según el perfil de comprador.</p>
          </div>
        </div>
        <div className="pic-casas-3d">
          <div ref={refCasas} className="pic-casas-lienzo" />
          {!casasListas && <span className="pic-casas-carga">Cargando las casas…</span>}
          <span className="pic-casas-pista">Arrastre para girar · rueda para acercarse</span>
          <div className="pic-casas-sello"><b>Referencia volumétrica</b><span>No es el diseño propuesto · Dirección 0{paso + 1} · {CASAS[paso].nombre}</span></div>
        </div>
      </div>
    ),
  },
  {
    id: 'zurbano', cap: 3, titulo: 'Casa Zurbano · dossier digital', tipo: 'opaco', tono: 'oscuro',
    notas: 'Un ejemplo real de cómo aplicamos un anteproyecto con enfoque comercial: el dossier digital de Casa Zurbano, en Madrid. El comprador ve cómo podría quedar su casa y lo que costaría, y el dossier termina con un cierre comercial digital. Así presentaríamos cada casa tipo de Isla Creta. Se puede abrir en directo con el botón.',
    render: () => (
      <div className="pic-zurbano">
        <div className="pic-zurbano-txt">
          <span className="pic-it r">Un ejemplo de nuestro trabajo</span>
          <h2 className="pic-t2 r">Casa Zurbano: el anteproyecto, convertido en herramienta de venta.</h2>
          <p className="pic-p r">Así aplicamos nuestros anteproyectos con enfoque comercial. Un dossier digital con el que el comprador ve cómo podría quedar su casa, y cierres comerciales digitales para que dé el siguiente paso desde el propio dossier.</p>
          <ul className="pic-zurbano-lista r">
            <li><i>01</i><span>Antes y después, con renders de cada estancia</span></li>
            <li><i>02</i><span>Cuánto cuesta reformarla y cuánto tarda</span></li>
            <li><i>03</i><span>Cierre comercial digital: el interesado deja sus datos y entra en el seguimiento</span></li>
          </ul>
          <a className="pic-zurbano-btn r" href="https://formaprima.es/propuesta/casa-zurbano-xzw9e" target="_blank" rel="noopener">Abrir el dossier de Casa Zurbano <span aria-hidden="true">↗</span></a>
          <p className="pic-nota r">Zurbano 6 · Madrid · dossier publicado para compradores</p>
        </div>
        <div className="pic-zurbano-moviles r">
          {['cz-cover-end', 'z6-03', 'z6-06'].map((f, k) => (
            <div key={f} className={`pic-movil m${k}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/propuestas/casa-zurbano-xzw9e/assets/${f}.webp`} alt="" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'casas-entrega', cap: 3, titulo: 'Casas tipo · alcance', tipo: 'velado',
    escena: () => ({ vista: 'manzana', lado: 'centro', deriva: 0.02, capas: { parcelas: 'base' } }),
    notas: 'Lo que entregaríamos por cada casa: plantas, fachadas, renders, vídeo, maqueta propia y la casa sobre su lote en la maqueta. Todo pensado para vender.',
    render: () => (
      <div className="pic-pad">
        <h2 className="pic-t2 r" style={{ maxWidth: 900 }}>Cuatro casas, a nivel de anteproyecto, pensadas para vender.</h2>
        <div className="pic-entregas">
          {[
            ['01', 'Plantas y fachadas', 'Distribución, alzados y cuadro de áreas de cada casa'],
            ['02', 'Renders fotorrealistas', 'Exteriores e interiores, para redes, dossier y sala de ventas'],
            ['03', 'Vídeo render', 'Un recorrido de cada casa, de la llegada al jardín'],
            ['04', 'Maqueta digital propia', 'Cada tipología en 3D, para enseñarla por dentro'],
            ['05', 'Sobre su lote', 'Cada casa colocada en la maqueta de la isla'],
            ['06', 'Material de venta', 'Fichas y planos comerciales legibles para el comprador'],
          ].map(([n, t, dd]) => <div key={n} className="r"><span className="pic-n">{n}</span><h3>{t}</h3><p>{dd}</p></div>)}
        </div>
      </div>
    ),
  },
  {
    id: 'club', cap: 3, titulo: 'Casa club', tipo: 'isla', velo: 'izq',
    escena: () => ({ vista: 'club', lado: 'derecha', deriva: 0.03, capas: { parcelas: 'base' } }),
    notas: 'La casa club y sus pistas son el lugar común de la isla y uno de sus mejores argumentos de venta. Su arquitectura está por diseñar: queremos diseñarla con ustedes. Las imágenes son inspiración.',
    render: ({ A, club }) => (
      <div className="pic-club">
        <div className="pic-club-txt">
          <h2 className="pic-t2 r">El corazón de la isla.</h2>
          <p className="pic-p r">La casa club y sus pistas son el lugar común de Isla Creta y uno de sus mejores argumentos de venta. Proponemos diseñarla con un solo equipo de principio a fin: arquitectura e interiorismo en las mismas manos.</p>
          <p className="pic-nota r">Imágenes de inspiración · no representan el diseño de la casa club.</p>
        </div>
        <div className="pic-carrusel r">
          {CLUB.map(([f, alt], k) => (
            <figure key={f} className={k === club ? 'on' : ''}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${A}/${f}.webp`} alt={alt} />
            </figure>
          ))}
          <div className="pic-carrusel-pie">
            <span key={club}>{CLUB[club][1]}</span>
            <div>{CLUB.map((c, k) => <i key={c[0]} className={k === club ? 'on' : ''} />)}</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'club-metodo', cap: 3, titulo: 'Casa club · cómo trabajamos', tipo: 'velado',
    escena: () => ({ vista: 'club', lado: 'centro', deriva: 0.03, capas: { parcelas: 'base' } }),
    notas: 'Cuatro fases, un solo equipo: anteproyecto, proyecto de ejecución y, como opcionales, seguimiento de obra e interiorismo. El mismo método que aplicamos en Guayaquil.',
    render: () => (
      <div className="pic-pad">
        <h2 className="pic-t2 r">Del primer trazo a la obra terminada.</h2>
        <div className="pic-fases">
          {[
            ['01–07', 'Anteproyecto', '6 semanas', ['Programa e implantación', 'Organización y volumen', 'Materiales y paisaje', 'Imágenes de presentación']],
            ['08', 'Proyecto de ejecución', '8 + 3 semanas', ['Planos y detalles para construir', 'Coordinación de ingenierías', 'Revisión integral']],
            ['09', 'Seguimiento de obra', 'Opcional', ['Arquitecto residente semanal', 'Reunión mensual', 'Visita trimestral de un socio']],
            ['10', 'Interiorismo', 'Opcional · 4 semanas', ['Interiores de la casa club', 'Materiales e iluminación', 'Mobiliario']],
          ].map(([n, t, dd, items], k) => (
            <div key={n as string} className={`r${k > 1 ? ' opc' : ''}`}>
              <span className="pic-n">{n as string}</span>
              <h3>{t as string}</h3>
              <em>{dd as string}</em>
              <ul>{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="pic-nota r">Ingenierías, tramitación y dirección de obra, fuera salvo acuerdo expreso.</p>
      </div>
    ),
  },

  // ── 05 · Honorarios ──────────────────────────────────────────────────────
  {
    id: 'alcance', cap: 4, titulo: 'Alcance', tipo: 'velado',
    escena: () => ({ vista: 'isla', lado: 'centro', deriva: 0.02, capas: { parcelas: 'base' } }),
    notas: 'Lo que han visto es una demostración para entender el producto. El trabajo está por delante: la maqueta completa con su inventario real, las casas tipo y la casa club.',
    render: () => (
      <div className="pic-pad">
        <h2 className="pic-t2 r">Una demostración y tres servicios.</h2>
        <p className="pic-p r">Lo que han visto es una vista previa para entender cómo funcionaría la herramienta. El trabajo que proponemos está por delante.</p>
        <div className="pic-servicios">
          <div className="r demo"><span className="pic-n">00 · Demostración</span><h3>Esta vista previa</h3><p>Una manzana de muestra, geometría simplificada y datos de ejemplo. Sirve para entender el producto; no es el producto.</p><b>Material de esta propuesta</b></div>
          <div className="r"><span className="pic-n">01 · Por desarrollar</span><h3>Maqueta digital comercial</h3><p>Las 173 parcelas con inventario, precios y estados reales, encuadres de venta, versión para tablet y sala de ventas, y actualización continua.</p><b>Precio cerrado</b></div>
          <div className="r"><span className="pic-n">02 · Por diseñar</span><h3>Cuatro casas tipo</h3><p>Programa, superficies y lenguaje, con su equipo. Anteproyecto y material de venta de cada casa.</p><b>Por m² diseñado</b></div>
          <div className="r"><span className="pic-n">03 · Por diseñar</span><h3>Casa club y zona deportiva</h3><p>Anteproyecto y proyecto de ejecución, a partir del ámbito y el programa que defina Grupo RSA.</p><b>Por m² diseñado</b></div>
        </div>
      </div>
    ),
  },
  {
    id: 'honorarios', cap: 4, titulo: 'Honorarios', tipo: 'opaco', tono: 'claro', pasos: 2,
    notas: 'Maqueta a precio cerrado: 23.000 (19.550 con descuento). Casas tipo y casa club a 22 USD/m² de anteproyecto y 30 de ejecución (18,70 y 25,50 con descuento), sobre supuestos de 250 m² por casa y 600 m² de casa club (el CAD da 1.557 m² de parcela; el volumen modelado es un pabellón de unos 290 m² de huella). Tarifa 76.200; pulsar para aplicar el 15 % de inicio de colaboración: 64.770. Todo más IVA.',
    render: ({ paso }) => {
      const d = paso >= 1
      const fila = (n: string, t: string, s: string, calc: string, base: string, con: string, pend = false) => (
        <div className={`h-fila${pend ? ' pend' : ''}`}>
          <span className="h-n">{n}</span>
          <div className="h-t"><b>{t}</b><span>{s}</span></div>
          <span className="h-c">{calc}</span>
          <span className={`h-b${d && !pend ? ' tachado' : ''}`}>{pend ? '' : base}</span>
          <span className={`h-d${d && !pend ? ' on' : ''}`}>−15%</span>
          <span className={`h-f${d && !pend ? ' on' : ''}`}>{pend ? <em>Por definir</em> : d ? con : base}</span>
        </div>
      )
      return (
        <div className="pic-hon">
          <div className="pic-hon-izq">
            <h2 className="pic-t2 r">Tres servicios, honorarios separados.</h2>
            <p className="pic-p r">La maqueta comercial tiene precio cerrado. Las casas tipo y la casa club se calculan por metro cuadrado diseñado; las superficies son supuestos que se ajustarán al programa definitivo.</p>
            <div className="pic-hon-cifras r">
              <div><b>≈ 250</b><span>m² por casa tipo · supuesto</span></div>
              <div><b>≈ 600</b><span>m² de casa club · supuesto</span></div>
            </div>
          </div>
          <div className="pic-hon-der">
            <div className="h-cab r"><span>Fase</span><span /><span>Cálculo</span><span>Honorarios</span><span /><span>{d ? 'Con descuento' : ''}</span></div>
            <div className="h-caja r">
              <div className="h-tit"><b>Maqueta digital comercial</b><em>Precio cerrado · USD</em></div>
              {fila('M1', 'Implementación', '173 parcelas: ficha, estados, filtros, capas y encuadres de venta', 'Cerrado', '23.000', '19.550')}
              {fila('M2', 'Mantenimiento y mejoras', 'Precios y estados al día · opcional', 'Por mes', '2.000', '1.700')}
            </div>
            <div className="h-caja r">
              <div className="h-tit"><b>Cuatro casas tipo</b><em>Por m² · supuesto 250 m² por casa</em></div>
              {fila('C1–C4', 'Anteproyecto y material de venta', 'Plantas, fachadas, renders, vídeo y maqueta propia · 4.675 USD por casa con descuento', '4 × 250 m² × 22', '22.000', '18.700')}
            </div>
            <div className="h-caja r">
              <div className="h-tit"><b>Casa club y zona deportiva</b><em>Por m² · supuesto 600 m², por confirmar</em></div>
              {fila('01–07', 'Anteproyecto', 'Programa, implantación, volumen, materiales e imágenes', '600 m² × 22', '13.200', '11.220')}
              {fila('08', 'Proyecto de ejecución', 'Documentación para construir · ingenierías aparte', '600 m² × 30', '18.000', '15.300')}
              <div className="h-sub">Opcionales · se contratan aparte</div>
              {fila('09', 'Seguimiento de obra', 'Residente semanal · visita trimestral de un socio', 'USD / mes', '2.400', '2.040')}
              {fila('10', 'Interiorismo', 'Interiores, materiales, iluminación y mobiliario · 13 → 11,05 USD/m²', '600 m² × 13', '7.800', '6.630')}
            </div>
          </div>
          <div className={`pic-hon-barra r${d ? ' on' : ''}`}>
            <b>−15%</b>
            <div><strong>Inicio de colaboración</strong><span>Nuestro primer proyecto con Grupo RSA. Aplicado a todas las fases.</span></div>
            <div className="h-total"><span>Maqueta, casas tipo y casa club · USD + IVA</span><em className={d ? 'tachado' : ''}>76.200</em>{d && <strong>64.770</strong>}</div>
          </div>
        </div>
      )
    },
  },
  {
    id: 'cronograma', cap: 4, titulo: 'Cronograma y pagos', tipo: 'opaco', tono: 'claro',
    notas: 'Diecisiete semanas de referencia. Maqueta en 3 semanas, casas tipo en 5, anteproyecto de la casa club en 6 y ejecución en 8 más 3 de revisión. La maqueta, las casas tipo y el anteproyecto de la casa club avanzan en paralelo desde que recibimos el inventario y los datos. Cada fase se paga 50 % al empezar y 50 % al entregar.',
    render: () => {
      const filas: { n: string; t: string; s: string; a: number; b: number; tipo?: 'opc' | 'sup'; hito?: number }[] = [
        { n: 'M1', t: 'Maqueta digital comercial', s: 'Implementación', a: 1, b: 3, hito: 2 },
        { n: 'C1–C4', t: 'Cuatro casas tipo', s: 'Anteproyecto y material de venta', a: 1, b: 5, hito: 3 },
        { n: '01–07', t: 'Casa club · anteproyecto', s: 'Desde la recepción de datos', a: 1, b: 6, hito: 3 },
        { n: '08', t: 'Casa club · ejecución', s: 'Planos y detalles', a: 7, b: 14 },
        { n: '08', t: 'Ejecución · revisión integral', s: 'Tras recibir las ingenierías', a: 15, b: 17, tipo: 'sup' },
        { n: '10', t: 'Interiorismo', s: 'Opcional', a: 12, b: 15, tipo: 'opc' },
      ]
      return (
        <div className="pic-crono">
          <div className="cr-cab r">
            <div>
              <h2 className="pic-t2">Cronograma y pagos</h2>
              <p className="pic-p">Cada fase se paga 50 % al empezar y 50 % al entregar. La maqueta, las casas tipo y la casa club avanzan en paralelo desde que recibimos el inventario y los datos.</p>
            </div>
            <div className="cr-sem"><b>{SEM}</b><span>semanas<br />de referencia</span></div>
          </div>
          <div className="cr-gantt r">
            <div className="cr-fila cr-num"><span>Fase</span>{Array.from({ length: SEM }, (_, k) => <b key={k}>{String(k + 1).padStart(2, '0')}</b>)}</div>
            {filas.map((f, k) => (
              <div key={k} className="cr-fila">
                <div className="cr-et"><i>{f.n}</i><div><b>{f.t}</b><span>{f.s}</span></div></div>
                <div className="cr-pista">
                  {Array.from({ length: SEM }, (_, c) => <span key={c} />)}
                  <em className={f.tipo ?? ''} style={{ left: `${((f.a - 1) / SEM) * 100}%`, width: `${((f.b - f.a + 1) / SEM) * 100}%`, animationDelay: `${0.35 + k * 0.12}s` }}>
                    {f.tipo !== 'opc' && <><u className="i" /><u className="f" /></>}
                    <small>{f.b - f.a + 1} sem</small>
                  </em>
                  {f.hito && <q style={{ left: `${((f.hito - 0.5) / SEM) * 100}%` }} />}
                </div>
              </div>
            ))}
          </div>
          <div className="cr-pagos r">
            {[
              ['M1 · Maqueta digital', [['Sem 01', '50 % al inicio', '9.775'], ['Sem 03', '50 % a la entrega', '9.775'], ['Desde sem 04', 'Mantenimiento · opcional', '1.700/mes']]],
              ['C1–C4 · Casas tipo', [['Sem 01', '50 % al inicio', '9.350'], ['Sem 05', '50 % a la entrega', '9.350']]],
              ['01–07 · Anteproyecto casa club', [['Sem 01', '50 % al inicio', '5.610'], ['Sem 06', '50 % a la entrega', '5.610']]],
              ['08 · Ejecución casa club', [['Sem 07', '50 % al inicio', '7.650'], ['Sem 17', '50 % a la entrega final', '7.650']]],
            ].map(([t, items]) => (
              <div key={t as string}>
                <b>{t as string}</b>
                {(items as string[][]).map(([s, c, v]) => <div key={s + c} className="cr-pago"><i /><span>{s}</span><em>{c}</em><strong>{v}</strong></div>)}
              </div>
            ))}
          </div>
          <div className="cr-leyenda r">
            <span><i className="o" />Hito de pago</span><span><i className="h" />Reunión de revisión</span><span><i className="b" />Fase contratada</span><span><i className="g" />Revisión</span><span><i className="p" />Opcional</span>
            <em>Importes en USD con el 15 % de descuento, + IVA · casas tipo y casa club sobre superficies supuestas · no incluye los plazos de ingenierías ni de entrega de datos</em>
          </div>
        </div>
      )
    },
  },
  {
    id: 'cierre', cap: 4, titulo: 'Cierre', tipo: 'isla', velo: 'cierre', sinCabecera: true,
    escena: () => ({ vista: 'cierre', lado: 'izquierda-max', deriva: 0.03, atardecer: true, capas: { parcelas: 'base' } }),
    notas: 'La isla al atardecer. Tres ideas y abrir a preguntas. Gracias.',
    render: ({ A }) => (
      <div className="pic-cierre">
        <div className="pic-cierre-cab r">
          <span className="pic-it">05 · Cierre</span>
          <div className="pic-logos">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/propuestas/logo-fp.png" alt="Forma Prima" className="fp" />
            <i />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${A}/logo-rsa-claro.png`} alt="Grupo RSA" className="rsa" />
          </div>
        </div>
        <h2 className="pic-t2 r">Empecemos a contar Isla Creta.</h2>
        <div className="pic-cierre-tres r">
          <div><span className="pic-n">01</span><b>Un solo equipo</b><p>Arquitectura, interiorismo y visualización en las mismas manos.</p></div>
          <div><span className="pic-n">02</span><b>Honorarios claros</b><p>Precio cerrado para la maqueta y por m² diseñado para casas tipo y casa club.</p></div>
          <div><span className="pic-n">03</span><b>17 semanas</b><p>En paralelo, desde que recibimos el inventario y los datos.</p></div>
        </div>
        <div className="pic-cierre-pasos r">
          <span className="pic-lbl">Próximos pasos</span>
          <ol>
            <li><i>01</i><span>Resolver dudas y ajustar el alcance</span></li>
            <li><i>02</i><span>Datos de la casa club: ámbito y programa</span></li>
            <li><i>03</i><span>Fecha de arranque</span></li>
          </ol>
        </div>
        <div className="pic-cierre-pie r">
          <b>Gracias.</b>
          <div><span className="pic-lbl">Contacto</span><span>contacto@formaprima.es</span></div>
          <div><span className="pic-lbl">Estudio</span><span>Madrid · España, EE. UU., México y Ecuador</span></div>
        </div>
      </div>
    ),
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const EASE = 'cubic-bezier(.16,1,.3,1)'
function animarEntrada(el: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  Array.from(el.querySelectorAll<HTMLElement>('.r')).forEach((b, k) => {
    const titulo = b.matches('h1,h2')
    b.animate(
      [{ opacity: 0, transform: `translate3d(0,${titulo ? 22 : 12}px,0)` }, { opacity: 1, transform: 'none' }],
      { duration: titulo ? 1300 : 1000, delay: 160 + Math.min(k, 14) * 80, easing: EASE, fill: 'backwards' },
    )
  })
  el.querySelectorAll<HTMLImageElement>('.pic-marco img').forEach((img, k) => {
    img.animate([{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 2200, delay: 260 + k * 70, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' })
  })
  el.querySelectorAll<HTMLElement>('[data-cuenta]').forEach((n) => {
    const fin = Number(n.dataset.cuenta), pre = n.dataset.pre ?? ''
    const original = n.textContent
    const dur = 1500 + Math.log10(fin + 1) * 220
    let t0: number | null = null
    n.style.fontVariantNumeric = 'tabular-nums'
    const paso = (t: number) => {
      if (t0 === null) t0 = t + 400
      const p = Math.min(1, Math.max(0, (t - t0) / dur))
      n.textContent = pre + Math.round(fin * (1 - Math.pow(1 - p, 4)))
      if (p < 1) requestAnimationFrame(paso)
      else { n.textContent = original; n.style.fontVariantNumeric = '' }
    }
    requestAnimationFrame(paso)
  })
}

export default function PropuestaIslaCreta({ slug, medir = false }: { slug: string; medir?: boolean }) {
  const A = `/propuestas/${slug}`
  const { alSlide, alVida, alEvento } = useMedicionSala(slug, medir)
  const lienzo = useRef<HTMLDivElement>(null)
  const escena = useRef<EscenaIsla | null>(null)
  const visorCasas = useRef<VisorCasas | null>(null)
  const slides = useRef<(HTMLElement | null)[]>([])
  const notasWin = useRef<Window | null>(null)
  const inicio = useRef(Date.now())

  const [i, setI] = useState(0)
  const [paso, setPaso] = useState(0)
  const [escala, setEscala] = useState(1)
  const [carga, setCarga] = useState(0)
  const [listo, setListo] = useState(false)
  const [sin3d, setSin3d] = useState<string | null>(null)
  const [splash, setSplash] = useState(true)
  const [lote, setLote] = useState<Lote | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [filtros, setFiltros] = useState<string[]>([])
  const [explorando, setExplorando] = useState(false)
  const [toast, setToast] = useState(false)
  const [ayuda, setAyuda] = useState(true)
  const [contCasas, setContCasas] = useState<HTMLDivElement | null>(null)
  const [casasListas, setCasasListas] = useState(false)
  const [club, setClub] = useState(0)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const d = DIAPOS[i]
  const pasos = d.pasos ?? 1
  const N = DIAPOS.length
  const enfoque = !!lote && d.tipo === 'isla' && !!d.tocable

  // ── Escala del lienzo 1920×1080 ──────────────────────────────────────────
  useEffect(() => {
    const f = () => setEscala(Math.min(innerWidth / W, innerHeight / H))
    f()
    addEventListener('resize', f)
    return () => removeEventListener('resize', f)
  }, [])

  // ── Diapositiva inicial (recargar en directo no la pierde) ───────────────
  // Se lee una sola vez: en desarrollo React repite los efectos y, para
  // entonces, el hash ya se ha reescrito con la diapositiva 1.
  const arranque = useRef<number | null>(null)
  useEffect(() => {
    if (arranque.current === null) {
      let guardada = 0
      try { guardada = Number(sessionStorage.getItem(`fp_ic_${slug}`)) || 0 } catch {}
      arranque.current = Number(location.hash.replace('#', '')) || guardada || 1
    }
    const n = arranque.current
    if (n >= 1 && n <= DIAPOS.length) setI(n - 1)
    registrarEventoPropuestaWeb(slug, 'abierta').catch(() => {})
    const t = setTimeout(() => setAyuda(false), 6000)
    return () => clearTimeout(t)
  }, [slug])

  // ── Maqueta 3D de la isla ────────────────────────────────────────────────
  useEffect(() => {
    const cont = lienzo.current
    if (!cont) return
    if (!hayWebGL()) { setSin3d('Este navegador no muestra 3D.'); setSplash(false); return }
    let viva = true
    const nav = navigator as Navigator & { deviceMemory?: number }
    const ligera = matchMedia('(pointer: coarse)').matches || innerWidth < 900 || (nav.deviceMemory ?? 8) <= 4
    import('./escena').then(({ crearEscena }) => crearEscena({
      contenedor: cont,
      base: `/propuesta/${slug}/maqueta`,
      ligera,
      onProgreso: (f) => viva && setCarga(f),
      onLote: (l) => viva && setLote(l as Lote | null),
      onBloqueado: () => {
        if (!viva) return
        setToast(true)
        if (toastT.current) clearTimeout(toastT.current)
        toastT.current = setTimeout(() => setToast(false), 2600)
      },
      onError: (m) => { if (viva) { setSin3d(m); setSplash(false) } },
    })).then((e) => {
      if (!viva) { e.destruir(); return }
      escena.current = e
      // Solo en desarrollo: las pruebas automáticas tocan lotes con esto.
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __islaCreta?: EscenaIsla }).__islaCreta = e
      setLotes(e.lotes)
      setListo(true)
      setTimeout(() => viva && setSplash(false), 400)
    }).catch(() => {})
    return () => {
      viva = false
      escena.current?.destruir()
      escena.current = null
      if (toastT.current) clearTimeout(toastT.current)
    }
  }, [slug])

  // ── Lo que hace la isla en cada diapositiva y paso ───────────────────────
  const anterior = useRef<{ i: number; vista: string } | null>(null)
  const cfgActual = useCallback(() => {
    const cfg = d.escena?.(paso)
    if (cfg && d.id === 'filtros') cfg.filtro = combinar(filtros)
    return cfg
  }, [d, paso, filtros])
  useEffect(() => {
    const e = escena.current
    if (!e || !listo) return
    const cfg = cfgActual()
    if (d.tipo === 'opaco' || d.tipo === 'casas' || !cfg) { e.pausar(true); anterior.current = { i, vista: '' }; return }
    e.pausar(false)
    const previa = anterior.current
    const desdeOpaco = !previa || previa.vista === ''
    e.capas({ vegetacion: true, arquitectura: true, parcelas: 'base', ...cfg.capas })
    e.filtrar(cfg.filtro ?? null)
    e.aislarTipo(cfg.tipo ?? null)
    e.atardecer(!!cfg.atardecer)
    e.deriva(cfg.deriva ?? 0.018)
    if (!d.tocable) e.deseleccionar()
    const clave = `${cfg.vista}|${cfg.lado ?? 'centro'}`
    if (desdeOpaco && cfg.desde) e.vista(cfg.desde, { lado: cfg.lado, dur: 1 })
    if (!previa || previa.vista !== clave || desdeOpaco) {
      setTimeout(() => escena.current?.vista(cfg.vista, { lado: cfg.lado, dur: cfg.dur }), desdeOpaco && cfg.desde ? 60 : 0)
    }
    anterior.current = { i, vista: clave }
  }, [i, paso, listo, d, cfgActual])

  // Parcela tocada: la cámara se acerca y la deja a la izquierda, con la ficha
  // a la derecha. Al cerrarla, vuelve al encuadre de la diapositiva.
  const enfocada = useRef(false)
  useEffect(() => {
    const e = escena.current
    if (!e) return
    if (lote && d.tipo === 'isla' && d.tocable) {
      enfocada.current = true
      e.deriva(0.012)
      e.vista(`lote:${lote.id}`, { lado: 'izquierda', dur: 1900 })
      alEvento('3d', lote.id)
      anterior.current = { i, vista: `lote:${lote.id}` }
    } else if (!lote && enfocada.current) {
      enfocada.current = false
      const cfg = cfgActual()
      if (cfg && d.tipo === 'isla') {
        e.deriva(cfg.deriva ?? 0.018)
        e.vista(cfg.vista, { lado: cfg.lado })
        anterior.current = { i, vista: `${cfg.vista}|${cfg.lado ?? 'centro'}` }
      }
    }
  }, [lote]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar de diapositiva: cámara al encuadre, ficha cerrada, filtros limpios.
  useEffect(() => {
    setExplorando(false)
    escena.current?.explorar(false)
    enfocada.current = false
    escena.current?.deseleccionar()
    setFiltros([])
  }, [i])

  // ── Visor de las casas tipo (solo en su diapositiva) ─────────────────────
  useEffect(() => {
    if (d.tipo !== 'casas' || !contCasas) return
    let viva = true
    setCasasListas(false)
    import('./casas3d').then(({ crearVisorCasas }) => crearVisorCasas({ contenedor: contCasas, base: `/propuesta/${slug}/maqueta` }))
      .then((v) => {
        if (!viva) { v.destruir(); return }
        visorCasas.current = v
        setCasasListas(true)
      })
      .catch(() => {})
    return () => {
      viva = false
      visorCasas.current?.destruir()
      visorCasas.current = null
    }
  }, [d.tipo, contCasas, slug])
  useEffect(() => { if (d.tipo === 'casas') visorCasas.current?.mostrar(paso) }, [d.tipo, paso, casasListas])

  // Carrusel de la casa club: solo gira mientras se ve.
  useEffect(() => {
    if (d.id !== 'club') return
    const t = setInterval(() => setClub((c) => (c + 1) % CLUB.length), 4200)
    return () => clearInterval(t)
  }, [d.id])

  // ── Entrada animada, medición y hash ─────────────────────────────────────
  useEffect(() => {
    const el = slides.current[i]
    if (el) animarEntrada(el)
    history.replaceState(null, '', `#${i + 1}`)
    try { sessionStorage.setItem(`fp_ic_${slug}`, String(i + 1)) } catch {}
    alSlide(i, N, d.titulo)
    progresoPropuestaWeb(slug, i, N, d.titulo).catch(() => {})
    if (i === N - 1) registrarEventoPropuestaWeb(slug, 'final').catch(() => {})
  }, [i, N, d.titulo, slug, alSlide])

  // ── Navegación ───────────────────────────────────────────────────────────
  const ir = useCallback((n: number, pasoInicial = 0) => {
    const k = Math.max(0, Math.min(DIAPOS.length - 1, n))
    setI(k)
    setPaso(pasoInicial === -1 ? (DIAPOS[k].pasos ?? 1) - 1 : pasoInicial)
  }, [])
  const siguiente = useCallback(() => {
    if (paso < pasos - 1) setPaso(paso + 1)
    else if (i < N - 1) ir(i + 1)
  }, [paso, pasos, i, N, ir])
  const previa = useCallback(() => {
    if (paso > 0) setPaso(paso - 1)
    else if (i > 0) ir(i - 1, -1)
  }, [paso, i, ir])
  const nav = useRef({ siguiente, previa })
  nav.current = { siguiente, previa }

  const toggleExplorar = useCallback(() => {
    const e = escena.current
    if (!e || d.tipo !== 'isla') return
    const v = !explorando
    setExplorando(v)
    e.explorar(v)
    if (v) alEvento('3d', 'explorar')
    else { const cfg = cfgActual(); if (cfg) e.vista(cfg.vista, { lado: cfg.lado }) }
  }, [explorando, d, cfgActual, alEvento])

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return
      alVida()
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(ev.key)) { ev.preventDefault(); if (!ev.repeat) siguiente() }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(ev.key)) { ev.preventDefault(); if (!ev.repeat) previa() }
      else if (ev.key === 'Home') ir(0)
      else if (ev.key === 'End') ir(N - 1)
      else if (ev.key === 'f' || ev.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}) }
      else if (ev.key === 'g' || ev.key === 'G') toggleExplorar()
      else if (ev.key === 'n' || ev.key === 'N') abrirNotas()
      else if (ev.key === 'Escape') { if (lote) escena.current?.deseleccionar(); else if (explorando) toggleExplorar() }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  // Rueda bloqueada: un gesto, una diapositiva. Tras avanzar, no se vuelve a
  // escuchar hasta que la rueda (o la inercia del trackpad) se ha quedado
  // quieta 450 ms y han pasado al menos 1,1 s.
  useEffect(() => {
    let acum = 0, ultimo = 0, desde = 0, bloqueada = false
    const enLienzoCasas = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('.pic-casas-3d')
    const w = (ev: WheelEvent) => {
      if (explorando || enLienzoCasas(ev.target)) return
      ev.preventDefault()
      alVida()
      const ahora = performance.now()
      if (bloqueada) {
        if (ahora - ultimo > 450 && ahora - desde > 1100) bloqueada = false
        else { ultimo = ahora; return }
      }
      ultimo = ahora
      acum += ev.deltaY + ev.deltaX
      if (Math.abs(acum) > 28) {
        if (acum > 0) nav.current.siguiente(); else nav.current.previa()
        acum = 0
        bloqueada = true
        desde = ahora
      }
    }
    addEventListener('wheel', w, { passive: false })
    return () => removeEventListener('wheel', w)
  }, [explorando, alVida])

  // Táctil: un deslizamiento (vertical u horizontal), una diapositiva. Sin
  // desplazamiento libre de la página.
  useEffect(() => {
    let x0: number | null = null, y0 = 0, t0 = 0
    const dentro3d = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('.pic-casas-3d') || (explorando && (t as HTMLElement)?.tagName === 'CANVAS')
    const s = (ev: TouchEvent) => { if (dentro3d(ev.target)) { x0 = null; return } x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; t0 = Date.now(); alVida() }
    const m = (ev: TouchEvent) => { if (x0 !== null) ev.preventDefault() }
    const e = (ev: TouchEvent) => {
      if (x0 === null) return
      const dx = ev.changedTouches[0].clientX - x0, dy = ev.changedTouches[0].clientY - y0
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      if (dist > 50 && Date.now() - t0 < 900) {
        const adelante = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0
        if (adelante) nav.current.siguiente(); else nav.current.previa()
      }
      x0 = null
    }
    addEventListener('touchstart', s, { passive: true })
    addEventListener('touchmove', m, { passive: false })
    addEventListener('touchend', e, { passive: true })
    return () => { removeEventListener('touchstart', s); removeEventListener('touchmove', m); removeEventListener('touchend', e) }
  }, [explorando, alVida])

  useEffect(() => {
    const v = () => alVida()
    addEventListener('pointermove', v, { passive: true })
    return () => removeEventListener('pointermove', v)
  }, [alVida])

  // ── Notas del orador (ventana aparte) ────────────────────────────────────
  const pintarNotas = useCallback(() => {
    const w = notasWin.current
    if (!w || w.closed) return
    const sig = DIAPOS[i + 1]
    const min = Math.floor((Date.now() - inicio.current) / 60000)
    w.document.body.innerHTML = `<div style="font:15px/1.5 -apple-system,Helvetica,sans-serif;color:#eee;padding:28px;">
      <div style="display:flex;justify-content:space-between;color:#e2b45a;font-size:13px;letter-spacing:.12em;text-transform:uppercase"><span>${i + 1} / ${N} · ${CAPITULOS[d.cap]}</span><span>${min} min</span></div>
      <h1 style="font-weight:300;font-size:30px;margin:10px 0 4px">${d.titulo}${pasos > 1 ? ` <small style="font-size:15px;color:#999">paso ${paso + 1}/${pasos}</small>` : ''}</h1>
      <p style="font-size:20px;line-height:1.5;color:#fff;margin:18px 0 28px">${d.notas}</p>
      <p style="color:#999;border-top:1px solid #333;padding-top:14px">Siguiente: ${sig ? sig.titulo : '—'}</p>
      <p style="color:#666;font-size:12px">→ avanzar · ← volver · G girar la maqueta · F pantalla completa</p></div>`
  }, [i, paso, pasos, d, N])
  const abrirNotas = () => {
    const w = window.open('', 'fp-notas-isla-creta', 'width=760,height=560')
    if (!w) return
    notasWin.current = w
    w.document.title = 'Notas · Isla Creta'
    w.document.body.style.cssText = 'margin:0;background:#141414'
    w.addEventListener('keydown', (ev) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(ev.key)) { ev.preventDefault(); nav.current.siguiente() }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(ev.key)) { ev.preventDefault(); nav.current.previa() }
    })
    pintarNotas()
  }
  useEffect(() => { pintarNotas() }, [pintarNotas])
  useEffect(() => {
    const t = setInterval(pintarNotas, 30000)
    return () => clearInterval(t)
  }, [pintarNotas])

  const alternarFiltro = useCallback((id: string) => setFiltros((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])), [])
  const ctx: Ctx = useMemo(() => ({ paso, lotes, A, filtros, alternarFiltro, irPaso: setPaso, refCasas: setContCasas, casasListas, club }), [paso, lotes, A, filtros, alternarFiltro, casasListas, club])
  const modo3d = d.tipo === 'opaco' || d.tipo === 'casas' ? 'oculto' : d.tipo === 'velado' ? 'velado' : ''
  const tono = d.tipo === 'opaco' || d.tipo === 'casas' ? d.tono ?? 'oscuro' : 'oscuro'

  return (
    <div className={`pic tono-${tono}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div ref={lienzo} className={`pic-3d ${modo3d}`} />
      {(sin3d || !listo) && modo3d !== 'oculto' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={`pic-poster ${modo3d}`} src={`${A}/portada.webp`} alt="" />
      )}
      {/* Fondo de las diapositivas opacas y velos sobre la maqueta: a pantalla
          completa (fuera del lienzo 16:9), para que no se corten en los bordes. */}
      <div className={`pic-fondo${d.tipo === 'opaco' || d.tipo === 'casas' ? ` on tono-${tono}` : ''}`} />
      <div className={`pic-velo velo-${d.velo ?? 'ninguno'}${enfoque ? ' enfoque' : ''}`} />

      <div className="pic-stage" style={{ transform: `translate(-50%,-50%) scale(${escala})` }}>
        {DIAPOS.map((s, k) => (
          <section
            key={s.id}
            ref={(n) => { slides.current[k] = n }}
            className={`pic-slide pic-${s.tipo}${s.tono ? ` tono-${s.tono}` : ''}${k === i ? ' on' : ''}${k === i && enfoque ? ' enfoque' : ''}`}
            aria-hidden={k !== i}
            aria-label={s.titulo}
          >
            {Math.abs(k - i) <= 1 && s.render(k === i ? ctx : { ...ctx, paso: 0 })}
          </section>
        ))}

        {/* Ficha de la parcela tocada (solo la manzana de muestra) */}
        <div className={`pic-ficha${enfoque ? ' on' : ''}`} role="dialog" aria-label={lote ? `Parcela ${lote.id}` : undefined}>
          {lote && (
            <>
              <div className="pic-ficha-cab">
                <span>Parcela unifamiliar · ejemplo</span>
                <button type="button" onClick={() => escena.current?.deseleccionar()} aria-label="Cerrar ficha">×</button>
              </div>
              <div className="pic-ficha-id">{lote.id}</div>
              <div className="pic-ficha-sub">{lote.label}</div>
              <em className="pic-ficha-estado" style={{ ['--c' as string]: COLOR[lote.estado] }}><i />{NOMBRE_ESTADO[lote.estado]}</em>
              <dl>
                <div><dt>Superficie</dt><dd>{usd(lote.area)} <small>m²</small></dd></div>
                <div><dt>Precio</dt><dd>{usd(lote.precio)} <small>USD</small></dd></div>
                <div><dt>Precio por m²</dt><dd>{usd(lote.precio / lote.area)} <small>USD</small></dd></div>
                <div><dt>Ubicación</dt><dd className="t">{lote.agua ? 'Junto al agua' : 'Junto a zona verde'}</dd></div>
              </dl>
              <p>Precio y estado de ejemplo. En la maqueta completa, conectados a su inventario.</p>
              <button type="button" className="pic-ficha-volver" onClick={() => escena.current?.deseleccionar()}>← Volver a la manzana</button>
            </>
          )}
        </div>

        <div className={`pic-toast${toast ? ' on' : ''}`} role="status">Esta parcela se activaría en la maqueta completa</div>

        {/* Cabecera discreta, como en Torre del Mangle */}
        <header className={`pic-top${d.sinCabecera ? ' fuera' : ''}`}>
          <span className="pic-top-cap"><b>0{d.cap + 1}</b><em>{CAPITULOS[d.cap]}</em></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tono === 'claro' ? '/propuestas/logo-fp-negro.png' : '/propuestas/logo-fp.png'} alt="Forma Prima" className="pic-top-logo" />
        </header>

        <footer className="pic-pie">
          <div className="pic-pie-izq">
            {d.tipo === 'isla' && listo && (
              <button type="button" className={`pic-girar${explorando ? ' on' : ''}`} onClick={toggleExplorar}>
                <i aria-hidden="true" />{explorando ? 'Volver al encuadre' : 'Girar la maqueta'}
              </button>
            )}
            {pasos > 1 && <div className="pic-subpasos" aria-hidden="true">{Array.from({ length: pasos }, (_, k) => <i key={k} className={k <= paso ? 'on' : ''} />)}</div>}
          </div>
          <div className="pic-flechas">
            <span className="pic-contador">{String(i + 1).padStart(2, '0')} <em>/ {N}</em></span>
            <button type="button" onClick={previa} disabled={i === 0 && paso === 0} aria-label="Anterior">←</button>
            <button type="button" onClick={siguiente} disabled={i === N - 1 && paso === pasos - 1} aria-label="Siguiente">→</button>
          </div>
        </footer>
        {ayuda && <div className="pic-ayuda">→ para avanzar · F pantalla completa · N notas</div>}
      </div>
      <i className="pic-avance" style={{ transform: `scaleX(${(i + (paso + 1) / pasos) / N})` }} aria-hidden="true" />

      {/* Móvil en vertical: la presentación no se lee; se tapa hasta que lo giren
          (Safari no deja bloquear la orientación desde una web). Como en los dossiers. */}
      <div className="pic-rotar" role="dialog" aria-label="Gire el móvil para ver la propuesta">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${A}/portada.webp`} alt="" aria-hidden="true" className="pic-rotar-fondo" />
        <div className="pic-rotar-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/propuestas/logo-fp.png" alt="Forma Prima" className="fp" />
          <i />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/logo-rsa-claro.png`} alt="Grupo RSA" className="rsa" />
        </div>
        <div className="pic-rotar-centro">
          <svg className="pic-rotar-movil" width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="20" y="6" width="24" height="52" rx="5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="29" y1="11" x2="35" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <div className="pic-rotar-ante">Propuesta de honorarios</div>
          <div className="pic-rotar-titulo">Isla Creta</div>
          <div className="pic-rotar-linea" />
          <p className="pic-rotar-texto">Para explorar esta propuesta,<br />gire su iPhone en horizontal.</p>
          <p className="pic-rotar-ordenador">Para la mejor experiencia con la maqueta 3D, le recomendamos abrirla en una computadora.</p>
        </div>
        <p className="pic-rotar-pie">¿No gira la pantalla? Desactive el bloqueo de rotación en el Centro de control.</p>
      </div>

      {/* Carga */}
      <div className={`pic-splash${splash ? '' : ' fuera'}`} role="status" aria-hidden={!splash}>
        <div className="pic-splash-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/propuestas/logo-fp.png" alt="Forma Prima" className="fp" />
          <i />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/logo-rsa-claro.png`} alt="Grupo RSA" className="rsa" />
        </div>
        <div className="pic-splash-pie">
          <span>Isla Creta · Preparando la vista previa</span>
          <div className="pic-barra"><i style={{ transform: `scaleX(${Math.max(0.03, carga)})` }} /></div>
          <small>{Math.round(carga * 100)} %</small>
        </div>
        <button type="button" className="pic-splash-saltar" onClick={() => setSplash(false)}>Empezar sin esperar</button>
      </div>
    </div>
  )
}

// Escala tipográfica de Torre del Mangle: títulos 52, texto 16, rótulos 11–13,
// cabecera 12 + Newsreader 19, márgenes de 104 px.
const CSS = `
html,body{background:#0d0d0d!important;margin:0;overflow:hidden;overscroll-behavior:none;touch-action:none;}
.pic{--negro:#0d0d0d;--grafito:#141414;--blanco:#fbfbfa;--papel:#f4f3f0;--tinta:#141414;--salvia:#8fa596;--verde:#2f4238;--oro:#e2b45a;
  position:fixed;inset:0;overflow:hidden;background:var(--negro);color:var(--blanco);font-family:'Hanken Grotesk',sans-serif;-webkit-font-smoothing:antialiased;user-select:none;}
.pic *{box-sizing:border-box;}
.pic img{display:block;max-width:100%;}
.pic h1,.pic h2,.pic h3{margin:0;font-weight:200;letter-spacing:-.03em;text-wrap:balance;}
.pic p{margin:0;text-wrap:pretty;}
.pic ul,.pic ol{list-style:none;margin:0;padding:0;}
.pic button{font-family:inherit;}

/* Capas a pantalla completa */
.pic-3d,.pic-poster{position:absolute;inset:0;width:100%;height:100%;transition:filter 1.3s cubic-bezier(.4,0,.2,1),transform 1.3s cubic-bezier(.4,0,.2,1),opacity .9s;}
.pic-poster{object-fit:cover;}
.pic-3d.velado,.pic-poster.velado{filter:blur(18px) brightness(.42) saturate(1.05);transform:scale(1.06);}
.pic-3d.oculto,.pic-poster.oculto{opacity:0;}
.pic-fondo{position:absolute;inset:0;opacity:0;transition:opacity .8s cubic-bezier(.4,0,.2,1),background .6s;pointer-events:none;}
.pic-fondo.on{opacity:1;}
.pic-fondo.tono-claro{background:var(--papel);}
.pic-fondo.tono-oscuro{background:var(--negro);}
.pic-velo{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 1s cubic-bezier(.4,0,.2,1),background 1s;}
.pic-velo.velo-izq,.pic-velo.velo-fuerte,.pic-velo.velo-abajo,.pic-velo.velo-cierre{opacity:1;}
.pic-velo.velo-izq{background:linear-gradient(90deg,rgba(13,13,13,.82) 0,rgba(13,13,13,.58) 26%,rgba(13,13,13,.14) 46%,rgba(13,13,13,0) 58%),linear-gradient(180deg,rgba(13,13,13,.35) 0,rgba(13,13,13,0) 14%,rgba(13,13,13,0) 86%,rgba(13,13,13,.3) 100%);}
.pic-velo.velo-fuerte{background:linear-gradient(90deg,rgba(13,13,13,.86) 0,rgba(13,13,13,.62) 28%,rgba(13,13,13,.12) 52%,rgba(13,13,13,0) 64%),linear-gradient(180deg,rgba(13,13,13,.3) 0,rgba(13,13,13,0) 16%);}
.pic-velo.velo-abajo{background:linear-gradient(180deg,rgba(13,13,13,.4) 0,rgba(13,13,13,0) 18%,rgba(13,13,13,0) 50%,rgba(13,13,13,.8) 100%);}
.pic-velo.velo-cierre{background:linear-gradient(90deg,rgba(13,13,13,0) 0,rgba(13,13,13,0) 36%,rgba(20,20,20,.96) 41%,#141414 100%);}
.pic-velo.enfoque{background:linear-gradient(270deg,rgba(13,13,13,.55) 0,rgba(13,13,13,0) 36%);}

/* Lienzo 1920×1080 */
.pic-stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:50% 50%;pointer-events:none;}
.pic-slide{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity .8s cubic-bezier(.4,0,.2,1),visibility 0s linear .8s;}
.pic-slide.on{opacity:1;visibility:visible;transition:opacity .8s cubic-bezier(.4,0,.2,1) .12s,visibility 0s;}
.pic-slide.on.pic-opaco>*,.pic-slide.on.pic-casas>*{pointer-events:auto;}
.pic-slide.on .pic-panel,.pic-slide.on.pic-velado .pic-pad,.pic-slide.on .pic-club,.pic-slide.on .pic-cierre{pointer-events:auto;}
.pic-slide .pic-panel{transition:opacity .6s,transform .8s cubic-bezier(.16,1,.3,1);}
.pic-slide.enfoque .pic-panel{opacity:0;transform:translateX(-30px);pointer-events:none!important;}
.tono-claro{color:var(--tinta);}

/* Tipografía */
.pic-it{display:block;font-family:'Newsreader',serif;font-style:italic;font-size:19px;font-weight:400;color:var(--salvia);margin-bottom:18px;}
.pic-t1{font-size:96px;line-height:.98;letter-spacing:-.045em;}
.pic-t1.grande{font-size:150px;}
.pic-t2{font-size:52px;line-height:1.06;}
.pic-p{margin-top:24px!important;font-size:16px;font-weight:300;line-height:1.6;opacity:.68;max-width:560px;}
.pic-nota{margin-top:24px!important;font-size:12px;font-weight:300;opacity:.5;line-height:1.5;}
.pic-n{display:block;font-size:12px;font-weight:500;letter-spacing:.02em;opacity:.55;margin-bottom:10px;font-variant-numeric:tabular-nums;}
.pic-lbl{display:block;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.5;margin-bottom:12px;}
.pic-marco{display:block;overflow:hidden;margin:0;}
.pic-marco img{width:100%;height:100%;object-fit:cover;}

/* Cabecera y pie */
.pic-top{position:absolute;left:104px;right:104px;top:52px;display:flex;justify-content:space-between;align-items:baseline;pointer-events:none;transition:opacity .6s;}
.pic-top.fuera{opacity:0;}
.pic-top-cap{display:inline-flex;align-items:baseline;gap:12px;}
.pic-top-cap b{font-size:12px;font-weight:500;color:var(--oro);}
.pic-top-cap em{font-family:'Newsreader',serif;font-size:19px;font-weight:400;opacity:.85;}
.pic.tono-claro .pic-top-cap b{color:var(--verde);}
.pic.tono-claro .pic-top{color:var(--tinta);}
.pic-top-logo{height:16px;width:auto;}
.pic-pie{position:absolute;left:104px;right:104px;bottom:40px;display:flex;justify-content:space-between;align-items:center;pointer-events:auto;}
.pic-pie-izq{display:flex;align-items:center;gap:24px;}
.pic-girar{display:inline-flex;align-items:center;gap:10px;height:36px;padding:0 16px;background:rgba(13,13,13,.45);color:var(--blanco);border:1px solid rgba(251,251,250,.35);font-size:13px;cursor:pointer;backdrop-filter:blur(8px);transition:all .3s;}
.pic-girar i{width:13px;height:13px;border:1.5px solid currentColor;border-radius:50%;border-top-color:transparent;}
.pic-girar.on{background:var(--oro);color:var(--tinta);border-color:var(--oro);}
.pic-subpasos{display:flex;gap:6px;}
.pic-subpasos i{width:22px;height:2px;background:rgba(251,251,250,.3);transition:background .4s;}
.pic-subpasos i.on{background:var(--oro);}
.pic.tono-claro .pic-subpasos i{background:rgba(20,20,20,.18);}
.pic.tono-claro .pic-subpasos i.on{background:var(--verde);}
.pic-flechas{display:flex;align-items:center;gap:8px;}
.pic-contador{font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;margin-right:12px;opacity:.8;}
.pic-contador em{font-style:normal;opacity:.5;font-weight:400;}
.pic-flechas button{width:40px;height:40px;border-radius:50%;border:1px solid rgba(251,251,250,.35);background:rgba(13,13,13,.3);color:var(--blanco);font-size:15px;cursor:pointer;transition:all .25s;backdrop-filter:blur(6px);}
.pic-flechas button:hover:not(:disabled){background:var(--oro);color:var(--tinta);border-color:var(--oro);}
.pic-flechas button:disabled{opacity:.25;cursor:default;}
.pic.tono-claro .pic-flechas button{border-color:rgba(20,20,20,.25);color:var(--tinta);background:transparent;}
.pic.tono-claro .pic-flechas button:hover:not(:disabled){background:var(--tinta);color:var(--papel);}
.pic-avance{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--oro);transform-origin:0 50%;transition:transform .6s cubic-bezier(.16,1,.3,1);z-index:5;}
.pic-ayuda{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);font-size:12px;padding:9px 16px;background:rgba(13,13,13,.6);color:rgba(251,251,250,.85);backdrop-filter:blur(6px);animation:pic-fuera 6s ease forwards;}
@keyframes pic-fuera{0%,80%{opacity:1}100%{opacity:0}}

/* Portada */
.pic-portada{position:absolute;left:104px;top:56px;bottom:120px;width:760px;display:flex;flex-direction:column;justify-content:space-between;}
.pic-logos{display:flex;align-items:center;gap:22px;}
.pic-logos .fp{height:20px;width:auto;}
.pic-logos .rsa{height:42px;width:auto;}
.pic-logos i{width:1px;height:36px;background:rgba(251,251,250,.35);}
.pic-portada-pie{display:flex;gap:40px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;opacity:.5;}

/* Índice */
.pic-indice{position:absolute;inset:0;display:grid;grid-template-columns:1fr 760px;gap:104px;padding:150px 104px 120px;}
.pic-indice ol{align-self:center;border-top:1px solid rgba(20,20,20,.14);}
.pic-indice li{display:grid;grid-template-columns:64px 1fr auto;align-items:baseline;padding:22px 0;border-bottom:1px solid rgba(20,20,20,.14);}
.pic-indice li b{font-size:12px;font-weight:500;color:var(--verde);}
.pic-indice li span{font-size:30px;font-weight:200;letter-spacing:-.02em;}
.pic-indice li em{font-family:'Newsreader',serif;font-size:17px;opacity:.55;}
.pic-indice figure{height:100%;}

/* Estudio */
.pic-estudio{position:absolute;inset:0;padding:150px 104px 130px;display:grid;grid-template-columns:1.4fr 1fr;gap:140px;align-items:end;}
.pic-estudio .pic-p{max-width:620px;}
.pic-cifras{margin:0;}
.pic-cifras div{display:flex;align-items:baseline;gap:26px;padding:20px 0;border-top:1px solid rgba(20,20,20,.14);}
.pic-cifras div:last-child{border-bottom:1px solid rgba(20,20,20,.14);}
.pic-cifras dt{font-size:56px;font-weight:200;letter-spacing:-.04em;min-width:120px;}
.pic-cifras dd{margin:0;font-size:14px;font-weight:300;opacity:.65;}

.pic-pad{position:absolute;inset:0;padding:150px 104px 120px;}
.pic-cuatro{display:grid;grid-template-columns:repeat(4,1fr);gap:40px;margin-top:96px;}
.pic-cuatro>div{border-top:1px solid rgba(251,251,250,.2);padding-top:20px;}
.pic-cuatro>div.oro{border-top-color:var(--oro);}
.pic-cuatro h3{font-size:24px;font-weight:300;letter-spacing:-.01em;margin-bottom:14px!important;}
.pic-cuatro>div.oro h3{color:var(--oro);}
.pic-cuatro li{font-size:14px;font-weight:300;opacity:.65;padding:10px 0;border-bottom:1px solid rgba(251,251,250,.08);}

/* Equipo */
.pic-equipo-cab{display:grid;grid-template-columns:1fr 820px;gap:104px;align-items:end;}
.pic-equipo-cab figure{height:330px;}
.pic-equipo-cab img{object-position:center 40%;}
.pic-equipo-fila{display:grid;grid-template-columns:repeat(7,1fr);gap:16px;margin-top:48px;}
.pic-equipo-fila figure{aspect-ratio:1/1.1;margin-bottom:12px;}
.pic-equipo-fila img{object-position:center top;filter:grayscale(.15);}
.pic-equipo-fila strong{display:block;font-size:15px;font-weight:400;}
.pic-equipo-fila span{display:block;margin-top:3px;font-size:12px;font-weight:300;opacity:.55;line-height:1.4;}

/* Obra */
.pic-fila-cab{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:36px;}
.pic-fila-cab>span{font-family:'Newsreader',serif;font-size:19px;opacity:.55;}
.pic-obras{display:grid;grid-template-columns:repeat(6,1fr);gap:24px 20px;}
.pic-obras figure{margin:0;grid-column:span 2;}
.pic-obras figure.grande{grid-column:span 3;}
.pic-obras .pic-marco{aspect-ratio:16/8;}
.pic-obras figure:not(.grande) .pic-marco{aspect-ratio:16/9;}
.pic-obras figcaption{display:flex;justify-content:space-between;margin-top:10px;font-size:13px;}
.pic-obras em{font-style:normal;opacity:.55;}

/* Apertura */
.pic-apertura{position:absolute;left:104px;right:104px;bottom:150px;}
.pic-apertura .pic-it{color:var(--oro);}
.pic-apertura .pic-t1{text-shadow:0 10px 60px rgba(0,0,0,.3);}

/* Panel lateral sobre la maqueta */
.pic-panel{position:absolute;left:104px;top:130px;bottom:120px;width:600px;display:flex;flex-direction:column;justify-content:center;}
.pic-panel.ancho{width:760px;}
.pic-capas{margin-top:36px!important;border-top:1px solid rgba(251,251,250,.18);}
.pic-capas li{display:flex;gap:20px;align-items:baseline;padding:16px 0;border-bottom:1px solid rgba(251,251,250,.18);opacity:.35;transition:opacity .6s;}
.pic-capas li.on{opacity:1;}
.pic-capas li i{font-style:normal;font-size:12px;font-weight:500;color:var(--oro);width:24px;}
.pic-capas b{display:block;font-size:17px;font-weight:400;}
.pic-capas span{display:block;font-size:13px;font-weight:300;opacity:.6;margin-top:3px;}
.pic-dos{display:flex;gap:40px;margin-top:36px;}
.pic-dos div{flex:1;border-top:2px solid var(--oro);padding-top:14px;}
.pic-dos div.off{border-top-color:rgba(251,251,250,.25);opacity:.6;}
.pic-dos b{display:block;font-size:56px;font-weight:200;letter-spacing:-.04em;line-height:1;}
.pic-dos span{display:block;font-size:13px;font-weight:300;opacity:.75;margin-top:8px;}
.pic-pista{margin-top:26px!important;font-size:13px;color:var(--oro);display:flex;align-items:center;gap:10px;}
.pic-pista::before{content:'';width:9px;height:9px;border-radius:50%;background:var(--oro);animation:pic-vivo 1.8s ease-out infinite;}
@keyframes pic-vivo{0%{box-shadow:0 0 0 0 rgba(226,180,90,.7)}100%{box-shadow:0 0 0 12px rgba(226,180,90,0)}}

/* Estados con color vivo */
.pic-leyenda{display:flex;gap:12px;margin-top:30px;}
.pic-estado{flex:1;display:flex;flex-direction:column;gap:4px;padding:16px 16px 14px;background:color-mix(in srgb,var(--c) 16%,rgba(13,13,13,.55));border:1.5px solid var(--c);box-shadow:0 0 30px color-mix(in srgb,var(--c) 25%,transparent);}
.pic-estado i{width:12px;height:12px;border-radius:50%;background:var(--c);box-shadow:0 0 12px var(--c);}
.pic-estado b{font-size:40px;font-weight:300;letter-spacing:-.03em;line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;}
.pic-estado span{font-size:12px;font-weight:600;color:var(--c);letter-spacing:.04em;}

.pic-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px;}
.pic-chips button{font-size:13px;padding:10px 16px;border:1px solid rgba(251,251,250,.4);background:rgba(13,13,13,.35);color:var(--blanco);cursor:pointer;transition:all .3s;}
.pic-chips button:hover{border-color:var(--blanco);}
.pic-chips button.on{background:var(--blanco);color:var(--tinta);border-color:var(--blanco);}
.pic-resultado{display:flex;align-items:baseline;gap:14px;margin-top:26px;}
.pic-resultado b{font-size:64px;font-weight:200;letter-spacing:-.04em;line-height:1;animation:pic-salta .6s cubic-bezier(.16,1,.3,1);}
.pic-resultado span{font-size:14px;font-weight:300;opacity:.75;}
@keyframes pic-salta{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* Casa Zurbano */
.pic-zurbano{position:absolute;inset:0;display:grid;grid-template-columns:680px 1fr;gap:80px;padding:130px 104px 120px;align-items:center;}
.pic-zurbano .pic-t2{font-size:46px;}
.pic-zurbano-lista{margin-top:30px!important;border-top:1px solid rgba(251,251,250,.18);}
.pic-zurbano-lista li{display:flex;gap:18px;padding:14px 0;border-bottom:1px solid rgba(251,251,250,.18);font-size:15px;font-weight:300;}
.pic-zurbano-lista i{font-style:normal;font-size:12px;font-weight:500;color:var(--oro);width:22px;}
.pic-zurbano-btn{display:inline-flex;align-items:center;gap:10px;margin-top:32px;height:48px;padding:0 22px;background:var(--blanco);color:var(--tinta);font-size:14px;font-weight:500;text-decoration:none;align-self:flex-start;transition:background .25s;}
.pic-zurbano-btn:hover{background:var(--oro);}
.pic-zurbano-txt{display:flex;flex-direction:column;}
.pic-zurbano-moviles{position:relative;height:100%;}
.pic-movil{position:absolute;top:50%;width:300px;aspect-ratio:9/19.5;border-radius:38px;padding:10px;background:#1c1c1c;box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(255,255,255,.12);}
.pic-movil img{width:100%;height:100%;object-fit:cover;border-radius:29px;}
.pic-movil.m0{left:50%;transform:translate(-50%,-50%);z-index:2;width:330px;}
.pic-movil.m1{left:8%;transform:translate(0,-46%) rotate(-6deg);opacity:.9;}
.pic-movil.m2{right:8%;transform:translate(0,-46%) rotate(6deg);opacity:.9;}

/* Paneles del equipo comercial */
.pic-paneles{padding-top:118px;display:flex;flex-direction:column;}
.pic-paneles-cab{display:flex;justify-content:space-between;align-items:flex-end;gap:80px;}
.pic-paneles-cab .pic-t2{font-size:44px;max-width:760px;}
.pic-paneles-cab .pic-p{max-width:520px;margin:0!important;}
.pic-paneles-dos{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:30px;}
.pic-paneles-dos .pic-lbl{margin-bottom:10px;color:var(--oro);opacity:.9;}
.pic-paneles .pic-nota{margin-top:16px!important;}
.pv{background:#fbfbfa;color:var(--tinta);box-shadow:0 40px 90px rgba(0,0,0,.45);overflow:hidden;height:640px;display:flex;flex-direction:column;}
.pv-barra{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;background:#e9e8e3;border-bottom:1px solid rgba(20,20,20,.08);}
.pv-barra i{width:9px;height:9px;border-radius:50%;background:rgba(20,20,20,.18);}
.pv-barra span{margin-left:14px;font-size:11px;opacity:.55;background:#fbfbfa;padding:3px 12px;border-radius:4px;}
.pv-cuerpo{padding:20px 22px;flex:1;display:flex;flex-direction:column;}
.pv-lbl{display:block;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.5;margin-bottom:8px;}
.pv-cab{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:1px solid rgba(20,20,20,.1);}
.pv-cab b{display:block;font-size:22px;font-weight:300;letter-spacing:-.02em;}
.pv-yo{display:flex;align-items:center;gap:10px;}
.pv-yo i,.pv-ag i{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--verde);color:#fff;font-style:normal;font-size:11px;font-weight:600;}
.pv-yo b{font-size:13px;font-weight:500;letter-spacing:0;}
.pv-yo span{display:block;font-size:11px;opacity:.55;}
.pv-filtro{display:flex;gap:6px;}
.pv-filtro span{font-size:11px;border:1px solid rgba(20,20,20,.2);padding:5px 10px;}
.pv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 16px;}
.pv-kpis.cinco{grid-template-columns:repeat(5,1fr);}
.pv-kpis div{background:#f1f0eb;padding:12px 14px;}
.pv-kpis b{display:block;font-size:28px;font-weight:300;letter-spacing:-.03em;line-height:1.05;}
.pv-kpis span{display:block;font-size:11px;opacity:.6;margin-top:2px;}
.pv-kpis em{display:block;font-style:normal;font-size:10px;color:var(--verde);margin-top:4px;font-weight:600;}
.pv-kpis .hot{background:rgba(255,45,85,.09);}
.pv-kpis .hot b{color:#d6002a;}
.pv-dos{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;flex:1;}
.pv-th,.pv-tr{display:grid;align-items:center;gap:8px;font-size:12px;}
.pv-tabla .pv-th,.pv-tabla .pv-tr{grid-template-columns:1.4fr .8fr .6fr .9fr .9fr;}
.pv-th{font-size:10px;font-weight:600;opacity:.45;padding-bottom:6px;border-bottom:1px solid rgba(20,20,20,.1);}
.pv-tr{padding:9px 0;border-bottom:1px solid rgba(20,20,20,.06);}
.pv-temp{display:inline-block;font-style:normal;font-size:10px;font-weight:700;color:#fff;padding:3px 7px;background:linear-gradient(90deg,#ff8a00,#ff2d55);border-radius:10px;min-width:34px;text-align:center;}
.pv-act li{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(20,20,20,.06);}
.pv-act i{flex:none;width:8px;height:8px;border-radius:50%;margin-top:5px;background:rgba(20,20,20,.25);}
.pv-act i.r{background:#ff2d55;}
.pv-act i.a{background:#ffb000;}
.pv-act i.v{background:#19c26a;}
.pv-act b{display:block;font-size:12px;font-weight:500;}
.pv-act span{display:block;font-size:11px;opacity:.55;margin-top:2px;}
.pv-agentes .pv-th,.pv-agentes .pv-tr{grid-template-columns:1.5fr 1.4fr .9fr .8fr .6fr .6fr;}
.pv-ag{display:flex;align-items:center;gap:8px;}
.pv-ag i{width:24px;height:24px;font-size:9px;}
.pv-bar{display:flex;align-items:center;gap:8px;}
.pv-bar u{display:block;height:6px;background:var(--verde);text-decoration:none;}
.pv-bar b{font-weight:500;}
.pv-agentes .hot{color:#d6002a;font-weight:600;}
.pv-pie{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:auto;padding-top:14px;}
.pv-semanas{display:flex;align-items:flex-end;gap:10px;height:66px;}
.pv-semanas div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;}
.pv-semanas i{width:100%;background:var(--verde);}
.pv-semanas span{font-size:9px;opacity:.5;}
.pv-embudo{margin-top:auto;padding-top:14px;}
.pv-embudo>div{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.pv-embudo>div>div{position:relative;background:#f1f0eb;padding:10px 12px 14px;overflow:hidden;}
.pv-embudo b{display:block;font-size:20px;font-weight:300;}
.pv-embudo span{display:block;font-size:10px;opacity:.6;}
.pv-embudo i{position:absolute;left:0;bottom:0;height:3px;background:var(--verde);}
.pv-embudo .hot i{background:#ff2d55;}
.pv-embudo .hot b{color:#d6002a;}
.pv-embudo .ok i{background:#19c26a;}
.pv-top li{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid rgba(20,20,20,.06);}
.pv-top b{font-weight:500;opacity:.7;}

/* Dossier personalizado */
.pic-dossier{display:grid;grid-template-columns:560px 1fr;gap:104px;align-items:center;padding-top:120px;}
.pic-flujo{margin-top:40px!important;border-top:1px solid rgba(251,251,250,.18);}
.pic-flujo li{display:flex;gap:20px;padding:18px 0;border-bottom:1px solid rgba(251,251,250,.18);}
.pic-flujo i{font-style:normal;font-size:12px;font-weight:500;color:var(--oro);width:24px;padding-top:3px;}
.pic-flujo b{display:block;font-size:17px;font-weight:400;}
.pic-flujo span{display:block;font-size:13px;font-weight:300;opacity:.62;margin-top:4px;line-height:1.5;}
.pic-panelcom{background:var(--papel);color:var(--tinta);padding:30px 34px 22px;box-shadow:0 40px 90px rgba(0,0,0,.4);}
.pc-cab{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:1px solid rgba(20,20,20,.12);}
.pc-cab b{display:block;font-size:26px;font-weight:300;letter-spacing:-.02em;}
.pc-cab em{display:block;font-style:normal;font-size:13px;opacity:.55;margin-top:4px;}
.pc-temp{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#c4001f;background:rgba(255,45,85,.12);border:1px solid rgba(255,45,85,.5);padding:6px 12px;}
.pc-temp i{width:8px;height:8px;border-radius:50%;background:#ff2d55;animation:pic-vivo-r 1.8s ease-out infinite;}
@keyframes pic-vivo-r{0%{box-shadow:0 0 0 0 rgba(255,45,85,.6)}100%{box-shadow:0 0 0 10px rgba(255,45,85,0)}}
.pc-kpis{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(20,20,20,.12);}
.pc-kpis div{padding:18px 0 16px;}
.pc-kpis div+div{padding-left:22px;border-left:1px solid rgba(20,20,20,.1);}
.pc-kpis b{display:block;font-size:34px;font-weight:200;letter-spacing:-.03em;}
.pc-kpis span{font-size:12px;opacity:.55;}
.pc-cuerpo{display:grid;grid-template-columns:1fr 420px;gap:40px;padding-top:22px;}
.pc-barra{display:grid;grid-template-columns:64px 1fr 44px;align-items:center;gap:12px;margin-bottom:12px;font-size:13px;}
.pc-barra div{height:8px;background:rgba(20,20,20,.08);}
.pc-barra div i{display:block;height:100%;animation:pic-barra 1.4s cubic-bezier(.16,1,.3,1) .6s both;transform-origin:0 50%;}
.pc-barra em{font-style:normal;text-align:right;opacity:.6;font-variant-numeric:tabular-nums;}
.pc-dias{display:flex;align-items:flex-end;gap:6px;height:44px;}
.pc-dias i{flex:1;background:var(--verde);}
.pic-mapa{width:100%;height:auto;display:block;background:rgba(20,20,20,.04);}
.pc-pie{margin-top:16px!important;font-size:11px;opacity:.45;}

.pic-usos{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:40px;}
.pic-usos>div{border-top:1px solid rgba(251,251,250,.3);padding-top:16px;}
.pic-usos h3{font-size:19px;font-weight:400;letter-spacing:-.01em;}
.pic-usos p{margin-top:8px!important;font-size:13px;font-weight:300;line-height:1.55;opacity:.68;}
.pic-meta{display:flex;gap:16px;align-items:flex-start;margin-top:40px;padding:18px 20px;background:rgba(226,180,90,.12);border-left:2px solid var(--oro);}
.pic-meta i{flex:none;width:9px;height:9px;margin-top:6px;border-radius:50%;background:#19e27a;animation:pic-vivo-v 2s ease-out infinite;}
@keyframes pic-vivo-v{0%{box-shadow:0 0 0 0 rgba(25,226,122,.7)}100%{box-shadow:0 0 0 12px rgba(25,226,122,0)}}
.pic-meta p{font-size:14px;font-weight:300;line-height:1.55;}
.pic-meta strong{font-weight:500;color:var(--oro);}

/* Casas tipo: maqueta fuera de la isla */
.pic-casas{position:absolute;inset:0;display:grid;grid-template-columns:640px 1fr;}
.pic-casas-txt{padding:150px 0 120px 104px;display:flex;flex-direction:column;justify-content:center;}
.pic-tabs{margin-top:32px;border-top:1px solid rgba(20,20,20,.14);}
.pic-tabs button{display:grid;grid-template-columns:36px 130px 1fr;align-items:baseline;width:100%;padding:14px 0;border:0;border-bottom:1px solid rgba(20,20,20,.14);background:none;color:inherit;text-align:left;cursor:pointer;opacity:.45;transition:opacity .35s;}
.pic-tabs button:hover{opacity:.8;}
.pic-tabs button.on{opacity:1;}
.pic-tabs i{font-style:normal;font-size:12px;font-weight:500;color:var(--verde);}
.pic-tabs b{font-size:19px;font-weight:400;}
.pic-tabs span{font-size:13px;font-weight:300;opacity:.7;}
.pic-aviso{margin-top:28px;padding:16px 18px;border:1px solid rgba(154,106,18,.45);background:rgba(226,180,90,.14);}
.pic-aviso b{display:block;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#9a6a12;margin-bottom:6px;}
.pic-aviso p{font-size:13px;line-height:1.55;opacity:.8;}
.pic-casas-3d{position:relative;margin:110px 104px 100px 40px;background:radial-gradient(ellipse at 50% 60%,#fbfbf8 0,#ecebe5 70%);}
.pic-casas-lienzo{position:absolute;inset:0;}
.pic-casas-carga{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:13px;opacity:.55;}
.pic-casas-pista{position:absolute;left:24px;bottom:20px;font-size:12px;opacity:.5;pointer-events:none;}
.pic-casas-sello{position:absolute;left:50%;top:28px;transform:translateX(-50%) rotate(-1.5deg);display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 26px 11px;border:2px solid rgba(154,106,18,.75);outline:1px solid rgba(154,106,18,.35);outline-offset:3px;background:rgba(251,248,238,.82);backdrop-filter:blur(4px);color:#8a5d0c;pointer-events:none;white-space:nowrap;}
.pic-casas-sello b{font-size:15px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;}
.pic-casas-sello span{font-size:11px;font-weight:500;letter-spacing:.06em;opacity:.85;}

.pic-entregas{display:grid;grid-template-columns:repeat(3,1fr);gap:48px 40px;margin-top:80px;}
.pic-entregas>div{border-top:1px solid rgba(251,251,250,.3);padding-top:18px;}
.pic-entregas h3,.pic-fases h3,.pic-servicios h3{font-size:22px;font-weight:300;letter-spacing:-.01em;}
.pic-entregas p{margin-top:8px!important;font-size:14px;font-weight:300;opacity:.65;line-height:1.5;}

/* Casa club: carrusel protagonista */
.pic-club{position:absolute;inset:0;}
.pic-club-txt{position:absolute;left:104px;top:130px;bottom:120px;width:480px;display:flex;flex-direction:column;justify-content:center;}
.pic-carrusel{position:absolute;left:680px;right:104px;top:130px;bottom:120px;overflow:hidden;background:#111;box-shadow:0 40px 90px rgba(0,0,0,.45);}
.pic-carrusel figure{position:absolute;inset:0;margin:0;opacity:0;transition:opacity 1.4s cubic-bezier(.4,0,.2,1);}
.pic-carrusel figure.on{opacity:1;}
.pic-carrusel img{width:100%;height:100%;object-fit:cover;transform:scale(1.08);}
.pic-carrusel figure.on img{animation:pic-kb 6s linear both;}
@keyframes pic-kb{from{transform:scale(1.02)}to{transform:scale(1.1)}}
.pic-carrusel-pie{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:60px 32px 26px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55));}
.pic-carrusel-pie span{font-size:14px;font-weight:300;animation:pic-salta .9s cubic-bezier(.16,1,.3,1);}
.pic-carrusel-pie div{display:flex;gap:6px;}
.pic-carrusel-pie i{width:22px;height:2px;background:rgba(251,251,250,.35);transition:background .4s;}
.pic-carrusel-pie i.on{background:var(--blanco);}

.pic-fases{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:72px;}
.pic-fases>div{background:rgba(13,13,13,.45);border-top:2px solid var(--oro);padding:24px 24px 26px;backdrop-filter:blur(6px);}
.pic-fases>div.opc{border-top-color:rgba(251,251,250,.35);}
.pic-fases em{display:block;font-style:normal;font-size:13px;color:var(--oro);margin-top:6px;}
.pic-fases>div.opc em{color:rgba(251,251,250,.55);}
.pic-fases ul{margin-top:16px!important;}
.pic-fases li{font-size:13px;font-weight:300;opacity:.72;padding:9px 0;border-bottom:1px solid rgba(251,251,250,.1);}

.pic-servicios{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:64px;}
.pic-servicios>div{background:var(--papel);color:var(--tinta);padding:26px 26px 22px;display:flex;flex-direction:column;min-height:330px;}
.pic-servicios>div.demo{background:transparent;color:var(--blanco);border:1px dashed rgba(251,251,250,.4);}
.pic-servicios p{margin-top:12px!important;font-size:14px;font-weight:300;line-height:1.55;opacity:.7;flex:1;}
.pic-servicios b{font-size:13px;font-weight:600;padding-top:14px;border-top:1px solid currentColor;}
.pic-servicios .demo b{opacity:.6;font-weight:400;}

/* Honorarios (como Torre del Mangle) */
.pic-hon{position:absolute;inset:0;padding:120px 104px 110px;display:grid;grid-template-columns:.58fr 1.42fr;grid-template-rows:1fr auto;column-gap:88px;row-gap:22px;}
.pic-hon-izq{padding-top:10px;}
.pic-hon-cifras{display:flex;gap:44px;margin-top:40px;padding-top:24px;border-top:1px solid rgba(20,20,20,.14);}
.pic-hon-cifras b{display:block;font-size:44px;font-weight:200;letter-spacing:-.03em;line-height:1;}
.pic-hon-cifras span{display:block;font-size:12px;opacity:.55;margin-top:8px;}
.pic-hon-der{display:flex;flex-direction:column;gap:10px;}
.h-cab,.h-fila{display:grid;grid-template-columns:70px 1fr 110px 90px 56px 120px;align-items:center;gap:10px;}
.h-cab{font-size:11px;font-weight:500;opacity:.5;padding:0 18px 4px;}
.h-cab span:nth-child(n+4){text-align:right;}
.h-caja{border:1px solid rgba(20,20,20,.14);padding:12px 18px 6px;}
.h-tit{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid rgba(20,20,20,.1);}
.h-tit b{font-size:13px;font-weight:600;}
.h-tit em{font-style:normal;font-size:11px;font-weight:500;padding:4px 10px;border:1px solid rgba(20,20,20,.3);}
.h-fila{padding:9px 0;border-bottom:1px solid rgba(20,20,20,.07);}
.h-fila:last-child{border-bottom:0;}
.h-n{font-size:12px;font-weight:500;opacity:.6;}
.h-t b{display:block;font-size:15px;font-weight:400;}
.h-t span{display:block;font-size:11px;opacity:.55;margin-top:2px;}
.h-c{font-size:12px;opacity:.6;}
.h-b{text-align:right;font-size:15px;font-variant-numeric:tabular-nums;opacity:.8;transition:opacity .5s;}
.h-d{justify-self:end;font-size:10px;font-weight:600;color:#fff;background:var(--verde);padding:3px 6px;opacity:0;transform:scale(.6);transition:all .5s cubic-bezier(.16,1,.3,1) .15s;}
.h-d.on{opacity:1;transform:none;}
.h-f{text-align:right;font-size:20px;font-weight:300;letter-spacing:-.01em;font-variant-numeric:tabular-nums;padding:6px 10px;transition:background .6s .3s;}
.h-f.on{background:rgba(20,20,20,.06);}
.h-f em{font-style:normal;font-size:11px;font-weight:600;color:#9a6a12;background:rgba(226,180,90,.22);padding:4px 8px;}
.h-sub{font-size:11px;font-weight:500;opacity:.45;padding:10px 0 2px;border-top:1px solid rgba(20,20,20,.1);margin-top:2px;}
.pic .tachado{text-decoration:line-through;text-decoration-color:#b03a2e;opacity:.4!important;}
.pic-hon-barra{grid-column:1 / -1;display:flex;align-items:center;gap:30px;background:var(--grafito);color:var(--blanco);padding:20px 30px;}
.pic-hon-barra>b{font-size:40px;font-weight:200;letter-spacing:-.03em;opacity:.4;transition:opacity .6s,color .6s;}
.pic-hon-barra.on>b{opacity:1;color:var(--oro);}
.pic-hon-barra strong{display:block;font-size:12px;font-weight:600;}
.pic-hon-barra span{display:block;font-size:12px;opacity:.6;margin-top:2px;}
.h-total{margin-left:auto;display:flex;align-items:baseline;gap:16px;}
.h-total span{font-size:11px;opacity:.55;margin:0;}
.h-total em{font-style:normal;font-size:20px;font-weight:300;}
.h-total strong{font-size:34px;font-weight:300;letter-spacing:-.02em;animation:pic-salta .7s cubic-bezier(.16,1,.3,1);}

/* Cronograma (como Torre del Mangle) */
.pic-crono{position:absolute;inset:0;padding:120px 104px 100px;display:flex;flex-direction:column;}
.cr-cab{display:flex;justify-content:space-between;align-items:flex-end;}
.cr-cab .pic-t2{font-size:44px;}
.cr-cab .pic-p{max-width:620px;margin-top:16px!important;}
.cr-sem{display:flex;align-items:flex-end;gap:12px;}
.cr-sem b{font-size:76px;font-weight:200;letter-spacing:-.04em;line-height:.9;}
.cr-sem span{font-size:12px;opacity:.55;line-height:1.35;padding-bottom:6px;}
.cr-gantt{margin-top:40px;border-top:1px solid rgba(20,20,20,.14);}
.cr-fila{display:grid;grid-template-columns:420px 1fr;align-items:center;min-height:52px;border-bottom:1px solid rgba(20,20,20,.08);}
.cr-num{min-height:34px;grid-template-columns:420px repeat(17,1fr);}
.cr-num span{font-size:11px;opacity:.45;}
.cr-num b{font-size:11px;font-weight:500;opacity:.45;text-align:center;}
.cr-et{display:flex;gap:16px;align-items:baseline;}
.cr-et i{font-style:normal;font-size:11px;font-weight:500;opacity:.55;width:48px;}
.cr-et b{display:block;font-size:15px;font-weight:400;}
.cr-et span{display:block;font-size:11px;opacity:.5;margin-top:1px;}
.cr-pista{position:relative;height:100%;min-height:52px;display:grid;grid-template-columns:repeat(17,1fr);}
.cr-pista>span{border-left:1px solid rgba(20,20,20,.06);}
.cr-pista em{position:absolute;top:50%;height:20px;margin-top:-10px;background:var(--grafito);display:flex;align-items:center;padding-left:14px;transform-origin:0 50%;animation:pic-barra 1.1s cubic-bezier(.16,1,.3,1) both;}
.cr-pista em.sup{background:var(--verde);}
.cr-pista em.opc{background:rgba(20,20,20,.06);border:1px solid rgba(20,20,20,.3);}
.cr-pista em small{font-size:10px;color:#fff;opacity:.85;}
.cr-pista em.opc small{color:var(--tinta);opacity:.6;}
.cr-pista u{position:absolute;top:50%;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;background:var(--papel);border:1.5px solid var(--grafito);}
.cr-pista u.i{left:-4.5px;}
.cr-pista u.f{right:-4.5px;}
.cr-pista q{position:absolute;top:50%;width:9px;height:9px;margin:-15px 0 0 -4.5px;background:var(--oro);transform:rotate(45deg);quotes:none;}
@keyframes pic-barra{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.cr-pagos{display:grid;grid-template-columns:repeat(4,1fr);gap:36px;margin-top:32px;}
.cr-pagos>div>b{display:block;font-size:12px;font-weight:600;padding-bottom:10px;border-bottom:1px solid rgba(20,20,20,.14);margin-bottom:6px;}
.cr-pago{display:grid;grid-template-columns:16px 76px 1fr auto;align-items:center;gap:6px;padding:6px 0;font-size:12px;}
.cr-pago i{width:8px;height:8px;border-radius:50%;border:1.5px solid var(--grafito);}
.cr-pago span{opacity:.5;}
.cr-pago em{font-style:normal;opacity:.8;}
.cr-pago strong{font-weight:500;font-size:13px;font-variant-numeric:tabular-nums;}
.cr-leyenda{display:flex;align-items:center;gap:26px;margin-top:auto;padding-top:20px;font-size:11px;opacity:.65;}
.cr-leyenda span{display:inline-flex;align-items:center;gap:8px;}
.cr-leyenda i{display:inline-block;}
.cr-leyenda i.o{width:8px;height:8px;border-radius:50%;border:1.5px solid var(--grafito);}
.cr-leyenda i.h{width:8px;height:8px;background:var(--oro);transform:rotate(45deg);}
.cr-leyenda i.b{width:22px;height:8px;background:var(--grafito);}
.cr-leyenda i.g{width:22px;height:8px;background:var(--verde);}
.cr-leyenda i.p{width:22px;height:8px;border:1px solid rgba(20,20,20,.35);}
.cr-leyenda em{margin-left:auto;font-style:normal;}

/* Cierre (como Torre del Mangle) */
.pic-cierre{position:absolute;left:840px;right:104px;top:56px;bottom:110px;display:flex;flex-direction:column;}
.pic-cierre-cab{display:flex;justify-content:space-between;align-items:center;}
.pic-cierre-cab .pic-it{margin:0;}
.pic-cierre .pic-t2{margin-top:auto;}
.pic-cierre-tres{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:56px;}
.pic-cierre-tres b{display:block;font-size:17px;font-weight:400;}
.pic-cierre-tres p{margin-top:6px!important;font-size:12px;font-weight:300;opacity:.6;line-height:1.5;}
.pic-cierre-pasos{margin-top:48px;}
.pic-cierre-pasos ol{border-top:1px solid rgba(251,251,250,.16);}
.pic-cierre-pasos li{display:flex;gap:20px;padding:14px 0;border-bottom:1px solid rgba(251,251,250,.16);font-size:15px;font-weight:300;}
.pic-cierre-pasos i{font-style:normal;font-size:12px;font-weight:500;color:var(--oro);width:22px;}
.pic-cierre-pie{display:flex;align-items:flex-end;gap:56px;margin-top:auto;}
.pic-cierre-pie>b{font-size:44px;font-weight:200;letter-spacing:-.03em;margin-right:auto;}
.pic-cierre-pie div span:last-child{font-size:12px;opacity:.75;}
.pic-cierre-pie .pic-lbl{margin-bottom:6px;}

/* Ficha */
.pic-ficha{position:absolute;right:104px;top:150px;width:440px;background:var(--blanco);color:var(--tinta);padding:26px 30px 24px;box-shadow:0 40px 90px rgba(0,0,0,.4);pointer-events:auto;opacity:0;transform:translateX(30px);visibility:hidden;transition:opacity .5s,transform .8s cubic-bezier(.16,1,.3,1),visibility 0s linear .5s;}
.pic-ficha.on{opacity:1;transform:none;visibility:visible;transition:opacity .5s .5s,transform .8s cubic-bezier(.16,1,.3,1) .5s,visibility 0s;}
.pic-ficha-cab{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--verde);}
.pic-ficha-cab button{background:none;border:0;font-size:22px;line-height:1;cursor:pointer;opacity:.5;padding:0 0 0 10px;}
.pic-ficha-id{margin-top:14px;font-size:56px;font-weight:200;letter-spacing:-.04em;line-height:1;}
.pic-ficha-sub{font-size:13px;opacity:.55;margin-top:6px;}
.pic-ficha-estado{display:inline-flex;align-items:center;gap:8px;margin-top:16px;font-style:normal;font-size:13px;font-weight:600;background:color-mix(in srgb,var(--c) 20%,#fff);border:1.5px solid var(--c);padding:6px 12px;}
.pic-ficha-estado i{width:9px;height:9px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c);}
.pic-ficha dl{display:grid;grid-template-columns:1fr 1fr;gap:16px 20px;margin:20px 0 0;padding-top:18px;border-top:1px solid rgba(20,20,20,.12);}
.pic-ficha dt{font-size:11px;opacity:.55;}
.pic-ficha dd{margin:3px 0 0;font-size:24px;font-weight:300;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}
.pic-ficha dd.t{font-size:15px;padding-top:6px;}
.pic-ficha dd small{font-size:12px;opacity:.55;}
.pic-ficha p{margin-top:16px!important;padding-top:12px;border-top:1px solid rgba(20,20,20,.12);font-size:11px;opacity:.55;line-height:1.5;}
.pic-ficha-volver{margin-top:16px;background:none;border:0;padding:0;font-size:13px;color:var(--verde);cursor:pointer;}
.pic-toast{position:absolute;left:50%;top:50%;transform:translate(-50%,-40%);opacity:0;transition:all .3s;background:var(--blanco);color:var(--tinta);padding:13px 20px;font-size:14px;white-space:nowrap;pointer-events:none;}
.pic-toast.on{opacity:1;transform:translate(-50%,-50%);}

/* Carga */
.pic-splash{position:absolute;inset:0;z-index:100;background:var(--negro);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;transition:opacity 1s ease .2s,visibility 0s linear 1.2s;}
.pic-splash.fuera{opacity:0;visibility:hidden;pointer-events:none;}
.pic-splash-logos{display:flex;align-items:center;gap:30px;animation:pic-salta 1.2s cubic-bezier(.16,1,.3,1) both;}
.pic-splash-logos .fp{height:24px;width:auto;}
.pic-splash-logos .rsa{height:52px;width:auto;}
.pic-splash-logos i{width:1px;height:44px;background:rgba(251,251,250,.35);}
.pic-splash-pie{display:flex;flex-direction:column;align-items:center;gap:12px;width:280px;font-size:12px;font-weight:300;color:rgba(251,251,250,.7);}
.pic-splash-pie small{font-size:11px;opacity:.6;font-variant-numeric:tabular-nums;}
.pic-barra{width:100%;height:1px;background:rgba(251,251,250,.25);}
.pic-barra i{display:block;height:100%;background:var(--blanco);transform-origin:0 50%;transition:transform .3s;}
.pic-splash-saltar{position:absolute;bottom:40px;background:none;border:0;color:rgba(251,251,250,.4);font-size:12px;cursor:pointer;text-decoration:underline;}

/* Gire el móvil */
.pic-rotar{display:none;}
@media (orientation:portrait) and (max-width:600px){
  .pic-rotar{display:flex;position:fixed;inset:0;z-index:200;flex-direction:column;align-items:center;justify-content:space-between;
    padding:calc(env(safe-area-inset-top) + 40px) 32px calc(env(safe-area-inset-bottom) + 32px);background:var(--negro);color:var(--blanco);
    text-align:center;overflow:hidden;animation:pic-rotar-in .8s cubic-bezier(.4,0,.2,1) both;touch-action:none;}
  .pic-rotar>*{position:relative;}
  .pic-rotar-fondo{position:absolute!important;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);max-width:none!important;object-fit:cover;filter:blur(30px) saturate(.7);opacity:.3;transform:scale(1.05);}
  .pic-rotar-logos{display:flex;align-items:center;gap:14px;}
  .pic-rotar-logos .fp{height:14px;width:auto;}
  .pic-rotar-logos .rsa{height:30px;width:auto;}
  .pic-rotar-logos i{width:1px;height:24px;background:rgba(251,251,250,.35);}
  .pic-rotar-centro{display:flex;flex-direction:column;align-items:center;}
  .pic-rotar-movil{color:var(--oro);margin-bottom:40px;transform-origin:50% 50%;animation:pic-rotar 3.2s cubic-bezier(.65,0,.35,1) .9s infinite;}
  .pic-rotar-ante{font-family:'Newsreader',serif;font-style:italic;font-size:17px;color:var(--oro);}
  .pic-rotar-titulo{margin-top:14px;font-size:44px;font-weight:200;letter-spacing:-.03em;line-height:1.02;}
  .pic-rotar-linea{width:48px;height:1px;background:var(--oro);margin:30px 0 26px;}
  .pic-rotar-texto{margin:0;font-size:16px;font-weight:300;line-height:1.55;opacity:.8;}
  .pic-rotar-ordenador{margin:22px 0 0;max-width:270px;padding:12px 16px;border:1px solid rgba(226,180,90,.45);font-size:13px;font-weight:300;line-height:1.5;color:var(--oro);}
  .pic-rotar-pie{margin:0;max-width:280px;font-size:11px;font-weight:300;line-height:1.5;opacity:.42;}
}
@keyframes pic-rotar-in{from{opacity:0}to{opacity:1}}
@keyframes pic-rotar{0%,22%{transform:rotate(0)}48%,78%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){.pic-slide,.pic-3d{transition:none!important;}.pic-rotar-movil{animation:none!important;}}
`
