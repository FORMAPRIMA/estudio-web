// Textos del dossier de prospección (formaprima.es/para/<token>), en los dos
// idiomas. Lo personal (nombre, empresa) entra por parámetro: nada de esto sale
// de la base de datos.

export type Idioma = 'es' | 'en'
export type Perfil = 'developer' | 'constructora'

/** A quién va el dossier. En la muestra son datos de ejemplo. */
export interface LeadPara {
  nombre: string
  empresa: string
  perfil: Perfil
  idioma: Idioma
  /** Logo del lead ya listo para fondo oscuro; null = su nombre en texto. */
  logo: string | null
}

const MESES = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

export const mesAnio = (d: Date, l: Idioma) => `${MESES[l][d.getMonth()]} ${d.getFullYear()}`

export const T = {
  es: {
    preparado: (empresa: string, fecha: string) => `Preparado para ${empresa} · ${fecha}`,
    hola: (nombre: string) => `${nombre}, esto es`,
    marca: 'Forma Prima.',
    lema: 'Arquitectura y diseño. Y las herramientas para venderlo.',
    bajar: 'Desliza para empezar',
    idioma: 'English',

    mapaRotulo: 'Obra',
    mapaTitulo: 'Más de 60 proyectos en cuatro países.',
    mapaAterriza: 'Y la mayoría, a pocas calles de nuestro estudio en Madrid.',
    paises: [
      { pais: 'España', ciudad: 'Madrid' },
      { pais: 'Estados Unidos', ciudad: 'Miami' },
      { pais: 'México', ciudad: 'Monterrey · Querétaro' },
      { pais: 'Ecuador', ciudad: 'Guayaquil' },
    ],
    obrasEnMadrid: 'obras en el mapa',
    explorarMapa: 'Explorar el mapa',
    tocaObra: 'Toca una obra para verla',
    verProyecto: 'Ver proyecto',

    maquetaRotulo: 'Visual Lab · Maqueta digital',
    maquetaTitulo: 'Una torre que se vende antes de construirse.',
    maquetaTexto: 'Cada vivienda con su estado, su precio y su luz, en una maqueta que el comprador recorre desde el móvil y el equipo comercial actualiza en directo.',
    sello: 'Demostración · datos de ejemplo',
    proyectoMaqueta: 'Méndez Álvaro 32 · Madrid',
    modos: { disponibilidad: 'Disponibilidad', plantas: 'Plantas', asoleamiento: 'Luz', vista: 'Vista' } as Record<string, string>,
    explorarMaqueta: 'Explorar la maqueta',
    tocaVivienda: 'Toca una vivienda',
    disponibles: 'disponibles',
    viviendas: 'viviendas',
    dorm: 'dorm.',
    ficha: { planta: 'Planta', superficie: 'Útiles', dorm: 'Dormitorios', orientacion: 'Orientación', precio: 'Precio' },
    estados: { disponible: 'Disponible', negociacion: 'En negociación', reservada: 'Reservada', vendida: 'Vendida', piloto: 'Piso piloto' } as Record<string, string>,

    cerrar: 'Seguir',
    arrastra: 'Arrastra para girar',
  },
  en: {
    preparado: (empresa: string, fecha: string) => `Prepared for ${empresa} · ${fecha}`,
    hola: (nombre: string) => `${nombre}, this is`,
    marca: 'Forma Prima.',
    lema: 'Architecture and design. And the tools to sell it.',
    bajar: 'Scroll to begin',
    idioma: 'Español',

    mapaRotulo: 'Work',
    mapaTitulo: 'Over 60 projects in four countries.',
    mapaAterriza: 'Most of them a few streets from our studio in Madrid.',
    paises: [
      { pais: 'Spain', ciudad: 'Madrid' },
      { pais: 'United States', ciudad: 'Miami' },
      { pais: 'Mexico', ciudad: 'Monterrey · Querétaro' },
      { pais: 'Ecuador', ciudad: 'Guayaquil' },
    ],
    obrasEnMadrid: 'projects on the map',
    explorarMapa: 'Explore the map',
    tocaObra: 'Tap a project to see it',
    verProyecto: 'View project',

    maquetaRotulo: 'Visual Lab · Digital model',
    maquetaTitulo: 'A tower that sells before it is built.',
    maquetaTexto: 'Every home with its status, price and light, in a model buyers explore from their phone and the sales team updates live.',
    sello: 'Demo · sample data',
    proyectoMaqueta: 'Méndez Álvaro 32 · Madrid',
    modos: { disponibilidad: 'Availability', plantas: 'Floors', asoleamiento: 'Light', vista: 'View' } as Record<string, string>,
    explorarMaqueta: 'Explore the model',
    tocaVivienda: 'Tap a home',
    disponibles: 'available',
    viviendas: 'homes',
    dorm: 'bed',
    ficha: { planta: 'Floor', superficie: 'Interior', dorm: 'Bedrooms', orientacion: 'Facing', precio: 'Price' },
    estados: { disponible: 'Available', negociacion: 'In negotiation', reservada: 'Reserved', vendida: 'Sold', piloto: 'Show flat' } as Record<string, string>,

    cerrar: 'Continue',
    arrastra: 'Drag to rotate',
  },
}

export type Textos = (typeof T)['es']
