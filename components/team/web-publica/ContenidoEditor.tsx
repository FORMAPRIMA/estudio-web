'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { upsertContent } from '@/app/actions/web-content'
import { CONTENT_SCHEMA, type ContentField } from '@/lib/web-publica-schema'
import { contentKey, type ContentMap, type WebContent, type ContentTipo } from '@/lib/web-publica'

const BUCKET = 'web-publica'
const ORANGE = '#D85A30'
const INK = '#1A1A1A'
const BORDER = '#F0EEE8'

async function uploadFile(file: File): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `content/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

async function traducir(texto: string): Promise<string | null> {
  try {
    const res = await fetch('/api/web-publica/traducir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return typeof json.traduccion === 'string' ? json.traduccion : null
  } catch { return null }
}

export function ContenidoEditor({ content }: { content: Record<string, ContentMap> }) {
  const [pagina, setPagina] = useState(CONTENT_SCHEMA[0]?.pagina ?? 'home')
  const page = CONTENT_SCHEMA.find((p) => p.pagina === pagina)
  const map = content[pagina] ?? {}

  return (
    <div>
      {/* Selector de página */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {CONTENT_SCHEMA.map((p) => {
          const active = p.pagina === pagina
          return (
            <button key={p.pagina} onClick={() => setPagina(p.pagina)}
              style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 12, letterSpacing: '0.04em', cursor: 'pointer',
                border: `1px solid ${active ? INK : BORDER}`, background: active ? INK : '#fff', color: active ? '#fff' : `${INK}90`,
              }}>
              {p.label}
            </button>
          )
        })}
      </div>

      {!page ? (
        <p style={{ fontSize: 13, color: `${INK}60` }}>Sin campos definidos aún.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {page.sections.map((s) => (
            <section key={s.seccion}>
              <h3 style={{ fontSize: 15, fontWeight: 500, color: INK, margin: '0 0 3px' }}>{s.label}</h3>
              {s.hint && <p style={{ fontSize: 12, color: `${INK}55`, margin: '0 0 14px', maxWidth: 560, lineHeight: 1.5 }}>{s.hint}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {s.fields.map((f) => (
                  <ContentBlock
                    key={f.clave}
                    pagina={pagina}
                    seccion={s.seccion}
                    field={f}
                    row={map[contentKey(s.seccion, f.clave)]}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ContentBlock({
  pagina, seccion, field, row,
}: {
  pagina: string
  seccion: string
  field: ContentField
  row?: WebContent
}) {
  const isMedia = field.tipo === 'imagen' || field.tipo === 'video'
  const mobileable = field.mobileable !== false
  const [d, setD] = useState({
    valor_es: row?.valor_es ?? '',
    valor_en: row?.valor_en ?? '',
    mobile_override: row?.mobile_override ?? false,
    valor_mobile_es: row?.valor_mobile_es ?? '',
    valor_mobile_en: row?.valor_mobile_en ?? '',
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((p) => ({ ...p, [k]: v })); setSaved(false) }

  const onTranslate = async (from: 'valor_es' | 'valor_mobile_es', to: 'valor_en' | 'valor_mobile_en') => {
    if (!d[from].trim()) return
    setBusy(to); setError(null)
    const t = await traducir(d[from])
    setBusy(null)
    if (t == null) { setError('No se pudo traducir.'); return }
    set(to, t)
  }

  const onFile = async (target: 'valor_es' | 'valor_mobile_es', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(target); setError(null)
    const res = await uploadFile(file)
    setBusy(null)
    if ('error' in res) { setError(res.error); return }
    set(target, res.url)
  }

  const save = async () => {
    setBusy('save'); setError(null)
    const res = await upsertContent(pagina, seccion, field.clave, {
      tipo: field.tipo,
      valor_es: d.valor_es || null,
      valor_en: isMedia ? null : (d.valor_en || null),
      mobile_override: d.mobile_override,
      valor_mobile_es: d.mobile_override ? (d.valor_mobile_es || null) : null,
      valor_mobile_en: d.mobile_override && !isMedia ? (d.valor_mobile_en || null) : null,
    })
    setBusy(null)
    if ('error' in res) { setError(res.error); return }
    setSaved(true)
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: INK }}>{field.label}</span>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${INK}45`, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '1px 6px' }}>{field.tipo}</span>
      </div>
      {field.hint && <p style={{ fontSize: 11, color: `${INK}55`, margin: '0 0 12px', lineHeight: 1.5 }}>{field.hint}</p>}

      {/* Desktop */}
      {isMedia ? (
        <MediaField tipo={field.tipo} url={d.valor_es} busy={busy === 'valor_es'} onFile={(e) => onFile('valor_es', e)} onClear={() => set('valor_es', '')} />
      ) : (
        <LangPair
          es={d.valor_es} en={d.valor_en} rich={field.tipo === 'rich'}
          translating={busy === 'valor_en'}
          onEs={(v) => set('valor_es', v)} onEn={(v) => set('valor_en', v)}
          onTranslate={() => onTranslate('valor_es', 'valor_en')}
        />
      )}

      {/* Override móvil */}
      {mobileable && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: `${INK}90`, cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={d.mobile_override} onChange={(e) => set('mobile_override', e.target.checked)} />
            Personalizar en móvil
            <span style={{ fontSize: 11, color: `${INK}45` }}>(si no, el móvil muestra lo mismo)</span>
          </label>
          {d.mobile_override && (
            <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: `2px solid ${ORANGE}55` }}>
              {isMedia ? (
                <MediaField tipo={field.tipo} url={d.valor_mobile_es} busy={busy === 'valor_mobile_es'} onFile={(e) => onFile('valor_mobile_es', e)} onClear={() => set('valor_mobile_es', '')} mobile />
              ) : (
                <LangPair
                  es={d.valor_mobile_es} en={d.valor_mobile_en} rich={field.tipo === 'rich'}
                  translating={busy === 'valor_mobile_en'}
                  onEs={(v) => set('valor_mobile_es', v)} onEn={(v) => set('valor_mobile_en', v)}
                  onTranslate={() => onTranslate('valor_mobile_es', 'valor_mobile_en')}
                  mobile
                />
              )}
            </div>
          )}
        </>
      )}

      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={save} disabled={busy !== null}
          style={{ padding: '8px 18px', background: saved ? '#2e7d32' : ORANGE, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy === 'save' ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function LangPair({
  es, en, rich, translating, onEs, onEn, onTranslate, mobile,
}: {
  es: string; en: string; rich: boolean; translating: boolean
  onEs: (v: string) => void; onEn: (v: string) => void; onTranslate: () => void; mobile?: boolean
}) {
  const rows = rich ? 5 : 2
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <FieldLabel>{mobile ? 'Español (móvil)' : 'Español'}</FieldLabel>
        <textarea value={es} onChange={(e) => onEs(e.target.value)} rows={rows} style={textareaStyle} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <FieldLabel inline>{mobile ? 'English (mobile)' : 'English'}</FieldLabel>
          <button onClick={onTranslate} disabled={translating || !es.trim()}
            style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: es.trim() ? ORANGE : `${INK}35`, background: 'none', border: 'none', cursor: es.trim() && !translating ? 'pointer' : 'default', padding: 0 }}>
            {translating ? 'Traduciendo…' : '↳ Traducir con IA'}
          </button>
        </div>
        <textarea value={en} onChange={(e) => onEn(e.target.value)} rows={rows} style={textareaStyle} placeholder="Se rellena al traducir; editable." />
      </div>
    </div>
  )
}

