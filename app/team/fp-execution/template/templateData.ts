import type { Presupuesto } from './types'

export const TEMPLATE_DEFAULT: Presupuesto = [
  // ─── 1. DEMOLICIONES Y TRABAJOS PREVIOS ────────────────────────────────────
  {
    id: 'c1',
    numero: 1,
    nombre: 'Demoliciones y trabajos previos',
    subcapitulos: [
      {
        id: 'c1-s1',
        nombre: 'Tabiquería',
        partidas: [
          { id: 'c1-s1-p1', concepto: 'Demolición de tabiquería interior', descripcion: 'Derribo de tabique de ladrillo o pladur, descontando huecos. Incluye carga y transporte a vertedero.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s1-p2', concepto: 'Demolición de tabiquería con huecos de paso', descripcion: 'Derribo de tabique incluyendo marco y hoja, con apuntalamiento si necesario.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s2',
        nombre: 'Ventanas',
        partidas: [
          { id: 'c1-s2-p1', concepto: 'Desmontaje de ventana, persiana y vidrios', descripcion: 'Retirada de carpintería exterior completa incluyendo persiana y acristalamiento. Incluye transporte a vertedero.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s2-p2', concepto: 'Retirada de marcos y tapajuntas exteriores', descripcion: 'Extracción de marcos perimetrales y remates, con reparación de jambas si necesario.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s3',
        nombre: 'Puertas',
        partidas: [
          { id: 'c1-s3-p1', concepto: 'Desmontaje de puerta de paso', descripcion: 'Retirada de hoja, marco y tapajuntas. No se distingue entre abatibles y correderas.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s3-p2', concepto: 'Desmontaje de puerta de entrada', descripcion: 'Retirada de puerta de acceso con blindaje, marcos y cerrajería.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s4',
        nombre: 'Instalaciones',
        partidas: [
          { id: 'c1-s4-p1', concepto: 'Fontanería / Saneamiento', descripcion: 'Desmontaje de red de agua fría, caliente y saneamiento existente.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s4-p2', concepto: 'Ventilación', descripcion: 'Retirada de conductos y equipos de ventilación existentes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s4-p3', concepto: 'Calefacción', descripcion: 'Desmontaje de radiadores, tuberías y caldera existente.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s4-p4', concepto: 'A/C', descripcion: 'Retirada de unidades interiores y exteriores de climatización.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s4-p5', concepto: 'ACS', descripcion: 'Desmontaje de calentador o acumulador de agua caliente sanitaria.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s4-p6', concepto: 'Electricidad / Iluminación / Teleco', descripcion: 'Retirada de cuadro eléctrico, cableado, puntos de luz y tomas de telecomunicaciones.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s4-p7', concepto: 'Gas', descripcion: 'Desmontaje de montante, llave de paso y aparatos de gas. Si no existe se deja en 0.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s5',
        nombre: 'Pavimentos y revestimientos',
        partidas: [
          { id: 'c1-s5-p1', concepto: 'Arranque de pavimento existente', descripcion: 'Demolición y retirada de cualquier tipo de pavimento (parquet, cerámico, mármol, etc.).', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s5-p2', concepto: 'Arranque de alicatado y revestimientos', descripcion: 'Retirada de azulejos, gresite y revestimientos de pared en baños y cocina.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s6',
        nombre: 'Armarios',
        partidas: [
          { id: 'c1-s6-p1', concepto: 'Desmontaje de armario empotrado', descripcion: 'Retirada de módulos de armario por unidad de 60×60 cm o similar, incluyendo puertas y estructura.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s6-p2', concepto: 'Retirada de frente de armario', descripcion: 'Desmontaje de hojas de puertas correderas o batientes de armario.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s7',
        nombre: 'Sanitarios y cocina',
        partidas: [
          { id: 'c1-s7-p1', concepto: 'Desmontaje de sanitarios', descripcion: 'Retirada de inodoro, lavabo, bañera o ducha, bidé y muebles de baño.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s7-p2', concepto: 'Desmontaje de equipamiento de cocina', descripcion: 'Retirada de muebles altos y bajos, encimera, electrodomésticos y fregadero de cocina.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s8',
        nombre: 'Falsos techos',
        partidas: [
          { id: 'c1-s8-p1', concepto: 'Demolición de falso techo continuo', descripcion: 'Retirada de falso techo de escayola, yeso o pladur existente.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s8-p2', concepto: 'Demolición de falso techo registrable', descripcion: 'Desmontaje de placas y estructura metálica de falso techo registrable.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c1-s9',
        nombre: 'Molduras y foseados',
        partidas: [
          { id: 'c1-s9-p1', concepto: 'Demolición de molduras de escayola', descripcion: 'Retirada de cornisas y molduras perimetrales de escayola o yeso.', unidad: 'ml', cantidad: 0, precioUnitario: 0 },
          { id: 'c1-s9-p2', concepto: 'Demolición de foseados', descripcion: 'Retirada de foseados perimetrales para iluminación indirecta.', unidad: 'ml', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 2. ALBAÑILERÍA ────────────────────────────────────────────────────────
  {
    id: 'c2',
    numero: 2,
    nombre: 'Albañilería',
    subcapitulos: [
      {
        id: 'c2-s1',
        nombre: 'Trasdosados de Pladur / ladrillo',
        partidas: [
          { id: 'c2-s1-p1', concepto: 'Trasdosado con placa de yeso laminado', descripcion: 'Trasdosado sobre estructura metálica con placa de 15 mm. Descontando huecos mayores de 2 m².', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s1-p2', concepto: 'Trasdosado de ladrillo hueco', descripcion: 'Trasdosado con ladrillo hueco de 4 cm sobre paramento existente. Descontando huecos mayores de 2 m².', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c2-s2',
        nombre: 'Tabiquería de Pladur',
        partidas: [
          { id: 'c2-s2-p1', concepto: 'Tabique Pladur doble placa 13+13', descripcion: 'Tabique con estructura metálica y doble placa de 13 mm cada cara, sin aislamiento. Descontando huecos mayores de 2 m².', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s2-p2', concepto: 'Tabique Pladur con lana mineral', descripcion: 'Tabique con estructura metálica, lana mineral de 48 mm y placa 13 mm. Descontando huecos mayores de 2 m².', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c2-s3',
        nombre: 'Trasdosados directos / guarnecidos de yeso',
        partidas: [
          { id: 'c2-s3-p1', concepto: 'Guarnecido y maestreado de yeso', descripcion: 'Guarnecido de yeso de 15 mm sobre paramento, con maestras cada 1,5 m. Descontando huecos mayores de 2 m².', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s3-p2', concepto: 'Enlucido de yeso fino', descripcion: 'Enlucido de yeso de 3 mm sobre guarnecido para acabado listo para pintar. Descontando huecos mayores de 2 m².', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c2-s4',
        nombre: 'Falsos techos',
        partidas: [
          { id: 'c2-s4-p1', concepto: 'Falso techo continuo de Pladur', descripcion: 'Falso techo con estructura y placa de 12,5 mm, listo para pintar.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s4-p2', concepto: 'Falso techo registrable de escayola', descripcion: 'Falso techo con placas de escayola 60×60 sobre perfilería vista.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c2-s5',
        nombre: 'Molduras y foseados',
        partidas: [
          { id: 'c2-s5-p1', concepto: 'Moldura de escayola prefabricada', descripcion: 'Moldura perimetral de escayola sobre encuentro techo-pared.', unidad: 'ml', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s5-p2', concepto: 'Foseado de escayola para iluminación indirecta', descripcion: 'Foseado perimetral o central para alojamiento de tira LED, con remate de escayola.', unidad: 'ml', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c2-s6',
        nombre: 'Soleras y rellenos',
        partidas: [
          { id: 'c2-s6-p1', concepto: 'Recrecido de mortero para nivelación', descripcion: 'Solera de mortero de cemento para nivelación de suelos, espesor variable.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s6-p2', concepto: 'Relleno con hormigón de limpieza', descripcion: 'Relleno de pozos, zanjas o huecos con hormigón en masa HM-20.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c2-s7',
        nombre: 'Ayudas de albañilería',
        partidas: [
          { id: 'c2-s7-p1', concepto: 'Ayuda a fontanería', descripcion: 'Rozas, pasos de forjado y tabiques, taladros y remates en obra para instalación de fontanería.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c2-s7-p2', concepto: 'Ayuda a instalación eléctrica', descripcion: 'Rozas, cajas y tapas de mecanismos, y remates en obra para instalación eléctrica.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 3. CARPINTERÍA METÁLICA Y VIDRIERÍA ───────────────────────────────────
  {
    id: 'c3',
    numero: 3,
    nombre: 'Carpintería metálica y vidriería',
    subcapitulos: [
      {
        id: 'c3-s1',
        nombre: 'Carpinterías metálicas / PVC',
        partidas: [
          { id: 'c3-s1-p1', concepto: 'Ventana de aluminio RPT', descripcion: 'Ventana de aluminio con rotura de puente térmico, medida por separado de vidrio y persiana.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c3-s1-p2', concepto: 'Puerta balconera de PVC', descripcion: 'Puerta balconera de PVC con refuerzo interior, medida por separado de vidrio y persiana.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c3-s2',
        nombre: 'Vidriería',
        partidas: [
          { id: 'c3-s2-p1', concepto: 'Doble acristalamiento bajo emisivo 6/12/4', descripcion: 'Vidrio doble con cámara de 12 mm y lámina de control solar, medido por separado de la carpintería.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c3-s2-p2', concepto: 'Triple acristalamiento alta eficiencia', descripcion: 'Vidrio triple con dos cámaras y valores Uw ≤ 0,8 W/m²K, medido por separado de la carpintería.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c3-s3',
        nombre: 'Persianas',
        partidas: [
          { id: 'c3-s3-p1', concepto: 'Persiana enrollable de aluminio lacado', descripcion: 'Persiana de aluminio con guías laterales y cajón térmico, medida por separado de la carpintería.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c3-s3-p2', concepto: 'Persiana motorizada con domótica', descripcion: 'Persiana motorizada con motor tubular y control domótico, medida por separado de la carpintería.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c3-s4',
        nombre: 'Puertas divisorias suelo-techo (metálicas)',
        partidas: [
          { id: 'c3-s4-p1', concepto: 'Puerta corredera suelo-techo acero + vidrio', descripcion: 'Puerta corredera de altura completa en acero y vidrio templado. Solo puertas metálicas con vidrio.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c3-s4-p2', concepto: 'Puerta pivotante metálica con vidrio', descripcion: 'Puerta pivotante de altura total con perfil metálico y vidrio, sistema suelo-techo.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c3-s5',
        nombre: 'Mamparas',
        partidas: [
          { id: 'c3-s5-p1', concepto: 'Mampara de ducha con vidrio templado 8 mm', descripcion: 'Mampara fija o abatible con vidrio templado de 8 mm y perfil de aluminio anodizado.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c3-s5-p2', concepto: 'Mampara separadora de espacios', descripcion: 'Mampara fija de vidrio para separación interior de ambientes, con perfil mínimo.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c3-s6',
        nombre: 'Espejos',
        partidas: [
          { id: 'c3-s6-p1', concepto: 'Espejo de baño con bisel perimetral', descripcion: 'Espejo plateado con bisel de 10 mm anclado sobre paramento de baño.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c3-s6-p2', concepto: 'Espejo retroiluminado a medida', descripcion: 'Espejo con iluminación LED perimetral o posterior, a medida, incluyendo conexión eléctrica.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 4. CARPINTERÍA DE MADERA ──────────────────────────────────────────────
  {
    id: 'c4',
    numero: 4,
    nombre: 'Carpintería de madera',
    subcapitulos: [
      {
        id: 'c4-s1',
        nombre: 'Puertas de acceso a vivienda',
        partidas: [
          { id: 'c4-s1-p1', concepto: 'Puerta de entrada blindada lacada', descripcion: 'Puerta de acceso de seguridad con alma de acero, acabado lacado, incluye marco y herrajes.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c4-s1-p2', concepto: 'Puerta de acceso con apertura telescópica', descripcion: 'Puerta de entrada telescópica o de gran formato, lacada o enchapada.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c4-s2',
        nombre: 'Puertas de paso abatibles',
        partidas: [
          { id: 'c4-s2-p1', concepto: 'Puerta de paso abatible lisa lacada', descripcion: 'Puerta de paso de tablero liso con acabado lacado, incluye marco, tapajuntas y herrajes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c4-s2-p2', concepto: 'Puerta de paso abatible con cristal', descripcion: 'Puerta abatible con visor o panel de vidrio, acabado a definir, incluye herrajes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c4-s3',
        nombre: 'Puertas de paso correderas',
        partidas: [
          { id: 'c4-s3-p1', concepto: 'Puerta corredera empotrada en tabique', descripcion: 'Puerta corredera con sistema de caja en tabique, incluye armazón, hoja, marco y herrajes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c4-s3-p2', concepto: 'Puerta corredera vista sobre guía', descripcion: 'Puerta corredera exterior con guía superior vista, incluye hoja, herrajes y topes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c4-s4',
        nombre: 'Puertas divisorias suelo-techo (madera)',
        partidas: [
          { id: 'c4-s4-p1', concepto: 'Puerta divisoria suelo-techo madera + vidrio', descripcion: 'Puerta de altura total en madera lacada con inserto de vidrio, sistema suelo-techo. Solo puertas de madera con vidrio.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c4-s4-p2', concepto: 'Cristalera interior de madera lacada', descripcion: 'Tabique divisorio de madera y vidrio de altura total, con o sin apertura.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c4-s5',
        nombre: 'Armarios a medida',
        partidas: [
          { id: 'c4-s5-p1', concepto: 'Armario a medida con puertas batientes', descripcion: 'Armario empotrado a medida con puertas abatibles, por módulo de 60×60 cm. Incluye interior y herrajes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c4-s5-p2', concepto: 'Armario a medida con puertas correderas', descripcion: 'Armario empotrado a medida con puertas correderas, por módulo de 60×60 cm. Incluye interior y herrajes.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c4-s6',
        nombre: 'Armarios de baño',
        partidas: [
          { id: 'c4-s6-p1', concepto: 'Mueble de baño suspendido a medida', descripcion: 'Mueble bajo lavabo suspendido, fabricado a medida con tablero hidrófugo y herrajes suaves.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c4-s6-p2', concepto: 'Columna de baño a medida', descripcion: 'Columna auxiliar de baño con estantes y puertas, fabricada a medida.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 5. INSTALACIONES ──────────────────────────────────────────────────────
  {
    id: 'c5',
    numero: 5,
    nombre: 'Instalaciones',
    subcapitulos: [
      {
        id: 'c5-s1',
        nombre: 'Fontanería y saneamiento',
        partidas: [
          { id: 'c5-s1-p1', concepto: 'Red de agua fría y caliente', descripcion: 'Suministro y montaje de red de distribución interior de agua en tubo multicapa o cobre.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s1-p2', concepto: 'Red de saneamiento horizontal', descripcion: 'Colectores y bajantes de PVC para evacuación de aguas residuales y pluviales.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s2',
        nombre: 'Ventilación',
        partidas: [
          { id: 'c5-s2-p1', concepto: 'Extractor de baño con temporizador', descripcion: 'Extractor helicoidal con temporizador y válvula antirretorno. Incluye conducto a shunt o exterior.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s2-p2', concepto: 'Sistema de ventilación forzada cocina', descripcion: 'Conducto y extractor de cocina con salida al exterior, incluye rejillas y campana.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s3',
        nombre: 'Calefacción',
        partidas: [
          { id: 'c5-s3-p1', concepto: 'Radiador con válvula termostática', descripcion: 'Radiador de acero o aluminio con válvula termostática y detentor. Incluye sujeción y purgador.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s3-p2', concepto: 'Red de distribución de calefacción', descripcion: 'Tuberías de ida y retorno en cobre o multicapa para circuito de calefacción.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s4',
        nombre: 'A/C',
        partidas: [
          { id: 'c5-s4-p1', concepto: 'Unidad exterior de aire acondicionado', descripcion: 'Unidad condensadora exterior tipo bomba de calor inverter, con soporte y conexiones.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s4-p2', concepto: 'Unidad interior tipo split', descripcion: 'Unidad evaporadora de pared con control remoto y canalización de línea frigorífica.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s5',
        nombre: 'ACS',
        partidas: [
          { id: 'c5-s5-p1', concepto: 'Calentador acumulador eléctrico', descripcion: 'Calentador de acumulación eléctrico con resistencia y termostato, incluye conexiones.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s5-p2', concepto: 'Bomba de calor ACS aerotérmica', descripcion: 'Equipo aerotérmico para producción de agua caliente sanitaria de alta eficiencia.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s6',
        nombre: 'Electricidad',
        partidas: [
          { id: 'c5-s6-p1', concepto: 'Cuadro eléctrico con protecciones', descripcion: 'Cuadro de distribución con IGA, ICP, diferenciales y automáticos según REBT.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s6-p2', concepto: 'Red de circuitos con cableado', descripcion: 'Circuitos de distribución con cable de cobre en tubo corrugado empotrado, incluye mecanismos.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s7',
        nombre: 'Iluminación',
        partidas: [
          { id: 'c5-s7-p1', concepto: 'Puntos de luz empotrados en techo', descripcion: 'Luminarias LED empotradas con transformador y difusor, incluye cableado hasta caja.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s7-p2', concepto: 'Carril electrificado con focos orientables', descripcion: 'Carril trifásico empotrado o superficial con focos LED orientables, incluye conexión.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s8',
        nombre: 'Telecomunicaciones',
        partidas: [
          { id: 'c5-s8-p1', concepto: 'Red de voz y datos', descripcion: 'Canalización y cableado de red Ethernet Cat 6A y RJ45, con rosetas y rack de distribución.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s8-p2', concepto: 'Canalización para fibra óptica', descripcion: 'Tubo corrugado y cajas para entrada de fibra óptica hasta RITI y punto de distribución en vivienda.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c5-s9',
        nombre: 'Gas',
        partidas: [
          { id: 'c5-s9-p1', concepto: 'Legalización de instalación de gas', descripcion: 'Tramitación y documentación para legalización ante distribuidora. Incluye inspección y puesta en marcha.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c5-s9-p2', concepto: 'Red interior de gas con montante', descripcion: 'Tuberías de cobre para distribución interior de gas natural o propano, con llave y regulador.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 6. PINTURAS, PAVIMENTOS Y REVESTIMIENTOS ──────────────────────────────
  {
    id: 'c6',
    numero: 6,
    nombre: 'Pinturas, pavimentos y revestimientos',
    subcapitulos: [
      {
        id: 'c6-s1',
        nombre: 'Pintura',
        partidas: [
          { id: 'c6-s1-p1', concepto: 'Pintura plástica lisa en paredes y techo', descripcion: 'Dos manos de pintura plástica en color a definir sobre imprimación. Incluye preparación de superficie.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c6-s1-p2', concepto: 'Pintura al esmalte en carpintería', descripcion: 'Pintura al esmalte sintético o poliuretano sobre madera o metal, con lijado y fondo.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c6-s2',
        nombre: 'Solados y alicatados',
        partidas: [
          { id: 'c6-s2-p1', concepto: 'Pavimento porcelánico rectificado', descripcion: 'Pavimento de gres porcelánico rectificado, formato a definir, colocado con adhesivo cementoso.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c6-s2-p2', concepto: 'Alicatado de gres en baños y cocina', descripcion: 'Revestimiento de gres rectificado hasta techo o cota definida, con juntas de silicona.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 7. EQUIPAMIENTO ───────────────────────────────────────────────────────
  {
    id: 'c7',
    numero: 7,
    nombre: 'Equipamiento',
    subcapitulos: [
      {
        id: 'c7-s1',
        nombre: 'Sanitarios',
        partidas: [
          { id: 'c7-s1-p1', concepto: 'Inodoro suspendido con cisterna empotrada', descripcion: 'Inodoro de porcelana con asiento, cisterna empotrada Geberit o similar, incluye anclaje y sellado.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c7-s1-p2', concepto: 'Lavabo suspendido o sobre encimera', descripcion: 'Lavabo de porcelana o piedra sobre encimera o suspendido, incluye sifón y válvula.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c7-s2',
        nombre: 'Griferías y accesorios',
        partidas: [
          { id: 'c7-s2-p1', concepto: 'Grifería monomando para lavabo', descripcion: 'Grifo monomando de lavabo con limitador de caudal, clase A, incluye latiguillos y conexión.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c7-s2-p2', concepto: 'Grifería termostática para ducha', descripcion: 'Grifo termostático para ducha con regulación de temperatura y caudal, incluye ducha y brazo.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 8. COCINA ─────────────────────────────────────────────────────────────
  {
    id: 'c8',
    numero: 8,
    nombre: 'Cocina',
    subcapitulos: [
      {
        id: 'c8-s1',
        nombre: 'Mobiliario de cocina',
        partidas: [
          { id: 'c8-s1-p1', concepto: 'Módulo de cocina alto/bajo 60×60 cm', descripcion: 'Módulo estándar de 60×60 cm, mueble alto o bajo (si hay ambos cuenta como 1 módulo). Incluye montaje y accesorios.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c8-s1-p2', concepto: 'Módulo de esquina', descripcion: 'Módulo especial de esquina con herraje rincón o carrusel, incluye montaje.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c8-s2',
        nombre: 'Encimera, aplacado, fregadero y grifos',
        partidas: [
          { id: 'c8-s2-p1', concepto: 'Encimera de silestone / cuarzo', descripcion: 'Encimera de silestone o cuarzo compacto de 20 mm, corte, pulido y colocación. Material a definir.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c8-s2-p2', concepto: 'Aplacado de revestimiento en pared de cocina', descripcion: 'Revestimiento de pared de cocina sobre encimera, en gres, vidrio o microcemento.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c8-s2-p3', concepto: 'Fregadero de acero inoxidable', descripcion: 'Fregadero de acero inoxidable de uno o dos senos, incluye válvula y sifón.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c8-s2-p4', concepto: 'Grifería monomando para fregadero', descripcion: 'Grifo monomando de cocina con caño extraíble o fijo, clase A de eficiencia hídrica.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c8-s3',
        nombre: 'Electrodomésticos',
        partidas: [
          { id: 'c8-s3-p1', concepto: 'Horno multifunción empotrable', descripcion: 'Horno eléctrico empotrable multifunción, clase energética A+. Marca y modelo a definir.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c8-s3-p2', concepto: 'Placa de inducción', descripcion: 'Placa de inducción de 4 fuegos empotrable en encimera. Marca y modelo a definir.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 9. TERRAZA ────────────────────────────────────────────────────────────
  {
    id: 'c9',
    numero: 9,
    nombre: 'Terraza',
    subcapitulos: [
      {
        id: 'c9-s1',
        nombre: 'Pérgola',
        partidas: [
          { id: 'c9-s1-p1', concepto: 'Estructura de pérgola en aluminio lacado', descripcion: 'Pérgola con perfil de aluminio lacado, anclada a forjado o fachada, con sistema de lamas orientables.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c9-s1-p2', concepto: 'Cubrición de pérgola con policarbonato o vidrio', descripcion: 'Techo de pérgola con panel de policarbonato celular o vidrio laminado sobre estructura existente.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c9-s2',
        nombre: 'Barandilla',
        partidas: [
          { id: 'c9-s2-p1', concepto: 'Barandilla de vidrio con perfil en U', descripcion: 'Barandilla de vidrio templado encastrado en perfil en U de acero inoxidable o aluminio.', unidad: 'ml', cantidad: 0, precioUnitario: 0 },
          { id: 'c9-s2-p2', concepto: 'Barandilla metálica lacada', descripcion: 'Barandilla de tubo de acero con pasamanos, lacada o pintada al esmalte, con anclaje a forjado.', unidad: 'ml', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c9-s3',
        nombre: 'Paisajismo',
        partidas: [
          { id: 'c9-s3-p1', concepto: 'Jardinera a medida en madera tratada', descripcion: 'Jardinera de exterior en madera tratada con impermeabilización interior, a medida.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c9-s3-p2', concepto: 'Pavimento exterior antideslizante', descripcion: 'Baldosa o tarima de exterior antideslizante sobre plots regulables o mortero.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c9-s4',
        nombre: 'Varios terraza',
        partidas: [
          { id: 'c9-s4-p1', concepto: 'Punto de luz exterior', descripcion: 'Luminaria exterior IP44 empotrada en suelo o pared, con cableado y caja de registro.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c9-s4-p2', concepto: 'Toma de agua exterior', descripcion: 'Grifo de jardín con llave de corte empotrada en paramento, con toma de 1/2".', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 10. VARIOS ────────────────────────────────────────────────────────────
  {
    id: 'c10',
    numero: 10,
    nombre: 'Varios',
    subcapitulos: [
      {
        id: 'c10-s1',
        nombre: 'Varios',
        partidas: [
          { id: 'c10-s1-p1', concepto: 'Partida sin clasificar A', descripcion: 'Partida para elementos que no encajan en ningún otro capítulo. Descripción a completar en proyecto.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c10-s1-p2', concepto: 'Partida sin clasificar B', descripcion: 'Partida para elementos que no encajan en ningún otro capítulo. Descripción a completar en proyecto.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },

  // ─── 11. GASTOS GENERALES ──────────────────────────────────────────────────
  {
    id: 'c11',
    numero: 11,
    nombre: 'Gastos generales',
    subcapitulos: [
      {
        id: 'c11-s1',
        nombre: 'Documentación y trámites',
        partidas: [
          { id: 'c11-s1-p1', concepto: 'Redacción de proyecto técnico', descripcion: 'Honorarios por redacción de proyecto básico y/o de ejecución por técnico competente (ECU).', unidad: 'ECU', cantidad: 0, precioUnitario: 0 },
          { id: 'c11-s1-p2', concepto: 'Dirección de obra y coordinación', descripcion: 'Honorarios de dirección facultativa y coordinación de seguridad y salud durante la obra (ECU).', unidad: 'ECU', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c11-s2',
        nombre: 'Tasas urbanísticas',
        partidas: [
          { id: 'c11-s2-p1', concepto: 'Tasa municipal de licencia de obras', descripcion: 'Tasa municipal para obtención de licencia de obras mayor o comunicación previa.', unidad: 'ECU', cantidad: 0, precioUnitario: 0 },
          { id: 'c11-s2-p2', concepto: 'ICIO (Impuesto sobre Construcciones)', descripcion: 'Impuesto municipal sobre el coste de ejecución material de la obra.', unidad: 'ECU', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c11-s3',
        nombre: 'Gestión de residuos',
        partidas: [
          { id: 'c11-s3-p1', concepto: 'Alquiler y gestión de contenedor / saca', descripcion: 'Suministro, colocación, retirada y traslado a planta de transferencia de contenedor o sacas.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
          { id: 'c11-s3-p2', concepto: 'Tasas de vertedero autorizado', descripcion: 'Canon de vertedero para gestión final de residuos de construcción y demolición (RCD).', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c11-s4',
        nombre: 'Seguridad y salud',
        partidas: [
          { id: 'c11-s4-p1', concepto: 'Documentación de seguridad y salud', descripcion: 'Elaboración del estudio básico de seguridad y salud o estudio completo según RD 1627/97.', unidad: 'ECU', cantidad: 0, precioUnitario: 0 },
          { id: 'c11-s4-p2', concepto: 'EPIs y medidas de protección en obra', descripcion: 'Equipos de protección individual y colectiva durante la ejecución de los trabajos.', unidad: 'ECU', cantidad: 0, precioUnitario: 0 },
        ],
      },
      {
        id: 'c11-s5',
        nombre: 'Limpieza final de obra',
        partidas: [
          { id: 'c11-s5-p1', concepto: 'Limpieza final de obra', descripcion: 'Limpieza general de la vivienda al finalizar los trabajos, incluye retirada de protecciones.', unidad: 'm²', cantidad: 0, precioUnitario: 0 },
          { id: 'c11-s5-p2', concepto: 'Retirada de protecciones y restos de obra', descripcion: 'Desmontaje de protecciones de suelos, carpinterías y sanitarios, y limpieza de restos.', unidad: 'ud', cantidad: 0, precioUnitario: 0 },
        ],
      },
    ],
  },
]
