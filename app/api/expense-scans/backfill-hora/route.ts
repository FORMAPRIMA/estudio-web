import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Limit per call to avoid Vercel 60 s timeout
const BATCH_SIZE = 15

async function extractHora(fotoUrl: string): Promise<string | null> {
  try {
    const fileRes = await fetch(fotoUrl)
    if (!fileRes.ok) return null

    const fileBuffer = await fileRes.arrayBuffer()
    const base64 = Buffer.from(fileBuffer).toString('base64')
    const contentType = fileRes.headers.get('content-type') ?? 'image/jpeg'
    const isPdf = contentType.includes('pdf') || fotoUrl.toLowerCase().includes('.pdf')

    const fileContent = isPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (contentType.startsWith('image/') ? contentType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        }

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: 'You extract the purchase time from a receipt or invoice. Reply ONLY with the time in HH:MM format (24h), or "null" if no time is visible. Nothing else.',
      messages: [
        {
          role: 'user',
          content: [
            fileContent as any,
            { type: 'text', text: 'What time does this receipt show?' },
          ],
        },
      ],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : 'null'
    if (raw === 'null' || raw === '' || raw.toLowerCase() === 'null') return null

    // Validate HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [h, m] = raw.split(':').map(Number)
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    }
    return null
  } catch {
    return null
  }
}

export async function POST() {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch scans with missing hora_ticket
  const { data: pending, error } = await admin
    .from('expense_scans')
    .select('id, foto_url')
    .is('hora_ticket', null)
    .not('foto_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pending || pending.length === 0) {
    return NextResponse.json({ updated: 0, failed: 0, remaining: 0 })
  }

  // Count total remaining before this batch
  const { count: totalRemaining } = await admin
    .from('expense_scans')
    .select('id', { count: 'exact', head: true })
    .is('hora_ticket', null)
    .not('foto_url', 'is', null)

  let updated = 0
  let failed  = 0

  for (const scan of pending) {
    const hora = await extractHora(scan.foto_url)
    if (hora !== null) {
      const { error: upErr } = await admin
        .from('expense_scans')
        .update({ hora_ticket: hora })
        .eq('id', scan.id)
      if (!upErr) updated++
      else failed++
    } else {
      // Mark as processed (empty string) so we don't retry endlessly
      await admin
        .from('expense_scans')
        .update({ hora_ticket: '' })
        .eq('id', scan.id)
      failed++
    }
  }

  const remaining = Math.max(0, (totalRemaining ?? 0) - pending.length)

  return NextResponse.json({ updated, failed, remaining })
}
