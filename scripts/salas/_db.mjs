// Conexión service_role para los scripts de Salas (lee .env.local).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

export async function sala(slug) {
  const { data, error } = await db.from('sala_salas').select('*').eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(`No hay sala para ${slug}. ¿Está aplicada supabase/migrations/salas_fase1.sql?`)
  return data
}

export function args(argv) {
  const pos = [], op = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) op[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i]
    else pos.push(argv[i])
  }
  return { pos, op }
}
