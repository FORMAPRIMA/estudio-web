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
    mapaTitulo: 'Proyectos en cuatro países.',
    mapaSub: 'Este es el mapa de nuestra obra.',
    mapaAterriza: 'Toca un punto para ver cada proyecto.',
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
    maquetaTitulo: 'Así es una maqueta digital comercial.',
    maquetaTexto: 'Un ejemplo de las que preparamos para cada promoción: el comprador ve el estado, el precio y la luz de cada vivienda, y el equipo comercial la actualiza en directo.',
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
      { img: '/para/obra/cc38-real.webp', nombre: 'Claudio Coello 38', lugar: 'Madrid', tipo: 'Residencial · 320 m²' },
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
    acompanamos: {
      developer: 'Acompañamos a cada promotor a mejorar su proceso de venta.',
      constructora: 'Acompañamos a cada constructora a mejorar su proceso de construcción.',
    },
    vlRotulo: 'FP Visual Lab',
    vlTitulo: 'Nuestro laboratorio digital y comercial.',
    vlTexto: 'Un área del estudio que desarrolla las herramientas con las que nuestros clientes venden y siguen sus proyectos. A continuación, un ejemplo de cada una.',
    vlHerramientas: [
      { t: 'Maquetas digitales comerciales', d: 'Cada vivienda con su estado, su precio y su luz, en 3D.' },
      { t: 'Dossieres digitales', d: 'El proyecto explicado en una aplicación para cada comprador.' },
      { t: 'Realidad virtual', d: 'Recorrer el proyecto antes de construirlo.' },
      { t: 'Portal de cliente', d: 'El seguimiento de la obra, en un solo acceso.' },
      { t: 'Salas de seguimiento', d: 'Saber qué le interesa a cada comprador.' },
    ],
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
    portalTitulo: 'Un portal único para cada cliente.',
    portalTexto: 'Nuestra aplicación de seguimiento: cada cliente ve su obra al día, con el cronograma, las actas de visita, los documentos, las decisiones y los pagos.',
    portalVideoTitulo: 'El portal, por dentro.',
    portalVideoTexto: 'Así siguen la obra el promotor y la constructora, de la primera acta a la entrega.',
    verVideo: 'Ver el vídeo', conSonido: 'con sonido', pausa: 'Pausa', seguirVideo: 'Seguir',
    cargar3d: 'Cargar la maqueta 3D',
    portalPuntos: ['Cronograma y avance de obra', 'Actas, fotos y visitas', 'Planos y presupuestos, siempre la última versión', 'Aprobaciones registradas'],

    colaboracionRotulo: 'Colaboración',
    colaboracionTitulo: 'Un estudio que acompaña la obra.',
    colaboracionPuntos: [
      { t: 'Documentación para licitar', d: 'Mediciones y memoria de calidades para que las ofertas sean comparables desde el primer día.' },
      { t: 'Respuesta en obra', d: 'Visitas, actas y resolución de dudas de diseño durante toda la ejecución.' },
      { t: 'Promociones propias', d: 'Cuando la constructora promueve, diseñamos el producto y las herramientas para venderlo.' },
    ],

    dossierRotulo: 'Visual Lab · Dossier digital',
    dossierTitulo: 'Dossieres digitales: el proyecto, en una aplicación.',
    dossierTexto: 'Para cada proyecto preparamos una presentación navegable —distribuciones, calidades, presupuesto y plazos— que el comprador abre en su móvil. Cada uno recibe su enlace y el equipo comercial sabe qué le interesa.',
    dossierPie: 'Ejemplo real · Casa Zurbano, Madrid',
    abrirDossier: 'Abrir el ejemplo',

    vrRotulo: 'Visual Lab · Realidad virtual',
    vrTitulo: 'Realidad virtual aplicada a nuestros proyectos.',
    vrTexto: 'Recorridos en realidad virtual, estudios de soleamiento y renders para validar proporciones, vistas y materiales antes de construir.',
    sonido: 'Sonido',
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
    agendaTitulo: 'Elige un momento para la llamada',
    agendaZona: (zona: string) => `Horas en tu zona · ${zona}`,
    agendaMin: (m: number) => `${m} min`,
    agendaEmail: 'Correo para la invitación',
    agendaEmailPh: 'tu@empresa.com · opcional',
    agendaNota: '¿Algo que debamos saber? (opcional)',
    agendaReservar: 'Reservar la llamada',
    agendaReservando: 'Reservando…',
    agendaNinguna: 'Ninguna me va bien',
    agendaOtra: 'Cuéntanos qué días u horas te vienen mejor',
    agendaEnviar: 'Enviar',
    agendaVolver: 'Volver a las horas',
    agendaHecho: 'Llamada reservada.',
    agendaHechoTexto: (quien: string) => `${quien} te escribirá con el enlace de la videollamada.`,
    agendaPropuesta: 'Recibido.',
    agendaPropuestaTexto: (quien: string) => `${quien} te escribirá para cerrar la fecha.`,
    agendaCalendario: 'Añadir a mi calendario',
    agendaCambiar: 'Cambiar la hora',
    agendaMuestra: 'Muestra: aquí no se reserva.',

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
    mapaTitulo: 'Projects in four countries.',
    mapaSub: 'This is the map of our work.',
    mapaAterriza: 'Tap a point to see each project.',
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
    maquetaTitulo: 'This is a commercial digital model.',
    maquetaTexto: 'An example of the ones we build for each development: buyers see the status, price and light of every home, and the sales team updates it live.',
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
      { img: '/para/obra/cc38-real.webp', nombre: 'Claudio Coello 38', lugar: 'Madrid', tipo: 'Residential · 320 m²' },
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
    acompanamos: {
      developer: 'We help every developer improve how they sell.',
      constructora: 'We help every contractor improve how they build.',
    },
    vlRotulo: 'FP Visual Lab',
    vlTitulo: 'Our digital and sales lab.',
    vlTexto: 'A part of the studio that builds the tools our clients use to sell and follow their projects. An example of each follows.',
    vlHerramientas: [
      { t: 'Commercial digital models', d: 'Every home with its status, price and light, in 3D.' },
      { t: 'Digital brochures', d: 'The project explained in an app for each buyer.' },
      { t: 'Virtual reality', d: 'Walk the project before it is built.' },
      { t: 'Client portal', d: 'Following the build, in one place.' },
      { t: 'Buyer rooms', d: 'Knowing what each buyer cares about.' },
    ],
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
    portalTitulo: 'A dedicated portal for every client.',
    portalTexto: 'Our tracking app: every client follows their build up to date, with the schedule, site reports, documents, decisions and payments.',
    portalVideoTitulo: 'The portal, from the inside.',
    portalVideoTexto: 'How developer and contractor follow the build, from the first site report to handover.',
    verVideo: 'Watch the video', conSonido: 'with sound', pausa: 'Pause', seguirVideo: 'Resume',
    cargar3d: 'Load the 3D model',
    portalPuntos: ['Schedule and progress', 'Site reports, photos and visits', 'Drawings and budgets, always the latest version', 'Logged approvals'],

    colaboracionRotulo: 'Collaboration',
    colaboracionTitulo: 'A studio that stays with the build.',
    colaboracionPuntos: [
      { t: 'Tender-ready documents', d: 'Quantities and specifications so bids are comparable from day one.' },
      { t: 'On-site response', d: 'Visits, reports and design answers throughout construction.' },
      { t: 'Own developments', d: 'When the contractor develops, we design the product and the tools to sell it.' },
    ],

    dossierRotulo: 'Visual Lab · Digital brochure',
    dossierTitulo: 'Digital brochures: the project, as an app.',
    dossierTexto: 'For each project we build a presentation buyers navigate on their phone — layouts, finishes, budget and timeline. Each one gets their own link and the sales team knows what they care about.',
    dossierPie: 'Real example · Casa Zurbano, Madrid',
    abrirDossier: 'Open the example',

    vrRotulo: 'Visual Lab · Virtual reality',
    vrTitulo: 'Virtual reality applied to our projects.',
    vrTexto: 'Virtual reality walkthroughs, sunlight studies and renders to validate proportions, views and materials before building.',
    sonido: 'Sound',
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
    agendaTitulo: 'Pick a time for the call',
    agendaZona: (zona: string) => `Times in your zone · ${zona}`,
    agendaMin: (m: number) => `${m} min`,
    agendaEmail: 'Email for the invitation',
    agendaEmailPh: 'you@company.com · optional',
    agendaNota: 'Anything we should know? (optional)',
    agendaReservar: 'Book the call',
    agendaReservando: 'Booking…',
    agendaNinguna: 'None of these work',
    agendaOtra: 'Tell us which days or times suit you',
    agendaEnviar: 'Send',
    agendaVolver: 'Back to times',
    agendaHecho: 'Call booked.',
    agendaHechoTexto: (quien: string) => `${quien} will write to you with the video call link.`,
    agendaPropuesta: 'Received.',
    agendaPropuestaTexto: (quien: string) => `${quien} will write to you to set the date.`,
    agendaCalendario: 'Add to my calendar',
    agendaCambiar: 'Change the time',
    agendaMuestra: 'Sample: booking is disabled here.',

    web: 'Visit formaprima.es',
  },
}

export type Textos = (typeof T)['es']
