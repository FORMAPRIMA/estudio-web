'use client'

import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar, updateProfile, updatePassword } from '@/app/actions/profile'

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

interface Props {
  nombre: string
  email: string
  rol: string
}

export default function PerfilPage({ nombre: initialNombre, email, rol }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const roleColor = ROLE_COLORS[rol] ?? '#888888'
  const initials = initialNombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || email[0]?.toUpperCase()

  // Avatar — loaded client-side
  const [savedAvatar, setSavedAvatar] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
        .then(({ data }) => { if (data?.avatar_url) setSavedAvatar(data.avatar_url) })
    })
  }, [])

  const displayAvatar = previewUrl ?? savedAvatar

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setAvatarMsg(null)
  }

  const handleSaveAvatar = async () => {
    if (!pendingFile) return
    setAvatarSaving(true)
    setAvatarMsg(null)
    const bytes = new Uint8Array(await pendingFile.arrayBuffer())
    const result = await uploadAvatar(bytes, pendingFile.name, pendingFile.type)
    if ('error' in result) {
      setAvatarMsg({ ok: false, text: result.error })
    } else {
      setSavedAvatar(result.url)
      setPendingFile(null)
      setPreviewUrl(null)
      setAvatarMsg({ ok: true, text: 'Foto guardada correctamente.' })
    }
    setAvatarSaving(false)
  }

  // Nombre
  const [nombre, setNombre] = useState(initialNombre)
  const [nombreSaving, setNombreSaving] = useState(false)
  const [nombreMsg, setNombreMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleNombre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setNombreSaving(true)
    setNombreMsg(null)
    const result = await updateProfile(nombre)
    setNombreMsg('error' in result
      ? { ok: false, text: result.error }
      : { ok: true, text: 'Nombre actualizado.' }
    )
    setNombreSaving(false)
  }

  // Password
  const [pw, setPw] = useState({ new: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (pw.new.length < 6) { setPwMsg({ ok: false, text: 'Mínimo 6 caracteres.' }); return }
    if (pw.new !== pw.confirm) { setPwMsg({ ok: false, text: 'Las contraseñas no coinciden.' }); return }
    setPwSaving(true)
    const result = await updatePassword(pw.new)
    setPwMsg('error' in result
      ? { ok: false, text: result.error }
      : { ok: true, text: 'Contraseña actualizada.' }
    )
    if (!('error' in result)) setPw({ new: '', confirm: '' })
    setPwSaving(false)
  }

  return (
    <div className="p-8 lg:p-10 max-w-xl">
      <div className="mb-10">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-2">Área interna</p>
        <h1 className="text-3xl font-light text-ink tracking-tight">Mi perfil</h1>
      </div>

      {/* ── Avatar ─────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-4">Foto de perfil</p>
        <div className="flex items-center gap-6 mb-4">
          <div
            className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-ink/10 shrink-0 cursor-pointer"
            style={{ background: roleColor }}
            onClick={() => fileInputRef.current?.click()}
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt={nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xl font-light flex items-center justify-center w-full h-full">
                {initials}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-light text-ink mb-1">{nombre || email}</p>
            <p className="text-[10px] tracking-widest uppercase font-light mb-3" style={{ color: roleColor }}>
              {ROLE_LABELS[rol] ?? rol}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
            >
              {displayAvatar ? 'Cambiar foto' : 'Subir foto'}
            </button>
          </div>
        </div>

        {pendingFile && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSaveAvatar}
              disabled={avatarSaving}
              className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-50"
            >
              {avatarSaving ? 'Guardando…' : 'Guardar foto'}
            </button>
            <button
              type="button"
              onClick={() => { setPendingFile(null); setPreviewUrl(null) }}
              className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {avatarMsg && (
          <p className={`mt-2 text-[11px] font-light ${avatarMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
            {avatarMsg.text}
          </p>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </section>

      <div className="border-t border-ink/8 mb-10" />

      {/* ── Nombre ─────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-4">Datos</p>
        <form onSubmit={handleNombre} className="space-y-3">
          <div>
            <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
              Nombre completo
            </label>
            <input
              value={nombre}
              onChange={e => { setNombre(e.target.value); setNombreMsg(null) }}
              placeholder="Tu nombre"
              className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
              Correo electrónico
            </label>
            <input
              value={email}
              disabled
              className="w-full border border-ink/10 px-3 py-2 text-sm font-light text-meta bg-ink/[0.02] cursor-not-allowed"
            />
            <p className="text-[9px] text-meta/50 font-light mt-1">El correo no se puede modificar.</p>
          </div>
          {nombreMsg && (
            <p className={`text-[11px] font-light ${nombreMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
              {nombreMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={nombreSaving || !nombre.trim()}
            className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-50"
          >
            {nombreSaving ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </form>
      </section>

      <div className="border-t border-ink/8 mb-10" />

      {/* ── Contraseña ─────────────────────────────────────────────────────── */}
      <section>
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-4">Contraseña</p>
        <form onSubmit={handlePassword} className="space-y-3">
          <div>
            <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={pw.new}
              onChange={e => { setPw(p => ({ ...p, new: e.target.value })); setPwMsg(null) }}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={pw.confirm}
              onChange={e => { setPw(p => ({ ...p, confirm: e.target.value })); setPwMsg(null) }}
              placeholder="Repite la contraseña"
              className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors"
            />
          </div>
          {pwMsg && (
            <p className={`text-[11px] font-light ${pwMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
              {pwMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={pwSaving || !pw.new || !pw.confirm}
            className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-50"
          >
            {pwSaving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </div>
  )
}
