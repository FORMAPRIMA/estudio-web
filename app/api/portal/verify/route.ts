import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const SECRET = process.env.PORTAL_SECRET ?? 'fp-portal-secret-2024'

function generatePortalToken(proyectoId: string): string {
  return createHmac('sha256', SECRET).update(proyectoId).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { proyectoId, fecha_nacimiento } = await req.json() as {
      proyectoId: string
      fecha_nacimiento: string
    }

    if (!proyectoId || !fecha_nacimiento) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify project exists
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('id')
      .eq('id', proyectoId)
      .single()

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
    }

    // Fetch all clients linked to this project (via junction table) + their DOB
    const { data: vinculados } = await admin
      .from('proyecto_clientes')
      .select('clientes(fecha_nacimiento)')
      .eq('proyecto_id', proyectoId)

    type Vinculado = { clientes: { fecha_nacimiento: string | null } | null }
    const fechas = ((vinculados ?? []) as unknown as Vinculado[])
      .map(v => v.clientes?.fecha_nacimiento?.split('T')[0])
      .filter(Boolean) as string[]

    if (fechas.length === 0) {
      return NextResponse.json(
        { error: 'El acceso a este portal aún no está configurado. Contacta con tu arquitecto.' },
        { status: 403 }
      )
    }

    // Accept if the provided date matches ANY linked client's DOB
    const provided = fecha_nacimiento.trim()
    if (!fechas.includes(provided)) {
      return NextResponse.json({ error: 'Fecha incorrecta. Inténtalo de nuevo.' }, { status: 401 })
    }

    // Issue cookie
    const token = generatePortalToken(proyectoId)
    const cookieName = `fp_portal_${proyectoId.replace(/-/g, '').slice(0, 12)}`

    const res = NextResponse.json({ success: true })
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: `/portal/${proyectoId}`,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return res
  } catch (err) {
    console.error('[portal/verify]', err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
