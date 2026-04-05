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
  actions: { display: 'flex', gap: 8, marginTop: 20 },
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
  chapterWrap: { border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden', background: '#fff' },
  chapterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  chapterLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  chapterNum: { fontSize: 11, fontWeight: 600, color: '#CCC', width: 20, textAlign: 'right' as const },
  chapterName: { fontSize: 13, fontWeight: 400, color: '#1A1A1A', letterSpacing: '0.01em' },
  chapterChevron: { fontSize: 10, color: '#BBB' },
  subsWrap: { borderTop: '1px solid #F0EEE8' },
  subRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px 10px 56px',
    borderBottom: '1px solid #F8F7F4',
  },
  subDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: '#D4D0C8',
    marginRight: 12,
    flexShrink: 0,
  },
  subName: { fontSize: 12, fontWeight: 400, color: '#555' },
}

export default function FpExecutionTemplatePage() {
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setOpenChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const expandAll = () => setOpenChapters(new Set(TEMPLATE_DEFAULT.map(c => c.id)))
  const collapseAll = () => setOpenChapters(new Set())

  return (
    <div style={S.page}>
      <div style={S.header}>
        <p style={S.label}>FP Execution</p>
        <h1 style={S.title}>Template</h1>
        <div style={S.actions}>
          <button style={S.btnOutline} onClick={expandAll}>Expandir todo</button>
          <button style={S.btnOutline} onClick={collapseAll}>Colapsar todo</button>
        </div>
      </div>

      <div style={S.body}>
        {TEMPLATE_DEFAULT.map(capitulo => {
          const isOpen = openChapters.has(capitulo.id)
          return (
            <div key={capitulo.id} style={S.chapterWrap}>
              <div
                style={{ ...S.chapterRow, background: isOpen ? '#FAFAF8' : '#fff' }}
                onClick={() => toggle(capitulo.id)}
              >
                <div style={S.chapterLeft}>
                  <span style={S.chapterNum}>{capitulo.numero}</span>
                  <span style={S.chapterName}>{capitulo.nombre.toUpperCase()}</span>
                </div>
                <span style={S.chapterChevron}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={S.subsWrap}>
                  {capitulo.subcapitulos.map(sub => (
                    <div key={sub.id} style={S.subRow}>
                      <span style={S.subDot} />
                      <span style={S.subName}>{sub.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
