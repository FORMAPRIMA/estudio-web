import type { Proyecto, Propiedad, Tarea, Evento } from '@/lib/types'

export const proyectosMock: Proyecto[] = [
  {
    id: '1',
    nombre: 'Casa Montaña',
    ubicacion: 'Valle de Bravo, México',
    año: 2023,
    tipologia: 'Residencial',
    descripcion:
      'Residencia unifamiliar integrada en el paisaje boscoso de Valle de Bravo. El proyecto explora la relación entre la arquitectura y la naturaleza a través de materiales locales y grandes aperturas visuales hacia el bosque.',
    slug: 'casa-montana',
    estado: 'finalizado',
    cliente_id: 'c1',
    imagen_principal: '',
  },
  {
    id: '2',
    nombre: 'Boutique Hotel Cenote',
    ubicacion: 'Tulum, México',
    año: 2023,
    tipologia: 'Hospitalidad',
    descripcion:
      'Hotel boutique de 18 habitaciones diseñado alrededor de un cenote natural. La arquitectura dialoga con el entorno selvático mediante el uso de madera tropical, piedra caliza y techos de palapa contemporáneos.',
    slug: 'boutique-hotel-cenote',
    estado: 'finalizado',
    cliente_id: 'c2',
    imagen_principal: '',
  },
  {
    id: '3',
    nombre: 'Oficinas Coyoacán',
    ubicacion: 'Ciudad de México, México',
    año: 2022,
    tipologia: 'Comercial',
    descripcion:
      'Remodelación de una casona colonial del siglo XIX para albergar un espacio de trabajo creativo. El proyecto preserva los elementos históricos mientras introduce un programa contemporáneo de oficinas colaborativas.',
    slug: 'oficinas-coyoacan',
    estado: 'finalizado',
    cliente_id: 'c3',
    imagen_principal: '',
  },
  {
    id: '4',
    nombre: 'Apartamento Reforma',
    ubicacion: 'Ciudad de México, México',
    año: 2024,
    tipologia: 'Interiorismo',
    descripcion:
      'Interiorismo completo de un penthouse de 320m² en Paseo de la Reforma. Paleta de materiales en mármol travertino, latón y madera de roble. Diseño de mobiliario a medida para cada espacio.',
    slug: 'apartamento-reforma',
    estado: 'activo',
    cliente_id: 'c4',
    imagen_principal: '',
  },
  {
    id: '5',
    nombre: 'Restaurante Madera',
    ubicacion: 'Guadalajara, México',
    año: 2022,
    tipologia: 'Comercial',
    descripcion:
      'Diseño interior de restaurante con enfoque en la gastronomía de fuego. El espacio gira en torno a una cocina abierta con horno de leña, creando una experiencia inmersiva donde el fuego es el elemento central.',
    slug: 'restaurante-madera',
    estado: 'finalizado',
    cliente_id: 'c5',
    imagen_principal: '',
  },
  {
    id: '6',
    nombre: 'Casa Pedregal',
    ubicacion: 'Ciudad de México, México',
    año: 2024,
    tipologia: 'Residencial',
    descripcion:
      'Residencia de nueva construcción en el Pedregal de San Ángel. El proyecto se adapta a la topografía volcánica del terreno creando niveles aterrazados con jardines que descienden hasta una alberca desbordante.',
    slug: 'casa-pedregal',
    estado: 'en_construccion',
    cliente_id: 'c6',
    imagen_principal: '',
  },
  {
    id: '7',
    nombre: 'Spa Holístico',
    ubicacion: 'San Miguel de Allende, México',
    año: 2023,
    tipologia: 'Hospitalidad',
    descripcion:
      'Centro de bienestar y spa integrado en una hacienda del siglo XVIII. El proyecto de rehabilitación incorpora nuevos espacios de tratamientos, piscina de hidroterapia y jardín meditativo.',
    slug: 'spa-holistico',
    estado: 'finalizado',
    cliente_id: 'c7',
    imagen_principal: '',
  },
  {
    id: '8',
    nombre: 'Loft Industrial',
    ubicacion: 'Monterrey, México',
    año: 2023,
    tipologia: 'Interiorismo',
    descripcion:
      'Transformación de una antigua nave industrial en un loft residencial de dos plantas. La intervención conserva la estructura metálica original y los muros de ladrillo expuesto, contrastándolos con elementos contemporáneos.',
    slug: 'loft-industrial',
    estado: 'finalizado',
    cliente_id: 'c8',
    imagen_principal: '',
  },
  {
    id: '9',
    nombre: 'Clínica Dental Premium',
    ubicacion: 'Querétaro, México',
    año: 2024,
    tipologia: 'Comercial',
    descripcion:
      'Diseño de clínica dental de alto nivel con énfasis en la experiencia del paciente. Los espacios fueron concebidos para reducir la ansiedad clínica a través de materiales cálidos, iluminación cuidada y vistas a jardines interiores.',
    slug: 'clinica-dental-premium',
    estado: 'activo',
    cliente_id: 'c9',
    imagen_principal: '',
  },
]

