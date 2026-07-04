'use client'

// Visor del activo — modo 2D cartográfico (PNOA/IGN/Catastro) y modo 3D:
//  · light (por defecto): "maqueta de arquitecto" — suelo claro, edificios
//    blancos tipo clay render, envolvente naranja, sombras suaves
//  · dark: "gemelo digital" — suelo oscuro, contexto grafito, envolvente
//    naranja luminosa
// Datos 100% oficiales (IGN, Catastro, Ayto. Madrid). Sin API keys.

import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { bbox, centroid } from '@/lib/urban-analyst/geometry'
import type { GeoJSONGeometry } from '@/lib/urban-analyst/types'
import type { UAMode } from './uaTheme'

const IGN_BASE = 'https://www.ign.es/wmts/ign-base?layer=IGNBaseTodo&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}'
const PNOA = 'https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}'
const CATASTRO_WMS = 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Catastro&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'

const ALTURA_PLANTA_M = 3.1

interface TwinPalette {
  bg: string
  contexto: string
  contextoTop: string
  partes: string
  capaz: string
  capazOpacity: number
  parcela: string
  sombraCtxOpacity: number
  sombraPartesOpacity: number
}

// MapLibre necesita hexadecimales reales (no CSS vars)
const TWIN_PAL: Record<UAMode, TwinPalette> = {
  light: {
    bg: '#E9E7E1',
    contexto: '#EFEDE7',
    contextoTop: '#FCFBF8',
    partes: '#A9AFBB',
    capaz: '#D85A30',
    capazOpacity: 0.3,
    parcela: '#D85A30',
    sombraCtxOpacity: 0.1,
    sombraPartesOpacity: 0.16,
  },
  dark: {
    bg: '#0B0D11',
    contexto: '#252932',
    contextoTop: '#31363F',
    partes: '#7E8698',
    capaz: '#FF6A3D',
    capazOpacity: 0.34,
    parcela: '#FF6A3D',
    sombraCtxOpacity: 0.35,
    sombraPartesOpacity: 0.5,
  },
}

const contextoColorExpr = (p: TwinPalette) => ([
  'interpolate', ['linear'], ['get', 'altura'],
  3, p.contexto, 30, p.contextoTop,
] as never)

export interface Volumen3D {
  bandas: { geometry: GeoJSONGeometry; plantas: number | null; coef_z: string; remanente_m2c: number | null }[]
  partes: { geometry: GeoJSONGeometry; plantas_sobre: number | null }[]
}

interface Props {
  geometry: GeoJSONGeometry | null
  lat: number | null
  lng: number | null
  volumen?: Volumen3D | null
  /** Activa el modo 3D automáticamente al montar (si hay datos). */
  auto3D?: boolean
  mode?: UAMode
  /** Referencias ya incluidas en el activo (para no re-ofrecerlas). */
  currentRefcats?: string[]
  /** Si se pasa, el clic en el mapa 2D ofrece añadir la parcela al activo. */
  onAddParcela?: (refcat: string, direccion: string) => Promise<void>
}

