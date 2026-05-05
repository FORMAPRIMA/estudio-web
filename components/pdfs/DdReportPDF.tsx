// Server-only — solo usar desde API routes con @react-pdf/renderer
// No importar directamente desde componentes cliente ni server components estáticos

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import path from 'path'
import type {
  DdAsset, DdVisit, DdCard, DdRole, DdCardMedia, DdVisitTeam,
} from '@/lib/dd-visits/domain'
import {
  DD_CARD_ESTADO_LABELS, DD_CARD_RIESGO_LABELS,
  DD_CARD_PRIORIDAD_LABELS, DD_ASSET_STATUS_LABELS,
} from '@/lib/dd-visits/domain'

const LOGO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DdReportPDFData {
  asset: DdAsset
  visits: (DdVisit & { team?: DdVisitTeam[] })[]
  cards: DdCard[]
  roles: DdRole[]
  media: DdCardMedia[]
  resumenEjecutivo?: string
  disclaimerOverride?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

const C = {
  ink:   '#1A1A1A',
  soft:  '#555555',
  mid:   '#888888',
  meta:  '#AAAAAA',
  rule:  '#E6E4DF',
  light: '#F8F7F4',
  white: '#FFFFFF',
  brand: '#D85A30',
  green: '#2D7D5A',
  red:   '#C0392B',
  amber: '#E67E22',
  blue:  '#5B7FA6',
}

const RIESGO_COLOR: Record<string, string> = {
  sin_riesgo: C.green, bajo: C.blue, medio: C.amber, alto: C.red,
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', color: C.ink, backgroundColor: C.white, paddingBottom: 44 },
  coverPage: { backgroundColor: C.ink },
  coverInner: { paddingHorizontal: 48, paddingTop: 48, paddingBottom: 48, flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100%' },
  coverLogo: { width: 90, height: 22, marginBottom: 80 },
  coverTag: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 6 },
  coverAddr: { fontSize: 11, color: '#999', marginBottom: 40 },
  coverRule: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 14 },
  coverMetaRow: { flexDirection: 'row' },
  coverMetaItem: { marginRight: 32 },
  coverMetaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  coverMetaValue: { fontSize: 8, color: '#888' },
  pageHeader: { backgroundColor: C.ink, paddingHorizontal: 32, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageHeaderLogo: { width: 52, height: 13 },
  pageHeaderTitle: { fontSize: 6.5, color: '#666' },
  footer: { position: 'absolute', bottom: 14, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 5 },
  footerText: { fontSize: 6, color: C.meta },
  body: { paddingHorizontal: 40 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 2, textTransform: 'uppercase', marginTop: 24, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.rule },
  h2: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 4 },
  label: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 9, color: C.soft, marginBottom: 10 },
  bodyText: { fontSize: 9, color: C.soft, lineHeight: 1.6 },
  row2: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  badge: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase', padding: '3 8', borderRadius: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: C.light, padding: '6 8', borderBottomWidth: 1, borderBottomColor: C.rule },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottomWidth: 1, borderBottomColor: C.rule },
  tableCell: { fontSize: 8, color: C.soft },
  disclaimerBox: { backgroundColor: C.light, padding: '12 16', borderRadius: 4, marginTop: 16, borderLeftWidth: 3, borderLeftColor: C.mid },
  disclaimerText: { fontSize: 8, color: C.mid, lineHeight: 1.6, fontFamily: 'Helvetica-Oblique' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '31%' },
  photoImg: { width: '100%', height: 110, objectFit: 'cover', borderRadius: 3 },
  photoCaption: { fontSize: 6.5, color: C.meta, marginTop: 2 },
})

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PageHeader({ title }: { title: string }) {
  return (
    <View style={s.pageHeader} fixed>
      <Image src={LOGO} style={s.pageHeaderLogo} />
      <Text style={s.pageHeaderTitle}>{title}</Text>
    </View>
  )
}

