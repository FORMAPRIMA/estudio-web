'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateDdCardField, addDdCardMedia, deleteDdCardMedia } from '@/app/actions/dd-visits'
import type { DdCard, DdAsset, DdVisit, DdRole, DdCardMedia, DdCardEstado, DdCardRiesgo } from '@/lib/dd-visits/domain'
import { DD_CARD_ESTADO_LABELS, DD_CARD_ESTADO_COLORS, DD_CARD_RIESGO_LABELS, DD_CARD_RIESGO_COLORS } from '@/lib/dd-visits/domain'

const BUCKET = 'dd-visits'

async function uploadFile(file: File): Promise<{ url: string; storagePath: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '31536000', upsert: false,
  })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl, storagePath: data.path }
}

interface Props {
  asset: Pick<DdAsset, 'id' | 'nombre'>
  visit: Pick<DdVisit, 'id' | 'asset_id' | 'fecha' | 'status'>
  card: DdCard
  rol: DdRole
  media: DdCardMedia[]
  cardIndex: number
  totalCards: number
  prevCardId: string | null
  nextCardId: string | null
}

const ESTADO_OPTIONS: { value: DdCardEstado; label: string }[] = [
  { value: 'pendiente',           label: 'Pendiente' },
  { value: 'revisado_ok',         label: 'Revisado OK' },
  { value: 'incidencia',          label: 'Incidencia' },
  { value: 'no_accesible',        label: 'No accesible' },
  { value: 'no_aplica',           label: 'No aplica' },
  { value: 'requiere_aclaracion', label: 'Requiere aclaración' },
]

const RIESGO_OPTIONS: { value: DdCardRiesgo; label: string }[] = [
  { value: 'sin_riesgo', label: 'Sin riesgo' },
  { value: 'bajo',       label: 'Bajo' },
  { value: 'medio',      label: 'Medio' },
  { value: 'alto',       label: 'Alto' },
]

