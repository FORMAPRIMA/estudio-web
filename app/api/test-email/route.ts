import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, wrapEmail } from '@/lib/email'

// Temporary test endpoint — call with ?to=your@email.com
// DELETE this file once logo is confirmed working in production.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const to = req.nextUrl.searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'Falta ?to=email' }, { status: 400 })

  const body = `
    <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">Test de correo</h2>
    <p style="font-size:13px;color:#555;margin:0 0 12px;line-height:1.6;">
      Si ves el logo de Forma Prima arriba, el correo está configurado correctamente.
    </p>
    <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">
      If you see the Forma Prima logo above, the email rendering is working correctly.
    </p>
  `

  const result = await sendEmail({
    to,
    subject: 'Test — Forma Prima logo check',
    html:    wrapEmail(body),
  })

  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, emailId: result.id, sentTo: to })
}
