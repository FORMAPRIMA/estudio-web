// Correo de presentación adaptado con IA. Quien envía (business development o un
// socio) cuenta en dos líneas qué sabe del lead y la IA reescribe el correo de
// plantilla (lib/para/correo.ts) a ese contexto, con un objetivo fijo: proponer
// buscar sinergias y colaborar, y para eso enseñar cómo trabajamos con el dossier.
// Solo servidor.
//
// Lo que no puede pasar, y por eso va en las reglas y se comprueba después:
//   · que invente datos (proyectos, cifras, clientes, premios) que no están aquí;
//   · que pierda o cambie el enlace personal;
//   · que cambie el idioma, el tú/usted o la firma.

import Anthropic from '@anthropic-ai/sdk'
import { correoPresentacion, type DatosCorreo } from './correo'

export const MODELO_CORREO = 'claude-opus-5-5'

const ESTUDIO = `
Forma Prima es un estudio de arquitectura y diseño con sede en Madrid. Diseña el edificio completo: arquitectura,
interiorismo y cada detalle constructivo, con un solo equipo de principio a fin y los socios fundadores (José Lora y
Gabriela Hidalgo, arquitectos) al frente de cada encargo. Más de 60 proyectos de arquitectura e interiorismo, con obra
en España (Madrid), Estados Unidos (Miami), México (Monterrey, Querétaro) y Ecuador (Guayaquil).
Para promotores: diseño de producto residencial (tipologías y mix, superficie vendible, coste por m² controlado desde
el anteproyecto, imagen que vende sobre plano) y FP Visual Lab, su área digital: maquetas 3D comerciales, dossieres
digitales para compradores, realidad virtual y portal de cliente.
Para constructoras: proyectos de ejecución hiperdetallados, para que no haya dudas al presupuestar ni durante la obra,
colaboración en obra y un portal de seguimiento compartido.
El enlace lleva a una presentación breve preparada para esa empresa (unos cinco minutos, pensada para el móvil) que
termina con una agenda para reservar una llamada.`.trim()

const ESQUEMA = {
  type: 'object',
  properties: {
    asunto: { type: 'string', description: 'Asunto del correo, breve y concreto.' },
    cuerpo: { type: 'string', description: 'Cuerpo completo en texto plano, con saludo, el enlace y la firma.' },
  },
  required: ['asunto', 'cuerpo'],
  additionalProperties: false,
} as const

export interface PeticionCorreo {
  datos: DatosCorreo
  cargo?: string | null
  pais?: string | null
  contexto: string
  /** Para iterar: el borrador actual y lo que se quiere cambiar de él. */
  borrador?: { asunto: string; cuerpo: string } | null
  cambio?: string | null
}

export async function adaptarCorreo(p: PeticionCorreo): Promise<{ asunto: string; cuerpo: string }> {
  const d = p.datos
  const base = correoPresentacion(d)
  const en = d.idioma === 'en'
  const trato = en ? 'inglés, registro profesional cercano'
    : d.tratamiento === 'usted' ? 'español, tratamiento de usted (y «ustedes» para la empresa)'
    : d.espana ? 'español de España, tuteo (y «vosotros» para la empresa)' : 'español, tuteo para la persona y «ustedes» para la empresa'

  const sistema = `Redactas correos de primer contacto para Forma Prima. Los envía una persona del estudio desde su propio correo a
alguien de una empresa (promotora o constructora) con quien queremos colaborar. Tienen que sonar escritos a mano por
esa persona: directos, cálidos y con criterio, nunca a plantilla comercial ni a marketing.

Qué sabemos del estudio (lo ÚNICO que puedes afirmar sobre Forma Prima):
${ESTUDIO}

Objetivo fijo del correo: decir que nos encantaría encontrar sinergias y colaborar con su empresa, y que para eso hemos
preparado una presentación para enseñarles cómo trabajamos. Una sola llamada a la acción: abrir el enlace (y, si
encaja, reservar la llamada al final).

Reglas:
- Idioma y trato: ${trato}. No lo cambies.
- Usa el contexto para que el correo sea de esa empresa y no de cualquiera: por qué ellos, qué hemos visto o en qué
  podríamos sumar. Si el contexto es escaso, no lo rellenes con suposiciones.
- La presentación es la misma para todas las empresas de su tipo, con su nombre y su logo: no digas que la hemos
  hecho a partir de lo que nos contaron ni que incluye algo «para ellos» en concreto.
- No inventes nada: ni proyectos, ni cifras, ni clientes, ni premios, ni datos de su empresa que no estén en el
  contexto. Si dudas de algo, no lo pongas.
- El enlace va exactamente así, solo en su propia línea: ${d.enlace}
- Firma exactamente así (tres líneas): ${d.firma} / Forma Prima / ${en ? 'Architecture & Design' : 'Arquitectura y diseño'}
- Entre 90 y 170 palabras. Párrafos cortos. Texto plano: sin markdown, sin viñetas, sin emojis, sin signos de
  exclamación en serie.
- No uses rayas ni guiones largos (— o –) para incisos: usa comas, dos puntos o frases separadas.
- Nada de fórmulas vacías («espero que estés bien», «me pongo en contacto contigo para…», «líderes del sector»,
  «soluciones integrales», «sinergias» repetido). Di «sinergias» como mucho una vez.
- Asunto breve, sin mayúsculas de reclamo. Puede seguir el patrón «Forma Prima × ${d.empresa}» o ser más concreto si el
  contexto lo da.`

  const lead = [
    `Persona: ${d.nombre}${p.cargo ? `, ${p.cargo}` : ''}`,
    `Empresa: ${d.empresa}${p.pais ? ` (${p.pais})` : ''}`,
    `Tipo: ${d.perfil === 'developer' ? 'promotora / developer' : 'constructora'}`,
  ].join('\n')

  const mensajes: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Datos del lead:\n${lead}\n\nContexto que da quien envía:\n${p.contexto}\n\n` +
      `Correo de plantilla del que partir (respeta su información y su enlace, mejora todo lo demás):\n` +
      `Asunto: ${base.asunto}\n\n${base.cuerpo}`,
  }]
  if (p.borrador && p.cambio?.trim()) {
    mensajes.push({ role: 'assistant', content: JSON.stringify(p.borrador) })
    mensajes.push({ role: 'user', content: `Ajusta ese borrador: ${p.cambio.trim()}\nMantén todas las reglas.` })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3 })
  const r = await client.messages.create({
    model: MODELO_CORREO,
    max_tokens: 2000,
    system: sistema,
    messages: mensajes,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming)
  const texto = r.content.find((b) => b.type === 'text')
  if (!texto || texto.type !== 'text') throw new Error('La IA no ha devuelto el correo.')
  const out = JSON.parse(texto.text) as { asunto: string; cuerpo: string }

  // Red de seguridad: el enlace es lo único que no puede faltar ni cambiar.
  let cuerpo = out.cuerpo.trim().replace(/\s[—–]\s/g, ', ')
  if (!cuerpo.includes(d.enlace)) cuerpo = cuerpo.replace(/https?:\/\/\S*formaprima\.es\/para\/\S*/g, d.enlace)
  if (!cuerpo.includes(d.enlace)) throw new Error('La IA ha perdido el enlace. Vuelve a intentarlo.')
  return { asunto: out.asunto.trim().slice(0, 160), cuerpo }
}
