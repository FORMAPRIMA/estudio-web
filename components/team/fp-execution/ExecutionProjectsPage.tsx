'use client'

import { useState, useRef } from 'react'
import { TEMPLATE_DEFAULT } from '@/app/team/fp-execution/template/templateData'
import type { Capitulo } from '@/app/team/fp-execution/template/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileItem { id: string; name: string; size: number }

interface UploadZone {
  id: string
  files: FileItem[]
  coveredSubIds: string[]
  partnerIds: string[]
}

interface ExecutionProject {
  id: string
  nombre: string
  cliente: string
  direccion: string
  ciudad: string
  descripcion: string
  linkedProjectId?: string
  generalFiles: FileItem[]
  chapterZones: Record<string, UploadZone[]>
}

export interface ExistingProject { id: string; nombre: string; cliente?: string; direccion?: string; ciudad?: string }
export interface Partner { id: string; nombre: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyZone = (): UploadZone => ({ id: crypto.randomUUID(), files: [], coveredSubIds: [], partnerIds: [] })

function initChapterZones(): Record<string, UploadZone[]> {
  const z: Record<string, UploadZone[]> = {}
  TEMPLATE_DEFAULT.forEach(c => { z[c.id] = [emptyZone()] })
  return z
}

// After updating coverage in any zone, keep array length correct:
// always ends with exactly one empty zone when subs remain uncovered.
function normalizeZones(chapter: Capitulo, zones: UploadZone[]): UploadZone[] {
  const allCovered = new Set(zones.flatMap(z => z.coveredSubIds))
  let lastWithCoverage = -1
  zones.forEach((z, i) => { if (z.coveredSubIds.length > 0) lastWithCoverage = i })
  const trimmed = [...zones.slice(0, Math.max(1, lastWithCoverage + 1))]
  if (allCovered.size < chapter.subcapitulos.length) {
    if (trimmed[trimmed.length - 1].coveredSubIds.length > 0) trimmed.push(emptyZone())
  }
  return trimmed
}

// Zone N sees only subs not yet claimed by zones 0..N-1
function getAvailableSubs(chapter: Capitulo, zones: UploadZone[], idx: number) {
  const coveredBefore = new Set(zones.slice(0, idx).flatMap(z => z.coveredSubIds))
  return chapter.subcapitulos.filter(s => !coveredBefore.has(s.id))
}

function isChapterDone(chapter: Capitulo, zones: UploadZone[]): boolean {
  const covered = new Set(zones.flatMap(z => z.coveredSubIds))
  return chapter.subcapitulos.every(s => covered.has(s.id))
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#AAA', fontWeight: 600, marginBottom: 8, display: 'block',
}
const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #E8E6E0', background: '#fff',
  padding: '9px 12px', fontSize: 13, color: '#1A1A1A', fontWeight: 300,
  outline: 'none', borderRadius: 3, boxSizing: 'border-box',
}

// ─── FileDropZone ─────────────────────────────────────────────────────────────

