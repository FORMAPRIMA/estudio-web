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
  /** Quien lo envía: firma el cierre (foto del equipo si la hay). */
  contacto: { nombre: string; cargo: string; email: string; foto: string | null }
}

/** Fotos del equipo por correo, para que el cierre lo firme una cara conocida. */
export const FOTO_EQUIPO: Record<string, string> = {
  'aalban@formaprima.es': '/para/equipo/team-ana-cristina.webp',
  'jlorag@formaprima.es': '/para/equipo/team-jose-lora.webp',
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
    lema: { developer: 'Arquitectura y diseño. Y las herramientas para venderlo.', constructora: 'Arquitectura y diseño. Y planos que se construyen sin dudas.' },
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

    estudioRotulo: 'El estudio',
    estudioTitulo: 'Arquitectura y diseño, de la primera idea a la entrega de llaves.',
    estudioTexto: 'Un estudio de Madrid que diseña el edificio completo: la arquitectura, el interiorismo y cada detalle constructivo. Un solo equipo de principio a fin, sin intermediarios.',
    estudioCifras: [
      { v: '+60', l: 'proyectos de arquitectura e interiorismo' },
      { v: '4', l: 'países · España, EE. UU., México y Ecuador' },
      { v: '1', l: 'equipo para todas las fases' },
    ],
    nucleo: {
      developer: 'Nuestro oficio es la arquitectura y el diseño. Las herramientas digitales existen para ayudar a venderlos.',
      constructora: 'Nuestro oficio es la arquitectura y el diseño, dibujados para que se construya exactamente lo proyectado.',
    },

    obraRotulo: 'Obra seleccionada',
    obraTitulo: 'Lo que dibujamos, construido.',
    obras: [
      { img: '/para/obra/cc38-salon.webp', nombre: 'Claudio Coello 38', lugar: 'Madrid', tipo: 'Residencial · 320 m²' },
      { img: '/para/obra/airapi-sala.webp', nombre: 'Airapi Memorial Park', lugar: 'Monterrey', tipo: 'Terciario · 2.300 m²' },
      { img: '/para/obra/mia-322-lounge.webp', nombre: '322 SW 18th Rd', lugar: 'Miami', tipo: 'Residencial · 260 m²' },
      { img: '/para/obra/nwl-fachada.webp', nombre: 'Colegio NWL', lugar: 'Querétaro', tipo: 'Educativo · 3.200 m²' },
      { img: '/para/obra/columela6-comedor.webp', nombre: 'Columela 6', lugar: 'Madrid', tipo: 'Residencial · 235 m²' },
      { img: '/para/obra/jade-fachada.webp', nombre: 'JADE Matcha Gallery', lugar: 'Madrid', tipo: 'Comercial' },
    ],
    desliza: 'Desliza',

    equipoRotulo: 'Equipo',
    equipoTitulo: 'Quién estará en el proyecto.',
    equipoTexto: 'Arquitectura, interiorismo y visualización en un mismo equipo, con los socios fundadores al frente de cada encargo.',
    personas: [
      { foto: '/para/equipo/team-jose-lora.webp', nombre: 'José Lora', cargo: 'Socio fundador · Arquitecto' },
      { foto: '/para/equipo/team-gabriela-hidalgo.webp', nombre: 'Gabriela Hidalgo', cargo: 'Socia fundadora · Arquitecta' },
      { foto: '/para/equipo/team-jose-antonio.webp', nombre: 'José Antonio', cargo: 'Director de proyectos · Arquitecto' },
      { foto: '/para/equipo/team-aitana.webp', nombre: 'Aitana', cargo: 'Arquitecta' },
      { foto: '/para/equipo/team-ariana.webp', nombre: 'Ariana', cargo: 'Diseñadora de interiores' },
      { foto: '/para/equipo/team-daniel.webp', nombre: 'Daniel', cargo: 'Arquitecto' },
      { foto: '/para/equipo/team-ana-cristina.webp', nombre: 'Ana Cristina', cargo: 'Desarrollo de negocio' },
    ],

    productoRotulo: 'Producto residencial',
    productoTitulo: 'Diseñamos producto que se vende.',
    productoPuntos: [
      { t: 'Tipologías y mix', d: 'El programa de viviendas que pide el mercado, con la superficie vendible optimizada desde el primer trazo.' },
      { t: 'Coste bajo control', d: 'Criterio constructivo y coste por metro cuadrado desde el anteproyecto, no al final.' },
      { t: 'Imagen que vende', d: 'Fachada, zonas comunes e interiores pensados para comercializar sobre plano.' },
    ],

    ejecucionRotulo: 'Proyecto de ejecución',
    ejecucionTitulo: 'Planos que se construyen sin dudas.',
    ejecucionCifra: 'láminas para una vivienda de 320 m²',
    ejecucionTexto: 'Cada encuentro, cada carpintería y cada mueble, dibujados antes de construir.',
    ejecucionPie: 'Claudio Coello 38 · Madrid · Proyecto de ejecución',

    portalRotulo: 'Portal de cliente',
    portalTitulo: 'Toda la obra, en un solo acceso.',
    portalTexto: 'Cronograma, actas de visita, documentación, decisiones y pagos, siempre al día y en el mismo sitio para el promotor, la constructora y el estudio.',
    portalPuntos: ['Cronograma y avance de obra', 'Actas, fotos y visitas', 'Planos y presupuestos, siempre la última versión', 'Aprobaciones registradas'],

    colaboracionRotulo: 'Colaboración',
    colaboracionTitulo: 'Un estudio que acompaña la obra.',
    colaboracionPuntos: [
      { t: 'Documentación para licitar', d: 'Mediciones y memoria de calidades para que las ofertas sean comparables desde el primer día.' },
      { t: 'Respuesta en obra', d: 'Visitas, actas y resolución de dudas de diseño durante toda la ejecución.' },
      { t: 'Promociones propias', d: 'Cuando la constructora promueve, diseñamos el producto y las herramientas para venderlo.' },
    ],

    dossierRotulo: 'Visual Lab · Dossier digital',
    dossierTitulo: 'Un dossier que el comprador recorre desde el móvil.',
    dossierTexto: 'Distribuciones, calidades, presupuesto y plazos en una presentación navegable. Cada comprador recibe su enlace y el equipo comercial sabe qué le interesa.',
    dossierPie: 'Ejemplo real · Casa Zurbano, Madrid',
    abrirDossier: 'Tocar para recorrerlo',

    vrRotulo: 'Visual Lab · Realidad virtual',
    vrTitulo: 'Decidir sobre el proyecto, no sobre la obra.',
    vrTexto: 'Recorridos en realidad virtual, estudios de soleamiento y renders para validar proporciones, vistas y materiales antes de construir.',
    sonido: 'Activar sonido',
    silencio: 'Silenciar',

    porqueRotulo: 'Por qué Forma Prima',
    porqueTitulo: 'Tres razones para hablar.',
    porque: {
      developer: [
        { t: 'Un solo equipo', d: 'Arquitectura, interiorismo y herramientas comerciales con la misma mano y el mismo criterio.' },
        { t: 'Producto pensado para vender', d: 'Cada decisión de diseño se mide en superficie vendible, coste y atractivo comercial.' },
        { t: 'Tecnología propia', d: 'Maquetas digitales, dossieres y salas de seguimiento desarrollados por el estudio.' },
      ],
      constructora: [
        { t: 'Planos que se construyen', d: 'Proyectos de ejecución hiperdefinidos: menos dudas en obra y menos sorpresas en el presupuesto.' },
        { t: 'Un interlocutor en obra', d: 'El mismo equipo que diseña acompaña la ejecución hasta la entrega.' },
        { t: 'Valor comercial añadido', d: 'Maquetas, dossieres y realidad virtual cuando la promoción hay que venderla.' },
      ],
    },

    hablemosRotulo: 'Siguiente paso',
    hablemosTitulo: (nombre: string) => `¿Hablamos, ${nombre}?`,
    hablemosTexto: (empresa: string) => `Una llamada de 30 minutos para conocer los proyectos de ${empresa} y ver cómo podemos ayudar. En ella enseñamos la versión completa.`,
    escribir: 'Escribir',
    web: 'Visitar formaprima.es',
  },
  en: {
    preparado: (empresa: string, fecha: string) => `Prepared for ${empresa} · ${fecha}`,
    hola: (nombre: string) => `${nombre}, this is`,
    marca: 'Forma Prima.',
    lema: { developer: 'Architecture and design. And the tools to sell it.', constructora: 'Architecture and design. And drawings that build without guesswork.' },
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

    estudioRotulo: 'The studio',
    estudioTitulo: 'Architecture and design, from the first idea to handover.',
    estudioTexto: 'A Madrid studio that designs the whole building: the architecture, the interiors and every construction detail. One team from start to finish, no intermediaries.',
    estudioCifras: [
      { v: '60+', l: 'architecture and interior projects' },
      { v: '4', l: 'countries · Spain, US, Mexico and Ecuador' },
      { v: '1', l: 'team for every phase' },
    ],
    nucleo: {
      developer: 'Our craft is architecture and design. The digital tools exist to help sell them.',
      constructora: 'Our craft is architecture and design, drawn so that what gets built is exactly what was designed.',
    },

    obraRotulo: 'Selected work',
    obraTitulo: 'What we draw, built.',
    obras: [
      { img: '/para/obra/cc38-salon.webp', nombre: 'Claudio Coello 38', lugar: 'Madrid', tipo: 'Residential · 320 m²' },
      { img: '/para/obra/airapi-sala.webp', nombre: 'Airapi Memorial Park', lugar: 'Monterrey', tipo: 'Commercial · 2,300 m²' },
      { img: '/para/obra/mia-322-lounge.webp', nombre: '322 SW 18th Rd', lugar: 'Miami', tipo: 'Residential · 260 m²' },
      { img: '/para/obra/nwl-fachada.webp', nombre: 'NWL School', lugar: 'Querétaro', tipo: 'Education · 3,200 m²' },
      { img: '/para/obra/columela6-comedor.webp', nombre: 'Columela 6', lugar: 'Madrid', tipo: 'Residential · 235 m²' },
      { img: '/para/obra/jade-fachada.webp', nombre: 'JADE Matcha Gallery', lugar: 'Madrid', tipo: 'Retail' },
    ],
    desliza: 'Swipe',

    equipoRotulo: 'Team',
    equipoTitulo: 'Who will be on the project.',
    equipoTexto: 'Architecture, interiors and visualisation in one team, with the founding partners leading every commission.',
    personas: [
      { foto: '/para/equipo/team-jose-lora.webp', nombre: 'José Lora', cargo: 'Founding partner · Architect' },
      { foto: '/para/equipo/team-gabriela-hidalgo.webp', nombre: 'Gabriela Hidalgo', cargo: 'Founding partner · Architect' },
      { foto: '/para/equipo/team-jose-antonio.webp', nombre: 'José Antonio', cargo: 'Project director · Architect' },
      { foto: '/para/equipo/team-aitana.webp', nombre: 'Aitana', cargo: 'Architect' },
      { foto: '/para/equipo/team-ariana.webp', nombre: 'Ariana', cargo: 'Interior designer' },
      { foto: '/para/equipo/team-daniel.webp', nombre: 'Daniel', cargo: 'Architect' },
      { foto: '/para/equipo/team-ana-cristina.webp', nombre: 'Ana Cristina', cargo: 'Business development' },
    ],

    productoRotulo: 'Residential product',
    productoTitulo: 'We design product that sells.',
    productoPuntos: [
      { t: 'Unit types and mix', d: 'The programme the market asks for, with saleable area optimised from the first sketch.' },
      { t: 'Cost under control', d: 'Construction logic and cost per square metre from concept design, not at the end.' },
      { t: 'An image that sells', d: 'Façade, amenities and interiors designed to sell off-plan.' },
    ],

    ejecucionRotulo: 'Construction documents',
    ejecucionTitulo: 'Drawings that build without guesswork.',
    ejecucionCifra: 'sheets for a 320 m² home',
    ejecucionTexto: 'Every junction, every window and every piece of joinery, drawn before it is built.',
    ejecucionPie: 'Claudio Coello 38 · Madrid · Construction documents',

    portalRotulo: 'Client portal',
    portalTitulo: 'The whole build, in one place.',
    portalTexto: 'Schedule, site reports, documents, decisions and payments, always up to date and in one place for the developer, the contractor and the studio.',
    portalPuntos: ['Schedule and progress', 'Site reports, photos and visits', 'Drawings and budgets, always the latest version', 'Logged approvals'],

    colaboracionRotulo: 'Collaboration',
    colaboracionTitulo: 'A studio that stays with the build.',
    colaboracionPuntos: [
      { t: 'Tender-ready documents', d: 'Quantities and specifications so bids are comparable from day one.' },
      { t: 'On-site response', d: 'Visits, reports and design answers throughout construction.' },
      { t: 'Own developments', d: 'When the contractor develops, we design the product and the tools to sell it.' },
    ],

    dossierRotulo: 'Visual Lab · Digital brochure',
    dossierTitulo: 'A brochure buyers explore from their phone.',
    dossierTexto: 'Layouts, finishes, budget and timeline in a presentation buyers navigate. Each buyer gets their own link and the sales team knows what they care about.',
    dossierPie: 'Real example · Casa Zurbano, Madrid',
    abrirDossier: 'Tap to explore it',

    vrRotulo: 'Visual Lab · Virtual reality',
    vrTitulo: 'Decide on the design, not on site.',
    vrTexto: 'Virtual reality walkthroughs, sunlight studies and renders to validate proportions, views and materials before building.',
    sonido: 'Sound on',
    silencio: 'Mute',

    porqueRotulo: 'Why Forma Prima',
    porqueTitulo: 'Three reasons to talk.',
    porque: {
      developer: [
        { t: 'One team', d: 'Architecture, interiors and sales tools by the same hands, with the same judgement.' },
        { t: 'Product designed to sell', d: 'Every design decision is weighed in saleable area, cost and market appeal.' },
        { t: 'Our own technology', d: 'Digital models, brochures and buyer rooms built in-house.' },
      ],
      constructora: [
        { t: 'Drawings that build', d: 'Highly detailed construction documents: fewer questions on site, fewer surprises in the budget.' },
        { t: 'One counterpart on site', d: 'The team that designs stays with construction until handover.' },
        { t: 'Added sales value', d: 'Models, brochures and virtual reality when the development needs selling.' },
      ],
    },

    hablemosRotulo: 'Next step',
    hablemosTitulo: (nombre: string) => `Shall we talk, ${nombre}?`,
    hablemosTexto: (empresa: string) => `A 30-minute call to learn about ${empresa}'s projects and see how we can help. That is where we show the full version.`,
    escribir: 'Write to',
    web: 'Visit formaprima.es',
  },
}

export type Textos = (typeof T)['es']
