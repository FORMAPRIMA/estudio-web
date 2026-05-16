// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Contract data assembly
//
// Shared between:
//   - app/api/fpe-contracts/preview-pdf/route.ts (PDF preview, no DB write)
//   - app/actions/fpe-tenders.ts:generateContractsFromAwards (sign flow)
//
// Builds the FpeContractData payload from the adjudication overview + raw
// fpe_partners row, normalizing partner identity, scope and payment data.
// ══════════════════════════════════════════════════════════════════════════════

import type { FpeContractData, FpeContractTechnicalDoc } from '@/components/pdfs/FpeContractPDF'
import type { FpeOverviewPartner } from '@/app/actions/fpe-tenders'
import type { createAdminClient } from '@/lib/supabase/admin'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export interface ContractDataProjectRow {
  id:        string
  nombre:    string
  direccion: string | null
  ciudad:    string | null
}

export interface ContractDataPartnerRow {
  id:               string
  nombre:           string
  razon_social:     string | null
  nif_cif:          string | null
  contacto_nombre:  string | null
  email_contacto:   string | null
  telefono:         string | null
  direccion:        string | null
  ciudad:           string | null
  codigo_postal:    string | null
}

export function buildContractData(args: {
  project:         ContractDataProjectRow
  partner:         ContractDataPartnerRow | null
  pkg:             FpeOverviewPartner
  awarded_at?:     string
  technical_docs?: FpeContractTechnicalDoc[]
  /** Per-chapter computed dates from the Dream Team Gantt (Anexo III + Cl. 6). */
  chapter_dates?:  { chapter_id: string; fecha_inicio: string; fecha_fin: string; duracion_dias: number }[]
}): FpeContractData {
  const { project, partner, pkg } = args
  const datesByChapter = new Map<string, { fecha_inicio: string; fecha_fin: string; duracion_dias: number }>()
  for (const d of (args.chapter_dates ?? [])) {
    datesByChapter.set(d.chapter_id, { fecha_inicio: d.fecha_inicio, fecha_fin: d.fecha_fin, duracion_dias: d.duracion_dias })
  }

  const partnerAddress = [partner?.direccion, partner?.codigo_postal, partner?.ciudad]
    .filter(Boolean).join(', ') || null

  const flatLineItems = pkg.chapters.flatMap(ch =>
    ch.units.flatMap(u =>
      u.line_items.map(li => ({
        nombre:          li.nombre,
        unidad:          li.unidad_medida,
        cantidad:        li.cantidad,
        precio_unitario: li.precio_unitario,
        total:           li.total,
        unit_nombre:     u.unit_nombre,
      }))
    )
  )

  // One phase row per chapter. When real dates from the Dream Team Gantt are
  // available (chapter_dates), they are rendered as the contractual reference
  // in Anexo III + Cláusula 6. Otherwise the row falls back to duration-only.
  const schedule_phases = pkg.chapters.map(ch => {
    const dates = ch.chapter_id ? datesByChapter.get(ch.chapter_id) : undefined
    const fallbackDays = ch.units.reduce((s, u) => s + (u.days ?? 0), 0)
    return {
      fase:           ch.chapter_nombre,
      duracion_dias:  Math.round(dates?.duracion_dias ?? fallbackDays),
      fecha_inicio:   dates?.fecha_inicio ?? null,
      fecha_fin:      dates?.fecha_fin    ?? null,
      dependencias:   null,
      responsable:    'Execution Partner',
      estado:         'Pendiente',
    }
  })

  return {
    project: {
      id:        project.id,
      nombre:    project.nombre,
      ciudad:    project.ciudad ?? '',
      direccion: project.direccion ?? '',
    },
    partner: {
      id:           pkg.partner_id,
      nombre:       pkg.partner_nombre,
      email:        pkg.partner_email ?? '',
      legal_name:   partner?.razon_social ?? null,
      tax_id:       partner?.nif_cif ?? null,
      address:      partnerAddress,
      contact_name: partner?.contacto_nombre ?? null,
      phone:        partner?.telefono ?? null,
    },
    awarded_at: args.awarded_at ?? new Date().toISOString(),
    line_items: flatLineItems,
    chapters: pkg.chapters.map(ch => ({
      chapter_nombre: ch.chapter_nombre,
      units: ch.units.map(u => ({
        unit_nombre: u.unit_nombre,
        total:       u.total,
        days:        u.days,
        line_items:  u.line_items,
      })),
    })),
    payment_milestones: pkg.payment_milestones.map(m => ({
      nombre:       m.nombre,
      pct:          m.pct,
      monto:        m.monto,
      trigger_type: m.trigger_type,
      status:       'pendiente',
    })),
    schedule_phases,
    governing_discipline: pkg.governing_discipline_nombre,
    total:                pkg.total,
    framework_agreement:  null,  // TODO: wire when fpe_framework_agreements table exists
    technical_docs:       args.technical_docs ?? [],
    // Garantía: el mayor periodo entre todas las disciplinas adjudicadas al
    // EP. Es la lectura más conservadora para FORMA PRIMA cuando un mismo
    // contrato cubre varias disciplinas con periodos distintos.
    warranty_months:      pkg.disciplines.length > 0
      ? Math.max(...pkg.disciplines.map(d => d.warranty_months))
      : undefined,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Technical documents — snapshot of the docs the EP could see in the tender
// portal at the moment of contract generation.
//
// "Docs visibles for this EP" = docs of this project that are either:
//   (a) general — project_unit_id IS NULL (e.g., site planimetry, general specs)
//   (b) tied to a UE that this EP has been awarded (specific planimetry, specs)
//
// These are the same documents the EP had access to when submitting their bid,
// and therefore form the technical baseline of the contractual offer.
// ══════════════════════════════════════════════════════════════════════════════

interface FpeDocumentRow {
  id:              string
  nombre:          string
  storage_path:    string
  mime_type:       string | null
  size_bytes:      number | null
  project_unit_id: string | null
  created_at:      string
}

const PRINTABLE_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])

