// Web pública — registro de bloques editables (el "contrato" del CMS).
//
// El editor de /team/marketing/web-publica renderiza los campos a partir de ESTE
// registro (etiqueta + tipo + ayuda), no de filas arbitrarias de BD. Las páginas
// del sitio leen los mismos (pagina, seccion, clave) para pintar el contenido.
// Así el equipo edita con formularios amigables y el código sabe qué espera.
//
// Se amplía por página según vamos construyendo cada una (Home, Estudio, ...).

import type { ContentTipo } from '@/lib/web-publica'

export interface ContentField {
  clave:      string
  label:      string
  tipo:       ContentTipo
  hint?:      string
  /** ¿Se ofrece override de móvil para este campo? (default: true) */
  mobileable?: boolean
}

export interface ContentSection {
  seccion: string
  label:   string
  hint?:   string
  fields:  ContentField[]
}

export interface PageSchema {
  pagina:   string
  label:    string
  /** Ruta pública para el enlace "ver en la web" (cuando exista). */
  preview?: string
  sections: ContentSection[]
}

export const CONTENT_SCHEMA: PageSchema[] = [
  {
    pagina: 'home',
    label:  'Home',
    preview: '/',
    sections: [
      {
        seccion: 'intro',
        label:   'Vídeo de intro',
        hint:    'Se reproduce al entrar; se desvanece con doble clic/tap y no reaparece en la sesión.',
        fields: [
          { clave: 'video',  label: 'Vídeo widescreen', tipo: 'video', hint: 'MP4 horizontal. Se sube al bucket web-publica.' },
          { clave: 'poster', label: 'Póster (primer frame)', tipo: 'imagen', hint: 'Imagen que se ve mientras carga el vídeo. Importante para rendimiento y SEO.' },
          { clave: 'activo', label: '¿Mostrar vídeo de intro?', tipo: 'texto', hint: 'Escribe "si" para activarlo o "no" para saltar directo a la home.', mobileable: false },
        ],
      },
      {
        seccion: 'hero',
        label:   'Portada',
        hint:    'Por defecto la Home es SOLO imagen widescreen: el texto central está oculto y el pie con el nombre del proyecto sí se ve. El texto sigue guardado aunque no se muestre.',
        fields: [
          { clave: 'mostrar_texto', label: '¿Mostrar el texto central sobre la imagen?', tipo: 'texto', hint: 'Escribe "si" para que aparezcan antetítulo, titular y subtítulo. Vacío o "no" = solo imagen.', mobileable: false },
          { clave: 'eyebrow',  label: 'Antetítulo', tipo: 'texto' },
          { clave: 'titulo',   label: 'Titular',    tipo: 'texto' },
          { clave: 'subtitulo',label: 'Subtítulo',  tipo: 'texto' },
          { clave: 'mostrar_pie', label: '¿Mostrar el pie con el proyecto?', tipo: 'texto', hint: 'El "01 / 10 · NOMBRE · UBICACIÓN" de la esquina inferior izquierda. Se muestra salvo que escribas "no".', mobileable: false },
        ],
      },
    ],
  },
  {
    pagina: 'estudio',
    label:  'Estudio',
    preview: '/preview/estudio',
    sections: [
      {
        seccion: 'hero',
        label:   'Imagen del equipo (widescreen)',
        hint:    'Se ve a pantalla completa al entrar; al hacer scroll aparece el grid del equipo.',
        fields: [
          { clave: 'imagen',  label: 'Imagen widescreen', tipo: 'imagen', hint: 'Foto horizontal del equipo.' },
          { clave: 'eyebrow', label: 'Antetítulo',        tipo: 'texto' },
          { clave: 'titulo',  label: 'Titular',           tipo: 'texto' },
        ],
      },
      {
        seccion: 'equipo',
        label:   'Sección equipo',
        hint:    'Encabezado sobre el grid. Los integrantes se editan en la tab «Equipo».',
        fields: [
          { clave: 'eyebrow', label: 'Antetítulo', tipo: 'texto' },
          { clave: 'titulo',  label: 'Titular',    tipo: 'texto' },
          { clave: 'intro',   label: 'Introducción', tipo: 'rich' },
        ],
      },
    ],
  },
  {
    pagina: 'proyectos',
    label:  'Proyectos',
    preview: '/preview/proyectos',
    sections: [
      {
        seccion: 'hero',
        label:   'Encabezado de la parrilla',
        hint:    'Cada proyecto (con su ficha, fotos y planos) se edita en la tab «Proyectos».',
        fields: [
          { clave: 'eyebrow', label: 'Antetítulo', tipo: 'texto' },
          { clave: 'titulo',  label: 'Titular',    tipo: 'texto' },
          { clave: 'intro',   label: 'Introducción', tipo: 'rich' },
        ],
      },
    ],
  },
  {
    pagina: 'fp_tools',
    label:  'FP Tools',
    preview: '/preview/fp-tools',
    sections: [
      {
        seccion: 'hero',
        label:   'Encabezado',
        hint:    'Cada capacidad (Visual Lab, Urban Analyst…) se edita en la tab «FP Tools».',
        fields: [
          { clave: 'eyebrow', label: 'Antetítulo', tipo: 'texto' },
          { clave: 'titulo',  label: 'Titular',    tipo: 'texto' },
          { clave: 'intro',   label: 'Introducción', tipo: 'rich' },
        ],
      },
    ],
  },
  {
    pagina: 'real_estate',
    label:  'Real Estate',
    preview: '/preview/real-estate',
    sections: [
      {
        seccion: 'hero',
        label:   'Encabezado',
        hint:    'Las propiedades se editan en la tab «Real Estate».',
        fields: [
          { clave: 'eyebrow', label: 'Antetítulo', tipo: 'texto' },
          { clave: 'titulo',  label: 'Titular',    tipo: 'texto' },
          { clave: 'intro',   label: 'Introducción', tipo: 'rich' },
        ],
      },
      {
        seccion: 'modelo',
        label:   'Cómo trabajamos',
        hint:    'Explica el modelo (asesoría al comprador, comisión del vendedor).',
        fields: [
          { clave: 'titulo', label: 'Título', tipo: 'texto' },
          { clave: 'texto',  label: 'Texto',  tipo: 'rich' },
        ],
      },
    ],
  },
  {
    pagina: 'contacto',
    label:  'Contacto',
    preview: '/preview/contacto',
    sections: [
      {
        seccion: 'hero',
        label:   'Encabezado',
        fields: [
          { clave: 'eyebrow', label: 'Antetítulo', tipo: 'texto' },
          { clave: 'titulo',  label: 'Titular',    tipo: 'texto' },
          { clave: 'intro',   label: 'Introducción', tipo: 'rich' },
        ],
      },
      {
        seccion: 'confianza',
        label:   'Confianza (lo que hace que escriban)',
        hint:    'Lo que se lee al lado del formulario. Un compromiso concreto convierte mucho más que un «te responderemos pronto».',
        fields: [
          { clave: 'quien',     label: 'Quién responde',        tipo: 'texto', hint: 'Ej.: «Te responde Ana Cristina, de nuestro equipo.» Poner nombre y cara humaniza y sube la conversión.' },
          { clave: 'respuesta', label: 'Compromiso de respuesta', tipo: 'texto', hint: 'Ej.: «Respondemos en menos de 24 h laborables.» Sale junto al botón de enviar: prométe solo lo que se cumpla.' },
          { clave: 'prueba_1',  label: 'Prueba 1',              tipo: 'texto', hint: 'Dato concreto: proyectos entregados, m² gestionados, años de estudio…' },
          { clave: 'prueba_2',  label: 'Prueba 2',              tipo: 'texto' },
          { clave: 'prueba_3',  label: 'Prueba 3',              tipo: 'texto' },
        ],
      },
      {
        seccion: 'datos',
        label:   'Datos de contacto',
        hint:    'Se muestran junto al formulario.',
        fields: [
          { clave: 'email',     label: 'Email',      tipo: 'texto', mobileable: false },
          { clave: 'telefono',  label: 'Teléfono',   tipo: 'texto', mobileable: false },
          { clave: 'direccion', label: 'Dirección',  tipo: 'texto' },
          { clave: 'horario',   label: 'Horario',    tipo: 'texto' },
        ],
      },
    ],
  },
]

export function getPageSchema(pagina: string): PageSchema | undefined {
  return CONTENT_SCHEMA.find((p) => p.pagina === pagina)
}

/** Todas las (seccion, clave) declaradas para una página. */
export function pageFieldKeys(pagina: string): { seccion: string; clave: string; tipo: ContentTipo }[] {
  const p = getPageSchema(pagina)
  if (!p) return []
  return p.sections.flatMap((s) => s.fields.map((f) => ({ seccion: s.seccion, clave: f.clave, tipo: f.tipo })))
}
