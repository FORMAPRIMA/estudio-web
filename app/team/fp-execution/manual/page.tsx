'use client'

import React from 'react'
import Link from 'next/link'

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  dark:    '#1A1A1A',
  accent:  '#D85A30',
  mid:     '#555',
  muted:   '#888',
  faint:   '#AAA',
  border:  '#E8E6E0',
  bg:      '#F8F7F4',
  white:   '#fff',
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      padding: '2px 8px', borderRadius: 4, background: bg, color,
    }}>
      {label}
    </span>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
        background: C.dark, color: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 10, fontWeight: 700, marginTop: 1,
      }}>
        {n}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: C.mid, lineHeight: 1.65 }}>{children}</p>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderLeft: `3px solid ${C.accent}`, padding: '10px 16px',
      background: '#FFF8F5', borderRadius: '0 4px 4px 0', margin: '14px 0',
    }}>
      <p style={{ margin: 0, fontSize: 12, color: '#7A3520', lineHeight: 1.6 }}>
        <strong>Nota:</strong> {children}
      </p>
    </div>
  )
}

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ borderBottom: `2px solid ${C.dark}`, paddingBottom: 10, marginBottom: 24 }}>
      <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent }}>
        Sección {num}
      </p>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.dark, letterSpacing: '-0.02em' }}>
        {title}
      </h2>
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ margin: '28px 0 10px', fontSize: 14, fontWeight: 700, color: C.dark, borderLeft: `3px solid ${C.border}`, paddingLeft: 10 }}>
      {children}
    </h3>
  )
}

function Divider() {
  return <div style={{ borderTop: `1px solid ${C.border}`, margin: '36px 0' }} />
}

