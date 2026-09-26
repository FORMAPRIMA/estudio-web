'use client'

import {
  type Parcela, type ReglasPrecio,
  TIPOS, DEMO, C,
  usd, num, datosParcela, manzanaLabel, factorLabel, factorPct,
} from '@/lib/visual-lab/isla-creta'

interface Props {
  u: Parcela
  reglas: ReglasPrecio
  demo: boolean
  onClose: () => void
  onAcercar: () => void
  onEnlace: () => void
}

/**
 * Ficha de una parcela de Isla Creta. Solo lectura: el inventario entregado
 * no tiene disponibilidad confirmada y los precios son de demostración, así
 * que no hay reserva, cotización ni plan de pago que emitir.
 */
export default function FichaIslaCreta({ u, reglas, demo, onClose, onAcercar, onEnlace }: Props) {
  const d = DEMO[u.demoStatus]
  return (
    <div className="vl-ficha">
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="vl-label" style={{ margin: 0 }}>{TIPOS[u.type].label}</p>
          <p style={{ fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '6px 0 0', fontWeight: 300 }}>{u.unitId}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '7px 0 0' }}>{manzanaLabel(u)} · Isla Creta · Etapa 1</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <span style={{ width: 7, height: 7, background: demo ? d.color : C.grey, display: 'block' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: demo ? d.color : C.muted }}>
              {demo ? `Estado simulado · ${d.label}` : 'Disponibilidad por confirmar'}
            </span>
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

      <div className="vl-datos" style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
        {datosParcela(u).map((x) => (
          <div key={x.k} style={{ padding: '11px 10px 12px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
            <p className="vl-label" style={{ margin: 0 }}>{x.k}</p>
            <p style={{ fontSize: 13, margin: '5px 0 0' }}>{x.v}</p>
          </div>
        ))}
      </div>

      {/* Precio: de demostración, y se dice */}
      <div style={{ margin: '18px 20px 0', padding: '16px 0 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: 0, color: C.accent }}>Precio de demostración</p>
        <p style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', margin: '8px 0 0', fontWeight: 300 }}>{usd(u.priceUsd)}</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '9px 0 0', lineHeight: 1.5 }}>
          {num(u.effectiveUsdM2)} USD/m² · valor provisional · sin impuestos ni comisiones
        </p>
      </div>

      <div style={{ margin: '20px 20px 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: '0 0 8px' }}>Cómo se ha calculado</p>
        <div className="vl-row">
          <span style={{ fontSize: 13, color: '#3A3A36' }}>Base {TIPOS[u.type].corto.toLowerCase()}</span>
          <span style={{ fontSize: 13 }}>{u.baseUsdM2} USD/m²</span>
        </div>
        {u.priceFactors.length === 0 && (
          <div className="vl-row">
            <span style={{ fontSize: 13, color: '#3A3A36' }}>Sin primas ni descuentos</span>
            <span style={{ fontSize: 13, color: C.faint }}>—</span>
          </div>
        )}
        {u.priceFactors.map((f) => (
          <div key={f.key} className="vl-row">
            <span style={{ fontSize: 13, color: '#3A3A36' }}>{factorLabel(f)}</span>
            <span style={{ fontSize: 13, color: f.factor >= 1 ? C.green : C.accent }}>{factorPct(f.factor)}</span>
          </div>
        ))}
        <div className="vl-row">
          <span style={{ fontSize: 13, color: '#3A3A36' }}>Redondeo</span>
          <span style={{ fontSize: 13 }}>a {num(reglas.roundingUsd)} USD</span>
        </div>
      </div>

      <div style={{ margin: '18px 20px 0', padding: '12px 14px', background: '#F4F2EC', borderRadius: 4 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.ink, margin: 0 }}>Precios ilustrativos</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.55 }}>
          No es una oferta ni una tasación. Referencias de precios anunciados en Samborondón, no operaciones cerradas.
          La cercanía al borde no acredita vistas ni acceso al agua. Versión {reglas.version}.
        </p>
      </div>

      <div style={{ margin: '22px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vl-btn vl-btn-primary" onClick={onAcercar}>Acercar a esta parcela</button>
        <button className="vl-btn vl-btn-ghost" onClick={onEnlace}>Copiar enlace a la parcela</button>
      </div>
    </div>
  )
}
