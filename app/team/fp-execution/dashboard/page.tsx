import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// ── Status banner label ───────────────────────────────────────────────────────


const modules = [
  {
    label: 'Template',
    description: 'Configura los Capítulos, Unidades de Ejecución, Partidas y Fases que sirven de base a todos los proyectos.',
    href: '/team/fp-execution/template',
    status: 'live' as const,
    phase: 'Fase 1',
  },
  {
    label: 'Partners',
    description: 'Gestiona las empresas subcontratistas y sus especialidades por Unidad de Ejecución.',
    href: '/team/fp-execution/partners',
    status: 'live' as const,
    phase: 'Fase 1',
  },
  {
    label: 'Proyectos',
    description: 'Crea y gestiona proyectos de licitación. Define el scope, sube documentación y lanza la licitación.',
    href: '/team/fp-execution/projects',
    status: 'live' as const,
    phase: 'Fase 2',
  },
  {
    label: 'Control Room',
    description: 'Vista global de todas las licitaciones activas: plazos, ofertas recibidas, Q&A pendiente y adjudicaciones.',
    href: '/team/fp-execution/control-room',
    status: 'live' as const,
    phase: 'Fase 7',
  },
]

export default async function FpExecutionDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Módulo</p>
        <h1 className="text-2xl font-semibold text-stone-800">FP Execution</h1>
        <p className="mt-2 text-sm text-stone-500 max-w-xl">
          Plataforma de preconstrucción y licitación. Gestiona el scope técnico, lanza paquetes
          a partners externos y adjudica obra con trazabilidad completa.
        </p>
      </div>

      {/* Status banner */}
      <div className="mb-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Fases 1–7 activas — Plataforma completa de licitación</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Template · Partners · Proyectos · Portal externo · Ofertas · Q&amp;A · Control Room · Contratación
          </p>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          mod.status === 'live' ? (
            <Link
              key={mod.href}
              href={mod.href}
              className="rounded-lg border border-stone-200 bg-white p-5 flex flex-col gap-3 hover:border-stone-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-stone-700">{mod.label}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  {mod.phase}
                </span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed flex-1">{mod.description}</p>
              <span className="inline-block text-xs text-emerald-500 font-semibold mt-auto">
                Activo →
              </span>
            </Link>
          ) : (
            <div
              key={mod.href}
              className="rounded-lg border border-stone-200 bg-white p-5 flex flex-col gap-3 opacity-60"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-stone-700">{mod.label}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-400">
                  {mod.phase}
                </span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed flex-1">{mod.description}</p>
              <span className="inline-block text-xs text-stone-300 font-medium mt-auto">
                Próximamente
              </span>
            </div>
          )
        ))}
      </div>

      {/* Schema summary */}
      <div className="mt-10 rounded-lg border border-stone-200 bg-stone-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
          Modelo de datos — Fase 0
        </p>
        <div className="grid gap-2 sm:grid-cols-2 text-xs text-stone-600">
          {[
            ['Plantilla', 'fpe_template_chapters, units, line_items, phases, dependencies'],
            ['Partners', 'fpe_partners, partner_capabilities'],
            ['Proyectos', 'fpe_projects, project_units, project_line_items, documents'],
            ['Licitación', 'fpe_tenders, tender_invitations, bids, bid_line_items, bid_phase_durations'],
            ['Q&A', 'fpe_qa_questions, qa_answers'],
            ['Adjudicación', 'fpe_awards, contracts'],
          ].map(([group, tables]) => (
            <div key={group} className="flex flex-col gap-0.5">
              <span className="font-semibold text-stone-700">{group}</span>
              <span className="text-stone-400 font-mono text-[11px] leading-relaxed">{tables}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
