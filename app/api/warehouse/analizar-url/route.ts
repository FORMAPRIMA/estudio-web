import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPublicUrl, extraerSenales, fetchHtml, type SenalesProducto } from '@/lib/memorias/scrape'
import { IVA_DEFAULT, NIVELES, conIva, sinIva, type NivelCalidad } from '@/lib/memorias/domain'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

const MODELO = 'claude-opus-5'

// ── Esquema de salida ─────────────────────────────────────────────────────────

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })

function buildSchema(codigos: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'nombre', 'marca', 'modelo', 'referencia', 'descripcion',
      'acabados', 'tags', 'niveles_calidad', 'subcapitulo_codigo',
      'precio', 'precio_lleva_iva', 'iva_pct', 'precio_coste', 'moneda',
      'imagen_producto_idx', 'imagen_ambiente_idx', 'notas_ia',
    ],
    properties: {
      nombre: { type: 'string', description: 'Nombre comercial del producto, sin la marca delante.' },
      marca: nullable({ type: 'string' }),
      modelo: nullable({ type: 'string' }),
      referencia: nullable({ type: 'string', description: 'SKU o referencia del fabricante, solo si aparece explícita.' }),
      descripcion: nullable({ type: 'string', description: 'Una a tres frases para una memoria de calidades: material, acabado y característica técnica relevante.' }),
      acabados: { type: 'array', items: { type: 'string' }, description: 'Acabados o colores disponibles.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tres a seis etiquetas de búsqueda en minúsculas.' },
      niveles_calidad: {
        type: 'array',
        items: { type: 'string', enum: NIVELES.map(n => n.value) },
        description: 'Niveles en los que este producto encajaría. Normalmente uno; dos o tres si es una pieza que vale para varios.',
      },
      subcapitulo_codigo: nullable({ type: 'string', enum: codigos }),
      precio: nullable({ type: 'number', description: 'Precio de venta al público tal y como lo muestra la web.' }),
      precio_lleva_iva: nullable({ type: 'boolean', description: 'true si ese precio es con IVA incluido, false si la web indica que es sin IVA, null si no se puede saber.' }),
      iva_pct: nullable({ type: 'number', description: 'Tipo de IVA que indique la web (21, 10, 4). Null si no lo dice.' }),
      precio_coste: nullable({ type: 'number', description: 'Solo si la web muestra precio profesional, de distribuidor o tarifa con descuento.' }),
      moneda: { type: 'string', enum: ['EUR', 'USD', 'GBP', 'MXN'] },
      imagen_producto_idx: nullable({ type: 'integer', description: 'Índice de la imagen que mejor muestra el producto aislado.' }),
      imagen_ambiente_idx: nullable({ type: 'integer', description: 'Índice de la imagen del producto en un ambiente real. Null si no hay ninguna.' }),
      notas_ia: nullable({ type: 'string', description: 'Qué no has podido determinar o qué conviene verificar a mano. Menciona si el precio lleva IVA.' }),
    },
  }
}

const SYSTEM = `Eres el catalogador técnico de Forma Prima, un estudio de arquitectura e interiorismo de Madrid.

Tu trabajo es convertir la página de un producto en una ficha limpia para nuestro warehouse de memorias de calidades.

Reglas:
- Escribe en español de España, registro técnico y sobrio. Nada de superlativos de marketing ("increíble", "el mejor"), exclamaciones ni emoji.
- La descripción va a un documento que ve el cliente: di de qué está hecho, cómo está acabado y qué lo distingue. Entre una y tres frases.
- No inventes. Si una referencia, un precio o un acabado no aparece en la página, devuelve null. Es mucho mejor un hueco que un dato falso.
- Niveles de calidad: "functional" = gama funcional correcta y contenida en precio; "select" = gama media-alta de marca reconocida; "master_piece" = alta gama, diseño de autor o pieza singular. Deduce por marca, precio y acabados. Devuelve un solo nivel salvo que la pieza encaje razonablemente en dos (por ejemplo, una marca media-alta con acabado sobrio que sirve tanto en select como en functional). Nunca los tres a la vez a menos que sea un producto neutro que valga para cualquier gama.
- Precio: en España las tiendas al público suelen mostrarlo con IVA incluido. Devuelve el número tal y como aparece y marca en "precio_lleva_iva" si lo lleva o no; si la web no lo aclara, devuelve null y dilo en notas_ia. Si aparece un tipo de IVA concreto, indícalo en "iva_pct".
- Subcapítulo: elige el del listado que corresponda al capítulo de obra donde se presupuestaría esta pieza. Si dudas entre dos, elige el más específico; si ninguno encaja, devuelve null.
- Imágenes: te doy una lista numerada de candidatas. Elige por índice la mejor foto de producto y, si existe, una foto de ambiente distinta. No repitas el mismo índice en las dos.`

