// Carga en pp_indices el índice de costes de construcción compuesto con series del INE.
//   mano de obra: tabla 8377 (índice nacional de la mano de obra en construcción)
//   materiales:   tabla 8381 (materiales generales), media simple de los de edificación
// Índice = 100 × (0,45 × MO/MO₀ + 0,55 × MAT/MAT₀), base enero de 2023. Siempre se
// recalcula la serie entera con la misma base, así los factores no cambian al añadir meses.
//
//   set -a; source .env.local; set +a; npx tsx scripts/presupuestos-parametricos/indice-ine.mts

import { createClient } from '@supabase/supabase-js'

const SERIE = 'ine_construccion'
const PESO_MO = 0.45
const BASE = '2023-01-01'
const EXCLUIR = /Plantas|explosivos/i     // no son de edificación

type Dato = { Anyo: number; FK_Periodo: number; Valor: number | null }
async function tabla(id: number): Promise<{ Nombre: string; Data: Dato[] }[]> {
  const r = await fetch(`https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/${id}?date=20230101:20991231`)
  if (!r.ok) throw new Error(`INE ${id}: ${r.status}`)
  return r.json()
}
const periodo = (d: Dato) => `${d.Anyo}-${String(d.FK_Periodo).padStart(2, '0')}-01`
const porMes = (s: { Data: Dato[] }) => new Map(s.Data.filter(d => d.Valor != null && d.FK_Periodo <= 12).map(d => [periodo(d), d.Valor as number]))

const [materiales, manoObra] = await Promise.all([tabla(8381), tabla(8377)])
const mo = porMes(manoObra[0])
const mats = materiales.filter(s => !EXCLUIR.test(s.Nombre)).map(porMes)
const meses = Array.from(mo.keys()).filter(p => p >= BASE && mats.every(m => m.has(p))).sort()
if (!mo.has(BASE) || !mats.every(m => m.has(BASE))) throw new Error('Falta el mes base en alguna serie.')

const filas = meses.map(p => {
  const mat = mats.reduce((s, m) => s + m.get(p)! / m.get(BASE)!, 0) / mats.length
  const valor = 100 * (PESO_MO * mo.get(p)! / mo.get(BASE)! + (1 - PESO_MO) * mat)
  return { serie: SERIE, periodo: p, valor: Math.round(valor * 1000) / 1000, provisional: false, fuente_url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=8381 + t=8377' }
})

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const { error } = await admin.from('pp_indices').upsert(filas, { onConflict: 'serie,periodo' })
if (error) throw error
console.log(`${filas.length} meses (${meses[0]} → ${meses[meses.length - 1]}) · ${mats.length} materiales · último ${filas[filas.length - 1].valor}`)
