'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  isSubItem?: boolean
  isSection?: boolean
  isGroup?: boolean
  pinBottom?: boolean
  small?: boolean
}

interface NavSectionNode {
  header: NavItem
  children: NavItem[]
}

type NavTreeEntry =
  | { type: 'standalone'; item: NavItem }
  | { type: 'parent';     header: NavItem; children: NavItem[] }
  | { type: 'group';      header: NavItem; sections: NavSectionNode[] }

interface TeamSidebarProps {
  nombre: string
  rol: string
  navItems: NavItem[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  fp_team: 'FP Team',
  fp_manager: 'FP Manager',
  fp_partner: 'FP Partner',
}

const ROLE_COLORS: Record<string, string> = {
  fp_team: '#1D9E75',
  fp_manager: '#378ADD',
  fp_partner: '#D85A30',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function buildTree(items: NavItem[]): NavTreeEntry[] {
  const result: NavTreeEntry[] = []

  let currentGroup:   { header: NavItem; sections: NavSectionNode[] } | null = null
  let currentSection: { header: NavItem; children: NavItem[] }        | null = null
  let currentParent:  { header: NavItem; children: NavItem[] }        | null = null

  const flushSection = () => {
    if (!currentSection) return
    if (currentGroup) {
      currentGroup.sections.push({ header: currentSection.header, children: currentSection.children })
    } else {
      result.push({ type: 'parent', header: currentSection.header, children: currentSection.children })
    }
    currentSection = null
  }

  const flushGroup = () => {
    if (!currentGroup) return
    result.push({ type: 'group', header: currentGroup.header, sections: currentGroup.sections })
    currentGroup = null
  }

  const flushParent = () => {
    if (!currentParent) return
    result.push(
      currentParent.children.length > 0
        ? { type: 'parent', header: currentParent.header, children: currentParent.children }
        : { type: 'standalone', item: currentParent.header }
    )
    currentParent = null
  }

  for (const item of items) {
    if (item.isGroup) {
      flushSection(); flushGroup(); flushParent()
      currentGroup = { header: item, sections: [] }
    } else if (item.isSection) {
      flushSection(); flushParent()
      currentSection = { header: item, children: [] }
    } else if (item.isSubItem) {
      if (currentSection) currentSection.children.push(item)
      else if (currentParent) currentParent.children.push(item)
    } else {
      flushSection(); flushGroup(); flushParent()
      currentParent = { header: item, children: [] }
    }
  }

  flushSection(); flushGroup(); flushParent()
  return result
}

function getInitialExpanded(items: NavItem[], pathname: string): Record<string, boolean> {
  const state: Record<string, boolean> = {}
  for (const entry of buildTree(items)) {
    if (entry.type === 'parent') {
      if (entry.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))) {
        state[entry.header.label] = true
      }
    } else if (entry.type === 'group') {
      if (pathname === entry.header.href) {
        state[entry.header.label] = true
      }
      for (const section of entry.sections) {
        const hasActive = section.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
        if (hasActive) {
          state[section.header.label] = true
          state[entry.header.label]   = true
        }
      }
    }
  }
  return state
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamSidebar({ nombre, rol, navItems }: TeamSidebarProps) {
  const pathname = usePathname()
  const [localAvatar, setLocalAvatar] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    getInitialExpanded(navItems, pathname)
  )

  const roleLabel    = ROLE_LABELS[rol] ?? rol
  const roleColor    = ROLE_COLORS[rol] ?? '#888888'
  const initials     = getInitials(nombre)
  const pinnedItems  = navItems.filter(i => i.pinBottom)
  const mainNavItems = navItems.filter(i => !i.pinBottom)
  const tree         = useMemo(() => buildTree(mainNavItems), [mainNavItems])

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // On navigation: reset expanded state — only the active group/section stays open
  useEffect(() => {
    setExpanded(getInitialExpanded(navItems, pathname))
  }, [pathname, navItems])

