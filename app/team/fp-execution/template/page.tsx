'use client'

import { useState } from 'react'
import { TEMPLATE_DEFAULT } from './templateData'

const S = {
  page: { background: '#F8F7F4', minHeight: '100vh' },
  header: {
    padding: '40px 40px 28px',
    background: '#fff',
    borderBottom: '1px solid #E8E6E0',
  },
  label: {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#AAA',
    fontWeight: 500,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: 200,
    color: '#1A1A1A',
    letterSpacing: '-0.01em',
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 20,
  },
  btnOutline: {
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    fontWeight: 500,
    padding: '7px 16px',
    border: '1px solid #E8E6E0',
    background: '#fff',
    color: '#666',
    cursor: 'pointer',
    borderRadius: 4,
  },
  body: { padding: '28px 40px', display: 'flex', flexDirection: 'column' as const, gap: 6 },
  // chapter
  chapterWrap: { border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden', background: '#fff' },
  chapterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    background: '#fff',
  },
  chapterLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  chapterNum: { fontSize: 11, fontWeight: 600, color: '#CCC', width: 20, textAlign: 'right' as const },
  chapterName: { fontSize: 13, fontWeight: 400, color: '#1A1A1A', letterSpacing: '0.01em' },
  chapterChevron: { fontSize: 10, color: '#BBB' },
  // subcapítulo
  subWrap: { borderTop: '1px solid #F0EEE8' },
  subRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 20px 11px 56px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    borderBottom: '1px solid #F8F7F4',
  },
  subName: { fontSize: 12, fontWeight: 400, color: '#444', letterSpacing: '0.02em' },
  subToggle: { fontSize: 16, color: '#BBB', lineHeight: 1 },
  // partidas table
  tableWrap: { padding: '0 20px 14px 56px' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#BBB',
    padding: '8px 10px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #E8E6E0',
  },
  thRight: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#BBB',
    padding: '8px 10px',
    textAlign: 'right' as const,
    borderBottom: '1px solid #E8E6E0',
  },
  td: { padding: '9px 10px', color: '#333', borderBottom: '1px solid #F8F7F4', verticalAlign: 'top' as const },
  tdMeta: { padding: '9px 10px', color: '#AAA', borderBottom: '1px solid #F8F7F4', verticalAlign: 'top' as const },
  tdCenter: { padding: '9px 10px', color: '#888', borderBottom: '1px solid #F8F7F4', textAlign: 'center' as const },
  tdRight: { padding: '9px 10px', color: '#CCC', borderBottom: '1px solid #F8F7F4', textAlign: 'right' as const },
}

export default function FpExecutionTemplatePage() {
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())

  const toggleChapter = (id: string) =>
    setOpenChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleSub = (id: string) =>
    setOpenSubs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const expandAll = () => {
    setOpenChapters(new Set(TEMPLATE_DEFAULT.map(c => c.id)))
    setOpenSubs(new Set(TEMPLATE_DEFAULT.flatMap(c => c.subcapitulos.map(s => s.id))))
  }

  const collapseAll = () => {
    setOpenChapters(new Set())
    setOpenSubs(new Set())
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <p style={S.label}>FP Execution</p>
        <h1 style={S.title}>Template</h1>
        <div style={S.actions}>
          <button style={S.btnOutline} onClick={expandAll}>Expandir todo</button>
          <button style={S.btnOutline} onClick={collapseAll}>Colapsar todo</button>
        </div>
      </div>

      {/* Tree */}
      <div style={S.body}>
        {TEMPLATE_DEFAULT.map(capitulo => {
          const isOpen = openChapters.has(capitulo.id)
          return (
            <div key={capitulo.id} style={S.chapterWrap}>
              {/* Chapter row */}
              <div
                style={{
                  ...S.chapterRow,
                  background: isOpen ? '#FAFAF8' : '#fff',
                }}
                onClick={() => toggleChapter(capitulo.id)}
              >
                <div style={S.chapterLeft}>
                  <span style={S.chapterNum}>{capitulo.numero}</span>
                  <span style={S.chapterName}>{capitulo.nombre.toUpperCase()}</span>
                </div>
                <span style={S.chapterChevron}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {/* Subcapítulos */}
              {isOpen && (
                <div style={S.subWrap}>
                  {capitulo.subcapitulos.map(sub => {
                    const subOpen = openSubs.has(sub.id)
                    return (
                      <div key={sub.id}>
                        <div
                          style={{ ...S.subRow, background: subOpen ? '#FAFAF8' : '#fff' }}
                          onClick={() => toggleSub(sub.id)}
                        >
                          <span style={S.subName}>{sub.nombre}</span>
                          <span style={S.subToggle}>{subOpen ? '−' : '+'}</span>
                        </div>

                        {/* Partidas */}
                        {subOpen && (
                          <div style={S.tableWrap}>
                            <table style={S.table}>
                              <thead>
                                <tr>
                                  <th style={S.th}>Concepto</th>
                                  <th style={S.th}>Descripción</th>
                                  <th style={{ ...S.th, textAlign: 'center', width: 60 }}>Ud</th>
                                  <th style={{ ...S.thRight, width: 80 }}>Cantidad</th>
                                  <th style={{ ...S.thRight, width: 100 }}>P. Unitario</th>
                                  <th style={{ ...S.thRight, width: 100 }}>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sub.partidas.map(partida => (
                                  <tr key={partida.id}>
                                    <td style={S.td}>{partida.concepto}</td>
                                    <td style={S.tdMeta}>{partida.descripcion}</td>
                                    <td style={S.tdCenter}>{partida.unidad}</td>
                                    <td style={S.tdRight}>—</td>
                                    <td style={S.tdRight}>—</td>
                                    <td style={S.tdRight}>—</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