function Footer({ asset }: { asset: DdAsset }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Due Diligence Técnica — {asset.nombre} — GEINEX GROUP, S.L. · Forma Prima</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function DdReportPDF({ data }: { data: DdReportPDFData }) {
  const { asset, visits, cards, roles, media, resumenEjecutivo, disclaimerOverride } = data

  const disclaimer = disclaimerOverride ?? asset.disclaimer_texto ?? ''
  const visitasFin = visits.filter(v => ['finalizada', 'en_revision_interna', 'cerrada'].includes(v.status))
  const primeraVisita = visits[0]
  const cardsReporte = cards.filter(c => c.incluir_reporte_final && c.texto_aprobado)
  const cardsIncidencia = cards.filter(c => c.estado === 'incidencia')
  const cardsNoAccesibles = cards.filter(c => c.estado === 'no_accesible')
  const mediaReporte = media.filter(m => m.tipo === 'foto')

  const roleById = Object.fromEntries(roles.map(r => [r.id, r]))

  const cardsByRol = roles.map(rol => ({
    rol,
    cards: cardsReporte.filter(c => c.rol_id === rol.id),
  })).filter(g => g.cards.length > 0)

  const team = primeraVisita?.team ?? []

  return (
    <Document title={`DD Técnica — ${asset.nombre}`}>

      {/* ── Portada ── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <Image src={LOGO} style={s.coverLogo} />
          <Text style={s.coverTag}>Due Diligence Técnica No Invasiva</Text>
          <Text style={s.coverTitle}>{asset.nombre}</Text>
          {asset.direccion && <Text style={s.coverAddr}>{asset.direccion}</Text>}
          <View style={s.coverRule}>
            <View style={s.coverMetaRow}>
              {asset.cliente && (
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Cliente</Text>
                  <Text style={s.coverMetaValue}>{asset.cliente}</Text>
                </View>
              )}
              {primeraVisita?.fecha && (
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Fecha de visita</Text>
                  <Text style={s.coverMetaValue}>{fmtDate(primeraVisita.fecha)}</Text>
                </View>
              )}
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Estado</Text>
                <Text style={s.coverMetaValue}>{DD_ASSET_STATUS_LABELS[asset.status]}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ── Datos generales + alcance ── */}
      <Page size="A4" style={s.page}>
        <PageHeader title={`${asset.nombre} — Datos generales`} />
        <View style={s.body}>
          <Text style={s.sectionTitle}>1. Datos generales del activo</Text>
          <View style={s.row2}>
            <View style={s.col}>
              <Text style={s.label}>Activo</Text>
              <Text style={s.value}>{asset.nombre}</Text>
              <Text style={s.label}>Dirección</Text>
              <Text style={s.value}>{asset.direccion ?? '—'}</Text>
              <Text style={s.label}>Cliente</Text>
              <Text style={s.value}>{asset.cliente ?? '—'}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Superficie aproximada</Text>
              <Text style={s.value}>{asset.superficie_m2 ? `${asset.superficie_m2} m²` : '—'}</Text>
              <Text style={s.label}>Uso previsto</Text>
              <Text style={s.value}>{asset.uso_previsto ?? '—'}</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>2. Alcance de la revisión</Text>
          {asset.alcance_dd && <Text style={s.bodyText}>{asset.alcance_dd}</Text>}
          <Text style={[s.bodyText, { marginTop: 8 }]}>
            La presente Due Diligence Técnica tiene alcance ejecutivo no invasivo. Incluye inspección visual del estado general del edificio, envolvente exterior, instalaciones aparentes, acabados interiores y zonas comunes. No incluye catas, ensayos destructivos, pruebas de instalaciones, auditoría urbanística ni certificación de cumplimiento normativo.
          </Text>

          <Text style={s.sectionTitle}>3. Equipo de visita</Text>
          {team.length === 0 && <Text style={s.value}>No definido</Text>}
          {team.map((m, i) => {
            const rol = roleById[m.rol_id]
            return (
              <View key={m.id} style={{ flexDirection: 'row', marginBottom: 6 }}>
                <Text style={[s.value, { width: 200, fontFamily: 'Helvetica-Bold' }]}>{m.nombre_display}</Text>
                <Text style={s.value}>{rol?.nombre ?? '—'}</Text>
              </View>
            )
          })}

          <Text style={s.sectionTitle}>4. Zonas inspeccionadas</Text>
          {visits.map(v => (
            <View key={v.id} style={{ marginBottom: 12 }}>
              <Text style={[s.label, { marginBottom: 4 }]}>Visita {fmtDate(v.fecha)}</Text>
              <Text style={s.value}>Inspeccionadas: {(v.zonas_inspeccionadas ?? v.zonas_previstas ?? []).join(', ') || '—'}</Text>
              {(v.zonas_no_accesibles?.length ?? 0) > 0 && (
                <Text style={[s.value, { color: C.amber }]}>No accesibles: {v.zonas_no_accesibles!.join(', ')}</Text>
              )}
            </View>
          ))}
        </View>
        <Footer asset={asset} />
      </Page>

      {/* ── Resumen ejecutivo ── */}
      <Page size="A4" style={s.page}>
        <PageHeader title={`${asset.nombre} — Resumen ejecutivo`} />
        <View style={s.body}>
          <Text style={s.sectionTitle}>5. Resumen ejecutivo</Text>
          {resumenEjecutivo
            ? <Text style={s.bodyText}>{resumenEjecutivo}</Text>
            : <Text style={[s.bodyText, { color: C.meta, fontFamily: 'Helvetica-Oblique' }]}>(Pendiente de redacción)</Text>
          }

          <Text style={s.sectionTitle}>6. Tabla de hallazgos principales</Text>
          {cardsIncidencia.length === 0
            ? <Text style={s.value}>Sin incidencias registradas en las cards incluidas en informe.</Text>
            : (
              <View>
                <View style={s.tableHeader}>
                  <Text style={[s.tableCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>Hallazgo</Text>
                  <Text style={[s.tableCell, { flex: 1.5, fontFamily: 'Helvetica-Bold' }]}>Especialidad</Text>
                  <Text style={[s.tableCell, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Riesgo</Text>
                  <Text style={[s.tableCell, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>CAPEX</Text>
                </View>
                {cardsIncidencia.slice(0, 20).map(card => {
                  const riesgo = card.nivel_criticidad_final ?? card.riesgo
                  const color = riesgo ? RIESGO_COLOR[riesgo] : C.mid
                  return (
                    <View key={card.id} style={s.tableRow}>
                      <Text style={[s.tableCell, { flex: 3 }]}>{card.titulo}</Text>
                      <Text style={[s.tableCell, { flex: 1.5 }]}>{card.especialidad ?? roleById[card.rol_id]?.nombre ?? '—'}</Text>
                      <Text style={[s.tableCell, { flex: 1, color }]}>{riesgo ? DD_CARD_RIESGO_LABELS[riesgo] : '—'}</Text>
                      <Text style={[s.tableCell, { flex: 1 }]}>{card.capex_orientativo ?? '—'}</Text>
                    </View>
                  )
                })}
              </View>
            )
          }

          {cardsNoAccesibles.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 16 }]}>Puntos no accesibles en visita</Text>
              {cardsNoAccesibles.map(card => (
                <Text key={card.id} style={[s.value, { marginBottom: 4 }]}>
                  · {card.titulo}{card.zona_edificio ? ` — ${card.zona_edificio}` : ''}
                </Text>
              ))}
            </>
          )}
        </View>
        <Footer asset={asset} />
      </Page>

      {/* ── Hallazgos por especialidad ── */}
      {cardsByRol.length > 0 && (
        <Page size="A4" style={s.page}>
          <PageHeader title={`${asset.nombre} — Hallazgos por especialidad`} />
          <View style={s.body}>
            <Text style={s.sectionTitle}>7. Hallazgos por especialidad</Text>
            {cardsByRol.map(({ rol, cards: rCards }) => (
              <View key={rol.id} style={{ marginBottom: 20 }} wrap={false}>
                <Text style={[s.label, { color: rol.color, marginBottom: 8 }]}>{rol.nombre}</Text>
                {rCards.map(card => {
                  const textoFinal = card.texto_aprobado_informe ?? card.texto_propuesto_informe
                  const riesgo = card.nivel_criticidad_final ?? card.riesgo
                  const color = riesgo ? RIESGO_COLOR[riesgo] : C.mid
                  return (
                    <View key={card.id} style={{ marginBottom: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: color }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Text style={[s.tableCell, { fontFamily: 'Helvetica-Bold', flex: 1 }]}>{card.titulo}</Text>
                        {riesgo && <Text style={[s.tableCell, { color, fontSize: 7 }]}>{DD_CARD_RIESGO_LABELS[riesgo]}</Text>}
                      </View>
                      {textoFinal
                        ? <Text style={s.bodyText}>{textoFinal}</Text>
                        : card.comentario_tecnico
                        ? <Text style={[s.bodyText, { fontFamily: 'Helvetica-Oblique', color: C.meta }]}>{card.comentario_tecnico}</Text>
                        : null
                      }
                      {card.capex_orientativo && (
                        <Text style={[s.value, { marginTop: 4, fontFamily: 'Helvetica-Bold' }]}>CAPEX orientativo: {card.capex_orientativo}</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            ))}

            {visits.some(v => v.capex_orientativo_total) && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 8 }]}>8. CAPEX orientativo total</Text>
                {visits.filter(v => v.capex_orientativo_total).map(v => (
                  <Text key={v.id} style={s.value}>{v.capex_orientativo_total}</Text>
                ))}
              </>
            )}
          </View>
          <Footer asset={asset} />
        </Page>
      )}

      {/* ── Documentación + Limitaciones ── */}
      <Page size="A4" style={s.page}>
        <PageHeader title={`${asset.nombre} — Limitaciones`} />
        <View style={s.body}>
          {asset.limitaciones_generales && (
            <>
              <Text style={s.sectionTitle}>9. Limitaciones de la inspección</Text>
              <Text style={s.bodyText}>{asset.limitaciones_generales}</Text>
            </>
          )}

          <Text style={s.sectionTitle}>10. Disclaimer</Text>
          <View style={s.disclaimerBox}>
            <Text style={s.disclaimerText}>{disclaimer}</Text>
          </View>
        </View>
        <Footer asset={asset} />
      </Page>

      {/* ── Anexo fotográfico ── */}
      {mediaReporte.length > 0 && (
        <Page size="A4" style={s.page}>
          <PageHeader title={`${asset.nombre} — Anexo fotográfico`} />
          <View style={s.body}>
            <Text style={s.sectionTitle}>11. Anexo fotográfico</Text>
            <View style={s.photoGrid}>
              {mediaReporte.slice(0, 24).map(m => (
                <View key={m.id} style={s.photoItem} wrap={false}>
                  <Image src={m.url} style={s.photoImg} />
                  {m.caption && <Text style={s.photoCaption}>{m.caption}</Text>}
                </View>
              ))}
            </View>
          </View>
          <Footer asset={asset} />
        </Page>
      )}

    </Document>
  )
}
