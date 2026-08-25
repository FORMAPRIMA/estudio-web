'use client'

import {
  type Parcela, type FichaTab,
  TIPOS, ESTADOS, ETAPAS, VIAS,
  FICHA_TABS, FICHA_HINT, FICHA_CAPTION,
  datosParcela, parametrosUrb, planPago, accionDe,
  eur, num, C,
} from '@/lib/visual-lab/valdeserra'

interface Props {
  u: Parcela
  tab: FichaTab
  onTab: (t: FichaTab) => void
  onClose: () => void
  onCotizar: () => void
  onReservar: () => void
  onDealRoom: () => void
}

export default function FichaParcela({ u, tab, onTab, onClose, onCotizar, onReservar, onDealRoom }: Props) {
  const est = ESTADOS[u.estado]

  return (
    <div className="vl-ficha">
      {/* Identidad */}
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="vl-label" style={{ margin: 0 }}>{TIPOS[u.tipo].label}</p>
          <p style={{ fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '6px 0 0', fontWeight: 300 }}>{u.id}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '7px 0 0' }}>
            {VIAS[u.via].label} · {ETAPAS[u.etapa].label} · {ETAPAS[u.etapa].estado}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <span style={{ width: 7, height: 7, background: est.color, display: 'block' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: est.color }}>{est.label}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar ficha"
          style={{
            flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center',
            border: `1px solid ${C.border}`, borderRadius: 4, color: '#3A3A36', fontSize: 17,
          }}
        >
          ×
        </button>
      </div>

      {/* Datos de la parcela */}
      <div className="vl-datos" style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
        {datosParcela(u).map((d) => (
          <div key={d.k} style={{ padding: '11px 10px 12px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
            <p className="vl-label" style={{ margin: 0 }}>{d.k}</p>
            <p style={{ fontSize: 13, margin: '5px 0 0' }}>{d.v}</p>
          </div>
        ))}
      </div>

      {/* Precio */}
      <div style={{ margin: '18px 20px 0', padding: '16px 0 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: 0 }}>Precio de la parcela</p>
        <p style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', margin: '8px 0 0', fontWeight: 300 }}>{eur(u.precio)}</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '9px 0 0', lineHeight: 1.5 }}>
          {num(u.pm2)} €/m² de suelo · IVA 21% no incluido · urbanización y acometidas incluidas
        </p>
      </div>

      {/* Documentación gráfica — hueco a rellenar con el material real del proyecto */}
      <div style={{ margin: '18px 20px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FICHA_TABS.map((t) => (
            <button key={t.id} onClick={() => onTab(t.id)} className="vl-chip vl-chip-sq" data-on={tab === t.id ? '1' : '0'}>
              {t.label}
            </button>
          ))}
        </div>
        <div
          style={{
            marginTop: 10, height: 200, borderRadius: 4, border: `1px dashed ${C.border}`,
            background: '#F4F2EC', display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center',
          }}
        >
          <div>
            <p style={{ fontSize: 22, margin: 0, opacity: 0.3 }}>◳</p>
            <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
              {FICHA_HINT[tab]}
              <br />
              <span style={{ color: C.faint }}>{u.id}</span>
            </p>
          </div>
        </div>
        <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, margin: '8px 0 0' }}>
          {FICHA_CAPTION[tab]}
        </p>
      </div>

      {/* Parámetros urbanísticos */}
      <Bloque titulo="Parámetros de edificación" filas={parametrosUrb(u)} />

      {/* Plan de pago */}
      <Bloque titulo="Plan de pago orientativo" filas={planPago(u)} />

      {/* Acciones */}
      <div style={{ margin: '22px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vl-btn vl-btn-primary" onClick={onCotizar}>Generar cotización</button>
        <button className="vl-btn vl-btn-ghost" onClick={onReservar}>{accionDe(u.estado)}</button>
        <button className="vl-btn vl-btn-plain" onClick={onDealRoom}>Compartir deal room</button>
      </div>
    </div>
  )
}

function Bloque({ titulo, filas }: { titulo: string; filas: { k: string; v: string }[] }) {
  return (
    <div style={{ margin: '20px 20px 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
      <p className="vl-label" style={{ margin: '0 0 8px' }}>{titulo}</p>
      {filas.map((p) => (
        <div key={p.k} className="vl-row">
          <span style={{ fontSize: 13, color: '#3A3A36' }}>{p.k}</span>
          <span style={{ fontSize: 13, textAlign: 'right' }}>{p.v}</span>
        </div>
      ))}
    </div>
  )
}
