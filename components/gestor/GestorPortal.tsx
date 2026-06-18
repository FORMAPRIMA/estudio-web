// Portal de solo lectura para la gestoría. Server component: la navegación
// (pestañas, meses, extractos) funciona por enlaces con query params.

export interface GastoRow {
  id: string
  foto_url: string | null
  fecha_ticket: string | null
  monto: number | null
  moneda: string | null
  tipo: string
  proveedor: string | null
  nif_proveedor: string | null
  descripcion: string | null
  created_at: string
  proyecto: { nombre: string } | null
}

export interface FacturaRow {
  id: string
  numero_completo: string
  fecha_emision: string
  cliente_nombre: string
  base_imponible: number
  cuota_iva: number
  cuota_irpf: number | null
  total: number
  estado: string
}

export interface StatementRow {
  id: string
  year: number
  month: number
  month_to: number | null
  date_from: string | null
  date_to: string | null
  filename: string | null
  row_count: number | null
  created_at: string
}

export interface TransactionRow {
  id: string
  fecha: string | null
  hora: string | null
  concepto: string | null
  comercio: string | null
  importe: number | null
  moneda: string
  match_confidence: string | null
  linked_scan: { foto_url: string; proveedor: string | null; monto: number | null; fecha_ticket: string | null } | null
}

interface Props {
  token: string
  label: string | null
  vista: 'gastos' | 'facturas' | 'conciliacion'
  year: number
  month: number
  gastos: GastoRow[]
  facturas: FacturaRow[]
  statements: StatementRow[]
  transactions: TransactionRow[]
  selectedStatementId: string | null
}

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TIPO_LABELS: Record<string, string> = {
  taxi_transporte:       'Taxi / Transporte',
  restaurante_comida:    'Restaurante / Comida',
  alojamiento:           'Alojamiento',
  material_oficina:      'Material de oficina',
  software_suscripcion:  'Software / Suscripción',
  gasto_proyecto:        'Gasto de proyecto',
  factura_proveedor:     'Factura proveedor',
  otro:                  'Otro',
}

const ESTADO_FACTURA: Record<string, { label: string; color: string; bg: string }> = {
  emitida: { label: 'Emitida', color: '#1E40AF', bg: '#DBEAFE' },
  enviada: { label: 'Enviada', color: '#92400E', bg: '#FEF3C7' },
  pagada:  { label: 'Pagada',  color: '#065F46', bg: '#D1FAE5' },
  anulada: { label: 'Anulada', color: '#991B1B', bg: '#FEE2E2' },
}

