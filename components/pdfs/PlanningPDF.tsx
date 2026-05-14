// Server-only — only used inside API routes with @react-pdf/renderer.
// Do NOT import this from client components.

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import {
  computeParametricSchedule,
  formatScheduleDate,
  type ScheduleChapter,
  type ScheduleMilestone,
  type PhaseScheduleMap,
} from '@/lib/fp-execution/schedule'
import { addBusinessDays, snapToNextBusinessDay } from '@/lib/fp-execution/businessDays'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  ink:     '#1A1A1A',
  soft:    '#444444',
  mid:     '#666666',
  meta:    '#999999',
  rule:    '#E6E4DF',
  light:   '#F8F7F4',
  faint:   '#FAFAF8',
  white:   '#FFFFFF',
  brand:   '#D85A30',
  brandSoft: '#FFF7F0',
  brandBorder: '#FED7AA',
}

// Paleta de capítulos (coherente con la UI del Gantt)
const CAP_COLORS = ['#378ADD', '#D85A30', '#059669', '#7C3AED', '#0891B2', '#CA8A04', '#BE185D', '#0369A1']

// A4 portrait: 595 x 842 pt
const MARGIN_X = 48
const MARGIN_TOP_FIRST = 0      // primera página tiene portada custom
const MARGIN_TOP_INNER = 72     // resto de páginas, espacio para el header brandeado
const MARGIN_BOTTOM = 56

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface PlanningNarrative {
  resumen_ejecutivo: string
  narrativa_por_capitulo: Record<string, string>   // chapter id → texto
  analisis_ruta_critica: string
  coordinacion: string
}

export interface PlanningPDFData {
  projectName: string
  direccion: string | null
  ciudad: string | null
  fechaInicio: string                                    // 'YYYY-MM-DD'
  m2: number | null
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor?: number
  version: number
  emittedAt: Date
  usedAi: boolean
  narrative: PlanningNarrative
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: MARGIN_TOP_INNER,
    paddingBottom: MARGIN_BOTTOM,
    paddingHorizontal: MARGIN_X,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.45,
    color: C.ink,
    backgroundColor: C.white,
  },
  cover: {
    paddingTop: 0,
    paddingBottom: MARGIN_BOTTOM,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    color: C.ink,
    backgroundColor: C.white,
  },

  // Header brandeado (páginas internas)
  runningHeader: {
    position: 'absolute',
    top: 24, left: MARGIN_X, right: MARGIN_X,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.6,
    borderBottomColor: C.rule,
    paddingBottom: 8,
  },
  runningHeaderTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  runningHeaderRight: {
    fontSize: 8,
    color: C.mid,
  },

  // Portada
  coverHeader: {
    height: 320,
    backgroundColor: C.ink,
    paddingHorizontal: MARGIN_X,
    paddingTop: 64,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  coverLogo: { width: 140, height: 'auto' },
  coverTitle: {
    color: C.white,
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  coverProject: {
    color: '#F0EDE8',
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    maxWidth: 400,
  },
  coverAddress: {
    color: '#9A9692',
    fontSize: 11,
    marginTop: 6,
  },
  coverAccent: {
    height: 3, width: 60,
    backgroundColor: C.brand,
    marginTop: 14,
  },

  // Bloque de datos clave (portada)
  coverData: {
    marginTop: 40,
    paddingHorizontal: MARGIN_X,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 22,
    columnGap: 32,
  },
  coverDataItem: { width: 200 },
  coverDataLabel: {
    fontSize: 7,
    color: C.meta,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverDataValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
  },

  coverFooter: {
    position: 'absolute',
    bottom: MARGIN_BOTTOM,
    left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 0.6,
    borderTopColor: C.rule,
    paddingTop: 12,
  },
  coverFooterTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  coverFooterSubtitle: {
    fontSize: 8,
    color: C.mid,
    marginTop: 3,
  },

  // Secciones internas
  sectionWrap: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 7,
    color: C.brand,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    color: C.soft,
    marginBottom: 8,
    textAlign: 'justify',
  },

  // Capítulo (bloque narrativo)
  chapterBlock: {
    marginTop: 18,
    borderLeftWidth: 3,
    paddingLeft: 14,
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    flex: 1,
  },
  chapterDates: {
    fontSize: 9,
    color: C.mid,
    fontFamily: 'Helvetica-Bold',
  },
  chapterMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 8,
  },
  chapterMetaItem: {
    fontSize: 8,
    color: C.meta,
  },
  chapterMetaValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.soft,
  },
  chapterNarrative: {
    fontSize: 10,
    lineHeight: 1.5,
    color: C.soft,
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'justify',
  },

  // Tabla de fases
  phasesTable: {
    marginTop: 6,
    borderTopWidth: 0.6, borderBottomWidth: 0.6,
    borderColor: C.rule,
  },
  phasesHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.faint,
    paddingVertical: 4, paddingHorizontal: 6,
    borderBottomWidth: 0.6, borderBottomColor: C.rule,
  },
  phasesRow: {
    flexDirection: 'row',
    paddingVertical: 4, paddingHorizontal: 6,
    borderBottomWidth: 0.4, borderBottomColor: '#F0EDE8',
  },
  phasesCellName:  { width: '34%', fontSize: 9, color: C.ink },
  phasesCellDates: { width: '24%', fontSize: 8.5, color: C.mid },
  phasesCellDays:  { width: '10%', fontSize: 8.5, color: C.mid, textAlign: 'right' },
  phasesCellMeta:  { width: '32%', fontSize: 8.5, color: C.mid, paddingLeft: 6 },
  phasesHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Hitos críticos
  milestoneRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5, borderBottomColor: C.rule,
  },
  milestoneName: { width: '40%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink },
  milestoneDate: { width: '20%', fontSize: 9.5, color: C.brand, fontFamily: 'Helvetica-Bold' },
  milestoneRel:  { width: '40%', fontSize: 8.5, color: C.mid, paddingLeft: 6 },

  // Listado bullet
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 12, fontSize: 9, color: C.brand },
  bulletText: { flex: 1, fontSize: 9.5, color: C.soft, lineHeight: 1.45 },

  // Footer fijo
  footer: {
    position: 'absolute',
    bottom: 24,
    left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.6, borderTopColor: C.rule,
    paddingTop: 6,
  },
  footerLeft: { fontSize: 7, color: C.mid },
  footerCenter: { fontSize: 7, color: C.meta },
  footerRight: { fontSize: 7, color: C.mid },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return formatScheduleDate(d)
}