export default function DdCardView({
  asset, visit, card: initialCard, rol, media: initialMedia,
  cardIndex, totalCards, prevCardId, nextCardId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [card, setCard] = useState(initialCard)
  const [media, setMedia] = useState(initialMedia)
  const [showGuide, setShowGuide] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const basePath = `/team/apps/dd-visits/${asset.id}/visita/${visit.id}/mi-revision`

  function set<K extends keyof DdCard>(key: K, value: DdCard[K]) {
    setCard(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateDdCardField(card.id, asset.id, visit.id, {
        estado:                   card.estado,
        riesgo:                   card.riesgo,
        planta:                   card.planta,
        zona:                     card.zona,
        estancia:                 card.estancia,
        comentario_tecnico:       card.comentario_tecnico,
        requiere_seguimiento:     card.requiere_seguimiento,
        incluir_revision_interna: card.incluir_revision_interna,
      })
      if ('error' in result) { setSaveError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadError(null)
    setUploading(true)
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        setUploadError(`"${file.name}" supera 100 MB.`)
        setUploading(false)
        return
      }
      const tipo: 'foto' | 'video' = file.type.startsWith('video') ? 'video' : 'foto'
      const res = await uploadFile(file)
      if ('error' in res) { setUploadError(res.error); setUploading(false); return }
      const addRes = await addDdCardMedia(card.id, asset.id, visit.id, tipo, res.url, res.storagePath)
      if ('error' in addRes) { setUploadError(addRes.error); setUploading(false); return }
      setMedia(prev => [...prev, {
        id: addRes.id, card_id: card.id, asset_id: asset.id, visit_id: visit.id,
        tipo, url: res.url, storage_path: res.storagePath,
        caption: null, user_id: null, created_at: new Date().toISOString(),
      }])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeleteMedia(mediaId: string) {
    const result = await deleteDdCardMedia(mediaId, asset.id, visit.id, card.id)
    if ('error' in result) { setUploadError(result.error); return }
    setMedia(prev => prev.filter(m => m.id !== mediaId))
  }

  const guideItems = [
    { label: 'Objetivo', text: card.objetivo_revision, accent: false },
    { label: 'Qué revisar', text: card.que_revisar, accent: false },
    { label: 'Señales de alerta', text: card.senales_alerta, accent: true },
    { label: 'Fotos recomendadas', text: card.fotos_recomendadas, accent: false },
    { label: 'Preguntas a confirmar', text: card.preguntas_confirmar, accent: false },
    { label: 'Documentación relacionada', text: card.documentacion_relacionada, accent: false },
  ].filter(item => item.text)

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0DDD8', borderRadius: 6,
    padding: '10px 12px', fontSize: 14, color: '#1A1A1A',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }

  return (
    <div style={{ background: '#F8F7F4', minHeight: '100vh', maxWidth: 640, margin: '0 auto', paddingBottom: 88 }}>

      {/* Header sticky */}
      <div style={{ background: '#1A1A1A', padding: '12px 16px 14px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => router.push(basePath)}
            style={{ background: 'none', border: 'none', color: '#ffffff60', cursor: 'pointer', fontSize: 22, padding: '0 4px 0 0', lineHeight: 1 }}>
            ←
          </button>
          <span style={{ fontSize: 10, color: '#ffffff40' }}>{cardIndex} / {totalCards}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => prevCardId && router.push(`${basePath}/${prevCardId}`)}
              disabled={!prevCardId}
              style={{ background: 'none', border: 'none', color: prevCardId ? '#ffffff50' : '#ffffff20', cursor: prevCardId ? 'pointer' : 'default', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
            >‹</button>
            <button
              onClick={() => nextCardId && router.push(`${basePath}/${nextCardId}`)}
              disabled={!nextCardId}
              style={{ background: 'none', border: 'none', color: nextCardId ? '#ffffff50' : '#ffffff20', cursor: nextCardId ? 'pointer' : 'default', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
            >›</button>
          </div>
        </div>

        <p style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: rol.color || '#ffffff60', marginBottom: 4 }}>
          {rol.nombre}
        </p>
        <h1 style={{ fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 10 }}>
          {card.titulo}
        </h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {card.zona_edificio && (
            <span style={{ fontSize: 10, color: '#ffffff60', background: '#ffffff15', padding: '2px 8px', borderRadius: 20 }}>
              {card.zona_edificio}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#ffffff50', background: '#ffffff10', padding: '2px 8px', borderRadius: 20 }}>
            Prioridad {card.prioridad}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: DD_CARD_ESTADO_COLORS[card.estado] + '30',
            color: DD_CARD_ESTADO_COLORS[card.estado],
          }}>
            {DD_CARD_ESTADO_LABELS[card.estado]}
          </span>
        </div>
      </div>

      <div style={{ padding: '0 14px' }}>

        {/* Guía de revisión — collapsible */}
        {guideItems.length > 0 && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
            <button
              onClick={() => setShowGuide(!showGuide)}
              style={{
                width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60' }}>
                Guía de revisión
              </span>
              <span style={{ fontSize: 14, color: '#1A1A1A40', transition: 'transform 0.2s', display: 'inline-block', transform: showGuide ? 'rotate(180deg)' : 'none' }}>
                ▾
              </span>
            </button>

            {showGuide && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F0EEE8' }}>
                {guideItems.map(({ label, text, accent }) => (
                  <div
                    key={label}
                    style={{
                      marginTop: 14,
                      ...(accent ? { background: '#FFF8F5', padding: '10px 12px', borderRadius: 6, borderLeft: '3px solid #D85A30' } : {}),
                    }}
                  >
                    <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent ? '#D85A30' : '#1A1A1A40', marginBottom: 5 }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.7 }}>{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Captura de campo */}
        <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '16px 16px' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A40', marginBottom: 18 }}>
            Tu revisión
          </p>

          {/* Estado */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 10 }}>
              Estado *
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {ESTADO_OPTIONS.map(({ value, label }) => {
                const color = DD_CARD_ESTADO_COLORS[value]
                const active = card.estado === value
                return (
                  <button
                    key={value}
                    onClick={() => set('estado', value)}
                    style={{
                      padding: '13px 6px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 11, fontWeight: active ? 600 : 400, lineHeight: 1.3,
                      border: `2px solid ${active ? color : '#E8E6E0'}`,
                      background: active ? color + '18' : '#FAFAF8',
                      color: active ? color : '#1A1A1A70',
                      transition: 'all 0.12s', textAlign: 'center',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Riesgo */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 10 }}>
              Nivel de riesgo
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {RIESGO_OPTIONS.map(({ value, label }) => {
                const color = DD_CARD_RIESGO_COLORS[value]
                const active = card.riesgo === value
                return (
                  <button
                    key={value}
                    onClick={() => set('riesgo', active ? null : value)}
                    style={{
                      padding: '12px 4px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 11, fontWeight: active ? 600 : 400,
                      border: `2px solid ${active ? color : '#E8E6E0'}`,
                      background: active ? color + '18' : '#FAFAF8',
                      color: active ? color : '#1A1A1A70',
                      transition: 'all 0.12s', textAlign: 'center',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ubicación */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {(['planta', 'zona', 'estancia'] as const).map(field => (
              <div key={field}>
                <label style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A40', marginBottom: 5, display: 'block' }}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  value={card[field] ?? ''}
                  onChange={e => set(field, e.target.value || null)}
                  placeholder={field === 'planta' ? 'P1' : field === 'zona' ? 'Cubierta' : 'Baño 2'}
                  style={{ ...inputStyle, fontSize: 13, padding: '9px 10px' }}
                />
              </div>
            ))}
          </div>

          {/* Comentario libre — el campo más importante */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 8, display: 'block' }}>
              Comentario libre
            </label>
            <textarea
              value={card.comentario_tecnico ?? ''}
              onChange={e => set('comentario_tecnico', e.target.value || null)}
              placeholder="Describe brevemente lo que observaste. No hace falta redactar formalmente. Indica ubicación, síntoma visible, condición observada y cualquier duda relevante."
              rows={6}
              style={{
                ...inputStyle, resize: 'vertical', lineHeight: 1.65,
                fontFamily: 'inherit', fontSize: 13, padding: '12px',
                minHeight: 120,
              }}
            />
          </div>

          {/* Upload de fotos/vídeos */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 10, display: 'block' }}>
              Fotos y vídeos{media.length > 0 ? ` (${media.length})` : ''}
            </label>

            {media.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                {media.map(m => (
                  <div key={m.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#F0EEE8' }}>
                    {m.tipo === 'video' ? (
                      <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                    ) : (
                      <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <button
                      onClick={() => handleDeleteMedia(m.id)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
                        width: 24, height: 24, color: '#fff', fontSize: 15, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >×</button>
                    {m.tipo === 'video' && (
                      <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 3, padding: '1px 5px', fontSize: 9, color: '#fff' }}>
                        VID
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="dd-card-media-input"
            />
            <label
              htmlFor="dd-card-media-input"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px', borderRadius: 8, border: '2px dashed #E0DDD8',
                cursor: uploading ? 'wait' : 'pointer', fontSize: 13, color: '#1A1A1A60',
                background: uploading ? '#F8F7F4' : '#FAFAF8',
              }}
            >
              {uploading ? 'Subiendo...' : '📷  Añadir foto o vídeo'}
            </label>
            {uploadError && (
              <p style={{ fontSize: 11, color: '#C0392B', marginTop: 6, padding: '6px 10px', background: '#FDF2F2', borderRadius: 4 }}>
                {uploadError}
              </p>
            )}
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { field: 'requiere_seguimiento' as const,     label: 'Requiere seguimiento posterior',   desc: 'Este punto debe revisarse de nuevo o con más detalle' },
              { field: 'incluir_revision_interna' as const, label: 'Incluir en revisión interna',       desc: 'Marcar para análisis post-visita en oficina' },
            ].map(({ field, label, desc }) => (
              <label key={field} style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={card[field]}
                  onChange={e => set(field, e.target.checked)}
                  style={{ width: 20, height: 20, cursor: 'pointer', marginTop: 1, flexShrink: 0 }}
                />
                <div>
                  <p style={{ fontSize: 13, color: '#1A1A1A', marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 11, color: '#1A1A1A50' }}>{desc}</p>
                </div>
              </label>
            ))}
          </div>

          {saveError && (
            <p style={{ fontSize: 12, color: '#C0392B', marginTop: 14, padding: '8px 12px', background: '#FDF2F2', borderRadius: 4 }}>
              {saveError}
            </p>
          )}
        </div>
      </div>

      {/* Botón guardar sticky */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 640, padding: '12px 14px',
        background: 'rgba(248,247,244,0.97)', borderTop: '1px solid #E8E6E0',
        backdropFilter: 'blur(8px)',
      }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            width: '100%', padding: '15px', borderRadius: 10, border: 'none',
            background: saved ? '#2D7D5A' : '#1A1A1A',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.25s', letterSpacing: '-0.01em',
          }}
        >
          {isPending ? 'Guardando...' : saved ? '✓  Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
