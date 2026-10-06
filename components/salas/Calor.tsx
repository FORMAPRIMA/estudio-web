'use client'

// Mapa de calor de un dossier: una fila por diapositiva, una sola serie a la
// vez (tiempo medio o alcance), barra de un solo tono anclada a la izquierda y
// el valor siempre escrito en tinta. Al pasar por encima, el detalle completo.

import { useState } from 'react'
import { duracion, type SlideCalor } from '@/lib/salas/metricas'
import { S } from './theme'

type Medida = 'tiempo' | 'alcance'

export default function Calor({ datos, vacio }: { datos: SlideCalor[]; vacio?: string }) {
  const [medida, setMedida] = useState<Medida>('tiempo')
  const [foco, setFoco] = useState<number | null>(null)
  if (!datos.length || datos.every((d) => d.sesiones === 0)) {
    return <p style={{ fontSize: 13, color: S.soft, margin: 0 }}>{vacio ?? 'Aún no hay visitas con datos.'}</p>
  }
  const valor = (d: SlideCalor) => (medida === 'tiempo' ? d.msMedio : d.alcance)
  const max = Math.max(...datos.map(valor), medida === 'alcance' ? 1 : 1)
  // Las que más retienen: el podio de tiempos (si hay empate, entran todas las empatadas).
  const tiempos = Array.from(new Set(datos.map((d) => Math.round(d.msMedio / 1000)).filter((s) => s > 0))).sort((a, b) => b - a)
  const umbral = tiempos[Math.min(2, tiempos.length - 1)] ?? Infinity
  const top = datos.filter((d) => d.msMedio > 0 && Math.round(d.msMedio / 1000) >= umbral).map((d) => d.slide)

  return (
    <div>
      <div role="tablist" aria-label="Medida" style={{ display: 'inline-flex', border: `1px solid ${S.line}`, borderRadius: 6, padding: 2, marginBottom: 16, background: S.bg }}>
        {([['tiempo', 'Tiempo medio'], ['alcance', 'Alcance']] as [Medida, string][]).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={medida === id} onClick={() => setMedida(id)} style={{
            fontFamily: 'inherit', fontSize: 12, padding: '6px 12px', borderRadius: 4, border: 0, cursor: 'pointer',
            background: medida === id ? S.panel : 'transparent', color: medida === id ? S.ink : S.soft,
            boxShadow: medida === id ? '0 1px 2px #0000001a' : 'none', fontWeight: medida === id ? 500 : 400,
          }}>{l}</button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: S.soft, margin: '0 0 14px' }}>
        {medida === 'tiempo'
          ? 'Tiempo activo medio en cada diapositiva, entre las visitas que llegaron a ella.'
          : 'Porcentaje de visitas que llegaron a cada diapositiva. Donde cae, abandonan.'}
      </p>
      <div role="table" aria-label="Mapa de calor por diapositiva">
        {datos.map((d) => {
          const v = valor(d)
          const ancho = max ? (v / max) * 100 : 0
          const activa = foco === d.slide
          return (
            <div
              key={d.slide}
              role="row"
              onMouseEnter={() => setFoco(d.slide)}
              onMouseLeave={() => setFoco(null)}
              title={`${d.etiqueta} · ${Math.round(d.alcance * 100)} % de las visitas · ${duracion(d.msMedio)} de media · ${d.sesiones} ${d.sesiones === 1 ? 'visita' : 'visitas'} se pararon aquí`}
              style={{
                display: 'grid', gridTemplateColumns: 'minmax(110px, 200px) minmax(0, 1fr) 76px', gap: 12, alignItems: 'center',
                padding: '5px 6px', borderRadius: 4, background: activa ? S.bg : 'transparent',
              }}
            >
              <span role="cell" style={{ fontSize: 12.5, color: S.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: S.faint, fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>{String(d.slide + 1).padStart(2, '0')}</span>
                {d.etiqueta}
                {medida === 'tiempo' && top.includes(d.slide) && <span style={{ marginLeft: 6, fontSize: 10, color: S.accent, fontWeight: 600 }}>●</span>}
              </span>
              <span role="cell" aria-hidden="true" style={{ height: 14, background: S.lineSoft, borderRadius: 4, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.max(ancho, v > 0 ? 1.5 : 0)}%`, background: S.accent, opacity: activa ? 1 : 0.8, borderRadius: '0 4px 4px 0', transition: 'width .3s' }} />
              </span>
              <span role="cell" style={{ fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v ? S.ink : S.faint }}>
                {medida === 'tiempo' ? (d.msMedio ? duracion(d.msMedio) : '—') : `${Math.round(d.alcance * 100)} %`}
              </span>
            </div>
          )
        })}
      </div>
      {medida === 'tiempo' && top.length > 0 && (
        <p style={{ fontSize: 11.5, color: S.soft, margin: '12px 0 0' }}>
          <span style={{ color: S.accent }}>●</span> Las diapositivas que más retienen.
        </p>
      )}
    </div>
  )
}
