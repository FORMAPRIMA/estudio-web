// Correo de presentación que acompaña al enlace /para/<token>. Lo redacta el panel
// para que quien lo envía (business development) lo copie y lo mande desde su
// propio correo: llega de una persona, no de una plataforma. Puro (cliente y servidor).

import type { Idioma, Perfil } from './textos'

export interface DatosCorreo {
  nombre: string            // nombre de pila del contacto
  empresa: string
  perfil: Perfil
  idioma: Idioma
  tratamiento: 'tu' | 'usted'
  enlace: string
  mensaje?: string | null   // línea personal («Vimos vuestra torre en Polanco…»)
  firma: string             // quien envía
  /** España usa «vosotros» para el plural; el resto, «ustedes». */
  espana?: boolean
}

const POR_PERFIL = {
  es: {
    developer: 'cómo diseñamos producto residencial y las herramientas con las que lo ayudamos a vender',
    constructora: 'cómo trabajamos el diseño y el proyecto de ejecución para que la obra se construya sin dudas',
  },
  en: {
    developer: 'how we design residential product, and the tools we use to help sell it',
    constructora: 'how we handle design and construction documents so projects get built without guesswork',
  },
}

export function correoPresentacion(d: DatosCorreo): { asunto: string; cuerpo: string } {
  const extra = d.mensaje?.trim() ? `${d.mensaje.trim()}\n\n` : ''
  if (d.idioma === 'en') {
    return {
      asunto: `Forma Prima × ${d.empresa}`,
      cuerpo:
        `Hi ${d.nombre},\n\n${extra}` +
        `I'm ${d.firma}, from Forma Prima, an architecture and design studio based in Madrid with projects in Spain, the US, Mexico and Ecuador.\n\n` +
        `We've put together a short presentation for ${d.empresa}: ${POR_PERFIL.en[d.perfil]}. It takes five minutes and works on any phone:\n\n${d.enlace}\n\n` +
        `If it fits what you're working on, you can book a call at the end.\n\nBest regards,\n${d.firma}\nForma Prima · Architecture & Design`,
    }
  }
  const u = d.tratamiento === 'usted'
  return {
    asunto: `Forma Prima × ${d.empresa}`,
    cuerpo:
      `${u ? 'Buenos días' : 'Hola'}, ${d.nombre}:\n\n${extra}` +
      `Soy ${d.firma}, de Forma Prima, un estudio de arquitectura y diseño con sede en Madrid y proyectos en España, Estados Unidos, México y Ecuador.\n\n` +
      `Hemos preparado para ${d.empresa} una presentación breve: ${POR_PERFIL.es[d.perfil]}. ` +
      `Son cinco minutos y se ve bien en cualquier móvil:\n\n${d.enlace}\n\n` +
      `${!u && d.espana ? 'Si encaja con lo que tenéis entre manos, al final podéis reservar una llamada con nosotros.' : 'Si encaja con lo que tienen entre manos, al final pueden reservar una llamada con nosotros.'}\n\n` +
      `${u ? 'Un cordial saludo' : 'Un saludo'},\n${d.firma}\nForma Prima · Arquitectura y diseño`,
  }
}

export const enlacePara = (token: string) => `https://formaprima.es/para/${token}`
