import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('exchange_rates')
    .select('currency, eur_per_unit, updated_at')
    .order('currency')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rates: Record<string, number> = {}
  for (const row of data ?? []) {
    rates[row.currency] = row.eur_per_unit
  }
  const updatedAt = data?.[0]?.updated_at ?? null
  return NextResponse.json({ rates, updated_at: updatedAt })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Fetch from open.er-api.com (free, no key needed)
  let raw: Record<string, number>
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', { next: { revalidate: 0 } })
    const json = await res.json() as { rates?: Record<string, number>; result?: string }
    if (!json.rates) throw new Error('No rates in response')
    raw = json.rates
  } catch {
    return NextResponse.json({ error: 'No se pudo obtener tipos de cambio externos.' }, { status: 502 })
  }

  // raw[USD] = 1.08 means 1 EUR = 1.08 USD → eur_per_unit[USD] = 1/1.08
  const CURRENCIES = ['USD', 'GBP', 'CHF', 'MXN', 'ARS', 'COP', 'PEN', 'BRL', 'JPY', 'CNY']
  const admin = createAdminClient()

  const rows = CURRENCIES.filter(c => raw[c]).map(c => ({
    currency: c,
    eur_per_unit: 1 / raw[c],
    updated_at: new Date().toISOString(),
  }))
  // Always include EUR = 1
  rows.push({ currency: 'EUR', eur_per_unit: 1, updated_at: new Date().toISOString() })

  const { error } = await admin
    .from('exchange_rates')
    .upsert(rows, { onConflict: 'currency' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rates: Record<string, number> = {}
  for (const r of rows) rates[r.currency] = r.eur_per_unit

  return NextResponse.json({ rates, updated_at: new Date().toISOString() })
}