function inferDocType(d: FpeDocumentRow): string {
  if (d.mime_type) {
    if (d.mime_type.startsWith('image/')) return 'Imagen'
    if (d.mime_type === 'application/pdf') return 'PDF'
    if (d.mime_type.includes('autocad') || d.mime_type.includes('dwg')) return 'DWG (AutoCAD)'
    if (d.mime_type.includes('dxf')) return 'DXF'
    if (d.mime_type.includes('spreadsheet') || d.mime_type.includes('excel')) return 'Hoja de cálculo'
    if (d.mime_type.includes('word')) return 'Documento Word'
  }
  const ext = (d.storage_path.split('.').pop() ?? '').toLowerCase()
  if (!ext) return 'Documento'
  const upper = ext.toUpperCase()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'dwg') return 'DWG (AutoCAD)'
  if (ext === 'dxf') return 'DXF'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'Imagen'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Hoja de cálculo'
  if (['doc', 'docx'].includes(ext)) return 'Documento Word'
  return upper
}

function isPrintable(d: FpeDocumentRow): boolean {
  const ext = (d.storage_path.split('.').pop() ?? '').toLowerCase()
  if (PRINTABLE_EXT.has(ext)) return true
  if (d.mime_type === 'application/pdf') return true
  if (d.mime_type?.startsWith('image/')) return true
  return false
}

function mapDocToTechnicalDoc(d: FpeDocumentRow, scopeUnitIds: Set<string>): FpeContractTechnicalDoc {
  const printable = isPrintable(d)
  const scopeNote = d.project_unit_id === null
    ? 'Planimetría general del proyecto'
    : scopeUnitIds.has(d.project_unit_id) ? 'Planimetría específica de UE adjudicada' : 'Documento del proyecto'

  const observaciones = printable
    ? scopeNote
    : `${scopeNote}. Formato nativo no imprimible — referenciado por nombre y ruta de plataforma.`

  return {
    nombre:        d.nombre,
    tipo:          inferDocType(d),
    fecha:         d.created_at,
    version:       null,
    referencia:    d.storage_path,
    observaciones,
  }
}

export async function fetchTechnicalDocsForContract(args: {
  admin:          SupabaseAdmin
  project_id:     string
  scope_unit_ids: string[]
}): Promise<FpeContractTechnicalDoc[]> {
  const { admin, project_id, scope_unit_ids } = args

  const [generalRes, scopedRes] = await Promise.all([
    admin
      .from('fpe_documents')
      .select('id, nombre, storage_path, mime_type, size_bytes, project_unit_id, created_at')
      .eq('project_id', project_id)
      .is('project_unit_id', null)
      .order('created_at', { ascending: true }),
    scope_unit_ids.length > 0
      ? admin
          .from('fpe_documents')
          .select('id, nombre, storage_path, mime_type, size_bytes, project_unit_id, created_at')
          .eq('project_id', project_id)
          .in('project_unit_id', scope_unit_ids)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as FpeDocumentRow[] }),
  ])

  const docs: FpeDocumentRow[] = [
    ...((generalRes.data ?? []) as FpeDocumentRow[]),
    ...((scopedRes.data ?? []) as FpeDocumentRow[]),
  ]

  const scopeSet = new Set(scope_unit_ids)
  return docs.map(d => mapDocToTechnicalDoc(d, scopeSet))
}