  // Re-fetch avatar on navigation
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
        .then(({ data }) => { if (data?.avatar_url) setLocalAvatar(data.avatar_url) })
    })
  }, [pathname])

  const toggle = (label: string) =>
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // ── Sub-item link ──────────────────────────────────────────────────────────
  const SubLink = ({ item, indent, textSize = 'text-[10px]' }: { item: NavItem; indent: string; textSize?: string }) => {
    const active = pathname === item.href
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-2.5 pr-3 py-2 rounded tracking-widest uppercase font-light transition-all duration-200 ${indent} ${textSize} ${
          active ? 'text-white/70 bg-white/5' : 'text-white/35 hover:text-white/65 hover:bg-white/5'
        }`}
      >
        <span
          className="w-[2px] h-3 rounded-full shrink-0 transition-all duration-200"
          style={{ background: active ? roleColor : 'transparent' }}
        />
        {item.label}
      </Link>
    )
  }

  // ── Chevron ────────────────────────────────────────────────────────────────
  const Chevron = ({ open, dim = false }: { open: boolean; dim?: boolean }) => (
    <span
      className="text-[9px] inline-block transition-transform duration-200 shrink-0"
      style={{
        color: dim ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
      }}
    >
      ▾
    </span>
  )

  return (
    <>
      {/* ── Barra superior móvil ─────────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4"
        style={{ background: '#1A1A1A' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col gap-[5px] p-1 text-white/60 hover:text-white transition-colors"
          aria-label="Abrir menú"
        >
          <span className="block w-5 h-px bg-current" />
          <span className="block w-5 h-px bg-current" />
          <span className="block w-5 h-px bg-current" />
        </button>

        <Link href="/" className="hover:opacity-60 transition-opacity">
          <Image src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" height={22} width={110} className="h-[22px] w-auto" />
        </Link>

        <Link
          href="/team/area-interna"
          className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/20 hover:ring-white/50 transition-all shrink-0"
          style={{ background: roleColor }}
        >
          {localAvatar
            ? <img src={localAvatar} alt={nombre} className="w-full h-full object-cover" />
            : <span className="text-white text-[10px] font-medium flex items-center justify-center w-full h-full">{initials}</span>
          }
        </Link>
      </div>

      {/* ── Backdrop móvil ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`w-64 shrink-0 flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#1A1A1A' }}
      >
        {/* Logo + avatar */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10 flex items-center justify-between gap-3">
          <Link href="/" className="hover:opacity-60 transition-opacity shrink-0">
            <Image src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" height={28} width={140} className="block h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/team/area-interna"
              title="Mi perfil"
              className="relative shrink-0 w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/20 hover:ring-white/50 transition-all"
              style={{ background: roleColor }}
            >
              {localAvatar ? (
                <img src={localAvatar} alt={nombre} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-[10px] font-medium flex items-center justify-center w-full h-full">
                  {initials}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-white/40 hover:text-white transition-colors text-lg leading-none"
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <div className="space-y-0.5">
            {tree.map((entry) => {

              // ── 1. Standalone item (no children) ─────────────────────────
              if (entry.type === 'standalone') {
                const active =
                  pathname === entry.item.href ||
                  (entry.item.href !== '/team/dashboard' &&
                    pathname.startsWith(entry.item.href + '/'))
                return (
                  <Link
                    key={entry.item.href}
                    href={entry.item.href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded text-[12px] tracking-widest uppercase font-light transition-all duration-200 ${
                      active ? 'text-white bg-white/10' : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-[3px] h-4 rounded-full shrink-0 transition-all duration-200"
                      style={{ background: active ? roleColor : 'transparent' }}
                    />
                    {entry.item.label}
                  </Link>
                )
              }

              // ── 2. Regular item with children (e.g. Proyectos) ───────────
              if (entry.type === 'parent') {
                const isOpen = expanded[entry.header.label] ?? false
                const headerActive = pathname === entry.header.href
                return (
                  <div key={entry.header.href || entry.header.label}>
                    <div className={`flex items-center rounded transition-all duration-200 ${headerActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                      <Link
                        href={entry.header.href}
                        className={`flex items-center gap-2.5 flex-1 px-3 py-2.5 text-[12px] tracking-widest uppercase font-light transition-colors duration-200 ${
                          headerActive ? 'text-white' : 'text-white/45 hover:text-white/80'
                        }`}
                      >
                        <span
                          className="w-[3px] h-4 rounded-full shrink-0 transition-all duration-200"
                          style={{ background: headerActive ? roleColor : 'transparent' }}
                        />
                        {entry.header.label}
                      </Link>
                      <button
                        onClick={() => toggle(entry.header.label)}
                        className="px-3 py-2.5 transition-colors"
                        aria-label={isOpen ? 'Colapsar' : 'Expandir'}
                      >
                        <Chevron open={isOpen} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        {entry.children.map(child => (
                          <SubLink key={child.href} item={child} indent="pl-9" textSize="text-[11px]" />
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              // ── 3. Group with sections (e.g. Finanzas) ───────────────────
              if (entry.type === 'group') {
                const groupOpen = expanded[entry.header.label] ?? false
                const groupActive = entry.sections.some(s =>
                  s.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
                ) || pathname === entry.header.href
                const hasLink = !!entry.header.href
                return (
                  <div key={`group-${entry.header.label}`}>
                    {/* Group header — split link+toggle if href provided */}
                    <div className={`flex items-center rounded transition-all duration-200 ${groupActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                      {hasLink ? (
                        <Link
                          href={entry.header.href}
                          className={`flex items-center gap-2.5 flex-1 px-3 py-2.5 text-[12px] tracking-widest uppercase font-light transition-colors duration-200 ${
                            groupActive ? 'text-white' : 'text-white/45 hover:text-white/80'
                          }`}
                        >
                          <span
                            className="w-[3px] h-4 rounded-full shrink-0 transition-all duration-200"
                            style={{ background: groupActive ? roleColor : 'transparent' }}
                          />
                          {entry.header.label}
                        </Link>
                      ) : (
                        <span
                          className={`flex items-center gap-2.5 flex-1 px-3 py-2.5 text-[12px] tracking-widest uppercase font-light ${
                            groupActive ? 'text-white' : 'text-white/45'
                          }`}
                        >
                          <span
                            className="w-[3px] h-4 rounded-full shrink-0"
                            style={{ background: groupActive ? roleColor : 'transparent' }}
                          />
                          {entry.header.label}
                        </span>
                      )}
                      <button
                        onClick={() => toggle(entry.header.label)}
                        className="px-3 py-2.5 transition-colors"
                        aria-label={groupOpen ? 'Colapsar' : 'Expandir'}
                      >
                        <Chevron open={groupOpen} />
                      </button>
                    </div>

                    {/* Sections inside group */}
                    {groupOpen && (
                      <div className="mt-0.5 space-y-0">
                        {entry.sections.map(section => {
                          const sectionOpen = expanded[section.header.label] ?? false
                          return (
                            <div key={section.header.label}>
                              {/* Section header — same visual level as Proyectos sub-items */}
                              <button
                                onClick={() => toggle(section.header.label)}
                                className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-2 rounded text-[11px] tracking-widest uppercase font-light transition-all duration-200 ${
                                  sectionOpen
                                    ? 'text-white/65 bg-white/5'
                                    : 'text-white/35 hover:text-white/65 hover:bg-white/5'
                                }`}
                              >
                                <span
                                  className="w-[2px] h-3 rounded-full shrink-0 transition-all duration-200"
                                  style={{ background: sectionOpen ? roleColor : 'transparent' }}
                                />
                                <span className="flex-1 text-left">{section.header.label}</span>
                                <Chevron open={sectionOpen} dim />
                              </button>

                              {/* Section children */}
                              {sectionOpen && (
                                <div className="mt-0.5 mb-1 space-y-0.5">
                                  {section.children.map(child => (
                                    <SubLink key={child.href} item={child} indent="pl-12" />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
            })}
          </div>
        </nav>

        {/* Pinned bottom items (e.g. Área Interna FP) */}
        {pinnedItems.length > 0 && (
          <div className="px-3 pb-2 border-t border-white/10 pt-3 space-y-0.5">
            {pinnedItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              if (item.small) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] tracking-widest uppercase font-light transition-all duration-200 ${
                      active ? 'text-white/70 bg-white/5' : 'text-white/25 hover:text-white/55 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-[2px] h-2.5 rounded-full shrink-0 transition-all duration-200"
                      style={{ background: active ? roleColor : 'transparent' }}
                    />
                    {item.label}
                  </Link>
                )
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded text-[12px] tracking-widest uppercase font-light transition-all duration-200 ${
                    active ? 'text-white bg-white/10' : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <span
                    className="w-[3px] h-4 rounded-full shrink-0 transition-all duration-200"
                    style={{ background: active ? roleColor : 'transparent' }}
                  />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}

        {/* User + logout */}
        <div className="px-4 py-5 border-t border-white/10">
          <Link href="/team/area-interna" className="flex items-center gap-3 mb-4 group">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[11px] font-medium shrink-0 ring-1 ring-white/10 group-hover:ring-white/30 transition-all"
              style={{ background: roleColor }}
            >
              {localAvatar ? (
                <img src={localAvatar} alt={nombre} className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <div className="min-w-0">
              <p className="text-white/80 text-sm font-light truncate leading-snug group-hover:text-white transition-colors">{nombre}</p>
              <p className="text-[9px] uppercase tracking-widest font-light leading-snug mt-0.5" style={{ color: roleColor }}>
                {roleLabel}
              </p>
            </div>
          </Link>
          <div className="flex items-center justify-between">
            <button
              onClick={handleLogout}
              className="text-[8px] tracking-widest uppercase font-light text-white/35 hover:text-white/60 transition-colors whitespace-nowrap"
            >
              Cerrar sesión
            </button>
            <Link
              href="/"
              className="text-[8px] tracking-widest uppercase font-light text-white/35 hover:text-white/60 transition-colors whitespace-nowrap"
            >
              ← Forma Prima
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
