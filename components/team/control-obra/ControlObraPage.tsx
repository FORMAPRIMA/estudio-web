'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ObraData, type Partida, type Proveedor, type Vista, type EstadoPartida,
  importeCoste, importeCliente, baseImporteCoste, baseImporteCliente, importeActual, importeBase,
  presupuestoProveedor, pagadoProveedor, totalDepositos, totalPagos, balanceTesoreria,
  autoPucl, fmtEUR, fmtNum, fmtPct, fmtFecha, ESTADO_COLOR, buildCambiosCliente, tagCambio, clienteTotales,
} from '@/lib/control-obra/domain'
import {
  updatePartida, resetPartida, setPartidaEliminada, createPartida,
  createProveedor, updateProveedor, deleteProveedor,
  createPago, updatePago, deletePago,
  createDeposito, updateDeposito, deleteDeposito,
} from '@/app/actions/control-obra'

// ── Paleta / estilos base ───────────────────────────────────────────
const C = {
  ink: '#1A1A1A', cream: '#F8F7F4', card: '#fff', accent: '#D85A30',
  border: '#EDEAE3', borderSoft: '#F0EEE8', muted: '#1A1A1A70', faint: '#1A1A1A50',
  green: '#3D8B5F', red: '#C0492B',
}
const parseNum = (v: string): number => {
  let s = String(v ?? '').trim().replace(/\s/g, '')
  if (!s) return 0
  const hasComma = s.includes(','), hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // el último separador que aparece es el decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  // solo punto (o ninguno): se trata como decimal — "1.16" → 1.16
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}
const varColor = (d: number) => (Math.abs(d) < 0.005 ? C.faint : d > 0 ? C.red : C.green)

type Tab = 'partidas' | 'proveedores' | 'tesoreria' | 'cliente' | 'historico'

export default function ControlObraPage({ data }: { data: ObraData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('partidas')
  const [vista, setVista] = useState<Vista>('coste')
  const [presentacion, setPresentacion] = useState(false)

  const { obra, partidas, proveedores, pagos, depositos, log } = data

  const run = (fn: () => Promise<{ success: true } | { error: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      if ('error' in r) { alert(r.error); return }
      after?.()
      router.refresh()
    })

  // Totales globales
  const totBaseCoste = useMemo(() => partidas.reduce((s, p) => s + baseImporteCoste(p), 0), [partidas])
  const totActCoste = useMemo(() => partidas.reduce((s, p) => s + importeCoste(p), 0), [partidas])
  const totBaseCli = useMemo(() => partidas.reduce((s, p) => s + baseImporteCliente(p), 0), [partidas])
  const totActCli = useMemo(() => partidas.reduce((s, p) => s + importeCliente(p), 0), [partidas])
  // Totales de cara al cliente (respetan trasladar_cliente): pueden diferir del interno
  const cliTot = useMemo(() => clienteTotales(partidas), [partidas])

  if (presentacion) {
    return <PresentacionCliente partidas={partidas} totBase={cliTot.base} totAct={cliTot.actual} obra={obra.nombre} onClose={() => setPresentacion(false)} />
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'partidas', label: 'Partidas' },
    { id: 'proveedores', label: 'Proveedores y pagos' },
    { id: 'tesoreria', label: 'Tesorería' },
    { id: 'cliente', label: 'Vista cliente' },
    { id: 'historico', label: 'Histórico' },
  ]

  return (
    <div style={{ background: C.cream, minHeight: '100vh', color: C.ink }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.faint, marginBottom: 4 }}>
              Forma Prima · Control de obra
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>{obra.nombre}</h1>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              Baseline congelado · {fmtFecha(obra.baseline_fecha)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tab === 'partidas' && (
              <Segmented value={vista} onChange={(v) => setVista(v as Vista)} options={[{ v: 'coste', l: 'Coste' }, { v: 'cliente', l: 'Cliente' }]} />
            )}
            <button onClick={() => exportJSON(data)} style={btnGhost}>Exportar</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 4 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 14px', fontSize: 13, background: 'transparent',
              color: tab === t.id ? C.ink : C.muted, fontWeight: tab === t.id ? 600 : 400,
              borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px', opacity: isPending ? 0.6 : 1, transition: 'opacity .15s' }}>
        {tab === 'partidas' && (
          <PartidasTab obra={obra} partidas={partidas} proveedores={proveedores} vista={vista} run={run}
            totals={{ base: vista === 'coste' ? totBaseCoste : totBaseCli, act: vista === 'coste' ? totActCoste : totActCli }} />
        )}
        {tab === 'proveedores' && <ProveedoresTab obraId={obra.id} partidas={partidas} proveedores={proveedores} pagos={pagos} run={run} />}
        {tab === 'tesoreria' && <TesoreriaTab obraId={obra.id} depositos={depositos} pagos={pagos} totCoste={totActCoste} run={run} />}
        {tab === 'cliente' && (
          <ClienteResumen partidas={partidas} totBase={cliTot.base} totAct={cliTot.actual} onPresent={() => setPresentacion(true)} />
        )}
        {tab === 'historico' && <HistoricoTab log={log} />}
      </div>
    </div>
  )
}

// ═══════════════════════ PARTIDAS ═══════════════════════

const GRID = '96px minmax(0,1fr) 44px 62px 92px 108px 92px 108px 118px'

