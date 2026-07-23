// Modelo Café Goya — CAPEX de equipamiento.
// Lista de equipamiento específico para abrir la cafetería to-go de Goya 63,
// con precios de mercado (visita de campo + búsqueda, julio 2026) y posibles
// links de compra. Editable en la tab CAPEX; se persiste en localStorage.

export type CapexEstado = 'nuevo' | 'usado'

export type CapexItem = {
  id: string
  categoria: string
  concepto: string
  marca: string
  estado: CapexEstado
  cantidad: number
  precio: number        // € por unidad
  link: string
  nota: string
}

export const CATEGORIAS = [
  'Extracción de café',
  'Frío y conservación',
  'Agua',
  'Barra y servicio',
] as const

/** Sanea items venidos de BD/cliente (jsonb): descarta basura y completa campos. */
export function normalizeCapexItems(raw: unknown): CapexItem[] {
  if (!Array.isArray(raw)) return []
  const num = (x: unknown, def = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : def)
  const str = (x: unknown, def = '') => (typeof x === 'string' ? x : def)
  return raw.map((r, idx) => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
    return {
      id: str(o.id) || `item-${idx}`,
      categoria: str(o.categoria, 'Otros') || 'Otros',
      concepto: str(o.concepto),
      marca: str(o.marca),
      estado: o.estado === 'usado' ? 'usado' : 'nuevo',
      cantidad: num(o.cantidad, 1),
      precio: num(o.precio, 0),
      link: str(o.link),
      nota: str(o.nota),
    }
  })
}

export const capexSubtotal = (i: CapexItem) => i.cantidad * i.precio
export const capexTotal = (items: CapexItem[]) => items.reduce((a, i) => a + capexSubtotal(i), 0)

export const totalPorCategoria = (items: CapexItem[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const i of items) out[i.categoria] = (out[i.categoria] ?? 0) + capexSubtotal(i)
  return out
}