function fmtMoney(monto: number | null | undefined, moneda = 'EUR') {
  if (monto == null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda || 'EUR' }).format(monto)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GestorPortal({
  token, label, vista, year, month,
  gastos, facturas, statements, transactions, selectedStatementId,
}: Props) {
  const base = `/gestor/${token}`
  const href = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) sp.set(k, String(v))
    return `${base}?${sp.toString()}`
  }

  // Navegación de mes (gastos)
  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const now = new Date()
  const hasNext = nextDate <= now

  // Totales de gastos por divisa
  const totalesGastos = Object.entries(
    gastos.reduce((acc, g) => {
      const c = g.moneda ?? 'EUR'
      acc[c] = (acc[c] ?? 0) + (g.monto ?? 0)
      return acc
    }, {} as Record<string, number>)
  )

  // Resumen conciliación
  const conJustificante = transactions.filter(t => t.linked_scan).length
  const gastosBancarios = transactions.filter(t => (t.importe ?? 0) < 0)
  const sinJustificante = gastosBancarios.filter(t => !t.linked_scan).length

  const selectedStatement = statements.find(s => s.id === selectedStatementId) ?? null

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1A1A1A', padding: '20px 24px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#888', margin: '0 0 4px' }}>Forma Prima</p>
            <h1 style={{ fontSize: 17, fontWeight: 300, color: '#fff', margin: 0, letterSpacing: '0.02em' }}>Portal de gestoría</h1>
          </div>
          {label && <span style={{ fontSize: 11, color: '#AAA' }}>{label}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', padding: '0 24px' }}>
          {([
            ['gastos', 'Gastos'],
            ['facturas', 'Facturas emitidas'],
            ['conciliacion', 'Conciliación bancaria'],
          ] as const).map(([key, lbl]) => (
            <a
              key={key}
              href={href(key === 'gastos' ? { vista: key, year, month } : key === 'facturas' ? { vista: key, year } : { vista: key })}
              style={{
                padding: '13px 18px', fontSize: 12, textDecoration: 'none',
                fontWeight: vista === key ? 700 : 500,
                color: vista === key ? '#D85A30' : '#888',
                borderBottom: vista === key ? '2px solid #D85A30' : '2px solid transparent',
              }}
            >{lbl}</a>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px' }}>

        {/* ════ GASTOS ════ */}
        {vista === 'gastos' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <a href={href({ vista: 'gastos', year: prevDate.getFullYear(), month: prevDate.getMonth() + 1 })}
                 style={{ padding: '6px 12px', border: '1px solid #E8E6E0', borderRadius: 6, fontSize: 14, color: '#555', textDecoration: 'none', background: '#fff' }}>←</a>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', minWidth: 140, textAlign: 'center' }}>
                {MESES_ES[month - 1]} {year}
              </span>
              {hasNext ? (
                <a href={href({ vista: 'gastos', year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 })}
                   style={{ padding: '6px 12px', border: '1px solid #E8E6E0', borderRadius: 6, fontSize: 14, color: '#555', textDecoration: 'none', background: '#fff' }}>→</a>
              ) : (
                <span style={{ padding: '6px 12px', border: '1px solid #F0EEE8', borderRadius: 6, fontSize: 14, color: '#DDD' }}>→</span>
              )}
              {gastos.length > 0 && (
                <a
                  href={`/api/gestor/${token}/gastos-zip?year=${year}&month=${month}`}
                  style={{ marginLeft: 'auto', padding: '8px 16px', background: '#1A1A1A', color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.04em' }}
                >↓ Descargar ZIP (Excel + fotos)</a>
              )}
            </div>

            {/* Totales */}
            {totalesGastos.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {totalesGastos.map(([currency, total]) => (
                  <div key={currency} style={{ padding: '12px 16px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, minWidth: 130 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Total {currency}</p>
                    <p style={{ fontSize: 18, fontWeight: 600, color: '#D85A30', margin: 0 }}>{fmtMoney(total, currency)}</p>
                    <p style={{ fontSize: 10, color: '#888', margin: '2px 0 0' }}>{gastos.filter(g => (g.moneda ?? 'EUR') === currency).length} documentos</p>
                  </div>
                ))}
              </div>
            )}

            {gastos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12, background: '#fff' }}>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Sin gastos registrados en {MESES_ES[month - 1]} {year}.</p>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#FAFAF8' }}>
                      {['Fecha', 'Tipo', 'Proveedor', 'NIF', 'Proyecto', 'Importe', 'Doc'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Importe' ? 'right' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA', borderBottom: '1px solid #F0EEE8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #F8F7F4' }}>
                        <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{g.fecha_ticket ?? fmtDate(g.created_at)}</td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>{TIPO_LABELS[g.tipo] ?? g.tipo}</td>
                        <td style={{ padding: '10px 12px', color: '#1A1A1A', fontWeight: 500 }}>
                          {g.proveedor ?? g.descripcion ?? '—'}
                          {g.proveedor && g.descripcion && <span style={{ display: 'block', fontSize: 10, color: '#AAA', fontWeight: 400 }}>{g.descripcion}</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#888', whiteSpace: 'nowrap' }}>{g.nif_proveedor ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#888' }}>{g.proyecto?.nombre ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}>{fmtMoney(g.monto, g.moneda ?? 'EUR')}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {g.foto_url
                            ? <a href={g.foto_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#D85A30', textDecoration: 'none', fontWeight: 600 }}>Ver</a>
                            : <span style={{ color: '#DDD' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════ FACTURAS ════ */}
        {vista === 'facturas' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <a href={href({ vista: 'facturas', year: year - 1 })}
                 style={{ padding: '6px 12px', border: '1px solid #E8E6E0', borderRadius: 6, fontSize: 14, color: '#555', textDecoration: 'none', background: '#fff' }}>←</a>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', minWidth: 80, textAlign: 'center' }}>{year}</span>
              {year < now.getFullYear() ? (
                <a href={href({ vista: 'facturas', year: year + 1 })}
                   style={{ padding: '6px 12px', border: '1px solid #E8E6E0', borderRadius: 6, fontSize: 14, color: '#555', textDecoration: 'none', background: '#fff' }}>→</a>
              ) : (
                <span style={{ padding: '6px 12px', border: '1px solid #F0EEE8', borderRadius: 6, fontSize: 14, color: '#DDD' }}>→</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>{facturas.length} facturas</span>
            </div>

            {facturas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12, background: '#fff' }}>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Sin facturas emitidas en {year}.</p>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#FAFAF8' }}>
                      {['Número', 'Fecha', 'Cliente', 'Base', 'IVA', 'IRPF', 'Total', 'Estado', 'PDF'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: ['Base','IVA','IRPF','Total'].includes(h) ? 'right' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA', borderBottom: '1px solid #F0EEE8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map(f => {
                      const est = ESTADO_FACTURA[f.estado] ?? { label: f.estado, color: '#555', bg: '#F3F4F6' }
                      return (
                        <tr key={f.id} style={{ borderBottom: '1px solid #F8F7F4' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}>{f.numero_completo}</td>
                          <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_emision)}</td>
                          <td style={{ padding: '10px 12px', color: '#555' }}>{f.cliente_nombre}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', whiteSpace: 'nowrap' }}>{fmtMoney(f.base_imponible)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', whiteSpace: 'nowrap' }}>{fmtMoney(f.cuota_iva)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', whiteSpace: 'nowrap' }}>{f.cuota_irpf ? fmtMoney(-Math.abs(f.cuota_irpf)) : '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}>{fmtMoney(f.total)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: est.color, background: est.bg, padding: '2px 8px', borderRadius: 4 }}>{est.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <a href={`/api/gestor/${token}/factura/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#D85A30', textDecoration: 'none', fontWeight: 600 }}>PDF</a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════ CONCILIACIÓN ════ */}
        {vista === 'conciliacion' && (
          <>
            {statements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12, background: '#fff' }}>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Aún no hay extractos bancarios cargados.</p>
              </div>
            ) : (
              <>
                {/* Selector de extracto */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
                  {statements.map(s => {
                    const active = s.id === selectedStatementId
                    const lbl = s.month_to && s.month_to !== s.month
                      ? `${MESES_ES[s.month - 1].slice(0, 3)}–${MESES_ES[s.month_to - 1].slice(0, 3)} ${s.year}`
                      : `${MESES_ES[s.month - 1]} ${s.year}`
                    return (
                      <a
                        key={s.id}
                        href={href({ vista: 'conciliacion', extracto: s.id })}
                        style={{
                          flexShrink: 0, fontSize: 11, padding: '6px 14px', borderRadius: 20, textDecoration: 'none',
                          border: '1px solid', fontWeight: active ? 700 : 400,
                          background: active ? '#1A1A1A' : '#fff', color: active ? '#fff' : '#555',
                          borderColor: active ? '#1A1A1A' : '#E8E6E0',
                        }}
                      >{lbl}</a>
                    )
                  })}
                </div>

                {/* Resumen */}
                {selectedStatement && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Movimientos</p>
                      <p style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{transactions.length}</p>
                    </div>
                    <div style={{ padding: '12px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#065F46', margin: '0 0 4px' }}>Con justificante</p>
                      <p style={{ fontSize: 18, fontWeight: 600, color: '#065F46', margin: 0 }}>{conJustificante}</p>
                    </div>
                    <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#991B1B', margin: '0 0 4px' }}>Gastos sin justificante</p>
                      <p style={{ fontSize: 18, fontWeight: 600, color: '#991B1B', margin: 0 }}>{sinJustificante}</p>
                    </div>
                  </div>
                )}

                <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#FAFAF8' }}>
                        {['Fecha', 'Concepto', 'Importe', 'Justificante'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Importe' ? 'right' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA', borderBottom: '1px solid #F0EEE8' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #F8F7F4' }}>
                          <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{t.fecha ?? '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#1A1A1A' }}>
                            {t.comercio ?? t.concepto ?? '—'}
                            {t.comercio && t.concepto && <span style={{ display: 'block', fontSize: 10, color: '#AAA' }}>{t.concepto}</span>}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: (t.importe ?? 0) < 0 ? '#991B1B' : '#065F46' }}>
                            {fmtMoney(t.importe, t.moneda)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {t.linked_scan ? (
                              <a href={t.linked_scan.foto_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#065F46', textDecoration: 'none', fontWeight: 600 }}>
                                ✓ {t.linked_scan.proveedor ?? 'Ver ticket'}
                              </a>
                            ) : (t.importe ?? 0) < 0 ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', background: '#FEE2E2', padding: '2px 8px', borderRadius: 4 }}>Sin justificante</span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#CCC' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        <p style={{ fontSize: 10, color: '#BBB', textAlign: 'center', margin: '32px 0 8px' }}>
          Acceso de solo lectura · GEINEX GROUP, S.L. · contacto@formaprima.es
        </p>
      </div>
    </div>
  )
}