function PageBreak() {
  return <div className="page-break" />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManualPage() {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @page { margin: 18mm 16mm; size: A4; }
        body { font-family: 'Inter', system-ui, sans-serif; }
      `}</style>

      {/* ── Floating nav bar (hidden when printing) ── */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/team/fp-execution/dashboard" style={{ fontSize: 12, color: C.muted, textDecoration: 'none', fontWeight: 500 }}>
          ← Volver al Dashboard
        </Link>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 18px', fontSize: 12, fontWeight: 600, borderRadius: 5,
            border: 'none', cursor: 'pointer', background: C.dark, color: '#fff', fontFamily: 'inherit',
          }}
        >
          Descargar PDF
        </button>
      </div>

      {/* ── Document wrapper ── */}
      <div style={{ background: C.bg, minHeight: '100vh', padding: '0 0 80px' }}>
        <div style={{ maxWidth: 794, margin: '0 auto', background: C.white, boxShadow: '0 0 60px rgba(0,0,0,0.08)' }}>

          {/* ══════════════════════════════════════════════════
              PORTADA
          ══════════════════════════════════════════════════ */}
          <div style={{ background: C.dark, padding: '80px 64px 64px', minHeight: 360 }}>
            <p style={{ margin: '0 0 56px', fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.accent }}>
              FORMA PRIMA
            </p>
            <h1 style={{ margin: '0 0 8px', fontSize: 44, fontWeight: 300, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              FP Execution
            </h1>
            <p style={{ margin: '0 0 64px', fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              Manual de Usuario
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 28, display: 'flex', gap: 48 }}>
              {[
                ['Versión',    '1.0'],
                ['Fecha',      'Abril 2026'],
                ['Plataforma', 'internal.formaprima.es'],
                ['Acceso',     'fp_manager / fp_partner'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{k}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Intro paragraph under cover */}
          <div style={{ background: '#F0EEE8', padding: '28px 64px' }}>
            <p style={{ margin: 0, fontSize: 13, color: C.mid, lineHeight: 1.7, maxWidth: 600 }}>
              Este documento describe en detalle el funcionamiento de <strong>FP Execution</strong>, la plataforma interna de Forma Prima para gestionar el proceso completo de preconstrucción y licitación. Cubre todos los módulos, flujos de trabajo y acciones necesarias para operar el sistema de principio a fin.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════
              ÍNDICE
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent }}>Contenido</p>
            <h2 style={{ margin: '0 0 32px', fontSize: 22, fontWeight: 700, color: C.dark }}>Índice</h2>

            {[
              ['1', 'Introducción y acceso',               'Qué es, quién lo usa, cómo acceder'],
              ['2', 'Arquitectura del sistema',             'Módulos, roles y estados globales'],
              ['3', 'Módulo Template',                     'Capítulos, Unidades de Ejecución y Partidas'],
              ['4', 'Módulo Partners',                     'Registro, capacidades y datos de contacto'],
              ['5', 'Módulo Proyectos',                    'Ciclo de vida, scope (selección UEs), documentos + mediciones + partners por capítulo'],
              ['6', 'Envío de invitaciones',                'Paquetes por partner, revisión, envío masivo'],
              ['7', 'Portal externo del Partner',          'Lo que ve el subcontratista'],
              ['8', 'Sistema Q&A',                         'Preguntas y respuestas durante la licitación'],
              ['9', 'Comparativa de ofertas (Bid Comparison)', 'Análisis de bids, exportación CSV'],
              ['10','Adjudicación y contratación',         'Adjudicar, contratar, archivar'],
              ['11','Control Room',                        'Vista global de licitaciones activas'],
              ['12','Cronología completa de un proyecto',  'Paso a paso de inicio a cierre'],
              ['13','Emails automáticos del sistema',      'Qué se envía y cuándo'],
              ['14','Estados y transiciones',              'Diagrama de estados por entidad'],
              ['15','Glosario',                            'Términos clave del sistema'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flexShrink: 0, width: 20, fontSize: 11, fontWeight: 700, color: C.faint, fontFamily: 'monospace' }}>{num}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.dark }}>{title}</span>
                <span style={{ fontSize: 11, color: C.faint, textAlign: 'right', maxWidth: 240 }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════
              1 · INTRODUCCIÓN
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="1" title="Introducción y acceso" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              <strong>FP Execution</strong> es la plataforma interna de Forma Prima diseñada para gestionar el proceso de <em>preconstrucción y licitación</em> de proyectos. Permite al equipo crear proyectos, definir su alcance técnico (scope), invitar a partners (subcontratistas) a presentar ofertas económicas, comparar propuestas y adjudicar la obra, todo desde un único sistema trazable.
            </p>

            <SubTitle>¿Quién utiliza FP Execution?</SubTitle>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                {
                  role: 'Equipo Forma Prima',
                  badge: 'fp_manager / fp_partner',
                  badgeBg: '#1A1A1A', badgeC: '#fff',
                  items: ['Crear y gestionar proyectos', 'Definir el scope técnico', 'Subir documentación', 'Lanzar licitaciones', 'Invitar partners', 'Responder preguntas Q&A', 'Comparar y adjudicar ofertas', 'Marcar contratación'],
                },
                {
                  role: 'Partners externos',
                  badge: 'Sin cuenta — acceso por enlace',
                  badgeBg: '#F3F4F6', badgeC: '#6B7280',
                  items: ['Reciben invitación por email', 'Acceden al portal con enlace personal', 'Consultan scope y documentos', 'Formulan preguntas', 'Presentan su oferta económica', 'Pueden modificar la oferta hasta el plazo'],
                },
              ].map(r => (
                <div key={r.role} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: C.dark }}>{r.role}</p>
                  <Badge label={r.badge} bg={r.badgeBg} color={r.badgeC} />
                  <ul style={{ margin: '14px 0 0', paddingLeft: 18 }}>
                    {r.items.map(i => (
                      <li key={i} style={{ fontSize: 12, color: C.mid, lineHeight: 1.7 }}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <SubTitle>Cómo acceder</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              El acceso es mediante la plataforma interna de Forma Prima. Una vez con sesión iniciada:
            </p>
            <Step n={1}>Acceder a <strong>internal.formaprima.es</strong> con las credenciales del equipo.</Step>
            <Step n={2}>En el menú lateral, seleccionar <strong>FP Execution</strong>.</Step>
            <Step n={3}>El dashboard muestra todos los módulos disponibles: Template, Partners, Proyectos y Control Room.</Step>

            <Note>Solo los usuarios con rol <strong>fp_manager</strong> o <strong>fp_partner</strong> pueden acceder a FP Execution. Si al acceder aparece un error de permisos, contactar con el administrador del sistema.</Note>
          </div>

          <Divider />

          {/* ══════════════════════════════════════════════════
              2 · ARQUITECTURA
          ══════════════════════════════════════════════════ */}
          <div style={{ padding: '0 64px 56px' }}>
            <SectionTitle num="2" title="Arquitectura del sistema" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 24px' }}>
              FP Execution se organiza en cuatro módulos principales que interactúan entre sí. Entender cómo se relacionan es fundamental para operar el sistema correctamente.
            </p>

            {/* Module map */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
              <div style={{ background: C.dark, padding: '12px 20px' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Mapa de módulos</p>
              </div>
              {[
                { mod: 'Template', desc: 'Define la estructura global: qué capítulos, unidades y partidas existen. Es la base de todos los proyectos.', phase: 'Base', bg: '#F3F4F6', c: '#6B7280' },
                { mod: 'Partners', desc: 'Registro de empresas subcontratistas, sus datos y las unidades en las que están especializadas.', phase: 'Base', bg: '#F3F4F6', c: '#6B7280' },
                { mod: 'Proyectos', desc: 'Proyectos individuales. Cada uno tiene scope, documentación y su licitación asociada.', phase: 'Core', bg: '#EBF5FF', c: '#378ADD' },
                { mod: 'Control Room', desc: 'Vista centralizada de todas las licitaciones activas, con métricas y alertas de urgencia.', phase: 'Gestión', bg: '#FEF3C7', c: '#D97706' },
              ].map((r, i) => (
                <div key={r.mod} style={{ padding: '16px 20px', borderBottom: i < 3 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <Badge label={r.phase} bg={r.bg} color={r.c} />
                  <div>
                    <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: C.dark }}>{r.mod}</p>
                    <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <SubTitle>Relación entre módulos</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              El flujo natural entre módulos es el siguiente:
            </p>
            <div style={{ background: C.bg, borderRadius: 8, padding: '20px 24px', fontFamily: 'monospace', fontSize: 12, color: C.mid, lineHeight: 2 }}>
              Template (UEs y partidas)<br/>
              {'  ↓'}<br/>
              Partners (especializados en UEs del template)<br/>
              {'  ↓'}<br/>
              Proyecto (selecciona UEs del template como scope)<br/>
              {'  ↓'}<br/>
              Licitación (usa el scope + los partners disponibles)<br/>
              {'  ↓'}<br/>
              Control Room (visibilidad de todas las licitaciones)
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              3 · TEMPLATE
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="3" title="Módulo Template" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              El Template es la <strong>estructura maestra</strong> que define qué se puede licitar. Se organiza en tres niveles jerárquicos:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
              {[
                { level: '01', name: 'Capítulo', desc: 'Agrupación temática de trabajo. Ej: "Estructura", "Instalaciones", "Acabados".' },
                { level: '02', name: 'Unidad de Ejecución (UE)', desc: 'Partida de trabajo dentro del capítulo. Es la unidad mínima que se licita. Ej: "Hormigón armado in situ".' },
                { level: '03', name: 'Partida', desc: 'Elemento medible dentro de la UE con su unidad de medida. Ej: "Forjado losa maciza — m²".' },
              ].map(r => (
                <div key={r.level} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent }}>Nivel {r.level}</p>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: C.dark }}>{r.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{r.desc}</p>
                </div>
              ))}
            </div>

            <SubTitle>Cómo gestionar el template</SubTitle>
            <Step n={1}>Acceder a <strong>FP Execution → Template</strong>.</Step>
            <Step n={2}>Crear un <strong>Capítulo</strong> con el botón "+ Capítulo". Dar nombre y orden.</Step>
            <Step n={3}>Dentro del capítulo, añadir <strong>Unidades de Ejecución</strong> con el botón "+ Unidad".</Step>
            <Step n={4}>Dentro de cada UE, añadir las <strong>Partidas</strong> con nombre y unidad de medida (m², ml, ud, kg…).</Step>
            <Step n={5}>Las UEs y Partidas pueden activarse/desactivarse sin eliminarlas. Las desactivadas no aparecen en el scope builder.</Step>

            <Note>El template es global y compartido por todos los proyectos. Añadir nuevas UEs o partidas no afecta a proyectos ya guardados. Si se desactiva una UE o partida, proyectos existentes que la tenían en su scope <strong>no se ven afectados</strong>.</Note>

            <SubTitle>Buenas prácticas</SubTitle>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {[
                'Definir el template completo antes de crear los primeros proyectos.',
                'Usar nombres de UEs claros y reconocibles para los partners.',
                'Incluir la unidad de medida correcta desde el inicio — no cambia una vez hay proyectos con esa partida.',
                'Desactivar (no eliminar) las partidas obsoletas para mantener el historial.',
              ].map(t => <li key={t} style={{ fontSize: 12, color: C.mid, lineHeight: 1.8 }}>{t}</li>)}
            </ul>
          </div>

          {/* ══════════════════════════════════════════════════
              4 · PARTNERS
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="4" title="Módulo Partners" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              Un <strong>partner</strong> es cualquier empresa subcontratista o proveedor que puede ser invitado a licitar en los proyectos de Forma Prima. El registro en el sistema es un requisito previo para poder enviarle una invitación.
            </p>

            <SubTitle>Datos de un partner</SubTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { group: 'Datos empresa', items: ['Nombre comercial (obligatorio)', 'Razón social', 'NIF / CIF', 'Dirección, ciudad, código postal, país', 'IBAN (para facturación)'] },
                { group: 'Contacto', items: ['Nombre de contacto principal', 'Email de contacto', 'Email de notificaciones (recibe invitaciones)', 'Email de facturación', 'Teléfono'] },
              ].map(g => (
                <div key={g.group} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.dark, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{g.group}</p>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {g.items.map(i => <li key={i} style={{ fontSize: 12, color: C.mid, lineHeight: 1.8 }}>{i}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <Note>El campo <strong>Email de notificaciones</strong> es el que recibe las invitaciones a licitación y los recordatorios automáticos. Si no está relleno, se usa el email de contacto. Si ninguno está relleno, <strong>no se puede enviar la invitación</strong> por email (sólo copiar el enlace manualmente).</Note>

            <SubTitle>Matriz de capacidades</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Cada partner tiene asociadas las <strong>Unidades de Ejecución</strong> en las que está especializado. Esta matriz se usa al crear invitaciones: el sistema sugiere los partners compatibles con las UEs del scope del proyecto.
            </p>
            <Step n={1}>En el perfil del partner, acceder a la sección de capacidades.</Step>
            <Step n={2}>Marcar todas las UEs del template en las que el partner puede trabajar.</Step>
            <Step n={3}>Guardar. Las capacidades son visibles al crear invitaciones en la licitación.</Step>

            <SubTitle>Activar / Desactivar un partner</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: 0 }}>
              Los partners pueden marcarse como <strong>inactivos</strong>. Los partners inactivos no aparecen en la lista de candidatos al crear invitaciones, pero su historial se conserva en el sistema.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════
              5 · PROYECTOS
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="5" title="Módulo Proyectos" />

            <SubTitle>5.1 Ciclo de vida de un proyecto</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 16px' }}>
              Un proyecto avanza por los siguientes estados. Cada transición requiere una acción explícita del equipo:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 24 }}>
              {[
                { label: 'Borrador',      bg: '#F3F4F6', c: '#6B7280' },
                { label: '→', bg: 'transparent', c: C.faint },
                { label: 'Scope listo',   bg: '#EBF5FF', c: '#378ADD' },
                { label: '→', bg: 'transparent', c: C.faint },
                { label: 'En licitación', bg: '#FEF3C7', c: '#D97706' },
                { label: '→', bg: 'transparent', c: C.faint },
                { label: 'Adjudicado',    bg: '#ECFDF5', c: '#059669' },
                { label: '→', bg: 'transparent', c: C.faint },
                { label: 'Contratado',    bg: '#D1FAE5', c: '#065F46' },
                { label: '→', bg: 'transparent', c: C.faint },
                { label: 'Archivado',     bg: '#F9FAFB', c: '#9CA3AF' },
              ].map((s, i) => (
                s.bg === 'transparent'
                  ? <span key={i} style={{ fontSize: 14, color: C.faint }}>→</span>
                  : <Badge key={s.label} label={s.label} bg={s.bg} color={s.c} />
              ))}
            </div>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
              {[
                { estado: 'Borrador',      trigger: 'Al crear el proyecto',               desc: 'Proyecto creado, sin scope guardado o scope incompleto.' },
                { estado: 'Scope listo',   trigger: 'Al guardar el scope',                desc: 'UEs seleccionadas. Se puede continuar a configurar la documentación.' },
                { estado: 'En licitación', trigger: 'Al enviar invitaciones',             desc: 'Invitaciones enviadas a los execution partners seleccionados.' },
                { estado: 'Adjudicado',    trigger: 'Al adjudicar una oferta',            desc: 'Un partner ha sido elegido como ganador de la licitación.' },
                { estado: 'Contratado',    trigger: 'Al marcar "Contratado" manualmente', desc: 'Contrato firmado offline. Proyecto cerrado operativamente.' },
                { estado: 'Archivado',     trigger: 'Al archivar manualmente',            desc: 'Proyecto completado y retirado de las vistas activas.' },
              ].map((r, i) => (
                <div key={r.estado} style={{ display: 'grid', gridTemplateColumns: '130px 200px 1fr', gap: 16, padding: '12px 16px', borderBottom: i < 5 ? `1px solid ${C.border}` : 'none', alignItems: 'start', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.dark }}>{r.estado}</span>
                  <span style={{ color: C.muted }}>{r.trigger}</span>
                  <span style={{ color: C.mid }}>{r.desc}</span>
                </div>
              ))}
            </div>

            <SubTitle>5.2 Crear un proyecto</SubTitle>
            <Step n={1}>Acceder a <strong>FP Execution → Proyectos</strong>.</Step>
            <Step n={2}>Clic en <strong>+ Nuevo proyecto</strong>.</Step>
            <Step n={3}>Rellenar: nombre del proyecto (obligatorio), descripción, dirección y ciudad.</Step>
            <Step n={4}>Opcionalmente, vincular a un <strong>Proyecto FP interno</strong> para trazabilidad cruzada.</Step>
            <Step n={5}>Clic en <strong>Crear</strong>. El proyecto queda en estado Borrador.</Step>

            <SubTitle>5.3 Pestaña Scope — Selección de unidades</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              En esta pestaña se define <strong>qué unidades de ejecución forman parte del proyecto</strong>. Nada más. Las cantidades y la asignación de partners se hacen en el paso siguiente (Documentos).
            </p>
            <Step n={1}>Marcar el checkbox de cada <strong>Unidad de Ejecución</strong> que aplica al proyecto.</Step>
            <Step n={2}>Añadir una nota de UE si es necesario (condicionantes generales, observaciones de alcance).</Step>
            <Step n={3}>Clic en <strong>Guardar scope</strong>. El proyecto pasa a estado "Scope listo".</Step>

            <Note>Puedes usar los checkboxes de capítulo para marcar o desmarcar todas las UEs de un bloque de golpe. En este paso <strong>no se introducen cantidades ni precios</strong> — eso ocurre en la pestaña Documentos, dentro de cada capítulo.</Note>

            <SubTitle>5.4 Pestaña Documentos — Configuración por capítulo</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 16px' }}>
              Esta es la pestaña central de preparación de la licitación. El sistema genera automáticamente <strong>una sub-pestaña por cada capítulo</strong> que tenga al menos una UE seleccionada en el scope. Basta con haber marcado una sola UE de un capítulo para que ese capítulo aparezca aquí.
            </p>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              <em>Ejemplo: si se selecciona la UE "Instalación de maquinaria de Aire Acondicionado", aparece automáticamente una pestaña "Aire Acondicionado" con toda la configuración de ese capítulo.</em>
            </p>

            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.dark }}>Dentro de cada pestaña de capítulo hay tres zonas:</p>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              {[
                {
                  zona: '① Planimetría del capítulo',
                  desc: 'Zona de subida de archivos PDF y CAD específicos de ese capítulo (planos, detalles constructivos, especificaciones técnicas). Estos documentos se enviarán a todos los execution partners que estén asignados a cualquier UE dentro de este capítulo.',
                },
                {
                  zona: '② Cards por Unidad de Ejecución',
                  desc: 'Una card por cada UE seleccionada dentro de ese capítulo. Cada card muestra las partidas precargadas desde plantilla con título, descripción y unidad de medida ya rellenos. Solo hace falta introducir el campo "Cantidad". El campo "Precio unitario" está bloqueado — lo rellena el execution partner en su portal.',
                },
                {
                  zona: '③ Selección de execution partners (por UE)',
                  desc: 'En la parte inferior de cada card de UE hay un desplegable de selección múltiple de execution partners. La lista está filtrada exclusivamente a los partners con capacidades en esa UE concreta. No aparecerán partners de otras disciplinas. Los partners seleccionados aquí recibirán la invitación a licitar esta UE.',
                },
              ].map((r, i) => (
                <div key={r.zona} style={{ padding: '14px 18px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: C.dark }}>{r.zona}</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.mid, lineHeight: 1.65 }}>{r.desc}</p>
                </div>
              ))}
            </div>

            <Note>Un mismo execution partner puede estar asignado a varias UEs de distintos capítulos. El sistema agrupará automáticamente todas sus UEs asignadas en un único paquete de invitación. El partner recibirá un solo enlace con acceso a todo su scope.</Note>
          </div>

          {/* ══════════════════════════════════════════════════
              6 · ENVÍO DE INVITACIONES
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="6" title="Envío de invitaciones" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              Una vez configuradas las cantidades y asignados los execution partners por UE en la pestaña Documentos, el sistema genera automáticamente los <strong>paquetes de envío</strong>: un paquete por execution partner, agrupando todas las UEs que le han sido asignadas.
            </p>

            <SubTitle>6.1 Revisión de paquetes de envío</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 16px' }}>
              Antes de enviar, el sistema muestra un <strong>dashboard de revisión</strong> organizado por capítulo. Dentro de cada capítulo aparecen las cards de los execution partners seleccionados en ese bloque.
            </p>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ background: C.dark, padding: '10px 18px' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Contenido de cada card de paquete</p>
              </div>
              {[
                ['Nombre del partner',        'Nombre comercial del execution partner.'],
                ['Datos de contacto',         'Email y teléfono móvil por donde se comunicará la invitación.'],
                ['UEs asignadas (resumen)',   'Lista de todas las Unidades de Ejecución incluidas en su paquete, aunque provengan de distintos capítulos.'],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: '12px 18px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.dark }}>{k}</span>
                  <span style={{ color: C.mid }}>{v}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Este paso es exclusivamente de <strong>revisión y verificación</strong>. Aquí el equipo FP puede confirmar que cada partner tiene asignadas las UEs correctas y que los datos de contacto son válidos antes de hacer el envío masivo.
            </p>

            <SubTitle>6.2 Enviar todas las invitaciones</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Una vez revisados los paquetes, un único botón en la parte inferior del dashboard dispara el envío automático de todos los emails.
            </p>
            <Step n={1}>Revisar todos los paquetes de envío en el dashboard.</Step>
            <Step n={2}>Clic en <strong>Enviar invitaciones</strong> (botón al pie del dashboard de paquetes).</Step>
            <Step n={3}>El sistema genera un enlace personal único para cada partner y envía un email con acceso al portal externo.</Step>
            <Step n={4}>El estado de cada invitación pasa a <Badge label="Enviada" bg="#EBF5FF" color="#378ADD" /> y el proyecto a "En licitación".</Step>

            <Note>El enlace de invitación tiene una validez de <strong>14 días</strong>. Si caduca antes de que el partner presente oferta, es posible reenviar una nueva invitación desde la vista de seguimiento.</Note>

            <SubTitle>6.3 Estados de las invitaciones</SubTitle>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              {[
                { s: 'Enviada',         bg: '#EBF5FF', c: '#378ADD', desc: 'Email enviado. El partner aún no ha abierto el enlace.' },
                { s: 'Vista',           bg: '#FEF3C7', c: '#D97706', desc: 'El partner ha accedido al portal al menos una vez.' },
                { s: 'Oferta recibida', bg: '#ECFDF5', c: '#059669', desc: 'El partner ha enviado su propuesta económica.' },
                { s: 'Revocada',        bg: '#FEF2F2', c: '#DC2626', desc: 'Cancelada manualmente por el equipo FP. El portal muestra mensaje de acceso revocado.' },
                { s: 'Expirada',        bg: '#F9FAFB', c: '#9CA3AF', desc: 'El token ha caducado (14 días). El partner ya no puede acceder.' },
              ].map((r, i) => (
                <div key={r.s} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, padding: '12px 16px', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                  <Badge label={r.s} bg={r.bg} color={r.c} />
                  <span style={{ fontSize: 12, color: C.mid }}>{r.desc}</span>
                </div>
              ))}
            </div>

            <SubTitle>6.4 Copiar el enlace</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Si necesitas enviar el enlace por un canal adicional (WhatsApp, Teams, etc.), usa el botón <strong>Copiar enlace</strong> disponible en las invitaciones con estado Enviada, Vista u Oferta recibida.
            </p>

            <SubTitle>6.5 Revocar una invitación</SubTitle>
            <Step n={1}>En la vista de seguimiento, clic en <strong>Revocar</strong> en la fila del partner.</Step>
            <Step n={2}>Confirmar la acción (es irreversible).</Step>
            <Step n={3}>El portal del partner mostrará inmediatamente un mensaje de acceso revocado. El partner ya no puede enviar oferta.</Step>

            <SubTitle>6.6 Cerrar la licitación</SubTitle>
            <Step n={1}>Una vez recibidas las ofertas (o llegada la fecha límite), clic en <strong>Cerrar licitación</strong>.</Step>
            <Step n={2}>Confirmar. El estado pasa a <Badge label="Cerrada" bg="#ECFDF5" color="#059669" />.</Step>
            <Step n={3}>No se aceptarán más ofertas. Los portales de los partners muestran la licitación como cerrada.</Step>
          </div>

          {/* ══════════════════════════════════════════════════
              7 · PORTAL EXTERNO
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="7" title="Portal externo del Partner" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              El portal es la interfaz que ven los partners cuando reciben una invitación. <strong>No requiere cuenta ni login</strong>: el acceso se realiza únicamente mediante el enlace personal recibido por email.
            </p>

            <Note>El enlace es personal e intransferible. Cada partner recibe el suyo propio, con acceso sólo a las UEs que se le han asignado en su invitación. Nunca verá el scope de otros partners ni sus ofertas.</Note>

            <SubTitle>Pestañas del portal</SubTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { tab: 'Oferta', desc: 'Muestra el scope asignado al partner (UEs y partidas con cantidades). Aquí introduce los precios unitarios y envía la oferta.' },
                { tab: 'Documentación', desc: 'Lista de todos los documentos del proyecto: planos, memorias, especificaciones. Descargables en un clic.' },
                { tab: 'Notas', desc: 'Campo libre incluido en la oferta. El partner puede añadir consideraciones, alternativas técnicas o condicionantes.' },
                { tab: 'Preguntas (Q&A)', desc: 'El partner puede ver todas las preguntas y respuestas del proceso y formular nuevas consultas al equipo FP.' },
              ].map(r => (
                <div key={r.tab} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: C.dark }}>{r.tab}</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{r.desc}</p>
                </div>
              ))}
            </div>

            <SubTitle>7.1 Cómo presenta una oferta el partner</SubTitle>
            <Step n={1}>El partner abre el enlace del email y accede al portal.</Step>
            <Step n={2}>En la pestaña <strong>Oferta</strong>, ve el scope que le corresponde: UEs, partidas y cantidades.</Step>
            <Step n={3}>Para cada partida, introduce el <strong>precio unitario en €</strong>. El sistema calcula el importe por partida y el total automáticamente.</Step>
            <Step n={4}>Opcional: añadir notas generales en la pestaña <strong>Notas</strong>.</Step>
            <Step n={5}>Clic en <strong>Enviar oferta</strong>. La invitación pasa a estado "Oferta recibida".</Step>

            <Note>La oferta puede modificarse y reenviarse tantas veces como sea necesario hasta que se cierre la licitación o llegue la fecha límite. Una vez cerrada, el portal pasa a modo solo lectura.</Note>

            <SubTitle>7.2 Descarga de documentación</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              En la pestaña Documentación, el partner ve todos los archivos adjuntos al proyecto y puede descargarlos individualmente. Los documentos están organizados por disciplina y asociados a las UEs correspondientes.
            </p>

            <SubTitle>7.3 Acceso expirado o revocado</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: 0 }}>
              Si el enlace ha caducado (más de 14 días) o ha sido revocado por el equipo FP, el portal muestra una pantalla de acceso no disponible con instrucciones para contactar con <strong>contacto@formaprima.es</strong>.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════
              8 · Q&A
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="8" title="Sistema Q&A — Preguntas y respuestas" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              El sistema Q&A permite a los partners formular consultas técnicas o de alcance durante el proceso de licitación. Todas las preguntas y respuestas son <strong>visibles para todos los partners invitados</strong>, garantizando igualdad de condiciones.
            </p>

            <SubTitle>Desde el portal del partner</SubTitle>
            <Step n={1}>El partner accede a la pestaña <strong>Preguntas</strong> en su portal.</Step>
            <Step n={2}>Ve todas las preguntas previas con sus respuestas.</Step>
            <Step n={3}>Escribe su pregunta en el campo de texto y clic en <strong>Enviar pregunta</strong>.</Step>
            <Step n={4}>El equipo FP recibe una notificación automática por email en <code>contacto@formaprima.es</code>.</Step>

            <SubTitle>Desde la plataforma interna (equipo FP)</SubTitle>
            <Step n={1}>En la pestaña <strong>Licitación</strong> del proyecto, desplegar la sección <strong>Q&A</strong>.</Step>
            <Step n={2}>Las preguntas sin responder aparecen resaltadas en amarillo con el aviso "N pendientes".</Step>
            <Step n={3}>Escribir la respuesta en el campo de texto bajo la pregunta.</Step>
            <Step n={4}>Clic en <strong>Responder</strong>. La respuesta se publica inmediatamente y es visible para todos los partners.</Step>
            <Step n={5}>Si el partner que preguntó tiene email configurado, recibe la respuesta automáticamente por email.</Step>

            <SubTitle>Buenas prácticas</SubTitle>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {[
                'Responder todas las preguntas antes de la fecha límite de ofertas.',
                'Las respuestas son públicas: redactarlas de forma clara y aplicable a todos los licitadores.',
                'Si una pregunta implica un cambio de scope o documentación, actualizar también los archivos del proyecto.',
                'El indicador de Q&A pendientes en el Control Room facilita hacer seguimiento sin entrar en cada proyecto.',
              ].map(t => <li key={t} style={{ fontSize: 12, color: C.mid, lineHeight: 1.8 }}>{t}</li>)}
            </ul>
          </div>

          {/* ══════════════════════════════════════════════════
              9 · BID COMPARISON
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="9" title="Comparativa de ofertas (Bid Comparison)" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              Una vez el primer partner envía su oferta, el sistema activa automáticamente la vista de comparativa dentro de la pestaña Licitación. Permite comparar todas las propuestas recibidas en una misma tabla.
            </p>

            <SubTitle>Qué muestra la comparativa</SubTitle>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ background: C.dark, padding: '10px 16px' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Estructura de la tabla de comparación</p>
              </div>
              {[
                ['Columnas', 'Un partner por columna. Las columnas muestran el nombre del partner.'],
                ['Filas de UE', 'Subtítulo de agrupación por Unidad de Ejecución, con el subtotal de cada partner.'],
                ['Filas de partida', 'Precio unitario (gris, pequeño) + importe total (negrita). Si falta precio = "—".'],
                ['Fila total', 'Suma total de la oferta. La oferta más baja se resalta en verde con etiqueta "OFERTA MÁS BAJA".'],
                ['Fila notas', 'Notas generales incluidas por cada partner en su oferta.'],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, padding: '12px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.dark }}>{k}</span>
                  <span style={{ color: C.mid }}>{v}</span>
                </div>
              ))}
            </div>

            <SubTitle>Exportar a CSV</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Clic en <strong>Exportar CSV</strong> (botón sobre la tabla) para descargar la comparativa en formato compatible con Excel. Incluye todas las partidas, precios unitarios, importes y totales. El archivo usa codificación UTF-8 con BOM para garantizar compatibilidad con Microsoft Excel.
            </p>

            <SubTitle>Adjudicar una oferta</SubTitle>
            <Step n={1}>Revisar la comparativa y decidir el partner ganador.</Step>
            <Step n={2}>Clic en el botón <strong>Adjudicar</strong> en la columna del partner elegido (visible en la fila inferior de la tabla).</Step>
            <Step n={3}>Confirmar la acción. El estado de la oferta del partner ganador pasa a "Adjudicado".</Step>
            <Step n={4}>El proyecto pasa automáticamente a estado <Badge label="Adjudicado" bg="#ECFDF5" color="#059669" />.</Step>

            <Note>La adjudicación en la plataforma es un registro interno. La comunicación al partner ganador (y a los no seleccionados) se realiza fuera del sistema de forma manual por el equipo FP.</Note>
          </div>

          {/* ══════════════════════════════════════════════════
              10 · ADJUDICACIÓN Y CONTRATACIÓN
          ══════════════════════════════════════════════════ */}
          <div style={{ padding: '0 64px 56px' }}>
            <SectionTitle num="10" title="Adjudicación y contratación" />

            <SubTitle>Marcar como Contratado</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Una vez firmado el contrato offline con el partner adjudicado, registrar en la plataforma:
            </p>
            <Step n={1}>En la pestaña Licitación del proyecto, clic en <strong>Marcar como contratado</strong> (botón verde oscuro, visible cuando el proyecto está Adjudicado).</Step>
            <Step n={2}>Confirmar. El proyecto pasa a estado <Badge label="Contratado" bg="#D1FAE5" color="#065F46" />.</Step>
            <Step n={3}>El proyecto desaparece de las métricas activas del Control Room (adjudicados → contratados).</Step>

            <SubTitle>Archivar el proyecto</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Una vez la obra ha concluido y el proyecto ya no necesita estar visible en las vistas activas:
            </p>
            <Step n={1}>En la pestaña Licitación (estado Contratado), clic en <strong>Archivar proyecto</strong>.</Step>
            <Step n={2}>Confirmar. El proyecto pasa a estado <Badge label="Archivado" bg="#F9FAFB" color="#9CA3AF" />.</Step>
            <Step n={3}>El proyecto ya no aparece en el Control Room. Sigue siendo accesible desde el listado de Proyectos.</Step>

            <Note>Archivar un proyecto es reversible manualmente desde la base de datos, pero no desde la interfaz. Archivar sólo cuando el proyecto esté verdaderamente cerrado.</Note>
          </div>

          {/* ══════════════════════════════════════════════════
              11 · CONTROL ROOM
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="11" title="Control Room" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 20px' }}>
              El Control Room es la vista de gestión centralizada de todas las licitaciones activas. Accesible desde el Dashboard de FP Execution, proporciona una visión instantánea del estado del pipeline.
            </p>

            <SubTitle>Métricas globales</SubTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'En licitación',     desc: 'Licitaciones con status = Lanzada en este momento.' },
                { label: 'Ofertas recibidas', desc: 'Total de bids recibidos en todas las licitaciones activas.' },
                { label: 'Q&A pendiente',     desc: 'Preguntas sin responder en cualquier licitación activa. En rojo si hay alguna.' },
                { label: 'Adjudicados',       desc: 'Proyectos en estado Adjudicado o Contratado.' },
              ].map(r => (
                <div key={r.label} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.dark }}>{r.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{r.desc}</p>
                </div>
              ))}
            </div>

            <SubTitle>Tabla de licitaciones</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              La tabla muestra todas las licitaciones no archivadas, ordenadas por urgencia:
            </p>
            <ol style={{ paddingLeft: 20, margin: '0 0 20px' }}>
              <li style={{ fontSize: 12, color: C.mid, lineHeight: 1.8 }}><strong>Lanzadas</strong>, ordenadas por fecha límite más próxima primero.</li>
              <li style={{ fontSize: 12, color: C.mid, lineHeight: 1.8 }}><strong>Borradores</strong> (licitaciones creadas pero no lanzadas).</li>
              <li style={{ fontSize: 12, color: C.mid, lineHeight: 1.8 }}><strong>Cerradas / canceladas</strong> (historial reciente).</li>
            </ol>

            <SubTitle>Indicadores de plazo</SubTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Vencido',    bg: '#FEF2F2', c: '#DC2626', desc: 'La fecha límite ya pasó y la licitación sigue abierta.' },
                { label: 'Hoy',       bg: '#FEF2F2', c: '#DC2626', desc: 'Vence hoy — requiere atención inmediata.' },
                { label: 'Mañana',    bg: '#FEF3C7', c: '#D97706', desc: 'Vence mañana.' },
                { label: '≤3 días',   bg: '#FEF3C7', c: '#D97706', desc: 'Menos de 3 días. Proximidad inmediata.' },
                { label: 'Normal',    bg: '#F3F4F6', c: '#6B7280', desc: 'Más de 3 días hasta la fecha límite.' },
                { label: 'Cerrada',   bg: '#ECFDF5', c: '#059669', desc: 'Licitación cerrada. Sin urgencia.' },
                { label: 'Borrador',  bg: '#F3F4F6', c: '#6B7280', desc: 'Sin fecha límite activa (no lanzada).' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Badge label={r.label} bg={r.bg} color={r.c} />
                  <span style={{ fontSize: 12, color: C.mid }}>{r.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              12 · CRONOLOGÍA COMPLETA
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="12" title="Cronología completa de un proyecto" />
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 28px' }}>
              Esta sección describe el recorrido completo de un proyecto en FP Execution, de inicio a cierre, con todas las acciones en orden cronológico.
            </p>

            {[
              {
                phase: 'FASE 1', title: 'Preparación del proyecto', color: '#6B7280', bg: '#F3F4F6',
                steps: [
                  'Crear el proyecto: nombre, descripción, dirección, ciudad.',
                  'Pestaña Scope: seleccionar las Unidades de Ejecución que forman parte del proyecto. Solo selección — sin cantidades todavía.',
                  'Guardar scope. El proyecto pasa a estado "Scope listo".',
                  'Pestaña Documentos: el sistema genera una sub-pestaña por cada capítulo con UEs seleccionadas.',
                  'En cada sub-pestaña de capítulo: subir planimetría (PDF + CAD) específica de ese capítulo.',
                  'En cada card de UE: introducir las cantidades de cada partida (precargadas desde plantilla).',
                  'En cada card de UE: seleccionar los execution partners habilitados para esa UE (filtrado por capacidades).',
                ],
              },
              {
                phase: 'FASE 2', title: 'Revisión y envío de invitaciones', color: '#D97706', bg: '#FEF3C7',
                steps: [
                  'El sistema agrupa automáticamente los paquetes de envío por execution partner.',
                  'Revisar el dashboard de paquetes: cards por capítulo y por partner con datos de contacto y UEs asignadas.',
                  'Confirmar que todos los paquetes son correctos (partners, UEs, datos de contacto).',
                  'Clic en "Enviar invitaciones". El sistema envía un email personalizado a cada partner con su enlace único.',
                  'El proyecto pasa a estado "En licitación". Las invitaciones quedan en estado "Enviada".',
                ],
              },
              {
                phase: 'FASE 3', title: 'Período de licitación', color: '#378ADD', bg: '#EBF5FF',
                steps: [
                  'Los partners acceden al portal, revisan el scope y descargan documentos.',
                  'Los partners formulan preguntas en el Q&A del portal.',
                  'El equipo FP responde las preguntas en la plataforma interna (pestaña Q&A).',
                  'Hacer seguimiento del estado de las invitaciones: Enviada → Vista → Oferta recibida (sin estado "Pendiente").',
                  'El sistema envía recordatorios automáticos 3 días y 1 día antes del plazo.',
                  'Los partners envían sus ofertas antes de la fecha límite.',
                ],
              },
              {
                phase: 'FASE 4', title: 'Evaluación y adjudicación', color: '#059669', bg: '#ECFDF5',
                steps: [
                  'Una vez recibidas las ofertas, cerrar la licitación.',
                  'Revisar la comparativa de ofertas (Bid Comparison): precios por partida y totales.',
                  'Exportar CSV si se necesita análisis externo adicional.',
                  'Decidir el partner ganador.',
                  'Clic en "Adjudicar" en la columna del partner elegido.',
                  'El proyecto pasa a estado "Adjudicado".',
                ],
              },
              {
                phase: 'FASE 5', title: 'Contratación y cierre', color: '#065F46', bg: '#D1FAE5',
                steps: [
                  'Comunicar la adjudicación al partner ganador (fuera del sistema).',
                  'Firmar el contrato offline.',
                  'Marcar el proyecto como "Contratado" en la plataforma.',
                  'Cuando el proyecto esté completado, archivar para retirar de las vistas activas.',
                ],
              },
            ].map(phase => (
              <div key={phase.phase} style={{ marginBottom: 24, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: phase.bg, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Badge label={phase.phase} bg={phase.color} color="#fff" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{phase.title}</span>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {phase.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.faint, marginTop: 2 }}>
                        {i + 1}
                      </span>
                      <p style={{ margin: 0, fontSize: 12, color: C.mid, lineHeight: 1.6 }}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════
              13 · EMAILS AUTOMÁTICOS
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="13" title="Emails automáticos del sistema" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 24px' }}>
              FP Execution envía los siguientes emails de forma automática. No requieren ninguna acción manual más allá de configurar correctamente los emails en los perfiles de partner.
            </p>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
              <div style={{ background: C.dark, padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16 }}>
                {['Evento', 'Destinatario', 'Contenido del email'].map(h => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{h}</span>
                ))}
              </div>
              {[
                {
                  event: 'Envío de invitación',
                  to: 'Partner (email notificaciones)',
                  content: 'Nombre del proyecto, fecha límite, enlace personal al portal externo.',
                },
                {
                  event: 'Respuesta Q&A',
                  to: 'Partner que preguntó (si tiene email)',
                  content: 'La pregunta original y la respuesta del equipo FP.',
                },
                {
                  event: 'Recordatorio 3 días antes del plazo',
                  to: 'Partners sin oferta presentada',
                  content: 'Aviso de que la licitación cierra en 3 días. Enlace al portal.',
                },
                {
                  event: 'Recordatorio 1 día antes del plazo',
                  to: 'Partners sin oferta presentada',
                  content: 'Aviso urgente de que la licitación cierra mañana. Enlace al portal.',
                },
                {
                  event: 'Nueva pregunta Q&A',
                  to: 'contacto@formaprima.es',
                  content: 'Notificación interna: partner, proyecto y texto de la pregunta.',
                },
              ].map((r, i, arr) => (
                <div key={r.event} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, padding: '14px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'start', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: C.dark }}>{r.event}</span>
                  <span style={{ color: C.accent, fontWeight: 500 }}>{r.to}</span>
                  <span style={{ color: C.mid, lineHeight: 1.5 }}>{r.content}</span>
                </div>
              ))}
            </div>

            <SubTitle>Recordatorios automáticos — Cron</SubTitle>
            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 12px' }}>
              Los recordatorios de plazo se ejecutan automáticamente <strong>todos los días a las 09:00h</strong> mediante un proceso programado (cron). El sistema detecta las licitaciones abiertas con plazo ≤ 3 días y envía un email a cada partner invitado que todavía no ha presentado oferta.
            </p>
            <Note>No se requiere ninguna acción manual para que los recordatorios funcionen. Si un partner ya ha enviado su oferta, no recibirá el recordatorio.</Note>
          </div>

          {/* ══════════════════════════════════════════════════
              14 · ESTADOS Y TRANSICIONES
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="14" title="Estados y transiciones" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 28px' }}>
              Resumen de los estados posibles de cada entidad principal del sistema y qué acción provoca cada transición.
            </p>

            <SubTitle>Proyecto</SubTitle>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              {[
                { from: '—',            to: 'Borrador',      action: 'Crear proyecto' },
                { from: 'Borrador',     to: 'Scope listo',   action: 'Guardar scope con UEs y cantidades' },
                { from: 'Scope listo',  to: 'En licitación', action: 'Lanzar la licitación' },
                { from: 'En licitación',to: 'Adjudicado',    action: 'Adjudicar una oferta' },
                { from: 'Adjudicado',   to: 'Contratado',    action: 'Marcar como contratado (manual)' },
                { from: 'Contratado',   to: 'Archivado',     action: 'Archivar proyecto (manual)' },
              ].map((r, i, arr) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 24px 130px 1fr', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.muted }}>{r.from}</span>
                  <span style={{ color: C.faint, textAlign: 'center' }}>→</span>
                  <span style={{ fontWeight: 600, color: C.dark }}>{r.to}</span>
                  <span style={{ color: C.mid }}>{r.action}</span>
                </div>
              ))}
            </div>

            <SubTitle>Licitación</SubTitle>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              {[
                { from: '—',        to: 'Borrador',   action: 'Crear licitación' },
                { from: 'Borrador', to: 'Lanzada',    action: 'Lanzar licitación' },
                { from: 'Lanzada',  to: 'Cerrada',    action: 'Cerrar licitación manualmente' },
                { from: 'Lanzada',  to: 'Cancelada',  action: 'Cancelar licitación' },
              ].map((r, i, arr) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 24px 100px 1fr', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.muted }}>{r.from}</span>
                  <span style={{ color: C.faint, textAlign: 'center' }}>→</span>
                  <span style={{ fontWeight: 600, color: C.dark }}>{r.to}</span>
                  <span style={{ color: C.mid }}>{r.action}</span>
                </div>
              ))}
            </div>

            <SubTitle>Invitación</SubTitle>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              {[
                { from: '—',          to: 'Pendiente',       action: 'Crear invitación' },
                { from: 'Pendiente',  to: 'Enviada',         action: 'Enviar invitación por email' },
                { from: 'Enviada',    to: 'Vista',           action: 'Partner abre el portal por primera vez' },
                { from: 'Vista',      to: 'Oferta recibida', action: 'Partner envía su oferta' },
                { from: 'Enviada',    to: 'Oferta recibida', action: 'Partner envía oferta sin haberla "vista" técnicamente' },
                { from: 'Cualquiera', to: 'Revocada',        action: 'Revocar manualmente desde la plataforma' },
                { from: 'Cualquiera', to: 'Expirada',        action: 'Han pasado 14 días desde la creación del token' },
              ].map((r, i, arr) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 24px 140px 1fr', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.muted }}>{r.from}</span>
                  <span style={{ color: C.faint, textAlign: 'center' }}>→</span>
                  <span style={{ fontWeight: 600, color: C.dark }}>{r.to}</span>
                  <span style={{ color: C.mid }}>{r.action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              15 · GLOSARIO
          ══════════════════════════════════════════════════ */}
          <PageBreak />
          <div style={{ padding: '56px 64px' }}>
            <SectionTitle num="15" title="Glosario" />

            <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.75, margin: '0 0 24px' }}>
              Definición de los términos específicos utilizados en FP Execution.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['Bid / Oferta',          'Propuesta económica enviada por un partner. Incluye el precio unitario de cada partida del scope asignado y opcionalmente notas generales.'],
                ['Bid Comparison',        'Vista de comparativa de ofertas: tabla cruzada que enfrenta todas las propuestas recibidas para una licitación, partida a partida.'],
                ['Capítulo',              'Nivel superior del template. Agrupa Unidades de Ejecución relacionadas temáticamente. Ej: "Estructura", "Instalaciones".'],
                ['Control Room',          'Vista de gestión centralizada de todas las licitaciones activas en FP Execution, con métricas y alertas de urgencia.'],
                ['Cron / Recordatorio',   'Proceso automático que se ejecuta cada día a las 09:00h para enviar recordatorios de plazo a partners sin oferta.'],
                ['Fecha límite',          'Fecha hasta la que los partners pueden presentar su oferta. Después, el portal pasa a modo solo lectura aunque no se cierre manualmente.'],
                ['Importe',               'Precio unitario × cantidad de la partida. Se calcula automáticamente en la comparativa.'],
                ['Invitación',            'Registro en el sistema que vincula un tender con un partner para un subconjunto de UEs. Genera un token único de acceso.'],
                ['Partida',               'Elemento medible dentro de una UE. Tiene nombre y unidad de medida (m², ml, ud, kg, h…). Los partners ofertan precio por unidad.'],
                ['Partner',               'Empresa subcontratista o proveedor externo registrada en el sistema. Accede al portal con un enlace personal.'],
                ['Portal externo',        'Interfaz web para partners. Acceso sin login mediante token. Muestra scope, documentación, Q&A y formulario de oferta.'],
                ['Q&A',                   'Sistema de preguntas y respuestas durante la licitación. Las preguntas son formuladas por partners y respondidas por el equipo FP. Visibles para todos.'],
                ['Readiness score',       'Indicador porcentual (0–100%) que mide si un proyecto tiene suficiente información para lanzar su licitación (scope + documentación + partners).'],
                ['Scope',                 'Conjunto de Unidades de Ejecución y cantidades de partidas que definen el alcance técnico de un proyecto a licitar.'],
                ['Template',              'Estructura maestra global que define todos los capítulos, UEs y partidas disponibles para cualquier proyecto.'],
                ['Tender / Licitación',   'Proceso de solicitud de ofertas para un proyecto. Una licitación tiene fecha límite, invitados y un estado (borrador, lanzada, cerrada).'],
                ['Token',                 'Identificador único y cifrado incluido en el enlace de invitación. Válido 14 días. Permite acceder al portal sin login.'],
                ['UE (Unidad de Ejecución)', 'Unidad mínima de trabajo que se puede licitar. Pertenece a un capítulo del template. Los partners tienen capacidades por UE.'],
              ].map(([term, def], i, arr) => (
                <div key={term} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, padding: '14px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{term}</span>
                  <span style={{ fontSize: 12, color: C.mid, lineHeight: 1.7 }}>{def}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ background: C.dark, padding: '28px 64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>FORMA PRIMA</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>FP Execution — Manual de Usuario v1.0</p>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>contacto@formaprima.es</p>
          </div>

        </div>
      </div>
    </>
  )
}
