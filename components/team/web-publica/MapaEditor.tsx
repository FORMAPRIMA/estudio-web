'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createMapaPunto, updateMapaPunto, deleteMapaPunto, reorderMapaPuntos, geocodificarPunto,
} from '@/app/actions/web-mapa'
import type { MapaPunto } from '@/lib/web-mapa'
import type { WebProyecto } from '@/lib/web-publica'

const INK = '#1A1A1A'
const BORDER = '#F0EEE8'

const labelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: 5, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none' }
const btn = (disabled: boolean): React.CSSProperties => ({ padding: '7px 14px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, color: INK, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap' })
const arrowBtn = (disabled: boolean): React.CSSProperties => ({ background: 'none', border: 'none', color: disabled ? `${INK}30` : `${INK}80`, fontSize: 9, cursor: disabled ? 'default' : 'pointer', padding: 2, lineHeight: 1 })

export function MapaEditor({ puntos, proyectos }: { puntos: MapaPunto[]; proyectos: WebProyecto[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lote, setLote] = useState<string | null>(null)

  const sinCoordenadas = puntos.filter((p) => p.lat == null || p.lng == null)

  const mover = (id: string, dir: -1 | 1) => {
    const ids = puntos.map((p) => p.id)
    const i = ids.indexOf(id); const j = i + dir
    if (j < 0 || j >= ids.length) return
    const next = [...ids]; [next[i], next[j]] = [next[j], next[i]]
    startTransition(async () => { await reorderMapaPuntos(next); router.refresh() })
  }

  /**
   * Geocodifica de una en una y en serie, no en paralelo: la API de Mapbox limita
   * a 600 peticiones por minuto y, sobre todo, así el contador avanza a la vista
   * y se puede parar sabiendo por dónde iba.
   */
  const geocodificarTodos = () => {
    startTransition(async () => {
      let hechos = 0, fallos = 0
      for (const p of sinCoordenadas) {
        setLote(`Geocodificando ${hechos + fallos + 1} de ${sinCoordenadas.length}…`)
        const r = await geocodificarPunto(p.id)
        if ('error' in r) { fallos++; console.warn('[mapa]', p.nombre, r.error) } else hechos++
      }
      setLote(`${hechos} geocodificados${fallos ? `, ${fallos} sin resultado` : ''}. Revísalos uno a uno antes de publicar.`)
      router.refresh()
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button onClick={() => startTransition(async () => { await createMapaPunto(); router.refresh() })} disabled={isPending} style={btn(isPending)}>
          + Añadir obra
        </button>
        {sinCoordenadas.length > 0 && (
          <button onClick={geocodificarTodos} disabled={isPending} style={btn(isPending)}>
            Geocodificar las {sinCoordenadas.length} sin coordenadas
          </button>
        )}
        {lote && <span style={{ fontSize: 12, color: `${INK}70` }}>{lote}</span>}
      </div>

      <p style={{ fontSize: 11.5, color: `${INK}55`, lineHeight: 1.6, margin: '0 0 18px', maxWidth: '86ch' }}>
        Estas son las obras que salen en el mapa de Madrid. Es un mapa de <strong style={{ fontWeight: 500 }}>trayectoria</strong>:
        aquí van todas, tengan o no ficha en la web. Las que sí la tengan, enlázalas en «Proyecto» y en el mapa aparecerá
        el botón para abrirla.
        <br />
        <strong style={{ fontWeight: 500 }}>Geocodificar acierta en torno al 95 %.</strong> Antes de publicar, comprueba
        punto por punto que la chincheta cae en el portal correcto: una obra en la calle equivocada es una afirmación falsa
        sobre dónde ha trabajado el estudio. El enlace «ver» de cada fila abre esa coordenada exacta en Google Maps.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {puntos.map((p, i) => (
          <Fila key={p.id} punto={p} index={i} total={puntos.length} proyectos={proyectos} onMove={mover} busy={isPending} />
        ))}
        {puntos.length === 0 && (
          <p style={{ fontSize: 13, color: `${INK}60` }}>
            Todavía no hay obras. Si acabas de ejecutar <code>web_mapa_puntos.sql</code>, la migración siembra las 27 del teaser.
          </p>
        )}
      </div>
    </div>
  )
}

function Fila({ punto, index, total, proyectos, onMove, busy }: {
  punto: MapaPunto; index: number; total: number; proyectos: WebProyecto[]
  onMove: (id: string, dir: -1 | 1) => void; busy: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState({
    nombre: punto.nombre,
    direccion: punto.direccion ?? '',
    anio: punto.anio ?? '',
    proyecto_id: punto.proyecto_id ?? '',
    activo: punto.activo,
  })
  // Coordenadas a mano: el escape cuando la geocodificación deja la chincheta en
  // la calle equivocada, y el único camino cuando el token esté restringido por
  // dominio (una llamada desde servidor no manda Referer y Mapbox la rechaza).
  // Se aceptan pegadas de Google Maps en el formato «40.431538, -3.686550».
  const [coords, setCoords] = useState(
    punto.lat != null && punto.lng != null ? `${punto.lat}, ${punto.lng}` : ''
  )
  const [nota, setNota] = useState<string | null>(null)
  const ocupado = busy || isPending
  const situado = punto.lat != null && punto.lng != null

  const guardar = () => {
    const limpio = coords.trim()
    let lat: number | null = null
    let lng: number | null = null
    if (limpio) {
      const trozos = limpio.split(/[,\s]+/).filter(Boolean).map(Number)
      if (trozos.length !== 2 || trozos.some(Number.isNaN)) { setNota('Coordenadas: escribe «latitud, longitud».'); return }
      ;[lat, lng] = trozos
    }
    startTransition(async () => {
      const r = await updateMapaPunto(punto.id, {
        nombre: draft.nombre,
        direccion: draft.direccion || null,
        anio: draft.anio || null,
        proyecto_id: draft.proyecto_id || null,
        activo: draft.activo,
        lat, lng,
      })
      setNota('error' in r ? r.error : 'Guardado')
      router.refresh()
    })
  }

  const situar = () => {
    startTransition(async () => {
      const r = await geocodificarPunto(punto.id)
      if ('error' in r) { setNota(r.error); return }
      setNota(`Encontrado: ${r.encontrado}`)
      setCoords(`${r.lat}, ${r.lng}`)
      router.refresh()
    })
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, padding: 10, background: punto.activo ? '#fff' : '#FBFAF8' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: `${INK}40`, fontVariantNumeric: 'tabular-nums', paddingBottom: 8, width: 22 }}>
          {String(index + 1).padStart(2, '0')}
        </span>

        <div style={{ width: 165 }}>
          <label style={labelStyle}>Obra</label>
          <input value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ flex: 1, minWidth: 210 }}>
          <label style={labelStyle}>Dirección</label>
          <input value={draft.direccion} onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
            placeholder="Calle de Serrano 84, Madrid, España" style={inputStyle} />
        </div>

        <div style={{ width: 78 }}>
          <label style={labelStyle}>Año</label>
          <input value={draft.anio} onChange={(e) => setDraft({ ...draft, anio: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ width: 175 }}>
          <label style={labelStyle}>Proyecto</label>
          <select value={draft.proyecto_id} onChange={(e) => setDraft({ ...draft, proyecto_id: e.target.value })} style={inputStyle}>
            <option value="">— Sin ficha —</option>
            {proyectos.filter((p) => p.slug).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => onMove(punto.id, -1)} disabled={index === 0 || ocupado} style={arrowBtn(index === 0 || ocupado)}>▲</button>
          <button onClick={() => onMove(punto.id, 1)} disabled={index === total - 1 || ocupado} style={arrowBtn(index === total - 1 || ocupado)}>▼</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 9 }}>
        {/* La coordenada es editable: es lo que hay que revisar antes de publicar
            y, si la chincheta cae mal, se pega la buena desde Google Maps. */}
        <input value={coords} onChange={(e) => setCoords(e.target.value)}
          placeholder="Sin situar — lat, lng"
          title="Pega aquí las coordenadas de Google Maps si la chincheta cae mal"
          style={{ ...inputStyle, width: 205, padding: '6px 8px', fontVariantNumeric: 'tabular-nums',
            color: situado ? '#2e7d32' : '#b8860b' }} />
        {situado && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: `${INK}70` }}>ver ↗</a>
        )}
        <button onClick={situar} disabled={ocupado || !draft.direccion} style={btn(ocupado || !draft.direccion)}>
          {situado ? 'Volver a situar' : 'Situar'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: `${INK}70`, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.activo} onChange={(e) => setDraft({ ...draft, activo: e.target.checked })} />
          Visible en el mapa
        </label>
        <button onClick={guardar} disabled={ocupado} style={btn(ocupado)}>Guardar</button>
        <button
          onClick={() => { if (confirm(`¿Quitar «${punto.nombre}» del mapa?`)) startTransition(async () => { await deleteMapaPunto(punto.id); router.refresh() }) }}
          disabled={ocupado}
          style={{ background: 'none', border: 'none', color: `${INK}55`, fontSize: 11, cursor: 'pointer' }}>
          Eliminar
        </button>
        {nota && <span style={{ fontSize: 11, color: `${INK}70` }}>{nota}</span>}
      </div>
    </div>
  )
}