function PartidasTab({ obra, partidas, proveedores, vista, run, totals }: {
  obra: ObraData['obra']; partidas: Partida[]; proveedores: Proveedor[]; vista: Vista
  run: (fn: () => Promise<{ success: true } | { error: string }>, after?: () => void) => void
  totals: { base: number; act: number }
}) {
  const [q, setQ] = useState('')
  const [capCol, setCapCol] = useState<Set<number>>(new Set())
  const [subCol, setSubCol] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Partida | null>(null)
  const [creating, setCreating] = useState(false)

  const provName = (id: string | null) => proveedores.find((p) => p.id === id)?.nombre ?? '—'

  const grouped = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const caps = new Map<number, { nombre: string; subs: Map<string, { nombre: string; items: Partida[] }> }>()
    for (const p of partidas) {
      if (ql && !p.codigo.toLowerCase().includes(ql) && !p.descripcion.toLowerCase().includes(ql)) continue
      if (!caps.has(p.capitulo_num)) caps.set(p.capitulo_num, { nombre: p.capitulo_nombre, subs: new Map() })
      const cap = caps.get(p.capitulo_num)!
      if (!cap.subs.has(p.subcapitulo_codigo)) cap.subs.set(p.subcapitulo_codigo, { nombre: p.subcapitulo_nombre, items: [] })
      cap.subs.get(p.subcapitulo_codigo)!.items.push(p)
    }
    return Array.from(caps.entries()).sort((a, b) => a[0] - b[0]).map(([num, cap]) => ({
      num, nombre: cap.nombre,
      subs: Array.from(cap.subs.entries()).map(([code, s]) => ({ code, nombre: s.nombre, items: s.items })),
    }))
  }, [partidas, q])

  const searching = q.trim().length > 0
  const toggleCap = (n: number) => setCapCol((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x })
  const toggleSub = (c: string) => setSubCol((s) => { const x = new Set(s); x.has(c) ? x.delete(c) : x.add(c); return x })
  const dif = totals.act - totals.base

  const partidaRow = (p: Partida) => {
    const act = importeActual(p, vista); const base = importeBase(p, vista); const d = act - base
    const pu = vista === 'coste' ? p.puc : p.pucl; const puBase = vista === 'coste' ? p.base_puc : p.base_pucl
    const est = ESTADO_COLOR[p.estado]
    return (
      <div key={p.id} onClick={() => setEditing(p)} style={{
        ...gridRow(GRID), padding: '7px 16px 7px 28px', borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer',
        background: est.bg, alignItems: 'center',
        textDecoration: p.estado === 'eliminada' ? 'line-through' : 'none',
        opacity: p.estado === 'eliminada' ? 0.6 : 1,
      }}>
        <span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: est.dot, flexShrink: 0 }} />{p.codigo}
        </span>
        <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.descripcion}>
          {p.descripcion}
          {p.trasladar_cliente === false && p.estado !== 'igual' && (
            <span title="Cambio no trasladado al cliente" style={{ marginLeft: 6, fontSize: 8.5, color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: 3, padding: '1px 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>interno</span>
          )}
          <span style={{ color: C.faint, fontSize: 10.5 }}> · {provName(p.proveedor_id)}</span>
        </span>
        <span style={{ fontSize: 11, color: C.faint }}>{p.unidad}</span>
        <span style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(p.qty)}</span>
        <span style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(pu ?? 0, true)}</span>
        <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(act)}</span>
        <span style={{ textAlign: 'right', fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{p.estado === 'nueva' ? '—' : fmtEUR(puBase ?? 0, true)}</span>
        <span style={{ textAlign: 'right', fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{p.estado === 'nueva' ? '—' : fmtEUR(base)}</span>
        <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: varColor(d), fontVariantNumeric: 'tabular-nums' }}>
          {Math.abs(d) < 0.5 ? '—' : `${d > 0 ? '+' : ''}${fmtEUR(d)}${base ? ` · ${fmtPct(d / base)}` : ''}`}
        </span>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o descripción…"
          style={{ ...inputStyle, width: 360, maxWidth: '100%' }} />
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.muted, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['modificada', 'nueva', 'eliminada'] as EstadoPartida[]).map((e) => (
            <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: ESTADO_COLOR[e].dot, display: 'inline-block' }} />
              {ESTADO_COLOR[e].label}
            </span>
          ))}
        </div>
        <button onClick={() => setCreating(true)} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Nueva partida</button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ ...gridRow(GRID), background: '#FAF9F6', borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.faint, fontWeight: 600, padding: '9px 16px' }}>
          <span>Código</span><span>Descripción</span><span>Ud</span><span style={{ textAlign: 'right' }}>Cant.</span>
          <span style={{ textAlign: 'right' }}>PU actual</span><span style={{ textAlign: 'right' }}>Importe</span>
          <span style={{ textAlign: 'right' }}>PU base</span><span style={{ textAlign: 'right' }}>Imp. base</span>
          <span style={{ textAlign: 'right' }}>Variación</span>
        </div>

        {grouped.map((ch) => {
          const chItems = ch.subs.flatMap((s) => s.items)
          const chBase = chItems.reduce((s, p) => s + importeBase(p, vista), 0)
          const chAct = chItems.reduce((s, p) => s + importeActual(p, vista), 0)
          const chDif = chAct - chBase
          const capOpen = searching || !capCol.has(ch.num)
          return (
            <div key={ch.num}>
              {/* Capítulo */}
              <div onClick={() => toggleCap(ch.num)} style={{ ...gridRow(GRID), background: '#ECE8E0', borderTop: `1px solid ${C.border}`, cursor: 'pointer', padding: '10px 16px', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{capOpen ? '▾' : '▸'} {ch.num}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize' }}>{ch.nombre.toLowerCase()}</span>
                <span /><span /><span /><span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(chAct)}</span>
                <span /><span style={{ textAlign: 'right', fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(chBase)}</span>
                <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: varColor(chDif), fontVariantNumeric: 'tabular-nums' }}>
                  {Math.abs(chDif) < 0.5 ? '—' : (chDif > 0 ? '+' : '') + fmtEUR(chDif)}
                </span>
              </div>

              {capOpen && ch.subs.map((sub) => {
                const sBase = sub.items.reduce((s, p) => s + importeBase(p, vista), 0)
                const sAct = sub.items.reduce((s, p) => s + importeActual(p, vista), 0)
                const sDif = sAct - sBase
                const subOpen = searching || !subCol.has(sub.code)
                const nCambios = sub.items.filter((p) => p.estado !== 'igual').length
                return (
                  <div key={sub.code}>
                    {/* Subcapítulo */}
                    <div onClick={() => toggleSub(sub.code)} style={{ ...gridRow(GRID), background: '#F5F3EE', borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer', padding: '7px 16px 7px 16px', alignItems: 'center' }}>
                      <span style={{ fontSize: 10.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{subOpen ? '▾' : '▸'} {sub.code}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                        {sub.nombre.toLowerCase()}
                        {nCambios > 0 && <span style={{ marginLeft: 8, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.accent, fontWeight: 600 }}>{nCambios} cambio{nCambios > 1 ? 's' : ''}</span>}
                      </span>
                      <span /><span /><span /><span style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(sAct)}</span>
                      <span /><span style={{ textAlign: 'right', fontSize: 10.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(sBase)}</span>
                      <span style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 600, color: varColor(sDif), fontVariantNumeric: 'tabular-nums' }}>
                        {Math.abs(sDif) < 0.5 ? '—' : (sDif > 0 ? '+' : '') + fmtEUR(sDif)}
                      </span>
                    </div>
                    {subOpen && sub.items.map(partidaRow)}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Total bar */}
      <div style={{ ...gridRow(GRID), background: C.ink, color: '#fff', borderRadius: 8, marginTop: 12, padding: '14px 16px', alignItems: 'center' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', gridColumn: '1 / 5' }}>
          Total presupuesto · {vista === 'coste' ? 'coste' : 'cliente'}
        </span>
        <span style={{ textAlign: 'right', fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(totals.act)}</span>
        <span /><span style={{ textAlign: 'right', fontSize: 12, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(totals.base)}</span>
        <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: dif > 0 ? '#F3A18C' : dif < 0 ? '#9BD9B4' : '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {Math.abs(dif) < 0.5 ? '—' : `${dif > 0 ? '+' : ''}${fmtEUR(dif)}`}
        </span>
      </div>

      {editing && <EditDrawer partida={editing} proveedores={proveedores} vista={vista} run={run} onClose={() => setEditing(null)} />}
      {creating && <NuevaPartidaModal obra={obra} partidas={partidas} proveedores={proveedores} run={run} onClose={() => setCreating(false)} />}
    </>
  )
}

// ── Drawer de edición ───────────────────────────────────────────────
function EditDrawer({ partida, proveedores, vista, run, onClose }: {
  partida: Partida; proveedores: Proveedor[]; vista: Vista
  run: (fn: () => Promise<{ success: true } | { error: string }>, after?: () => void) => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(String(partida.qty ?? ''))
  const [puc, setPuc] = useState(String(partida.puc ?? ''))
  const [margin, setMargin] = useState(String(partida.margin ?? 1.16))
  const [puclAuto, setPuclAuto] = useState(partida.pucl_auto)
  const [pucl, setPucl] = useState(String(partida.pucl ?? ''))
  const [prov, setProv] = useState(partida.proveedor_id ?? '')
  const [motivo, setMotivo] = useState(partida.motivo_interno ?? '')
  const [nota, setNota] = useState(partida.nota_cliente ?? '')
  const [trasladar, setTrasladar] = useState(partida.trasladar_cliente)

  const nQty = parseNum(qty), nPuc = parseNum(puc), nMargin = parseNum(margin) || 1
  const nPucl = puclAuto ? autoPucl(nPuc, nMargin) : parseNum(pucl)
  const impCoste = nQty * nPuc, impCli = nQty * nPucl
  const baseC = baseImporteCoste(partida), baseCl = baseImporteCliente(partida)
  const deltaCoste = impCoste - baseC
  const cliVe = trasladar ? impCli : baseCl

  const save = () => run(() => updatePartida(partida.id, {
    qty: nQty, puc: nPuc, margin: nMargin, pucl: nPucl, pucl_auto: puclAuto, trasladar_cliente: trasladar,
    proveedor_id: prov || null, motivo_interno: motivo || null, nota_cliente: nota || null,
  }), onClose)

  return (
    <Drawer onClose={onClose} title={partida.codigo} subtitle={partida.descripcion} badge={ESTADO_COLOR[partida.estado]}>
      {partida.detalle && <p style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>{partida.detalle}</p>}

      <Field label="Cantidad" suffix={partida.unidad || ''}><input value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle} /></Field>
      <Field label="Precio unitario coste"><input value={puc} onChange={(e) => setPuc(e.target.value)} style={inputStyle} /></Field>
      <Field label="Margen (×)"><input value={margin} onChange={(e) => setMargin(e.target.value)} style={inputStyle} /></Field>
      <Field label="Precio unitario cliente">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={puclAuto ? String(autoPucl(nPuc, nMargin)) : pucl} disabled={puclAuto}
            onChange={(e) => setPucl(e.target.value)} style={{ ...inputStyle, background: puclAuto ? '#F3F1EC' : '#fff' }} />
          <label style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={puclAuto} onChange={(e) => setPuclAuto(e.target.checked)} /> auto
          </label>
        </div>
      </Field>
      <Field label="Proveedor">
        <select value={prov} onChange={(e) => setProv(e.target.value)} style={inputStyle}>
          <option value="">— Sin asignar —</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </Field>

      {/* Cálculo en vivo */}
      <div style={{ background: '#FAF9F6', border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, margin: '4px 0 14px', fontSize: 12 }}>
        <Row l="Importe coste" v={fmtEUR(impCoste, true)} base={partida.estado === 'nueva' ? null : fmtEUR(baseC, true)} d={impCoste - baseC} />
        <Row l="Importe cliente (interno)" v={fmtEUR(impCli, true)} base={partida.estado === 'nueva' ? null : fmtEUR(baseCl, true)} d={impCli - baseCl} />
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: C.muted }}>El cliente ve / paga</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtEUR(cliVe, true)}</span>
        </div>
      </div>

      {/* Trasladar al cliente */}
      <div style={{ border: `1px solid ${trasladar ? C.border : '#E7B8AE'}`, background: trasladar ? '#fff' : '#FCF3F0', borderRadius: 6, padding: 12, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          <input type="checkbox" checked={trasladar} onChange={(e) => setTrasladar(e.target.checked)} />
          Trasladar este cambio al cliente
        </label>
        <p style={{ fontSize: 11, color: C.muted, margin: '7px 0 0', lineHeight: 1.5 }}>
          {trasladar
            ? 'El cliente verá el nuevo precio en su vista y presupuesto.'
            : deltaCoste < -0.5
              ? `El cliente sigue pagando ${fmtEUR(baseCl, true)} (precio inicial). El ahorro de ${fmtEUR(-deltaCoste, true)} queda para nosotros.`
              : deltaCoste > 0.5
                ? `Asumimos el sobrecoste de ${fmtEUR(deltaCoste, true)}. El cliente sigue pagando ${fmtEUR(baseCl, true)} (precio inicial).`
                : 'El cliente sigue viendo el precio inicial; el cambio no se refleja en su vista.'}
        </p>
      </div>

      <Field label="Motivo interno"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas internas del cambio…" /></Field>
      <Field label="Comentario para el cliente"><textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Lo que verá el cliente en su vista…" /></Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={save} style={{ ...btnPrimary, flex: 1 }}>Guardar</button>
        {partida.estado !== 'nueva' && <button onClick={() => run(() => resetPartida(partida.id), onClose)} style={btnGhost}>Restaurar</button>}
        <button onClick={() => run(() => setPartidaEliminada(partida.id, partida.estado !== 'eliminada'), onClose)} style={btnDanger}>
          {partida.estado === 'eliminada' ? 'Reactivar' : partida.estado === 'nueva' ? 'Borrar' : 'No ejecutar'}
        </button>
      </div>
    </Drawer>
  )
}

function NuevaPartidaModal({ obra, partidas, proveedores, run, onClose }: {
  obra: ObraData['obra']; partidas: Partida[]; proveedores: Proveedor[]
  run: (fn: () => Promise<{ success: true } | { error: string }>, after?: () => void) => void
  onClose: () => void
}) {
  const capitulos = useMemo(() => {
    const m = new Map<number, string>()
    partidas.forEach((p) => m.set(p.capitulo_num, p.capitulo_nombre))
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [partidas])
  const subs = (cap: number) => {
    const m = new Map<string, string>()
    partidas.filter((p) => p.capitulo_num === cap).forEach((p) => m.set(p.subcapitulo_codigo, p.subcapitulo_nombre))
    return Array.from(m.entries())
  }
  const [cap, setCap] = useState(capitulos[0]?.[0] ?? 1)
  const [sub, setSub] = useState(subs(capitulos[0]?.[0] ?? 1)[0]?.[0] ?? '')
  const [codigo, setCodigo] = useState(''), [desc, setDesc] = useState(''), [detalle, setDetalle] = useState('')
  const [unidad, setUnidad] = useState(''), [qty, setQty] = useState('1'), [puc, setPuc] = useState('')
  const [margin, setMargin] = useState('1.16'), [prov, setProv] = useState(''), [motivo, setMotivo] = useState(''), [nota, setNota] = useState('')
  const [trasladar, setTrasladar] = useState(true)

  const nPuc = parseNum(puc), nMargin = parseNum(margin) || 1, nQty = parseNum(qty)
  const pucl = autoPucl(nPuc, nMargin)
  const subList = subs(cap)

  const create = () => run(() => createPartida({
    obra_id: obra.id, capitulo_num: cap, capitulo_nombre: capitulos.find((c) => c[0] === cap)?.[1] ?? '',
    subcapitulo_codigo: sub, subcapitulo_nombre: subList.find((s) => s[0] === sub)?.[1] ?? '',
    codigo: codigo.trim() || `${sub}.NUEVA`, descripcion: desc, detalle, unidad,
    qty: nQty, puc: nPuc, margin: nMargin, pucl, trasladar_cliente: trasladar, proveedor_id: prov || null, motivo_interno: motivo, nota_cliente: nota,
  }), onClose)

  return (
    <Drawer onClose={onClose} title="Nueva partida" subtitle="Se marcará como nueva (azul)">
      <Field label="Capítulo">
        <select value={cap} onChange={(e) => { const c = Number(e.target.value); setCap(c); setSub(subs(c)[0]?.[0] ?? '') }} style={inputStyle}>
          {capitulos.map(([n, name]) => <option key={n} value={n}>{n}. {name}</option>)}
        </select>
      </Field>
      <Field label="Subcapítulo">
        <select value={sub} onChange={(e) => setSub(e.target.value)} style={inputStyle}>
          {subList.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Código" flex><input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={`${sub}.x`} style={inputStyle} /></Field>
        <Field label="Unidad" flex><input value={unidad} onChange={(e) => setUnidad(e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} /></Field>
      <Field label="Detalle"><textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Cantidad" flex><input value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle} /></Field>
        <Field label="PU coste" flex><input value={puc} onChange={(e) => setPuc(e.target.value)} style={inputStyle} /></Field>
        <Field label="Margen" flex><input value={margin} onChange={(e) => setMargin(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ background: '#FAF9F6', border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, margin: '4px 0 16px', fontSize: 12 }}>
        <Row l="PU cliente (auto)" v={fmtEUR(pucl, true)} base={null} d={0} />
        <Row l="Importe coste" v={fmtEUR(nQty * nPuc, true)} base={null} d={0} />
        <Row l="Importe cliente" v={fmtEUR(nQty * pucl, true)} base={null} d={0} />
      </div>
      <Field label="Proveedor">
        <select value={prov} onChange={(e) => setProv(e.target.value)} style={inputStyle}>
          <option value="">— Sin asignar —</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </Field>
      <Field label="Motivo interno"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} style={inputStyle} /></Field>
      <Field label="Comentario para el cliente"><input value={nota} onChange={(e) => setNota(e.target.value)} style={inputStyle} /></Field>
      <div style={{ border: `1px solid ${trasladar ? C.border : '#E7B8AE'}`, background: trasladar ? '#fff' : '#FCF3F0', borderRadius: 6, padding: 12, margin: '4px 0 8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          <input type="checkbox" checked={trasladar} onChange={(e) => setTrasladar(e.target.checked)} />
          Trasladar al cliente
        </label>
        <p style={{ fontSize: 11, color: C.muted, margin: '7px 0 0', lineHeight: 1.5 }}>
          {trasladar ? 'El cliente verá esta partida nueva en su presupuesto.' : 'Partida interna: la asumimos nosotros y el cliente no la ve.'}
        </p>
      </div>
      <button onClick={create} style={{ ...btnPrimary, width: '100%', marginTop: 8 }}>Crear partida</button>
    </Drawer>
  )
}

// ═══════════════════════ PROVEEDORES ═══════════════════════

function ProveedoresTab({ obraId, partidas, proveedores, pagos, run }: {
  obraId: string; partidas: Partida[]; proveedores: Proveedor[]; pagos: ObraData['pagos']
  run: (fn: () => Promise<{ success: true } | { error: string }>, after?: () => void) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [pagoForm, setPagoForm] = useState<{ prov: string; monto: string; fecha: string; nota: string } | null>(null)

  const rows = proveedores.map((p) => {
    const presup = presupuestoProveedor(p, partidas)
    const pagado = pagadoProveedor(p.id, pagos)
    return { p, presup, pagado, pendiente: presup - pagado, pct: presup > 0 ? pagado / presup : 0, nPartidas: partidas.filter((x) => x.proveedor_id === p.id).length }
  })
  const totPresup = rows.reduce((s, r) => s + r.presup, 0)
  const totPagado = rows.reduce((s, r) => s + r.pagado, 0)

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nuevo proveedor…" style={{ ...inputStyle, width: 260 }} />
        <button onClick={() => nuevo.trim() && run(() => createProveedor(obraId, nuevo), () => setNuevo(''))} style={btnPrimary}>+ Añadir</button>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>
          Comprometido <b style={{ color: C.ink }}>{fmtEUR(totPresup)}</b> · Pagado <b style={{ color: C.ink }}>{fmtEUR(totPagado)}</b> · Pendiente <b style={{ color: C.accent }}>{fmtEUR(totPresup - totPagado)}</b>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 130px 130px 130px 160px', gap: 8, padding: '9px 16px', background: '#FAF9F6', borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.faint, fontWeight: 600 }}>
          <span>Proveedor</span><span style={{ textAlign: 'right' }}>Partidas</span><span style={{ textAlign: 'right' }}>Comprometido</span>
          <span style={{ textAlign: 'right' }}>Pagado</span><span style={{ textAlign: 'right' }}>Pendiente</span><span>% Pagado</span>
        </div>
        {rows.map(({ p, presup, pagado, pendiente, pct, nPartidas }) => {
          const isOpen = open === p.id
          const provPagos = pagos.filter((x) => x.proveedor_id === p.id)
          return (
            <div key={p.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
              <div onClick={() => setOpen(isOpen ? null : p.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 130px 130px 130px 160px', gap: 8, padding: '10px 16px', cursor: 'pointer', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{isOpen ? '▾' : '▸'} {p.nombre}</span>
                <span style={{ textAlign: 'right', fontSize: 12, color: C.faint }}>{nPartidas}</span>
                <span style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(presup)}{p.presupuesto_manual != null && <span title="Presupuesto manual" style={{ color: C.accent }}> ·m</span>}</span>
                <span style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(pagado)}</span>
                <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: pendiente > 0.5 ? C.accent : C.green, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(pendiente)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, height: 6, background: '#EDEAE3', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: pct >= 0.999 ? C.green : C.accent }} />
                  </span>
                  <span style={{ fontSize: 11, color: C.muted, width: 34, textAlign: 'right' }}>{(pct * 100).toFixed(0)}%</span>
                </span>
              </div>
              {isOpen && (
                <div style={{ padding: '4px 16px 16px', background: '#FAFAF8' }}>
                  {provPagos.length === 0 && <p style={{ fontSize: 12, color: C.faint, margin: '8px 0' }}>Sin pagos registrados.</p>}
                  {provPagos.map((pg, i) => (
                    <div key={pg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12 }}>
                      <span style={{ color: C.faint, width: 56 }}>Pago {i + 1}</span>
                      <span style={{ width: 120, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtEUR(pg.monto, true)}</span>
                      <span style={{ color: C.muted, width: 130 }}>{fmtFecha(pg.fecha, pg.fecha_texto)}</span>
                      <span style={{ color: C.muted, flex: 1 }}>{pg.nota || ''}</span>
                      <button onClick={() => run(() => deletePago(pg.id))} style={linkDanger}>Eliminar</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input placeholder="Importe (sin IVA)" id={`m-${p.id}`} style={{ ...inputStyle, width: 150 }}
                      onChange={(e) => setPagoForm({ prov: p.id, monto: e.target.value, fecha: pagoForm?.prov === p.id ? pagoForm.fecha : '', nota: pagoForm?.prov === p.id ? pagoForm.nota : '' })} />
                    <input type="date" style={{ ...inputStyle, width: 150 }}
                      onChange={(e) => setPagoForm((f) => ({ prov: p.id, monto: f?.prov === p.id ? f.monto : '', fecha: e.target.value, nota: f?.prov === p.id ? f.nota : '' }))} />
                    <input placeholder="Nota" style={{ ...inputStyle, width: 180 }}
                      onChange={(e) => setPagoForm((f) => ({ prov: p.id, monto: f?.prov === p.id ? f.monto : '', fecha: f?.prov === p.id ? f.fecha : '', nota: e.target.value }))} />
                    <button style={btnPrimary} onClick={() => {
                      const f = pagoForm
                      if (!f || f.prov !== p.id || !parseNum(f.monto)) { alert('Indica un importe.'); return }
                      run(() => createPago(obraId, p.id, { monto: parseNum(f.monto), fecha: f.fecha || null, nota: f.nota || null }), () => setPagoForm(null))
                    }}>Registrar pago</button>
                    <button style={{ ...linkDanger, marginLeft: 'auto' }} onClick={() => confirm(`¿Eliminar el proveedor ${p.nombre}? Se liberan sus partidas.`) && run(() => deleteProveedor(p.id))}>Eliminar proveedor</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ═══════════════════════ TESORERÍA ═══════════════════════

function TesoreriaTab({ obraId, depositos, pagos, totCoste, run }: {
  obraId: string; depositos: ObraData['depositos']; pagos: ObraData['pagos']; totCoste: number
  run: (fn: () => Promise<{ success: true } | { error: string }>, after?: () => void) => void
}) {
  const recibido = totalDepositos(depositos)
  const pagado = totalPagos(pagos)
  const balance = balanceTesoreria(depositos, pagos)
  const [form, setForm] = useState({ label: '', monto: '', iva: '', fecha: '' })
  const nMonto = parseNum(form.monto)
  const nIva = form.iva ? parseNum(form.iva) : nMonto * 0.21

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        <Kpi label="Depósitos del cliente" value={fmtEUR(recibido)} hint="Caja recibida (con IVA)" />
        <Kpi label="Pagado a proveedores" value={fmtEUR(pagado)} hint="Salidas (sin IVA)" />
        <Kpi label="Balance de tesorería" value={fmtEUR(balance)} hint="Caja disponible en obra" accent />
        <Kpi label="Coste total de obra" value={fmtEUR(totCoste)} hint="Presupuesto actual (coste)" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Depósitos del cliente a la constructora</h3>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 140px 130px 130px 90px', gap: 8, padding: '9px 16px', background: '#FAF9F6', borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.faint, fontWeight: 600 }}>
          <span>Concepto</span><span>Fecha</span><span style={{ textAlign: 'right' }}>Base</span><span style={{ textAlign: 'right' }}>IVA</span><span style={{ textAlign: 'right' }}>Total</span><span />
        </div>
        {depositos.map((d) => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 140px 130px 130px 90px', gap: 8, padding: '10px 16px', borderTop: `1px solid ${C.borderSoft}`, alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ fontWeight: 500 }}>{d.label || 'Depósito'}</span>
            <span style={{ color: C.muted }}>{fmtFecha(d.fecha, d.fecha_texto)}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(d.monto, true)}</span>
            <span style={{ textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(d.iva, true)}</span>
            <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(d.total, true)}</span>
            <span style={{ textAlign: 'right' }}><button onClick={() => run(() => deleteDeposito(d.id))} style={linkDanger}>Eliminar</button></span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 140px 130px 130px 90px', gap: 8, padding: '12px 16px', borderTop: `1px solid ${C.border}`, alignItems: 'center', background: '#FAFAF8' }}>
          <input placeholder="Concepto (Pago 4…)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={inputStyle} />
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={inputStyle} />
          <input placeholder="Base" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} />
          <input placeholder={`IVA (${fmtEUR(nIva, true)})`} value={form.iva} onChange={(e) => setForm({ ...form, iva: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} />
          <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtEUR(nMonto + nIva, true)}</span>
          <button style={btnPrimary} onClick={() => {
            if (!nMonto) { alert('Indica la base.'); return }
            run(() => createDeposito(obraId, { label: form.label || null, monto: nMonto, iva: nIva, total: nMonto + nIva, fecha: form.fecha || null }), () => setForm({ label: '', monto: '', iva: '', fecha: '' }))
          }}>Añadir</button>
        </div>
      </div>
      <p style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>
        El balance de tesorería = depósitos recibidos del cliente (con IVA) − pagos hechos a proveedores. Es la caja que la constructora tiene en obra.
      </p>
    </>
  )
}

// ═══════════════════════ VISTA CLIENTE ═══════════════════════

function ClienteResumen({ partidas, totBase, totAct, onPresent }: {
  partidas: Partida[]; totBase: number; totAct: number; onPresent: () => void
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 12.5, color: C.muted, maxWidth: 640, margin: 0 }}>
          Vista limpia para enseñar al cliente. Muestra el presupuesto (con margen) agrupado por capítulos y subcapítulos, con el precio anterior, el nuevo y la explicación de cada cambio. No aparece coste, margen, proveedores ni tesorería.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/api/control-obra/cliente-pdf" target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>⤓ Exportar PDF</a>
          <button onClick={onPresent} style={btnPrimary}>▶ Modo presentación</button>
        </div>
      </div>
      <ClienteBody partidas={partidas} totBase={totBase} totAct={totAct} />
    </>
  )
}

const CLI_GRID = 'minmax(0,1fr) 105px 105px 130px'

function ClienteBody({ partidas, totBase, totAct }: { partidas: Partida[]; totBase: number; totAct: number }) {
  const dif = totAct - totBase
  const porCap = useMemo(() => buildCambiosCliente(partidas), [partidas])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        <Kpi label="Presupuesto inicial" value={fmtEUR(totBase)} hint="Firmado al inicio" />
        <Kpi label="Presupuesto actual" value={fmtEUR(totAct)} hint="Con los cambios acordados" />
        <Kpi label="Diferencia" value={`${dif > 0 ? '+' : ''}${fmtEUR(dif)}`} hint={totBase ? fmtPct(dif / totBase) : ''} accent />
      </div>

      {porCap.length === 0 && <p style={{ fontSize: 13, color: C.muted }}>No hay cambios respecto al presupuesto inicial.</p>}

      {porCap.map((ch) => (
        <div key={ch.num} style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottom: `2px solid ${C.ink}`, marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize', margin: 0 }}>{ch.num}. {ch.nombre.toLowerCase()}</h3>
            <span style={{ fontSize: 13, fontWeight: 700, color: varColor(ch.dif), fontVariantNumeric: 'tabular-nums' }}>
              {Math.abs(ch.dif) < 0.5 ? '—' : `${ch.dif > 0 ? '+' : ''}${fmtEUR(ch.dif)}`}
            </span>
          </div>

          {/* cabecera de columnas */}
          <div style={{ ...gridRow(CLI_GRID), padding: '8px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.faint, fontWeight: 600 }}>
            <span>Concepto</span><span style={{ textAlign: 'right' }}>Anterior</span><span style={{ textAlign: 'right' }}>Nuevo</span><span style={{ textAlign: 'right' }}>Variación</span>
          </div>

          {ch.subs.map((sub) => (
            <div key={sub.codigo}>
              <p style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'capitalize', color: C.muted, margin: '10px 0 2px', padding: '0 4px' }}>{sub.nombre.toLowerCase()}</p>
              {sub.items.map((it, i) => {
                const tagColor = it.estado === 'nueva' ? '#3B7DD8' : it.estado === 'eliminada' ? '#C0492B' : C.accent
                return (
                  <div key={i} style={{ ...gridRow(CLI_GRID), padding: '10px 4px', borderTop: `1px solid ${C.borderSoft}`, alignItems: 'start' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                        {it.descripcion}
                        <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: tagColor, marginLeft: 8, fontWeight: 600 }}>{tagCambio(it.estado)}</span>
                      </p>
                      {it.nota
                        ? <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0', lineHeight: 1.5 }}>{it.nota}</p>
                        : <p style={{ fontSize: 11.5, color: C.faint, margin: '3px 0 0', fontStyle: 'italic' }}>Sin comentario</p>}
                    </div>
                    <span style={{ textAlign: 'right', fontSize: 13, color: C.faint, fontVariantNumeric: 'tabular-nums', textDecoration: it.estado === 'eliminada' ? 'line-through' : 'none' }}>
                      {it.estado === 'nueva' ? '—' : fmtEUR(it.ant)}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: varColor(it.dif), fontVariantNumeric: 'tabular-nums' }}>
                      {it.estado === 'eliminada' ? '—' : fmtEUR(it.nue)}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: varColor(it.dif), fontVariantNumeric: 'tabular-nums' }}>
                      {it.estado === 'nueva' ? 'Nueva' : it.estado === 'eliminada' ? '−100%' : it.pct != null ? `${it.dif > 0 ? '+' : ''}${fmtEUR(it.dif)} · ${fmtPct(it.pct)}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function PresentacionCliente({ partidas, totBase, totAct, obra, onClose }: {
  partidas: Partida[]; totBase: number; totAct: number; obra: string; onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: C.cream, zIndex: 100, overflow: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 40px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.faint }}>Forma Prima</p>
            <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '4px 0 0' }}>{obra}</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Estado económico de la obra</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/api/control-obra/cliente-pdf" target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>⤓ Exportar PDF</a>
            <button onClick={onClose} style={btnGhost}>✕ Salir</button>
          </div>
        </div>
        <ClienteBody partidas={partidas} totBase={totBase} totAct={totAct} />
      </div>
    </div>
  )
}

// ═══════════════════════ HISTÓRICO ═══════════════════════

function HistoricoTab({ log }: { log: ObraData['log'] }) {
  if (log.length === 0) return <p style={{ fontSize: 13, color: C.muted }}>Sin cambios registrados todavía.</p>
  const tipoColor: Record<string, string> = { modificada: '#E0A82E', nueva: '#3B7DD8', eliminada: '#D14343', restaurada: '#8A857C', pago: C.green, deposito: C.accent }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {log.map((l) => (
        <div key={l.id} style={{ display: 'flex', gap: 14, padding: '11px 16px', borderTop: `1px solid ${C.borderSoft}`, alignItems: 'baseline' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tipoColor[l.tipo] || C.faint, flexShrink: 0, alignSelf: 'center' }} />
          <span style={{ fontSize: 12, color: C.faint, width: 150, flexShrink: 0 }}>{new Date(l.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13 }}>{l.resumen}</span>
            {l.motivo && <span style={{ fontSize: 12, color: C.muted }}> — {l.motivo}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════ PRIMITIVOS UI ═══════════════════════

const gridRow = (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center' } as const)
const inputStyle: React.CSSProperties = { border: `1px solid #D9D5CC`, borderRadius: 4, padding: '7px 10px', fontSize: 13, background: '#fff', width: '100%', outline: 'none', color: C.ink }
const btnPrimary: React.CSSProperties = { background: C.accent, color: '#fff', fontSize: 12.5, padding: '8px 14px', borderRadius: 4, fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost: React.CSSProperties = { fontSize: 12.5, padding: '7px 12px', border: `1px solid #D9D5CC`, borderRadius: 4, color: C.muted, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnDanger: React.CSSProperties = { fontSize: 12.5, padding: '7px 12px', border: `1px solid #E7B8AE`, borderRadius: 4, color: C.red, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }
const linkDanger: React.CSSProperties = { fontSize: 11.5, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{ display: 'flex', background: '#F0EEE8', borderRadius: 6, padding: 2 }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '5px 12px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer',
          background: value === o.v ? '#fff' : 'transparent', color: value === o.v ? C.ink : C.muted,
          fontWeight: value === o.v ? 600 : 400, boxShadow: value === o.v ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
        }}>{o.l}</button>
      ))}
    </div>
  )
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? C.ink : C.card, color: accent ? '#fff' : C.ink, border: `1px solid ${accent ? C.ink : C.border}`, borderRadius: 8, padding: '18px 20px' }}>
      <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: accent ? '#ffffff99' : C.faint, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: '8px 0 2px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: accent ? '#ffffff88' : C.muted, margin: 0 }}>{hint}</p>}
    </div>
  )
}

function Field({ label, children, suffix, flex }: { label: string; children: React.ReactNode; suffix?: string; flex?: boolean }) {
  return (
    <div style={{ marginBottom: 12, flex: flex ? 1 : undefined }}>
      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>{label}{suffix ? ` · ${suffix}` : ''}</label>
      {children}
    </div>
  )
}

function Row({ l, v, base, d }: { l: string; v: string; base: string | null; d: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: C.muted }}>{l}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        <b>{v}</b>
        {base != null && <span style={{ color: C.faint }}> · base {base}</span>}
        {base != null && Math.abs(d) > 0.005 && <span style={{ color: varColor(d), fontWeight: 600 }}> · {d > 0 ? '+' : ''}{fmtEUR(d)}</span>}
      </span>
    </div>
  )
}

function Drawer({ title, subtitle, badge, children, onClose }: { title: string; subtitle?: string; badge?: { dot: string; label: string }; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,.3)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '100%', background: C.cream, boxShadow: '-8px 0 24px rgba(0,0,0,.12)', overflow: 'auto', padding: '24px 24px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{title}</p>
            {subtitle && <h2 style={{ fontSize: 16, fontWeight: 500, margin: '2px 0 0', lineHeight: 1.3 }}>{subtitle}</h2>}
          </div>
          <button onClick={onClose} style={{ ...btnGhost, padding: '4px 9px' }}>✕</button>
        </div>
        {badge && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted, marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: badge.dot }} />{badge.label}
        </span>}
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Export JSON (backup) ────────────────────────────────────────────
function exportJSON(data: ObraData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `control-obra-${data.obra.slug}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
