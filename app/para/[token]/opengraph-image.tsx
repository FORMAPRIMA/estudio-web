import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'
import { leerLogo, prospectoPorToken } from '@/lib/salas/prospeccion'

// Vista previa del enlace al compartirlo (correo, WhatsApp, LinkedIn): la foto de
// la portada, Forma Prima × el logo del lead y «Preparado para …».

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

const dataUrl = (buf: Buffer, tipo: string) => `data:${tipo};base64,${buf.toString('base64')}`

/** Hanken Grotesk en TTF (sin agente de navegador, Google Fonts sirve TTF, que es lo que entiende ImageResponse). */
async function fuente(peso: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@${peso}`, { signal: AbortSignal.timeout(3000) })).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1]
    return url ? await (await fetch(url, { signal: AbortSignal.timeout(3000) })).arrayBuffer() : null
  } catch { return null }
}

export default async function Imagen({ params }: { params: { token: string } }) {
  const p = await prospectoPorToken(params.token)
  const pub = (f: string) => readFile(path.join(process.cwd(), 'public', f))
  const [foto, fp] = await Promise.all([pub('para/og-foto.jpg'), pub('para/logo-h-white.png')])
  const logo = p?.logoPath ? await leerLogo(p.logoPath, 'blanco') : null
  const en = p?.lead.idioma === 'en'
  const [ligera, normal] = await Promise.all([fuente(300), fuente(400)])
  const fonts = [
    ...(ligera ? [{ name: 'Hanken Grotesk', data: ligera, weight: 300 as const, style: 'normal' as const }] : []),
    ...(normal ? [{ name: 'Hanken Grotesk', data: normal, weight: 400 as const, style: 'normal' as const }] : []),
  ]
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0d0d0d', color: '#fbfbfa', fontFamily: 'Hanken Grotesk' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl(foto, 'image/jpeg')} alt="" width={460} height={630} style={{ objectFit: 'cover' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 64px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl(fp, 'image/png')} alt="" height={30} style={{ height: 30 }} />
            {p && <span style={{ fontSize: 28, color: 'rgba(251,251,250,.5)' }}>×</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={dataUrl(logo, 'image/png')} alt="" style={{ maxHeight: 54, maxWidth: 240, objectFit: 'contain' }} />
              : p ? <span style={{ fontSize: 24, letterSpacing: 5, textTransform: 'uppercase' }}>{p.lead.empresa}</span> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 26, color: '#8fa596', marginBottom: 18, fontWeight: 400 }}>
              {p ? (en ? `Prepared for ${p.lead.empresa}` : `Preparado para ${p.lead.empresa}`) : 'Forma Prima'}
            </span>
            <span style={{ fontSize: 62, fontWeight: 300, lineHeight: 1.05, letterSpacing: -2 }}>
              {en ? 'Architecture and design. And the tools to sell it.' : 'Arquitectura y diseño. Y las herramientas para venderlo.'}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