// Precios orientativos en €, IVA aparte salvo indicación; contrastar con proveedor.
export const CAPEX_DEFAULT: CapexItem[] = [
  // ── Extracción de café ──
  {
    id: 'lamarzocco', categoria: 'Extracción de café',
    concepto: 'Máquina espresso 2 grupos', marca: 'La Marzocco Linea Classic (2 gr.)',
    estado: 'usado', cantidad: 1, precio: 9000,
    link: 'https://www.lamarzocco.com/es/es/productos-comerciales/maquinas-de-espresso/linea-classic-s/',
    nota: '2ª mano en buen estado (objetivo < 12.000 €). Buscar en Wallapop/Milanuncios o distribuidor con revisión y garantía.',
  },
  {
    id: 'molino1', categoria: 'Extracción de café',
    concepto: 'Molino de espresso (negro)', marca: 'Mahlkönig E65S',
    estado: 'nuevo', cantidad: 2, precio: 2350,
    link: 'https://www.complementosdelcafe.com/en/electric-grinders/mahlkonig-e65s-electric-grinder',
    nota: 'Uno para el café principal y otro para descafeinado / segundo origen.',
  },
  {
    id: 'marco', categoria: 'Extracción de café',
    concepto: 'Brewer de precisión / lotes', marca: 'Marco SP9',
    estado: 'nuevo', cantidad: 1, precio: 2400,
    link: 'https://marcobeveragesystems.com/product-category/coffee/brewers-sp9/',
    nota: 'Café de filtro por taza y shots pre-batched; incluye caldera bajo mostrador. Recomendado por baristas del entorno.',
  },
  {
    id: 'accesorios', categoria: 'Extracción de café',
    concepto: 'Accesorios de barista', marca: 'Tampers, distribuidor, knock box, jarras, termómetros',
    estado: 'nuevo', cantidad: 1, precio: 700,
    link: 'https://www.espressocoffeeshop.es/',
    nota: 'Kit inicial de barra.',
  },
  {
    id: 'basculas', categoria: 'Extracción de café',
    concepto: 'Básculas de precisión', marca: 'Acaia / Brewista',
    estado: 'nuevo', cantidad: 2, precio: 200,
    link: 'https://www.espressocoffeeshop.es/',
    nota: 'Dosificación por peso en barra.',
  },

  // ── Frío y conservación ──
  {
    id: 'hielo', categoria: 'Frío y conservación',
    concepto: 'Máquina de hielo bajo mostrador', marca: 'ITV Orion 35 (~32 kg/día) o similar',
    estado: 'nuevo', cantidad: 1, precio: 1200,
    link: 'https://www.pepebar.com/482-maquina-de-hielo',
    nota: 'Imprescindible para iced lattes, cold brew y bebidas frías.',
  },
  {
    id: 'bajomostrador', categoria: 'Frío y conservación',
    concepto: 'Bajo mostrador refrigerado 2 puertas (inox)', marca: 'Serie americana / equivalente',
    estado: 'nuevo', cantidad: 2, precio: 1050,
    link: 'https://maquinariahosteleriatienda.es/comprar/frente-mostrador-refrigerado-de-acero-inox-2-puertas-y-2-estantes/',
    nota: 'Leche, bases de bebidas y producto del día en la barra.',
  },
  {
    id: 'vitrina', categoria: 'Frío y conservación',
    concepto: 'Vitrina refrigerada sobremostrador', marca: 'Bollería/pastelería (~100 cm)',
    estado: 'nuevo', cantidad: 1, precio: 1200,
    link: 'https://equipacionhosteleria.es/946-vitrinas-refrigeradas-para-pasteleria',
    nota: 'Exposición de bollería: venta por impulso.',
  },
  {
    id: 'botellero', categoria: 'Frío y conservación',
    concepto: 'Botellero / expositor de bebidas frías', marca: 'Puerta de cristal',
    estado: 'nuevo', cantidad: 1, precio: 800,
    link: 'https://www.pepebar.com/474-neveras-industriales',
    nota: 'Refrescos, kombucha y bebidas vegetales a la vista.',
  },
  {
    id: 'congelador', categoria: 'Frío y conservación',
    concepto: 'Congelador de apoyo', marca: 'Arcón / bajo mostrador',
    estado: 'nuevo', cantidad: 1, precio: 500,
    link: 'https://www.pepebar.com/474-neveras-industriales',
    nota: 'Hielo de reserva y producto congelado.',
  },

  // ── Agua ──
  {
    id: 'filtro', categoria: 'Agua',
    concepto: 'Descalcificador + filtración', marca: 'BWT Bestmax (cabezal + cartucho L/XL)',
    estado: 'nuevo', cantidad: 1, precio: 350,
    link: 'https://vainsmon.es/tienda/tratamiento-de-aguas/filtracion/filtro-cafetera-bwt-bestmax-m/',
    nota: 'Protege la máquina y estabiliza el sabor; clave con el agua dura de Madrid.',
  },

  // ── Barra y servicio ──
  {
    id: 'licuadora', categoria: 'Barra y servicio',
    concepto: 'Licuadora / blender profesional', marca: 'Sammic / Vitamix',
    estado: 'nuevo', cantidad: 1, precio: 600,
    link: 'https://www.pepebar.com/',
    nota: 'Matcha, frappés y bebidas con hielo.',
  },
  {
    id: 'hervidor', categoria: 'Barra y servicio',
    concepto: 'Hervidor de cuello de cisne', marca: 'Fellow / Brewista',
    estado: 'nuevo', cantidad: 1, precio: 150,
    link: 'https://www.espressocoffeeshop.es/',
    nota: 'Pour-over e infusiones.',
  },
  {
    id: 'tpv', categoria: 'Barra y servicio',
    concepto: 'TPV completo', marca: 'Táctil + software + impresora + cajón + datáfono',
    estado: 'nuevo', cantidad: 1, precio: 900,
    link: 'https://www.tpvcenter.com/tpv-hosteleria/',
    nota: 'Con software de facturación (VERIFACTU).',
  },
  {
    id: 'pantalla', categoria: 'Barra y servicio',
    concepto: 'Pantalla de menú digital 43" + soporte', marca: 'TV comercial',
    estado: 'nuevo', cantidad: 1, precio: 500,
    link: 'https://www.pepebar.com/',
    nota: 'Carta en barra, editable sin reimprimir.',
  },
  {
    id: 'menaje', categoria: 'Barra y servicio',
    concepto: 'Menaje y small wares', marca: 'Tazas, bandejas, dispensadores, textil',
    estado: 'nuevo', cantidad: 1, precio: 600,
    link: 'https://www.pepebar.com/',
    nota: 'Consumo de barra reutilizable (los vasos to-go van en stock inicial).',
  },
  {
    id: 'estanteria', categoria: 'Barra y servicio',
    concepto: 'Estantería y mesa de trabajo inox', marca: 'Mobiliario técnico',
    estado: 'nuevo', cantidad: 1, precio: 600,
    link: 'https://www.pepebar.com/',
    nota: 'Zona de apoyo y almacenaje tras la barra.',
  },
]
