'use client'

import {
  type Parcela, type CotConfig,
  TIPOS, cotizar, eur, num, C,
} from '@/lib/visual-lab/valdeserra'

interface Props {
  u: Parcela
  cfg: CotConfig
  onChange: (cfg: CotConfig) => void
  onEmitir: () => void
  onClose: () => void
}

export default function CotizacionModal({ u, cfg, onChange, onEmitir, onClose }: Props) {
  const p = cotizar(u, cfg)
  const set = (k: keyof CotConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...cfg, [k]: +e.target.value })

  const palancas: { k: string; v: string; min: number; max: number; step: number; val: number; on: (e: React.ChangeEvent<HTMLInputElement>) => void }[] = [
    { k: 'Entrada', v: cfg.entrada + '%', min: 10, max: 70, step: 5, val: cfg.entrada, on: set('entrada') },
    { k: 'Mensualidades', v: cfg.meses + ' meses', min: 6, max: 48, step: 6, val: cfg.meses, on: set('meses') },
    { k: 'Pago a escritura', v: cfg.obra + '%', min: 0, max: 40, step: 5, val: cfg.obra, on: set('obra') },
    { k: 'Cuota de comunidad', v: eur(cfg.cuota) + '/mes', min: 180, max: 480, step: 5, val: cfg.cuota, on: set('cuota') },
  ]

  const filas: { k: string; v: string; fg: string }[] = [
    { k: 'Precio de la parcela', v: eur(u.precio), fg: C.ink },
    { k: 'Señal de reserva', v: eur(p.apartado), fg: '#3A3A36' },
    { k: 'Entrada al contrato', v: eur(p.entrada - p.apartado), fg: '#3A3A36' },
    { k: 'Saldo financiado sin intereses', v: eur(p.financiado), fg: '#3A3A36' },
    { k: 'Pago a escritura', v: eur(p.escritura), fg: '#3A3A36' },
    { k: 'IVA 21%', v: eur(p.iva), fg: C.muted },
    { k: 'Notaría y registro (est.)', v: eur(p.notaria), fg: C.muted },
    { k: 'Cuota de comunidad y club', v: eur(p.cuota) + ' / mes', fg: C.muted },
  ]

  return (
    <>
      <div className="vl-modal-bg" onClick={onClose} />
      <div className="vl-modal" role="dialog" aria-label={`Cotización de la parcela ${u.id}`}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="vl-label" style={{ margin: 0 }}>Cotización de parcela</p>
            <p style={{ fontSize: 28, lineHeight: 1.1, margin: '6px 0 0', fontWeight: 300, letterSpacing: '-0.01em' }}>{u.id}</p>
            <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>
              {TIPOS[u.tipo].label} · {num(u.sup)} m² · {num(u.pm2)} €/m²
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar cotización"
            style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 17, color: '#3A3A36' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 24px' }}>
          {palancas.map((i) => (
            <div key={i.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="vl-label">{i.k}</span>
                <span style={{ fontSize: 12 }}>{i.v}</span>
              </div>
              <input className="vl-range" type="range" min={i.min} max={i.max} step={i.step} value={i.val} onChange={i.on} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>

        <div style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
          {filas.map((r) => (
            <div key={r.k} className="vl-row">
              <span style={{ fontSize: 13, color: r.fg }}>{r.k}</span>
              <span style={{ fontSize: 13, color: r.fg, textAlign: 'right' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ margin: '18px 20px 0', padding: '14px 16px', background: '#FAF9F6', border: `1px solid ${C.borderSoft}`, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span className="vl-label">Mensualidad sin intereses</span>
          <span style={{ fontSize: 22, letterSpacing: '-0.01em' }}>{eur(p.mens)}</span>
        </div>

        <div style={{ padding: '18px 20px 26px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="vl-btn vl-btn-primary" style={{ flex: '1 1 200px', width: 'auto' }} onClick={onEmitir}>Emitir cotización</button>
          <button className="vl-btn vl-btn-ghost" style={{ flex: '0 0 auto', width: 'auto', padding: '13px 22px' }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </>
  )
}