export const propiedadesMock: Propiedad[] = [
  {
    id: 'p1',
    nombre: 'Penthouse Santa Fe',
    ubicacion: 'Santa Fe, Ciudad de México',
    precio: 18500000,
    descripcion:
      'Espectacular penthouse de 420m² con terraza privada de 180m², vistas panorámicas a la ciudad y acabados de primera línea. 3 recámaras en suite, sala de cine, bodega y 3 cajones de estacionamiento.',
    slug: 'penthouse-santa-fe',
    imagenes: [],
    disponible: true,
  },
  {
    id: 'p2',
    nombre: 'Casa Bosques',
    ubicacion: 'Bosques de las Lomas, Ciudad de México',
    precio: 32000000,
    descripcion:
      'Residencia de 650m² de construcción en terreno de 800m². 4 recámaras, sala de usos múltiples, jardín con alberca, cuarto de servicio y sistema domótico integral. Acabados europeos.',
    slug: 'casa-bosques',
    imagenes: [],
    disponible: true,
  },
  {
    id: 'p3',
    nombre: 'Departamento Polanco',
    ubicacion: 'Polanco, Ciudad de México',
    precio: 9800000,
    descripcion:
      'Departamento de 180m² en edificio boutique de 8 unidades. 2 recámaras master, estudio, terraza privada de 30m², cocina integral equipada y 2 cajones de estacionamiento.',
    slug: 'departamento-polanco',
    imagenes: [],
    disponible: false,
  },
]

export const equipoMock = [
  {
    id: 't1',
    nombre: 'Ana Lorena García',
    rol: 'Directora y Arquitecta Fundadora',
    bio: 'Arquitecta egresada de la UNAM con maestría en Diseño Arquitectónico por la AA School de Londres. 15 años de experiencia en proyectos residenciales y hospitalidad de lujo.',
  },
  {
    id: 't2',
    nombre: 'Carlos Mendoza',
    rol: 'Director de Proyectos',
    bio: 'Arquitecto por el Tec de Monterrey, especialidad en sustentabilidad por la TU Delft. Lidera el equipo técnico y la coordinación de obra en los proyectos del estudio.',
  },
  {
    id: 't3',
    nombre: 'Valentina Ruiz',
    rol: 'Directora de Interiorismo',
    bio: 'Diseñadora de interiores graduada del Centro de Diseño, Cine y Televisión. Especializada en el diseño de experiencias sensoriales para espacios residenciales y de hospitalidad.',
  },
]

export const tareasMock: Tarea[] = [
  {
    id: 'ta1',
    titulo: 'Revisión de planos estructurales Casa Pedregal',
    descripcion: 'Coordinar con ingeniero estructural los cambios solicitados por el cliente en nivel -1',
    proyecto_id: '6',
    asignado_a: 't2',
    estado: 'en_progreso',
    fecha_limite: '2024-04-15',
  },
  {
    id: 'ta2',
    titulo: 'Selección de materiales Apartamento Reforma',
    descripcion: 'Presentar muestrario de mármoles para cocina y baño principal al cliente',
    proyecto_id: '4',
    asignado_a: 't3',
    estado: 'pendiente',
    fecha_limite: '2024-04-10',
  },
  {
    id: 'ta3',
    titulo: 'Entrega de render virtual Clínica Dental',
    descripcion: 'Preparar recorrido virtual 360° de sala de espera y 3 consultorios para presentación',
    proyecto_id: '9',
    asignado_a: 't1',
    estado: 'completada',
    fecha_limite: '2024-03-28',
  },
]

export const eventosMock: Evento[] = [
  {
    id: 'e1',
    titulo: 'Presentación de diseño — Casa Pedregal',
    fecha: '2024-04-08T10:00:00',
    descripcion: 'Presentación del anteproyecto ejecutivo al cliente con recorrido virtual en VR',
    proyecto_id: '6',
  },
  {
    id: 'e2',
    titulo: 'Visita de obra — Clínica Dental Premium',
    fecha: '2024-04-12T09:00:00',
    descripcion: 'Supervisión mensual de avances con el constructor y reunión con el cliente',
    proyecto_id: '9',
  },
  {
    id: 'e3',
    titulo: 'Showroom de materiales — Apartamento Reforma',
    fecha: '2024-04-15T15:00:00',
    descripcion: 'Visita al showroom de Porcelanosa para selección final de revestimientos',
    proyecto_id: '4',
  },
]