// ── Utilidades ────────────────────────────────────────────────────────────────

function recortarJsonLd(jsonLd: Record<string, unknown>[]): string {
  if (jsonLd.length === 0) return '(sin JSON-LD)'
  const texto = JSON.stringify(jsonLd, (key, value) =>
    key === 'image' || key === 'review' || key === 'aggregateRating' ? undefined : value
  )
  return texto.slice(0, 6_000)
}

function promptDesdeSenales(senales: SenalesProducto, catalogo: string): string {
  const imagenes = senales.imagenes.length
    ? senales.imagenes.map((u, i) => `[${i}] ${u}`).join('\n')
    : '(no se han encontrado imágenes en la página)'

  return `Ficha de producto a catalogar.

URL: ${senales.finalUrl}
Tienda: ${senales.sitio ?? '—'}
Título: ${senales.titulo ?? '—'}
Meta descripción: ${senales.descripcionMeta ?? '—'}

Datos estructurados (schema.org):
${recortarJsonLd(senales.jsonLd)}

Imágenes candidatas:
${imagenes}

Subcapítulos de nuestro presupuesto:
${catalogo}

Contenido de la página:
"""
${senales.texto}
"""`
}

interface FichaIA {
  nombre: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  acabados: string[]
  tags: string[]
  niveles_calidad: string[]
  subcapitulo_codigo: string | null
  precio: number | null
  precio_lleva_iva: boolean | null
  iva_pct: number | null
  precio_coste: number | null
  moneda: string
  imagen_producto_idx: number | null
  imagen_ambiente_idx: number | null
  notas_ia: string | null
}