export default function UrbanAssetMap({ geometry, lat, lng, volumen, auto3D, mode = 'light', currentRefcats, onAddParcela }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const contextLoadedRef = useRef(false)
  const orbitRef = useRef<number | null>(null)
  const is3DRef = useRef(false)
  const [base, setBase] = useState<'plano' | 'satelite'>('satelite')
  const [showCatastro, setShowCatastro] = useState(false)
  const [is3D, setIs3D] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isLoading3D, setIsLoading3D] = useState(false)
  const [isOrbiting, setIsOrbiting] = useState(false)

  const has3D = Boolean(volumen && (volumen.partes.length > 0 || volumen.bandas.length > 0))
  const P = TWIN_PAL[mode]
  const currentRefcatsRef = useRef<string[]>(currentRefcats || [])
  currentRefcatsRef.current = currentRefcats || []
  const onAddParcelaRef = useRef(onAddParcela)
  onAddParcelaRef.current = onAddParcela

  const stopOrbit = useCallback(() => {
    if (orbitRef.current != null) {
      cancelAnimationFrame(orbitRef.current)
      orbitRef.current = null
    }
    setIsOrbiting(false)
  }, [])

  const startOrbit = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    stopOrbit()
    setIsOrbiting(true)
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      map.setBearing(map.getBearing() + dt * 0.004)
      orbitRef.current = requestAnimationFrame(tick)
    }
    orbitRef.current = requestAnimationFrame(tick)
  }, [stopOrbit])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const center: [number, number] = lng != null && lat != null ? [lng, lat] : [-3.7038, 40.4168]
    const P0 = TWIN_PAL[mode]

    const map = new maplibregl.Map({
      container: containerRef.current,
      center,
      zoom: geometry ? 17 : 12,
      maxPitch: 72,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          plano:    { type: 'raster', tiles: [IGN_BASE], tileSize: 256, attribution: 'IGN' },
          satelite: { type: 'raster', tiles: [PNOA], tileSize: 256, attribution: 'PNOA IGN' },
          catastro: { type: 'raster', tiles: [CATASTRO_WMS], tileSize: 256, attribution: 'DG Catastro' },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': P0.bg } },
          { id: 'base-plano',    type: 'raster', source: 'plano',    layout: { visibility: 'none' } },
          { id: 'base-satelite', type: 'raster', source: 'satelite', layout: { visibility: 'visible' } },
          { id: 'catastro-wms',  type: 'raster', source: 'catastro', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } },
        ],
      },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('mousedown', stopOrbit)
    map.on('touchstart', stopOrbit)
    map.on('wheel', stopOrbit)

    map.on('load', () => {
      try {
        map.setLight({ anchor: 'viewport', color: '#FFF4EC', intensity: 0.45, position: [1.3, 200, 35] })
      } catch { /* opcional */ }

      if (geometry) {
        map.addSource('parcela', { type: 'geojson', data: { type: 'Feature', geometry, properties: {} } })
        map.addLayer({
          id: 'parcela-fill', type: 'fill', source: 'parcela',
          paint: { 'fill-color': '#D85A30', 'fill-opacity': 0.25 },
        })
        map.addLayer({
          id: 'parcela-line', type: 'line', source: 'parcela',
          paint: { 'line-color': '#D85A30', 'line-width': 2.5 },
        })
        const bb = bbox(geometry)
        if (bb) {
          map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 90, maxZoom: 18.4, duration: 0 })
        }
      } else if (lng != null && lat != null) {
        new maplibregl.Marker({ color: '#D85A30' }).setLngLat([lng, lat]).addTo(map)
      }

      map.addSource('contexto-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('partes-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('capaz-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      map.addLayer({
        id: 'sombra-contexto', type: 'fill', source: 'contexto-3d',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#000000', 'fill-opacity': P0.sombraCtxOpacity, 'fill-translate': [6, 6] },
      })
      map.addLayer({
        id: 'sombra-partes', type: 'fill', source: 'partes-3d',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#000000', 'fill-opacity': P0.sombraPartesOpacity, 'fill-translate': [8, 8] },
      })
      map.addLayer({
        id: 'contexto-3d', type: 'fill-extrusion', source: 'contexto-3d',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': contextoColorExpr(P0),
          'fill-extrusion-height': ['get', 'altura'],
          'fill-extrusion-opacity': 0.96,
          'fill-extrusion-vertical-gradient': true,
        },
      })
      map.addLayer({
        id: 'partes-3d', type: 'fill-extrusion', source: 'partes-3d',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': P0.partes,
          'fill-extrusion-height': ['get', 'altura'],
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      })
      map.addLayer({
        id: 'capaz-3d', type: 'fill-extrusion', source: 'capaz-3d',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': P0.capaz,
          'fill-extrusion-height': ['get', 'altura'],
          'fill-extrusion-opacity': P0.capazOpacity,
          'fill-extrusion-vertical-gradient': true,
        },
      })

      map.on('click', 'capaz-3d', (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { coef_z?: string; plantas?: number; remanente?: number | null }
        new maplibregl.Popup({ closeButton: false, className: 'ua-popup' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:inherit;font-size:11px;line-height:1.5">
              <div style="font-weight:600;color:var(--ua-brand);letter-spacing:.08em;text-transform:uppercase;font-size:9px;margin-bottom:2px">Envolvente capaz</div>
              <div>Banda COEF_Z «${p.coef_z ?? 's/d'}» · ${p.plantas ?? '?'} plantas</div>
              ${p.remanente != null ? `<div style="color:${Number(p.remanente) > 0 ? 'var(--ua-ok)' : 'var(--ua-bad)'}">Remanente: ${Number(p.remanente).toLocaleString('es-ES')} m²c</div>` : ''}
            </div>`
          )
          .addTo(map)
      })
      map.on('mouseenter', 'capaz-3d', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'capaz-3d', () => { map.getCanvas().style.cursor = '' })

      // Clic en 2D: identificar la parcela pulsada y ofrecer añadirla al activo
      map.on('click', async (e) => {
        if (is3DRef.current || !onAddParcelaRef.current) return
        try {
          const res = await fetch(`/api/urban-analyst/refcat-at?lat=${e.lngLat.lat}&lng=${e.lngLat.lng}`)
          if (!res.ok) return
          const { refcat, direccion } = await res.json() as { refcat: string; direccion: string }
          if (!refcat) return
          const yaIncluida = currentRefcatsRef.current.includes(refcat)

          const el = document.createElement('div')
          el.style.cssText = 'font-family:inherit;font-size:11px;line-height:1.5;max-width:230px'
          el.innerHTML = `
            <div style="font-weight:600;color:var(--ua-brand);letter-spacing:.08em;text-transform:uppercase;font-size:9px;margin-bottom:2px">Parcela</div>
            <div style="font-weight:600">${refcat}</div>
            <div style="color:var(--ua-sub);margin-bottom:6px">${direccion || ''}</div>`
          if (yaIncluida) {
            el.innerHTML += '<div style="color:var(--ua-ok);font-size:10px">✓ Ya incluida en este activo</div>'
          } else {
            const btn = document.createElement('button')
            btn.textContent = '+ Añadir al activo y re-analizar'
            btn.style.cssText = 'padding:6px 10px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;background:var(--ua-brand);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600'
            btn.onclick = async () => {
              btn.textContent = 'Añadiendo…'
              btn.disabled = true
              try { await onAddParcelaRef.current?.(refcat, direccion) } finally { popup.remove() }
            }
            el.appendChild(btn)
          }
          const popup = new maplibregl.Popup({ closeButton: true, className: 'ua-popup' })
            .setLngLat(e.lngLat)
            .setDOMContent(el)
            .addTo(map)
        } catch { /* silencioso */ }
      })

      setIsReady(true)
    })

    // El contenedor cambia de tamaño con el layout (flex/altura por viewport):
    // sin resize() el canvas queda desalineado y el centro aparente se desplaza
    const ro = new ResizeObserver(() => { try { map.resize() } catch { /* */ } })
    ro.observe(containerRef.current)

    mapRef.current = map
    return () => { ro.disconnect(); stopOrbit(); map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La geometría llega DESPUÉS del montaje cuando el análisis está corriendo:
  // crear/actualizar la fuente de la parcela y recentrar cuando aparezca
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady || !geometry) return
    const feat = { type: 'Feature' as const, geometry, properties: {} }
    const src = map.getSource('parcela') as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(feat as never)
    } else {
      map.addSource('parcela', { type: 'geojson', data: feat as never })
      // Insertar bajo las capas 3D para que la envolvente quede por encima
      const before = map.getLayer('sombra-contexto') ? 'sombra-contexto' : undefined
      map.addLayer({
        id: 'parcela-fill', type: 'fill', source: 'parcela',
        paint: { 'fill-color': '#D85A30', 'fill-opacity': 0.25 },
      }, before)
      map.addLayer({
        id: 'parcela-line', type: 'line', source: 'parcela',
        paint: { 'line-color': '#D85A30', 'line-width': 2.5 },
      }, before)
    }
    const bb = bbox(geometry)
    if (bb && !is3DRef.current) {
      map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 90, maxZoom: 18.4, duration: 600 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, isReady])

  // Re-tematizar el gemelo cuando cambia el modo
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady) return
    try {
      map.setPaintProperty('bg', 'background-color', P.bg)
      map.setPaintProperty('contexto-3d', 'fill-extrusion-color', contextoColorExpr(P))
      map.setPaintProperty('partes-3d', 'fill-extrusion-color', P.partes)
      map.setPaintProperty('capaz-3d', 'fill-extrusion-color', P.capaz)
      map.setPaintProperty('capaz-3d', 'fill-extrusion-opacity', P.capazOpacity)
      map.setPaintProperty('sombra-contexto', 'fill-opacity', P.sombraCtxOpacity)
      map.setPaintProperty('sombra-partes', 'fill-opacity', P.sombraPartesOpacity)
      if (is3DRef.current) {
        map.setPaintProperty('parcela-line', 'line-color', P.parcela)
      }
    } catch { /* capas aún no montadas */ }
  }, [mode, isReady, P])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady || is3D) return
    map.setLayoutProperty('base-plano', 'visibility', base === 'plano' ? 'visible' : 'none')
    map.setLayoutProperty('base-satelite', 'visibility', base === 'satelite' ? 'visible' : 'none')
  }, [base, isReady, is3D])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady) return
    map.setLayoutProperty('catastro-wms', 'visibility', showCatastro && !is3D ? 'visible' : 'none')
  }, [showCatastro, isReady, is3D])

  const enable3D = useCallback(async () => {
    const map = mapRef.current
    if (!map || !geometry || !volumen) return
    setIsLoading3D(true)

    const partesFc = {
      type: 'FeatureCollection' as const,
      features: volumen.partes
        .filter((p) => p.plantas_sobre != null && p.plantas_sobre > 0)
        .map((p) => ({
          type: 'Feature' as const,
          geometry: p.geometry,
          properties: { altura: (p.plantas_sobre || 0) * ALTURA_PLANTA_M },
        })),
    }
    const capazFc = {
      type: 'FeatureCollection' as const,
      features: volumen.bandas
        .filter((b) => b.plantas != null && b.plantas > 0)
        .map((b) => ({
          type: 'Feature' as const,
          geometry: b.geometry,
          properties: { altura: (b.plantas || 0) * ALTURA_PLANTA_M, coef_z: b.coef_z, plantas: b.plantas, remanente: b.remanente_m2c },
        })),
    }
    ;(map.getSource('partes-3d') as maplibregl.GeoJSONSource).setData(partesFc)
    ;(map.getSource('capaz-3d') as maplibregl.GeoJSONSource).setData(capazFc)

    if (!contextLoadedRef.current) {
      try {
        const bb = bbox(geometry)
        if (bb) {
          const pad = 0.0022
          const res = await fetch(`/api/urban-analyst/context-3d?bbox=${bb[0] - pad},${bb[1] - pad},${bb[2] + pad},${bb[3] + pad}&v=2`)
          if (res.ok) {
            const fc = await res.json() as { features: { geometry: { coordinates: unknown }; properties: { altura: number } }[] }
            const inParcelBbox = (f: { geometry: { coordinates: unknown } }) => {
              const first = (f.geometry.coordinates as number[][][])[0]?.[0]
              return Array.isArray(first)
                && first[0] >= bb[0] && first[0] <= bb[2]
                && first[1] >= bb[1] && first[1] <= bb[3]
            }
            const features = fc.features.filter((f) => !inParcelBbox(f))
            ;(map.getSource('contexto-3d') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features } as never)
            contextLoadedRef.current = true
          }
        }
      } catch { /* decorativo */ }
    }

    map.setLayoutProperty('base-plano', 'visibility', 'none')
    map.setLayoutProperty('base-satelite', 'visibility', 'none')
    map.setLayoutProperty('catastro-wms', 'visibility', 'none')
    map.setPaintProperty('parcela-fill', 'fill-color', P.parcela)
    map.setPaintProperty('parcela-fill', 'fill-opacity', 0.08)
    map.setPaintProperty('parcela-line', 'line-color', P.parcela)
    map.setPaintProperty('parcela-line', 'line-width', 2)
    for (const id of ['sombra-contexto', 'sombra-partes', 'contexto-3d', 'partes-3d', 'capaz-3d']) {
      map.setLayoutProperty(id, 'visibility', 'visible')
    }

    const c = centroid(geometry)
    map.easeTo({
      ...(c ? { center: c } : {}),
      pitch: 60, bearing: -30, duration: 1100, zoom: Math.max(map.getZoom(), 17.1),
    })
    setIsLoading3D(false)
    setIs3D(true)
    is3DRef.current = true
    window.setTimeout(() => startOrbit(), 1200)
  }, [geometry, volumen, startOrbit, P])

  const disable3D = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    stopOrbit()
    for (const id of ['sombra-contexto', 'sombra-partes', 'contexto-3d', 'partes-3d', 'capaz-3d']) {
      map.setLayoutProperty(id, 'visibility', 'none')
    }
    map.setLayoutProperty(base === 'plano' ? 'base-plano' : 'base-satelite', 'visibility', 'visible')
    map.setPaintProperty('parcela-fill', 'fill-color', '#D85A30')
    map.setPaintProperty('parcela-fill', 'fill-opacity', 0.25)
    map.setPaintProperty('parcela-line', 'line-color', '#D85A30')
    map.setPaintProperty('parcela-line', 'line-width', 2.5)
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
    setIs3D(false)
    is3DRef.current = false
  }, [base, stopOrbit])

  useEffect(() => {
    if (isReady && auto3D && has3D && !is3D) {
      const t = window.setTimeout(() => enable3D(), 450)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, auto3D, has3D])

  const chip = (active: boolean, accent = false): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
    background: active ? (accent ? 'var(--ua-brand)' : 'var(--ua-txt)') : 'var(--ua-glass)',
    color: active ? (accent ? '#fff' : 'var(--ua-bg)') : 'var(--ua-sub)',
    border: `1px solid ${active ? 'transparent' : 'var(--ua-edge)'}`,
    borderRadius: 4, cursor: 'pointer', fontWeight: active ? 600 : 400,
    backdropFilter: 'blur(8px)',
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 360, overflow: 'hidden', background: P.bg }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6, zIndex: 5, flexWrap: 'wrap' }}>
        {has3D && (
          <button
            style={chip(is3D, true)}
            onClick={() => (is3D ? disable3D() : enable3D())}
            disabled={isLoading3D}
          >
            {isLoading3D ? 'Cargando 3D…' : is3D ? '● Maqueta 3D' : 'Maqueta 3D'}
          </button>
        )}
        {!is3D && (
          <>
            <button style={chip(base === 'satelite')} onClick={() => setBase('satelite')}>Satélite</button>
            <button style={chip(base === 'plano')} onClick={() => setBase('plano')}>Plano</button>
            <button style={chip(showCatastro)} onClick={() => setShowCatastro(!showCatastro)}>Catastro</button>
          </>
        )}
        {is3D && (
          <button style={chip(isOrbiting)} onClick={() => (isOrbiting ? stopOrbit() : startOrbit())}>
            {isOrbiting ? '◉ Órbita' : 'Órbita'}
          </button>
        )}
      </div>

      {is3D && (
        <div style={{
          position: 'absolute', bottom: 14, left: 14, zIndex: 5,
          background: 'var(--ua-glass)', border: '1px solid var(--ua-edge)', borderRadius: 6,
          padding: '10px 14px', backdropFilter: 'blur(10px)',
        }}>
          <Legend color={P.partes} label="Edificio existente · plantas Catastro" />
          <Legend color={P.capaz} label="Volumen capaz · bandas COEF_Z (clic para detalle)" translucent />
          <Legend color={mode === 'light' ? '#D9D6CE' : P.contextoTop} label="Contexto · alturas reales municipales" />
        </div>
      )}
    </div>
  )
}

function Legend({ color, label, translucent }: { color: string; label: string; translucent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--ua-sub)', padding: '2px 0', fontWeight: 300 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: translucent ? 0.55 : 1, border: '1px solid var(--ua-edge)' }} />
      {label}
    </div>
  )
}