function fmtDateTime(d: Date) {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

interface Computed {
  schedule: PhaseScheduleMap
  totalDays: number
  start: Date
  endDate: Date | null
  weeks: string
  milestoneEndDate: Record<string, Date>
  milestoneAchievedBy: Record<string, string[]>   // milestoneId → phaseIds que lo logran
  milestoneRequiredBy: Record<string, string[]>   // milestoneId → phaseIds que lo requieren
  chapterRange: Record<string, { start: Date; end: Date; days: number }>
}

function compute(data: PlanningPDFData): Computed {
  const r = computeParametricSchedule(
    data.scheduleChapters,
    new Date(data.fechaInicio),
    data.m2,
    data.chapterDaysOverrides,
    data.duracionFactor ?? 1.0,
  )
  const start = snapToNextBusinessDay(new Date(data.fechaInicio))
  const totalDays = r.totalDays
  const endDate = totalDays > 0 ? addBusinessDays(start, Math.round(totalDays)) : null
  const weeks = totalDays > 0 ? (totalDays / 5).toFixed(1) : '0'

  // Milestone resolution
  const milestoneEndDate: Record<string, Date> = {}
  const milestoneAchievedBy: Record<string, string[]> = {}
  const milestoneRequiredBy: Record<string, string[]> = {}

  for (const ch of data.scheduleChapters) {
    for (const ph of ch.phases) {
      const e = r.phases[ph.id]
      if (!e) continue
      for (const mid of ph.achieves) {
        if (!milestoneEndDate[mid] || e.endDate > milestoneEndDate[mid]) {
          milestoneEndDate[mid] = e.endDate
        }
        if (!milestoneAchievedBy[mid]) milestoneAchievedBy[mid] = []
        milestoneAchievedBy[mid].push(ph.id)
      }
      for (const mid of ph.requires) {
        if (!milestoneRequiredBy[mid]) milestoneRequiredBy[mid] = []
        milestoneRequiredBy[mid].push(ph.id)
      }
    }
  }

  // Chapter range
  const chapterRange: Record<string, { start: Date; end: Date; days: number }> = {}
  for (const ch of data.scheduleChapters) {
    if (ch.phases.length === 0) continue
    let chStart: Date | null = null
    let chEnd: Date | null = null
    for (const ph of ch.phases) {
      const e = r.phases[ph.id]
      if (!e) continue
      if (!chStart || e.startDate < chStart) chStart = e.startDate
      if (!chEnd || e.endDate > chEnd) chEnd = e.endDate
    }
    if (chStart && chEnd) {
      const days = r.chapterDays[ch.id] ?? 0
      chapterRange[ch.id] = { start: chStart, end: chEnd, days }
    }
  }

  return { schedule: r.phases, totalDays, start, endDate, weeks, milestoneEndDate, milestoneAchievedBy, milestoneRequiredBy, chapterRange }
}

// ── Páginas internas: header y footer fijos ───────────────────────────────────
function RunningHeader({ projectName }: { projectName: string }) {
  return (
    <View style={s.runningHeader} fixed>
      <Text style={s.runningHeaderTitle}>Planning de ejecución de obra</Text>
      <Text style={s.runningHeaderRight}>{projectName}</Text>
    </View>
  )
}

function Footer({ version, emittedAt }: { version: number; emittedAt: Date }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLeft}>Forma Prima · GEINEX GROUP, S.L. · NIF B44873552</Text>
      <Text style={s.footerCenter}>Versión {version} · Emitido {fmtDateTime(emittedAt)}</Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
      />
    </View>
  )
}

