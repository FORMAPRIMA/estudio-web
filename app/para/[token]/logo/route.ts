import { NextResponse } from 'next/server'
import { leerLogo, prospectoPorToken } from '@/lib/salas/prospeccion'

// Logo del lead para su dossier. El bucket es privado: solo se sirve a quien
// tiene un enlace vigente, en la versión que eligió quien lo preparó.

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const p = await prospectoPorToken(params.token)
  if (!p?.logoPath) return new NextResponse(null, { status: 404 })
  const png = await leerLogo(p.logoPath, p.logoModo)
  if (!png) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300', 'X-Robots-Tag': 'noindex' },
  })
}
