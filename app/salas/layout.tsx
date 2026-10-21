import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { esHostSalas, miembroActual } from '@/lib/salas/panel'
import Login from '@/components/salas/Login'
import Salir from '@/components/salas/Salir'
import { S } from '@/components/salas/theme'

// Salas · panel de seguimiento de dossiers (salas.formaprima.es).
// Burbuja aparte de internal: su propia sesión (código personal), sus propias
// tablas (sala_*) y solo existe en el subdominio salas.* (next.config rewrites).
// Las rutas internas son /salas/…; en el subdominio se ven sin el prefijo.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: { absolute: 'Salas — Forma Prima' },
  robots: { index: false, follow: false, nocache: true },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function SalasLayout({ children }: { children: React.ReactNode }) {
  if (!esHostSalas()) notFound()
  const m = await miembroActual()
  if (!m) return <Login />

  return (
    <div style={{ minHeight: '100dvh', background: S.bg, color: S.ink, fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 400 }}>
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#F6F5F1!important}' }} />
      <header style={{ borderBottom: `1px solid ${S.line}`, background: S.panel, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 clamp(16px, 4vw, 40px)', height: 56, display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: S.ink }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="salas-oculto-movil" src="/propuestas/logo-fp-negro.png" alt="Forma Prima" style={{ height: 13, width: 'auto' }} />
            <span className="salas-oculto-movil" style={{ width: 1, height: 16, background: S.line }} />
            <span style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, color: S.accent }}>Salas</span>
          </Link>
          <nav style={{ display: 'flex', gap: 18, fontSize: 13 }}>
            <Link href="/" style={{ color: S.ink, textDecoration: 'none' }}>Dossiers</Link>
            <Link href="/agenda" style={{ color: S.ink, textDecoration: 'none' }}>Agenda</Link>
            {m.rol === 'propietario' && <Link href="/equipo" style={{ color: S.ink, textDecoration: 'none' }}>Equipo</Link>}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: S.soft }}>
            <span className="salas-oculto-movil">{m.nombre}{m.empresa ? ` · ${m.empresa}` : ''}</span>
            <Salir />
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px) 80px' }}>{children}</main>
    </div>
  )
}