function textoDeRespuesta(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' }, { status: 500 })
    }

    const body = await req.json().catch(() => null)
    const urlRaw = typeof body?.url === 'string' ? body.url : ''
    if (!urlRaw.trim()) return NextResponse.json({ error: 'Pega una URL de producto.' }, { status: 400 })

    const url = await assertPublicUrl(urlRaw)

    // Catálogo de subcapítulos, para que la IA elija uno válido
    const admin = createAdminClient()
    const [{ data: capitulos }, { data: subcapitulos }] = await Promise.all([
      admin.from('presupuesto_capitulos').select('id, numero, nombre').eq('activo', true).order('orden'),
      admin.from('presupuesto_subcapitulos').select('id, capitulo_id, codigo, nombre').eq('activo', true).order('orden'),
    ])
    if (!subcapitulos || subcapitulos.length === 0) {
      return NextResponse.json(
        { error: 'No hay subcapítulos cargados. Ejecuta la migración memorias_calidad_v2.sql.' },
        { status: 409 }
      )
    }
    const capituloPorId = new Map((capitulos ?? []).map(c => [c.id, c]))
    const catalogoTexto = subcapitulos
      .map(s => `${s.codigo} — ${capituloPorId.get(s.capitulo_id)?.nombre ?? '?'} › ${s.nombre}`)
      .join('\n')
    const schema = buildSchema(subcapitulos.map(s => s.codigo))

    // 1) Lectura propia de la página. 2) Si la web nos bloquea, que la lea Claude.
    let senales: SenalesProducto | null = null
    let fuente: 'html' | 'web_fetch' = 'html'
    let avisoFetch: string | null = null
    try {
      const { html, finalUrl } = await fetchHtml(url)
      senales = extraerSenales(html, finalUrl)
    } catch (err) {
      fuente = 'web_fetch'
      avisoFetch = err instanceof Error ? err.message : 'No se pudo leer la página.'
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: MODELO,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      messages: [
        {
          role: 'user',
          content: senales
            ? promptDesdeSenales(senales, catalogoTexto)
            : `Lee esta página de producto y cataloga la pieza: ${url.toString()}

No he podido descargar el HTML desde nuestro servidor (${avisoFetch}), así que usa la herramienta de fetch.
No tienes lista de imágenes candidatas: devuelve null en los dos índices de imagen y anótalo en notas_ia.

Subcapítulos de nuestro presupuesto:
${catalogoTexto}`,
        },
      ],
    }

    if (!senales) {
      params.tools = [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 }]
    }

    let message = await client.messages.create(params)
    // La herramienta de servidor puede pausar el turno; se reanuda reenviando el mismo hilo
    let reanudaciones = 0
    while (message.stop_reason === 'pause_turn' && reanudaciones < 3) {
      reanudaciones++
      message = await client.messages.create({
        ...params,
        messages: [...params.messages, { role: 'assistant', content: message.content }],
      })
    }

    if (message.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'La IA ha rechazado analizar esta página.' }, { status: 422 })
    }

    const texto = textoDeRespuesta(message)
    let ficha: FichaIA
    try {
      ficha = JSON.parse(texto)
    } catch {
      return NextResponse.json({ error: 'La IA no devolvió una ficha legible. Prueba otra vez o rellena a mano.' }, { status: 502 })
    }

    // Validación en servidor: nunca confiamos en los índices ni en el código recibido
    const candidatas = senales?.imagenes ?? []
    const idxValido = (i: number | null) => (i != null && Number.isInteger(i) && i >= 0 && i < candidatas.length ? i : null)
    const idxProducto = idxValido(ficha.imagen_producto_idx)
    let idxAmbiente = idxValido(ficha.imagen_ambiente_idx)
    if (idxAmbiente != null && idxAmbiente === idxProducto) idxAmbiente = null

    const subcapitulo = ficha.subcapitulo_codigo
      ? subcapitulos.find(s => s.codigo === ficha.subcapitulo_codigo) ?? null
      : null

    const validos = NIVELES.map(n => n.value) as string[]
    const niveles = Array.isArray(ficha.niveles_calidad)
      ? (Array.from(new Set(ficha.niveles_calidad.filter(n => validos.includes(n)))) as NivelCalidad[])
      : []

    // El precio de la web casi siempre viene con IVA: separamos base y total
    const ivaPct = typeof ficha.iva_pct === 'number' && ficha.iva_pct >= 0 && ficha.iva_pct <= 30
      ? ficha.iva_pct
      : IVA_DEFAULT
    const precio = typeof ficha.precio === 'number' ? ficha.precio : null
    // Sin indicación expresa asumimos precio con IVA (lo normal en tienda al público)
    const llevaIva = ficha.precio_lleva_iva !== false
    const precioBase = precio == null ? null : (llevaIva ? sinIva(precio, ivaPct) : precio)
    const precioConIva = precio == null ? null : (llevaIva ? precio : conIva(precio, ivaPct))

    return NextResponse.json({
      fuente,
      aviso: avisoFetch,
      candidatas,
      ficha: {
        nombre: ficha.nombre?.trim() || (senales?.titulo ?? ''),
        marca: ficha.marca?.trim() || null,
        modelo: ficha.modelo?.trim() || null,
        referencia: ficha.referencia?.trim() || null,
        descripcion: ficha.descripcion?.trim() || null,
        acabados: Array.isArray(ficha.acabados) ? ficha.acabados.filter(Boolean).slice(0, 20) : [],
        tags: Array.isArray(ficha.tags) ? ficha.tags.filter(Boolean).slice(0, 12) : [],
        niveles_calidad: niveles,
        subcapitulo_id: subcapitulo?.id ?? null,
        subcapitulo_codigo: subcapitulo?.codigo ?? null,
        precio_pvp: precioBase,
        precio_pvp_con_iva: precioConIva,
        iva_pct: ivaPct,
        precio_coste: typeof ficha.precio_coste === 'number' ? ficha.precio_coste : null,
        moneda: ficha.moneda || 'EUR',
        url_producto: senales?.finalUrl ?? url.toString(),
        imagen_producto_url: idxProducto != null ? candidatas[idxProducto] : null,
        imagen_ambiente_url: idxAmbiente != null ? candidatas[idxAmbiente] : null,
        notas_ia: ficha.notas_ia?.trim() || null,
      },
      uso: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    })
  } catch (err) {
    console.error('[warehouse/analizar-url]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado analizando la URL.' },
      { status: 500 }
    )
  }
}
