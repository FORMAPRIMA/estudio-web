'use client'

// Piezas de interfaz de la maqueta. Estilo del área interna: Inter, crema, tinta,
// naranja FP como acento y microtipografía en versalitas.

import { useState, type CSSProperties, type ReactNode } from 'react'

export const T = {
  tinta: '#1A1A1A',
  tinta2: '#1A1A1AB3',
  tinta3: '#1A1A1A80',
  tinta4: '#1A1A1A4D',
  crema: '#F8F7F4',
  fondo: '#F3F1EC',
  borde: '#E8E6E0',
  suave: '#F0EEE8',
  acento: '#D85A30',
  ok: '#1D9E75',
  duda: '#F5A000',
  morado: '#7B3FB0',
  error: '#C0392B',
}

export const fmt = (n: number, dec = 1) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' } as Intl.NumberFormatOptions)

export function Rotulo({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.tinta3, fontWeight: 600, ...style }}>{children}</p>
}

type Variante = 'primario' | 'secundario' | 'fantasma' | 'acento' | 'duda'

export function Boton({ variante = 'secundario', children, style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', padding: '8px 14px', borderRadius: 6,
    cursor: rest.disabled ? 'default' : 'pointer', opacity: rest.disabled ? 0.45 : 1,
    transition: 'background .15s, border-color .15s, color .15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }
  const v: Record<Variante, CSSProperties> = {
    primario: { background: T.tinta, color: '#fff', border: `1px solid ${T.tinta}` },
    secundario: { background: '#fff', color: T.tinta, border: `1px solid ${T.borde}` },
    fantasma: { background: 'transparent', color: T.tinta2, border: '1px solid transparent' },
    acento: { background: T.acento, color: '#fff', border: `1px solid ${T.acento}` },
    duda: { background: T.duda, color: '#fff', border: `1px solid ${T.duda}` },
  }
  return <button {...rest} style={{ ...base, ...v[variante], ...style }}>{children}</button>
}

/** Control segmentado de 2-3 opciones. */
export function Segmentado<V extends string>({ valor, opciones, onCambio }: { valor: V; opciones: { value: V; label: string }[]; onCambio: (v: V) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 7, padding: 2, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
      {opciones.map(o => (
        <button key={o.value} onClick={() => onCambio(o.value)} style={{
          border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          background: valor === o.value ? T.tinta : 'transparent', color: valor === o.value ? '#fff' : T.tinta2,
        }}>{o.label}</button>
      ))}
    </div>
  )
}

/** Sección plegable del panel lateral. */
export function Seccion({ titulo, extra, abierta: inicial = true, children }: { titulo: string; extra?: ReactNode; abierta?: boolean; children: ReactNode }) {
  const [abierta, setAbierta] = useState(inicial)
  return (
    <section style={{ borderTop: `1px solid ${T.suave}` }}>
      <button onClick={() => setAbierta(a => !a)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: 9, color: T.tinta3, transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .15s', width: 10 }}>▶</span>
        <Rotulo>{titulo}</Rotulo>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.tinta3 }}>{extra}</span>
      </button>
      {abierta && <div style={{ padding: '0 20px 18px' }}>{children}</div>}
    </section>
  )
}

export function Chip({ color, children, onClick, activo }: { color: string; children: ReactNode; onClick?: () => void; activo?: boolean }) {
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
      background: activo ? color : `${color}14`, color: activo ? '#fff' : color, border: `1px solid ${color}40`, cursor: onClick ? 'pointer' : 'default',
    }}>{children}</span>
  )
}

export function Punto({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: size, background: color, flexShrink: 0 }} />
}

export function Campo({ label, ayuda, children }: { label: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: T.tinta2, marginBottom: 6 }}>{label}</span>
      {children}
      {ayuda && <span style={{ display: 'block', fontSize: 11, color: T.tinta3, marginTop: 5, lineHeight: 1.45 }}>{ayuda}</span>}
    </label>
  )
}

export const input: CSSProperties = {
  width: '100%', fontSize: 13, padding: '9px 11px', border: `1px solid ${T.borde}`, borderRadius: 6,
  background: '#fff', color: T.tinta, outline: 'none', fontFamily: 'inherit',
}

export function Interruptor({ activo, onCambio, label }: { activo: boolean; onCambio: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onCambio(!activo)} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
      <span style={{ width: 28, height: 16, borderRadius: 8, background: activo ? T.tinta : T.borde, position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: activo ? 14 : 2, width: 12, height: 12, borderRadius: 6, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
      </span>
      {label && <span style={{ fontSize: 11, color: T.tinta2 }}>{label}</span>}
    </button>
  )
}

/** Contador − n + para cantidades pequeñas. */
export function Contador({ valor, onCambio }: { valor: number; onCambio: (v: number) => void }) {
  const b: CSSProperties = { width: 22, height: 22, border: `1px solid ${T.borde}`, background: '#fff', borderRadius: 5, cursor: 'pointer', fontSize: 13, lineHeight: 1, color: T.tinta2, padding: 0 }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => onCambio(Math.max(0, valor - 1))} style={b} aria-label="Uno menos">−</button>
      <span style={{ minWidth: 14, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>{valor}</span>
      <button onClick={() => onCambio(valor + 1)} style={b} aria-label="Uno más">+</button>
    </span>
  )
}