function FileDropZone({ files, onAdd, onRemove, accept = '.pdf,.dwg,.jpg,.jpeg,.png,.mp4' }: {
  files: FileItem[]
  onAdd: (f: FileItem[]) => void
  onRemove: (id: string) => void
  accept?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const process = (raw: FileList | null) => {
    if (!raw) return
    onAdd(Array.from(raw).map(f => ({ id: crypto.randomUUID(), name: f.name, size: f.size })))
  }

  return (
    <div>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); process(e.dataTransfer.files) }}
        style={{
          border: `1.5px dashed ${drag ? '#1A1A1A' : '#D4D0C8'}`, borderRadius: 4,
          padding: '16px 20px', textAlign: 'center', cursor: 'pointer',
          background: drag ? '#F8F7F4' : '#fff', transition: 'all 0.15s',
        }}
      >
        <p style={{ fontSize: 12, color: '#AAA', margin: 0 }}>
          Arrastra archivos o <span style={{ color: '#1A1A1A', textDecoration: 'underline' }}>selecciona</span>
        </p>
        <p style={{ fontSize: 10, color: '#CCC', margin: '3px 0 0', letterSpacing: '0.04em' }}>PDF · DWG · JPG · PNG · MP4</p>
      </div>
      <input ref={ref} type="file" multiple accept={accept} style={{ display: 'none' }} onChange={e => process(e.target.files)} />
      {files.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#F8F7F4', borderRadius: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, background: '#E8E6E0', color: '#666', padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {f.name.split('.').pop()}
                </span>
                <span style={{ fontSize: 12, color: '#333' }}>{f.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#AAA' }}>{fmtSize(f.size)}</span>
                <button onClick={e => { e.stopPropagation(); onRemove(f.id) }} style={{ background: 'none', border: 'none', color: '#BBB', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PartnerSelector ──────────────────────────────────────────────────────────

function PartnerSelector({ partners, selected, onChange }: {
  partners: Partner[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (partners.length === 0) return (
    <p style={{ fontSize: 12, color: '#BBB', fontStyle: 'italic', margin: 0 }}>
      Sin Execution Partners registrados
    </p>
  )
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {partners.map(p => {
        const on = selected.includes(p.id)
        return (
          <button key={p.id} onClick={() => toggle(p.id)} style={{
            fontSize: 11, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${on ? '#1A1A1A' : '#E8E6E0'}`,
            background: on ? '#1A1A1A' : '#fff',
            color: on ? '#fff' : '#555', fontWeight: on ? 500 : 400,
          }}>
            {p.nombre}
          </button>
        )
      })}
    </div>
  )
}

// ─── ZoneCard ─────────────────────────────────────────────────────────────────

function ZoneCard({ zone, zoneIndex, chapter, zones, partners, onUpdate }: {
  zone: UploadZone; zoneIndex: number; chapter: Capitulo
  zones: UploadZone[]; partners: Partner[]
  onUpdate: (z: UploadZone) => void
}) {
  const availableSubs = getAvailableSubs(chapter, zones, zoneIndex)
  const allChecked = availableSubs.length > 0 && availableSubs.every(s => zone.coveredSubIds.includes(s.id))

  const toggleSub = (id: string) => {
    const next = zone.coveredSubIds.includes(id)
      ? zone.coveredSubIds.filter(x => x !== id)
      : [...zone.coveredSubIds, id]
    onUpdate({ ...zone, coveredSubIds: next })
  }

  const toggleAll = () => {
    const next = allChecked
      ? zone.coveredSubIds.filter(id => !availableSubs.find(s => s.id === id))
      : [...new Set([...zone.coveredSubIds, ...availableSubs.map(s => s.id)])]
    onUpdate({ ...zone, coveredSubIds: next })
  }

  return (
    <div style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
      {/* Zone header */}
      <div style={{ background: '#FAFAF8', padding: '9px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
          Zona {zoneIndex + 1}
        </span>
        {zone.coveredSubIds.length > 0 && (
          <span style={{ fontSize: 10, background: '#1A1A1A', color: '#fff', padding: '1px 7px', borderRadius: 10 }}>
            {zone.coveredSubIds.length} subcap.
          </span>
        )}
        {zone.partnerIds.length > 0 && (
          <span style={{ fontSize: 10, background: '#E8E6E0', color: '#666', padding: '1px 7px', borderRadius: 10 }}>
            {zone.partnerIds.length} partner{zone.partnerIds.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Files */}
        <div>
          <span style={labelSt}>Documentación</span>
          <FileDropZone
            accept=".pdf,.dwg"
            files={zone.files}
            onAdd={f => onUpdate({ ...zone, files: [...zone.files, ...f] })}
            onRemove={id => onUpdate({ ...zone, files: zone.files.filter(f => f.id !== id) })}
          />
        </div>

        {/* Subcapítulo checklist */}
        {availableSubs.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={labelSt}>Subcapítulos cubiertos por esta zona</span>
              <button onClick={toggleAll} style={{ fontSize: 10, color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginBottom: 8 }}>
                {allChecked ? 'Desmarcar todo' : 'Marcar todo'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {availableSubs.map(sub => (
                <label key={sub.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '6px 10px', borderRadius: 3,
                  background: zone.coveredSubIds.includes(sub.id) ? '#F8F7F4' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={zone.coveredSubIds.includes(sub.id)}
                    onChange={() => toggleSub(sub.id)}
                    style={{ width: 13, height: 13, accentColor: '#1A1A1A', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: '#444' }}>{sub.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Partners */}
        <div>
          <span style={labelSt}>Execution Partners invitados a licitar</span>
          <PartnerSelector
            partners={partners}
            selected={zone.partnerIds}
            onChange={ids => onUpdate({ ...zone, partnerIds: ids })}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

function InfoStep({ project, onChange }: { project: ExecutionProject; onChange: (p: Partial<ExecutionProject>) => void }) {
  const f = (key: keyof ExecutionProject) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ [key]: e.target.value })

  return (
    <div>
      <h2 style={stepH2}>Información del proyecto</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {([
          ['nombre', 'Nombre del proyecto *', 'Reforma integral vivienda'],
          ['cliente', 'Cliente', 'Nombre del cliente'],
          ['direccion', 'Dirección', 'Calle, número, piso'],
          ['ciudad', 'Ciudad', 'Madrid'],
        ] as const).map(([key, label, ph]) => (
          <div key={key}>
            <label style={labelSt}>{label}</label>
            <input value={project[key] as string} onChange={f(key)} placeholder={ph} style={inputSt} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={labelSt}>Descripción</label>
        <textarea value={project.descripcion} onChange={f('descripcion')} placeholder="Descripción general del proyecto…" style={{ ...inputSt, minHeight: 100, resize: 'vertical' }} />
      </div>
    </div>
  )
}

function GeneralStep({ project, onChange }: { project: ExecutionProject; onChange: (p: Partial<ExecutionProject>) => void }) {
  return (
    <div>
      <h2 style={stepH2}>Documentación general</h2>
      <p style={{ fontSize: 13, color: '#888', fontWeight: 300, marginBottom: 20, lineHeight: 1.6 }}>
        Planos generales, secciones, alzados, renders, imágenes y vídeos de la propiedad.
        Esta documentación se incluirá en todos los paquetes que se envíen a los Execution Partners.
      </p>
      <FileDropZone
        files={project.generalFiles}
        accept=".pdf,.dwg,.jpg,.jpeg,.png,.mp4"
        onAdd={f => onChange({ generalFiles: [...project.generalFiles, ...f] })}
        onRemove={id => onChange({ generalFiles: project.generalFiles.filter(f => f.id !== id) })}
      />
    </div>
  )
}

function ChapterStep({ chapter, zones, partners, onZonesChange }: {
  chapter: Capitulo; zones: UploadZone[]; partners: Partner[]
  onZonesChange: (z: UploadZone[]) => void
}) {
  const updateZone = (idx: number, updated: UploadZone) => {
    const next = [...zones]
    next[idx] = updated
    onZonesChange(normalizeZones(chapter, next))
  }

  const coveredCount = new Set(zones.flatMap(z => z.coveredSubIds)).size
  const total = chapter.subcapitulos.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h2 style={{ ...stepH2, margin: 0 }}>{chapter.numero}. {chapter.nombre}</h2>
        <span style={{ fontSize: 11, color: coveredCount === total ? '#1D9E75' : '#AAA' }}>
          {coveredCount}/{total} subcapítulos cubiertos
        </span>
      </div>
      <p style={{ fontSize: 13, color: '#888', fontWeight: 300, marginBottom: 20, lineHeight: 1.6 }}>
        Crea una o varias zonas de documentación. Cada zona tiene su propio PDF, sus subcapítulos y sus Execution Partners invitados.
        Cuando una zona no cubre todos los subcapítulos disponibles, aparece automáticamente una zona complementaria.
      </p>
      {zones.map((zone, i) => (
        <ZoneCard
          key={zone.id}
          zone={zone}
          zoneIndex={i}
          chapter={chapter}
          zones={zones}
          partners={partners}
          onUpdate={updated => updateZone(i, updated)}
        />
      ))}
    </div>
  )
}

const stepH2: React.CSSProperties = { fontSize: 22, fontWeight: 200, color: '#1A1A1A', marginBottom: 20, letterSpacing: '-0.01em' }

// ─── Wizard sidebar + shell ───────────────────────────────────────────────────

interface WizardStep { key: string; label: string; short: string }

const STEPS: WizardStep[] = [
  { key: 'info', label: 'Información del proyecto', short: 'Proyecto' },
  { key: 'general', label: 'Documentación general', short: 'Doc. general' },
  ...TEMPLATE_DEFAULT.map(c => ({ key: c.id, label: `${c.numero}. ${c.nombre}`, short: `${c.numero}. ${c.nombre.split(' ').slice(0, 2).join(' ')}` })),
]

function stepStatus(idx: number, project: ExecutionProject): 'done' | 'active' | 'pending' {
  // called during render, so active is handled by the parent
  const step = STEPS[idx]
  if (step.key === 'info') return project.nombre ? 'done' : 'pending'
  if (step.key === 'general') return project.generalFiles.length > 0 ? 'done' : 'pending'
  const cap = TEMPLATE_DEFAULT.find(c => c.id === step.key)
  if (cap) return isChapterDone(cap, project.chapterZones[cap.id] ?? []) ? 'done' : 'pending'
  return 'pending'
}

function WizardSidebar({ current, project, onSelect }: {
  current: number; project: ExecutionProject; onSelect: (i: number) => void
}) {
  return (
    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #E8E6E0', background: '#fff', overflowY: 'auto' }}>
      {STEPS.map((step, i) => {
        const status = i === current ? 'active' : stepStatus(i, project)
        const isActive = i === current
        return (
          <button key={step.key} onClick={() => onSelect(i)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 16px', background: isActive ? '#F8F7F4' : 'transparent',
            border: 'none', borderLeft: `2px solid ${isActive ? '#1A1A1A' : 'transparent'}`,
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0, fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: status === 'done' ? '#1A1A1A' : isActive ? '#E8E6E0' : 'transparent',
              border: status === 'done' ? 'none' : '1.5px solid #CCC',
              color: status === 'done' ? '#fff' : '#CCC', fontWeight: 700,
            }}>
              {status === 'done' ? '✓' : ''}
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.3, color: isActive ? '#1A1A1A' : status === 'done' ? '#555' : '#AAA', fontWeight: isActive ? 500 : 400 }}>
              {step.short}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Wizard({ project, partners, onUpdate, onBack }: {
  project: ExecutionProject; partners: Partner[]
  onUpdate: (p: Partial<ExecutionProject>) => void; onBack: () => void
}) {
  const [step, setStep] = useState(0)

  const updateChapter = (chapId: string, zones: UploadZone[]) =>
    onUpdate({ chapterZones: { ...project.chapterZones, [chapId]: zones } })

  const renderContent = () => {
    const s = STEPS[step]
    if (s.key === 'info') return <InfoStep project={project} onChange={onUpdate} />
    if (s.key === 'general') return <GeneralStep project={project} onChange={onUpdate} />
    const cap = TEMPLATE_DEFAULT.find(c => c.id === s.key)
    if (cap) return (
      <ChapterStep
        chapter={cap}
        zones={project.chapterZones[cap.id] ?? [emptyZone()]}
        partners={partners}
        onZonesChange={z => updateChapter(cap.id, z)}
      />
    )
    return null
  }

  return (
    <div style={{ background: '#F8F7F4', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, padding: 0 }}>
          ← Projects
        </button>
        <span style={{ color: '#D4D0C8', fontSize: 14 }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 300, color: '#1A1A1A' }}>{project.nombre || 'Sin nombre'}</span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <WizardSidebar current={step} project={project} onSelect={setStep} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px' }}>
            <div style={{ maxWidth: 780 }}>
              {renderContent()}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ padding: '14px 40px', borderTop: '1px solid #E8E6E0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{ fontSize: 12, padding: '9px 20px', border: '1px solid #E8E6E0', background: '#fff', color: step === 0 ? '#CCC' : '#555', cursor: step === 0 ? 'default' : 'pointer', borderRadius: 4 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: 11, color: '#CCC' }}>{step + 1} / {STEPS.length}</span>
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={step === STEPS.length - 1}
              style={{ fontSize: 12, padding: '9px 20px', border: 'none', background: step === STEPS.length - 1 ? '#E8E6E0' : '#1A1A1A', color: step === STEPS.length - 1 ? '#AAA' : '#fff', cursor: step === STEPS.length - 1 ? 'default' : 'pointer', borderRadius: 4 }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ existingProjects, onClose, onCreate }: {
  existingProjects: ExistingProject[]
  onClose: () => void
  onCreate: (p: ExecutionProject) => void
}) {
  const [tab, setTab] = useState<'new' | 'link'>('new')
  const [linked, setLinked] = useState<string>('')
  const [form, setForm] = useState({ nombre: '', cliente: '', direccion: '', ciudad: '', descripcion: '' })

  const prefill = (p: ExistingProject) => {
    setLinked(p.id)
    setForm(f => ({ ...f, nombre: p.nombre, cliente: p.cliente ?? '', direccion: p.direccion ?? '', ciudad: p.ciudad ?? '' }))
  }

  const handleCreate = () => {
    if (!form.nombre.trim()) return
    onCreate({ id: crypto.randomUUID(), ...form, linkedProjectId: linked || undefined, generalFiles: [], chapterZones: initChapterZones() })
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: 'min(580px, 95vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E8E6E0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 200, color: '#1A1A1A', margin: 0 }}>Nuevo proyecto de ejecución</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#AAA', cursor: 'pointer', padding: 0 }}>×</button>
          </div>
          {existingProjects.length > 0 && (
            <div style={{ display: 'flex' }}>
              {(['new', 'link'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
                  fontSize: 12, fontWeight: tab === t ? 500 : 400, color: tab === t ? '#1A1A1A' : '#AAA',
                  borderBottom: `2px solid ${tab === t ? '#1A1A1A' : 'transparent'}`,
                }}>
                  {t === 'new' ? 'Proyecto nuevo' : 'Vincular a proyecto existente'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {tab === 'link' && existingProjects.length > 0 && (
            <>
              <label style={labelSt}>Selecciona un proyecto</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 16 }}>
                {existingProjects.map(p => (
                  <div key={p.id} onClick={() => prefill(p)} style={{
                    padding: '10px 14px', border: `1px solid ${linked === p.id ? '#1A1A1A' : '#E8E6E0'}`,
                    borderRadius: 4, cursor: 'pointer', background: linked === p.id ? '#F8F7F4' : '#fff',
                  }}>
                    <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0 }}>{p.nombre}</p>
                    {p.cliente && <p style={{ fontSize: 11, color: '#AAA', margin: '2px 0 0' }}>{p.cliente}</p>}
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: '#E8E6E0', marginBottom: 16 }} />
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {([
              ['nombre', 'Nombre del proyecto *', 'Reforma integral vivienda'],
              ['cliente', 'Cliente', 'Nombre del cliente'],
              ['direccion', 'Dirección', 'Calle, número, piso'],
              ['ciudad', 'Ciudad', 'Madrid'],
            ] as const).map(([key, label, ph]) => (
              <div key={key}>
                <label style={labelSt}>{label}</label>
                <input value={form[key]} onChange={f(key)} placeholder={ph} style={inputSt} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelSt}>Descripción</label>
            <textarea value={form.descripcion} onChange={f('descripcion')} placeholder="Descripción general del proyecto…" style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '9px 20px', border: '1px solid #E8E6E0', background: '#fff', color: '#666', cursor: 'pointer', borderRadius: 4 }}>
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={!form.nombre.trim()} style={{
            fontSize: 12, padding: '9px 20px', border: 'none', borderRadius: 4,
            background: '#1A1A1A', color: '#fff', cursor: 'pointer', opacity: form.nombre.trim() ? 1 : 0.4,
          }}>
            Crear y configurar →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ExecutionProjectsPage({ existingProjects = [], executionPartners = [] }: {
  existingProjects?: ExistingProject[]
  executionPartners?: Partner[]
}) {
  const [projects, setProjects] = useState<ExecutionProject[]>([])
  const [view, setView] = useState<'list' | 'wizard'>('list')
  const [active, setActive] = useState<ExecutionProject | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const handleCreate = (p: ExecutionProject) => {
    setProjects(prev => [...prev, p])
    setActive(p); setView('wizard'); setCreateOpen(false)
  }

  const handleUpdate = (partial: Partial<ExecutionProject>) => {
    if (!active) return
    const updated = { ...active, ...partial }
    setActive(updated)
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  if (view === 'wizard' && active) {
    return <Wizard project={active} partners={executionPartners} onUpdate={handleUpdate} onBack={() => setView('list')} />
  }

  return (
    <div style={{ background: '#F8F7F4', minHeight: '100vh' }}>
      <div style={{ padding: '40px 40px 28px', background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 500, marginBottom: 6 }}>FP Execution</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', letterSpacing: '-0.01em', margin: 0 }}>Projects</h1>
          <button onClick={() => setCreateOpen(true)} style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 500, padding: '10px 20px', background: '#1A1A1A', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
            + Nuevo proyecto
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 40px' }}>
        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#AAA' }}>
            <p style={{ fontSize: 14, fontWeight: 300, marginBottom: 6 }}>Sin proyectos de ejecución todavía</p>
            <p style={{ fontSize: 12, fontWeight: 300 }}>Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
                  {['Proyecto', 'Cliente', 'Ciudad', 'Capítulos', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const done = TEMPLATE_DEFAULT.filter(c => isChapterDone(c, p.chapterZones[c.id] ?? [])).length
                  return (
                    <tr key={p.id} onClick={() => { setActive(p); setView('wizard') }}
                      style={{ borderBottom: '1px solid #F0EEE8', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px 16px', color: '#1A1A1A', fontWeight: 400 }}>{p.nombre}</td>
                      <td style={{ padding: '14px 16px', color: '#555' }}>{p.cliente || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#555' }}>{p.ciudad || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, background: done === TEMPLATE_DEFAULT.length ? '#E8F5E9' : '#F0EEE8', color: done === TEMPLATE_DEFAULT.length ? '#1D9E75' : '#888', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                          {done}/{TEMPLATE_DEFAULT.length}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 12, color: '#AAA' }}>Configurar →</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && <CreateModal existingProjects={existingProjects} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />}
    </div>
  )
}