// ── Build PDF element ─────────────────────────────────────────────────────────
export function buildPlanningElement(data: PlanningPDFData) {
  const L = compute(data)
  const activeMilestones = data.scheduleMilestones
    .filter(m => L.milestoneEndDate[m.id])
    .sort((a, b) => L.milestoneEndDate[a.id].getTime() - L.milestoneEndDate[b.id].getTime())

  const phaseNameById: Record<string, string> = {}
  const milestoneNameById: Record<string, string> = {}
  for (const ch of data.scheduleChapters) {
    for (const ph of ch.phases) phaseNameById[ph.id] = ph.nombre
  }
  for (const m of data.scheduleMilestones) milestoneNameById[m.id] = m.nombre

  return (
    <Document>

      {/* ── Portada ── */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverHeader}>
          <Image src={LOGO_BLANCO} style={s.coverLogo} />
          <View>
            <Text style={s.coverTitle}>PLANNING DE EJECUCIÓN DE OBRA</Text>
            <Text style={s.coverProject}>{data.projectName}</Text>
            {(data.direccion || data.ciudad) && (
              <Text style={s.coverAddress}>
                {[data.direccion, data.ciudad].filter(Boolean).join(' · ')}
              </Text>
            )}
            <View style={s.coverAccent} />
          </View>
        </View>

        <View style={s.coverData}>
          <View style={s.coverDataItem}>
            <Text style={s.coverDataLabel}>Inicio de obra</Text>
            <Text style={s.coverDataValue}>{fmtDate(L.start)}</Text>
          </View>
          {L.endDate && (
            <View style={s.coverDataItem}>
              <Text style={s.coverDataLabel}>Fin estimado</Text>
              <Text style={s.coverDataValue}>{fmtDate(L.endDate)}</Text>
            </View>
          )}
          <View style={s.coverDataItem}>
            <Text style={s.coverDataLabel}>Duración total</Text>
            <Text style={s.coverDataValue}>{Math.round(L.totalDays)} DL · {L.weeks} sem</Text>
          </View>
          {data.m2 != null && (
            <View style={s.coverDataItem}>
              <Text style={s.coverDataLabel}>Superficie</Text>
              <Text style={s.coverDataValue}>{data.m2} m²</Text>
            </View>
          )}
          <View style={s.coverDataItem}>
            <Text style={s.coverDataLabel}>Capítulos en obra</Text>
            <Text style={s.coverDataValue}>{Object.keys(L.chapterRange).length}</Text>
          </View>
          <View style={s.coverDataItem}>
            <Text style={s.coverDataLabel}>Hitos críticos</Text>
            <Text style={s.coverDataValue}>{activeMilestones.length}</Text>
          </View>
        </View>

        <View style={s.coverFooter}>
          <View>
            <Text style={s.coverFooterTitle}>Forma Prima · Dirección de obra</Text>
            <Text style={s.coverFooterSubtitle}>FP Execution · GEINEX GROUP, S.L. · contacto@formaprima.es</Text>
          </View>
          <View>
            <Text style={s.coverFooterSubtitle}>Versión {data.version}</Text>
            <Text style={s.coverFooterSubtitle}>{fmtDateTime(data.emittedAt)}</Text>
          </View>
        </View>
      </Page>

      {/* ── Resumen ejecutivo ── */}
      <Page size="A4" style={s.page}>
        <RunningHeader projectName={data.projectName} />

        <View style={s.sectionWrap}>
          <Text style={s.sectionLabel}>1 · Resumen ejecutivo</Text>
          <Text style={s.sectionTitle}>Visión general del planning</Text>
          {data.narrative.resumen_ejecutivo.split(/\n\n+/).map((para, i) => (
            <Text key={i} style={s.paragraph}>{para.trim()}</Text>
          ))}
        </View>

        <Footer version={data.version} emittedAt={data.emittedAt} />
      </Page>

      {/* ── Cronología por capítulos ── */}
      <Page size="A4" style={s.page}>
        <RunningHeader projectName={data.projectName} />

        <View style={s.sectionWrap}>
          <Text style={s.sectionLabel}>2 · Cronología por capítulos</Text>
          <Text style={s.sectionTitle}>Desarrollo secuencial de la obra</Text>
          <Text style={s.paragraph}>
            La obra se estructura en {Object.keys(L.chapterRange).length} capítulos consecutivos. A continuación
            se detalla la cronología de cada uno, las fases que comprende, los hitos que desbloquea y las
            dependencias que condicionan su inicio.
          </Text>
        </View>

        {data.scheduleChapters
          .filter(ch => L.chapterRange[ch.id])
          .sort((a, b) => L.chapterRange[a.id].start.getTime() - L.chapterRange[b.id].start.getTime())
          .map((ch, idx) => {
            const color = CAP_COLORS[idx % CAP_COLORS.length]
            const range = L.chapterRange[ch.id]
            const phases = [...ch.phases].sort((a, b) => a.orden - b.orden)
            const achievesAll = Array.from(new Set(phases.flatMap(ph => ph.achieves)))
            const requiresAll = Array.from(new Set(phases.flatMap(ph => ph.requires)))
            const narrative = data.narrative.narrativa_por_capitulo?.[ch.id]?.trim() || ''

            return (
              <View key={ch.id} style={{ ...s.chapterBlock, borderLeftColor: color }} wrap>
                <View style={s.chapterHeader}>
                  <Text style={s.chapterTitle}>{ch.nombre}</Text>
                  <Text style={s.chapterDates}>
                    {fmtDate(range.start)} → {fmtDate(range.end)}
                  </Text>
                </View>

                <View style={s.chapterMeta}>
                  <Text style={s.chapterMetaItem}>
                    Duración <Text style={s.chapterMetaValue}>{Math.round(range.days)} DL</Text>
                  </Text>
                  <Text style={s.chapterMetaItem}>
                    Fases <Text style={s.chapterMetaValue}>{phases.length}</Text>
                  </Text>
                  {achievesAll.length > 0 && (
                    <Text style={s.chapterMetaItem}>
                      Logra <Text style={s.chapterMetaValue}>{achievesAll.map(mid => milestoneNameById[mid]).filter(Boolean).join(', ')}</Text>
                    </Text>
                  )}
                  {requiresAll.length > 0 && (
                    <Text style={s.chapterMetaItem}>
                      Requiere <Text style={s.chapterMetaValue}>{requiresAll.map(mid => milestoneNameById[mid]).filter(Boolean).join(', ')}</Text>
                    </Text>
                  )}
                </View>

                {narrative && (
                  <Text style={s.chapterNarrative}>{narrative}</Text>
                )}

                {/* Tabla de fases */}
                <View style={s.phasesTable}>
                  <View style={s.phasesHeaderRow}>
                    <Text style={[s.phasesCellName,  s.phasesHeaderCell]}>Fase</Text>
                    <Text style={[s.phasesCellDates, s.phasesHeaderCell]}>Periodo</Text>
                    <Text style={[s.phasesCellDays,  s.phasesHeaderCell]}>DL</Text>
                    <Text style={[s.phasesCellMeta,  s.phasesHeaderCell]}>Hitos / dependencias</Text>
                  </View>
                  {phases.map(ph => {
                    const e = L.schedule[ph.id]
                    if (!e) return null
                    const meta: string[] = []
                    if (ph.achieves.length > 0) {
                      meta.push('Logra: ' + ph.achieves.map(m => milestoneNameById[m]).filter(Boolean).join(', '))
                    }
                    if (ph.requires.length > 0) {
                      meta.push('Requiere: ' + ph.requires.map(m => milestoneNameById[m]).filter(Boolean).join(', '))
                    }
                    return (
                      <View key={ph.id} style={s.phasesRow} wrap={false}>
                        <Text style={s.phasesCellName}>{ph.nombre}</Text>
                        <Text style={s.phasesCellDates}>
                          {fmtDate(e.startDate)} → {fmtDate(e.endDate)}
                        </Text>
                        <Text style={s.phasesCellDays}>{Math.round(e.durationDays)}</Text>
                        <Text style={s.phasesCellMeta}>{meta.join(' · ') || '—'}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )
          })}

        <Footer version={data.version} emittedAt={data.emittedAt} />
      </Page>

      {/* ── Hitos críticos ── */}
      <Page size="A4" style={s.page}>
        <RunningHeader projectName={data.projectName} />

        <View style={s.sectionWrap}>
          <Text style={s.sectionLabel}>3 · Hitos críticos del proyecto</Text>
          <Text style={s.sectionTitle}>Mapa cronológico de hitos</Text>
          <Text style={s.paragraph}>
            Los hitos son puntos de control que estructuran el avance de la obra. Cada hito tiene una fecha
            objetivo definida por la fase que lo logra, y puede condicionar el inicio de otras fases. El
            seguimiento de obra se basa en la consecución secuencial de estos hitos.
          </Text>
        </View>

        {activeMilestones.length === 0 ? (
          <Text style={s.paragraph}>El planning actual no contempla hitos formales entre capítulos.</Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            <View style={[s.milestoneRow, { borderTopWidth: 0.6, borderTopColor: C.rule }]}>
              <Text style={[s.milestoneName, s.phasesHeaderCell]}>Hito</Text>
              <Text style={[s.milestoneDate, s.phasesHeaderCell]}>Fecha</Text>
              <Text style={[s.milestoneRel,  s.phasesHeaderCell]}>Desbloquea / depende</Text>
            </View>
            {activeMilestones.map(m => {
              const date = L.milestoneEndDate[m.id]
              const achievedPhases = (L.milestoneAchievedBy[m.id] || [])
                .map(id => phaseNameById[id]).filter(Boolean)
              const dependentPhases = (L.milestoneRequiredBy[m.id] || [])
                .map(id => phaseNameById[id]).filter(Boolean)
              const rel: string[] = []
              if (achievedPhases.length) rel.push('Logrado tras: ' + achievedPhases.join(', '))
              if (dependentPhases.length) rel.push('Habilita: ' + dependentPhases.join(', '))
              return (
                <View key={m.id} style={s.milestoneRow} wrap={false}>
                  <Text style={s.milestoneName}>{m.nombre}</Text>
                  <Text style={s.milestoneDate}>{fmtDate(date)}</Text>
                  <Text style={s.milestoneRel}>{rel.join(' · ') || '—'}</Text>
                </View>
              )
            })}
          </View>
        )}

        <Footer version={data.version} emittedAt={data.emittedAt} />
      </Page>

      {/* ── Análisis de ruta crítica ── */}
      <Page size="A4" style={s.page}>
        <RunningHeader projectName={data.projectName} />

        <View style={s.sectionWrap}>
          <Text style={s.sectionLabel}>4 · Análisis de ruta crítica</Text>
          <Text style={s.sectionTitle}>Encadenamiento y puntos de riesgo</Text>
          {data.narrative.analisis_ruta_critica.split(/\n\n+/).map((para, i) => (
            <Text key={i} style={s.paragraph}>{para.trim()}</Text>
          ))}
        </View>

        <View style={s.sectionWrap}>
          <Text style={s.sectionLabel}>5 · Coordinación y seguimiento</Text>
          <Text style={s.sectionTitle}>Dirección facultativa</Text>
          {data.narrative.coordinacion.split(/\n\n+/).map((para, i) => (
            <Text key={i} style={s.paragraph}>{para.trim()}</Text>
          ))}
        </View>

        <View style={s.sectionWrap}>
          <Text style={s.sectionLabel}>6 · Notas y consideraciones</Text>
          <View style={s.bulletRow}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.bulletText}>Las duraciones se expresan en días laborables (lunes a viernes, sin festivos oficiales). Los fines de semana y festivos aparecen como huecos no productivos en el calendario real.</Text>
          </View>
          <View style={s.bulletRow}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.bulletText}>Las fechas son una estimación paramétrica calculada a partir del scope del proyecto, los rangos de duración por capítulo y la superficie de construcción. Se ajustarán en función del avance real de obra.</Text>
          </View>
          <View style={s.bulletRow}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.bulletText}>Cualquier modificación del scope, cambio en partidas, ampliación de superficie o aparición de imprevistos en obra requerirá la emisión de una nueva versión de este planning.</Text>
          </View>
          <View style={s.bulletRow}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.bulletText}>Este documento ha sido emitido por Forma Prima en ejercicio de la dirección facultativa. Constituye una previsión de planificación, no un compromiso contractual de fechas, salvo que así se acuerde por escrito en documento aparte.</Text>
          </View>
        </View>

        <Footer version={data.version} emittedAt={data.emittedAt} />
      </Page>

    </Document>
  )
}
