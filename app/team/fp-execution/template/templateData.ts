import type { Presupuesto } from './types'

export const TEMPLATE_DEFAULT: Presupuesto = [
  // ─── 1. DEMOLICIONES Y TRABAJOS PREVIOS ────────────────────────────────────
  {
    id: 'c1',
    numero: 1,
    nombre: 'Demoliciones y trabajos previos',
    subcapitulos: [
      { id: 'c1-s1',  nombre: 'Tabiquería' },
      { id: 'c1-s2',  nombre: 'Ventanas' },
      { id: 'c1-s3',  nombre: 'Puertas' },
      { id: 'c1-s4',  nombre: 'Instalaciones - Fontanería / Saneamiento' },
      { id: 'c1-s5',  nombre: 'Instalaciones - Ventilación' },
      { id: 'c1-s6',  nombre: 'Instalaciones - Calefacción' },
      { id: 'c1-s7',  nombre: 'Instalaciones - A/C' },
      { id: 'c1-s8',  nombre: 'Instalaciones - ACS' },
      { id: 'c1-s9',  nombre: 'Instalaciones - Electricidad / Iluminación / Teleco' },
      { id: 'c1-s10', nombre: 'Instalaciones - Gas' },
      { id: 'c1-s11', nombre: 'Pavimentos y revestimientos' },
      { id: 'c1-s12', nombre: 'Armarios' },
      { id: 'c1-s13', nombre: 'Sanitarios y cocina' },
      { id: 'c1-s14', nombre: 'Falsos techos' },
      { id: 'c1-s15', nombre: 'Molduras y foseados' },
    ],
  },

  // ─── 2. ALBAÑILERÍA ────────────────────────────────────────────────────────
  {
    id: 'c2',
    numero: 2,
    nombre: 'Albañilería',
    subcapitulos: [
      { id: 'c2-s1', nombre: 'Trasdosados de Pladur / ladrillo' },
      { id: 'c2-s2', nombre: 'Tabiquería de Pladur' },
      { id: 'c2-s3', nombre: 'Trasdosados directos / guarnecidos de yeso' },
      { id: 'c2-s4', nombre: 'Falsos techos' },
      { id: 'c2-s5', nombre: 'Molduras y foseados' },
      { id: 'c2-s6', nombre: 'Soleras y rellenos' },
      { id: 'c2-s7', nombre: 'Ayudas de albañilería' },
    ],
  },

  // ─── 3. CARPINTERÍA METÁLICA Y VIDRIERÍA ───────────────────────────────────
  {
    id: 'c3',
    numero: 3,
    nombre: 'Carpintería metálica y vidriería',
    subcapitulos: [
      { id: 'c3-s1', nombre: 'Carpinterías metálicas / PVC' },
      { id: 'c3-s2', nombre: 'Vidriería' },
      { id: 'c3-s3', nombre: 'Persianas' },
      { id: 'c3-s4', nombre: 'Puertas divisorias suelo-techo' },
      { id: 'c3-s5', nombre: 'Mamparas' },
      { id: 'c3-s6', nombre: 'Espejos' },
    ],
  },

  // ─── 4. CARPINTERÍA DE MADERA ──────────────────────────────────────────────
  {
    id: 'c4',
    numero: 4,
    nombre: 'Carpintería de madera',
    subcapitulos: [
      { id: 'c4-s1', nombre: 'Puertas de acceso a vivienda' },
      { id: 'c4-s2', nombre: 'Puertas de paso abatibles' },
      { id: 'c4-s3', nombre: 'Puertas de paso correderas' },
      { id: 'c4-s4', nombre: 'Puertas divisorias suelo-techo' },
      { id: 'c4-s5', nombre: 'Armarios a medida' },
      { id: 'c4-s6', nombre: 'Armarios de baño' },
    ],
  },

  // ─── 5. INSTALACIONES ──────────────────────────────────────────────────────
  {
    id: 'c5',
    numero: 5,
    nombre: 'Instalaciones',
    subcapitulos: [
      { id: 'c5-s1', nombre: 'Fontanería y saneamiento' },
      { id: 'c5-s2', nombre: 'Ventilación' },
      { id: 'c5-s3', nombre: 'Calefacción' },
      { id: 'c5-s4', nombre: 'A/C' },
      { id: 'c5-s5', nombre: 'ACS' },
      { id: 'c5-s6', nombre: 'Electricidad' },
      { id: 'c5-s7', nombre: 'Iluminación' },
      { id: 'c5-s8', nombre: 'Telecomunicaciones' },
      { id: 'c5-s9', nombre: 'Gas' },
    ],
  },

  // ─── 6. PINTURAS, PAVIMENTOS Y REVESTIMIENTOS ──────────────────────────────
  {
    id: 'c6',
    numero: 6,
    nombre: 'Pinturas, pavimentos y revestimientos',
    subcapitulos: [
      { id: 'c6-s1', nombre: 'Pintura' },
      { id: 'c6-s2', nombre: 'Solados y alicatados' },
    ],
  },

  // ─── 7. EQUIPAMIENTO ───────────────────────────────────────────────────────
  {
    id: 'c7',
    numero: 7,
    nombre: 'Equipamiento',
    subcapitulos: [
      { id: 'c7-s1', nombre: 'Sanitarios' },
      { id: 'c7-s2', nombre: 'Griferías y accesorios' },
    ],
  },

  // ─── 8. COCINA ─────────────────────────────────────────────────────────────
  {
    id: 'c8',
    numero: 8,
    nombre: 'Cocina',
    subcapitulos: [
      { id: 'c8-s1', nombre: 'Mobiliario de cocina' },
      { id: 'c8-s2', nombre: 'Encimera, aplacado, fregadero y grifos' },
      { id: 'c8-s3', nombre: 'Electrodomésticos' },
    ],
  },

  // ─── 9. TERRAZA ────────────────────────────────────────────────────────────
  {
    id: 'c9',
    numero: 9,
    nombre: 'Terraza',
    subcapitulos: [
      { id: 'c9-s1', nombre: 'Pérgola' },
      { id: 'c9-s2', nombre: 'Barandilla' },
      { id: 'c9-s3', nombre: 'Paisajismo' },
      { id: 'c9-s4', nombre: 'Varios' },
    ],
  },

  // ─── 10. VARIOS ────────────────────────────────────────────────────────────
  {
    id: 'c10',
    numero: 10,
    nombre: 'Varios',
    subcapitulos: [
      { id: 'c10-s1', nombre: 'Varios' },
    ],
  },

  // ─── 11. GASTOS GENERALES ──────────────────────────────────────────────────
  {
    id: 'c11',
    numero: 11,
    nombre: 'Gastos generales',
    subcapitulos: [
      { id: 'c11-s1', nombre: 'Documentación y trámites' },
      { id: 'c11-s2', nombre: 'Tasas urbanísticas' },
      { id: 'c11-s3', nombre: 'Gestión de residuos' },
      { id: 'c11-s4', nombre: 'Seguridad y salud' },
      { id: 'c11-s5', nombre: 'Limpieza final de obra' },
    ],
  },
]