function MediaField({
  tipo, url, busy, onFile, onClear, mobile,
}: {
  tipo: ContentTipo; url: string; busy: boolean
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; mobile?: boolean
}) {
  const accept = tipo === 'video' ? 'video/*' : 'image/*'
  return (
    <div>
      <FieldLabel>{mobile ? `${tipo === 'video' ? 'Vídeo' : 'Imagen'} (móvil)` : tipo === 'video' ? 'Vídeo' : 'Imagen'}</FieldLabel>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 96, height: 60, borderRadius: 4, overflow: 'hidden', background: '#F8F7F4', border: `1px solid ${BORDER}`, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {url ? (
            tipo === 'video'
              // eslint-disable-next-line jsx-a11y/media-has-caption
              ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : <span style={{ color: `${INK}30`, fontSize: 18 }}>+</span>}
        </div>
        <label style={{ ...uploadBtnStyle, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Subiendo…' : url ? 'Cambiar' : 'Subir'}
          <input type="file" accept={accept} hidden onChange={onFile} disabled={busy} />
        </label>
        {url && <button onClick={onClear} style={{ background: 'none', border: 'none', color: `${INK}60`, fontSize: 12, cursor: 'pointer' }}>Quitar</button>}
      </div>
    </div>
  )
}

function FieldLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <label style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: inline ? 0 : 5, display: 'block' }}>
      {children}
    </label>
  )
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 4,
  fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5,
}
const uploadBtnStyle: React.CSSProperties = {
  padding: '8px 16px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4,
  fontSize: 11, color: INK, cursor: 'pointer', whiteSpace: 'nowrap',
}
