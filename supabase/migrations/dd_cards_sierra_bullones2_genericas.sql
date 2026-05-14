-- DD Visits — Cards genéricas complementarias Sierra Bullones 2
-- Due Diligence Técnica No Invasiva — capa estándar de revisión ejecutiva
-- Complementa la migración dd_cards_sierra_bullones2.sql (cards específicas, IDs rango 0005-*)
-- Rango de IDs: dd000000-0000-0000-0006-000000000001 a ...0016
-- orden: continúa desde 250 (las cards específicas terminan en 240)
-- Idempotente: ON CONFLICT (id) DO NOTHING

BEGIN;

INSERT INTO public.dd_cards (
  id, asset_id, visit_id, rol_id,
  titulo, especialidad, zona_edificio, prioridad,
  objetivo_revision, que_revisar, senales_alerta,
  fotos_recomendadas, preguntas_confirmar, documentacion_relacionada,
  orden, estado, riesgo,
  requiere_seguimiento, incluir_revision_interna, activo
) VALUES

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 1 · Arquitecto / Director técnico
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0006-000000000001',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Recorrido general del edificio y lectura de estado global',
  'Dirección técnica DD',
  'Todo el activo',
  'alta',
  'Obtener una lectura global del estado aparente del edificio, identificando incidencias generales, zonas críticas y coherencia entre uso real y uso previsto.',
  '- Acceso principal y portal: estado y mantenimiento
- Escalera: estado, limpieza, señales de uso
- Zonas comunes: estado general de conservación
- Circulaciones y distribución de accesos
- Señales de uso intensivo o falta de mantenimiento
- Sensación general de operación y gestión del activo',
  '- Deterioro general superior al esperado para la antigüedad de la reforma
- Falta de mantenimiento visible en zonas comunes
- Inconsistencias entre el uso real y el uso previsto como hold/renta
- Señales de uso intensivo sin respuesta de mantenimiento',
  '- Fachada principal
- Portal y acceso
- Escalera y rellanos por planta
- Circulaciones y zonas comunes
- Estado representativo por planta',
  '- ¿Qué uso operativo tiene actualmente el activo?
- ¿Qué zonas son comunes y cuáles privativas?
- ¿Existe responsable de mantenimiento identificado?',
  '- Alcance DD Técnica No Invasiva
- Documentación general aportada por propiedad',
  250, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000002',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Seguridad de uso y accesibilidad visual básica',
  'Seguridad de uso y accesibilidad',
  'Accesos, escaleras, zonas comunes',
  'media',
  'Revisar visualmente las condiciones básicas de seguridad de uso y accesibilidad dentro del alcance no invasivo.',
  '- Escaleras: estado de peldaños, huellas y tabicas
- Barandillas y pasamanos: estado y estabilidad
- Resbaladicidad aparente de pavimentos en zonas húmedas o exteriores
- Desniveles sin protección visible
- Iluminación de zonas comunes
- Obstáculos en recorridos de evacuación',
  '- Barandillas inestables, flojas o con altura insuficiente aparente
- Desniveles sin protección adecuada
- Escaleras con iluminación deficiente
- Obstáculos en recorridos de paso o evacuación
- Zonas con riesgo visible de tropiezo o caída',
  '- Escaleras: estado general y barandillas
- Barandillas: detalle de anclaje
- Accesos: desniveles o umbrales
- Zonas de paso con incidencias',
  '- ¿Ha habido incidencias de caídas o reclamaciones por seguridad?
- ¿Hay zonas con acceso restringido no señalizado?',
  '- Alcance DD Técnica No Invasiva',
  260, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0006-000000000003',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Compatibilidad operativa para hold/renta',
  'Operación inmobiliaria',
  'Todo el activo',
  'media',
  'Evaluar visualmente si el activo funciona adecuadamente para una estrategia de hold/renta y qué aspectos pueden condicionar su operación o su CAPEX.',
  '- Estado de zonas comunes: robustez para uso intensivo
- Facilidad de acceso a instalaciones para mantenimiento
- Robustez aparente de acabados frente a rotación de usuarios
- Distribuciones: compatibilidad con alquiler por unidades
- Zonas de mayor desgaste previsible
- Elementos difíciles de mantener o sustituir',
  '- Acabados excesivamente delicados para uso intensivo o alta rotación
- Instalaciones difíciles de acceder o mantener
- Zonas sin acceso técnico para intervención
- Desgaste acelerado respecto a la antigüedad de la reforma
- Elementos que requieren mantenimiento frecuente y especializado',
  '- Zonas de alto tránsito: estado actual
- Elementos de mantenimiento complejo
- Puntos de desgaste visible',
  '- ¿Cuál es el modelo actual de explotación del activo?
- ¿Qué incidencias se repiten con más frecuencia?
- ¿Qué zonas requieren más intervenciones de mantenimiento?',
  '- Facturas de mantenimiento
- Documentación operativa aportada',
  270, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0006-000000000004',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Documentación pendiente y limitaciones observadas en visita',
  'Control de alcance',
  'General',
  'alta',
  'Registrar durante la visita qué documentación sigue pendiente de recibir y qué limitaciones de acceso o verificación deben reflejarse explícitamente en el informe.',
  '- Documentación técnica solicitada y no aportada
- Zonas no inspeccionadas durante la visita y motivo
- Instalaciones no verificables dentro del alcance no invasivo
- Elementos ocultos cuya condición no puede determinarse
- Información recibida verbalmente sin soporte documental',
  '- Falta de documentación crítica (boletines, certificados, partes de mantenimiento)
- Imposibilidad de acceso a zonas técnicas relevantes
- Información relevante recibida solo verbalmente sin confirmación escrita
- Áreas no inspeccionadas que condicionan materialmente las conclusiones del informe',
  '- Zonas no accesibles durante la visita
- Cuartos cerrados sin acceso
- Elementos o instalaciones no verificables',
  '- ¿Qué documentación queda pendiente de recibir?
- ¿Qué zonas no se pudieron visitar en esta jornada?
- ¿Se entregará documentación adicional tras la visita?',
  '- Correos de solicitud documental previa
- Checklist DIU Sierra Bullones
- Alcance contratado',
  280, 'pendiente', NULL, false, true, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 2 · Construcción y acabados
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0006-000000000005',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Pavimentos interiores y exteriores',
  'Acabados',
  'Viviendas, zonas comunes, patios',
  'media',
  'Revisar el estado visual de pavimentos en viviendas, zonas comunes y exteriores, y su desgaste aparente en relación con el uso del activo.',
  '- Pavimentos interiores de viviendas: tipo, estado y desgaste
- Pavimentos de zonas comunes: estado y homogeneidad
- Pavimentos en patios o exteriores: estado y drenaje
- Juntas: estado y apertura
- Piezas sueltas, rotas o levantadas
- Desniveles o cejas entre zonas',
  '- Piezas sueltas o rotas en zonas de paso frecuente
- Desniveles o cejas que suponen riesgo de tropiezo
- Desgaste superior al esperado para la antigüedad del activo
- Pavimento levantado por humedad subyacente
- Juntas muy abiertas o deterioradas',
  '- Pavimentos por zona representativa
- Detalles de piezas dañadas o sueltas
- Juntas abiertas
- Pavimentos exteriores o de zonas húmedas',
  '- ¿Hay quejas de usuarios por el estado de pavimentos?
- ¿Se han realizado reparaciones recientes de pavimento?',
  '- Alcance DD Técnica No Invasiva',
  290, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0006-000000000006',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Carpinterías exteriores y sellados perimetrales',
  'Envolvente y acabados',
  'Fachadas, patios, viviendas',
  'alta',
  'Revisar el estado visual de carpinterías exteriores y sellados, por su incidencia directa en filtraciones, confort térmico y mantenimiento del activo.',
  '- Ventanas: estado del marco, acristalamiento y herrajes
- Puertas exteriores a patios o cubierta
- Sellados perimetrales entre carpintería y fachada
- Persianas o cajas de persiana si existen
- Vierteaguas: estado y encuentro con fachada
- Encuentros entre huecos y paramentos',
  '- Sellados perimetrales deteriorados, abiertos o inexistentes
- Rastros de filtraciones alrededor de huecos de carpintería
- Carpinterías visiblemente desajustadas o con rotura de puente térmico aparente
- Condensaciones interiores en zona de carpintería
- Fisuras en los encuentros entre carpintería y fachada',
  '- Ventanas por estancia representativa: vista general y detalle de sellado
- Vierteaguas y encuentro con fachada
- Encuentros problemáticos',
  '- ¿Ha habido entrada de agua o aire a través de ventanas?
- ¿Se han reparado o sustituido sellados o carpinterías?',
  '- Documentación técnica disponible
- Requerimientos municipales si aplican a fachada',
  300, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000007',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Puertas, cerrajería y elementos de uso frecuente',
  'Acabados y mantenimiento',
  'Accesos, viviendas, zonas comunes',
  'media',
  'Revisar el funcionamiento y desgaste de puertas, cerraduras, herrajes y elementos sometidos a uso frecuente por la rotación de usuarios.',
  '- Puerta de acceso al edificio: estado y cierre
- Puertas de viviendas: ajuste, cierre y herrajes
- Puertas interiores: funcionamiento y desgaste
- Cerraduras: funcionamiento y estado
- Manillas, bisagras y topes
- Elementos metálicos visibles: oxidación o corrosión',
  '- Puertas que no cierran correctamente o con holguras excesivas
- Cerraduras duras, deterioradas o con signos de manipulación
- Herrajes sueltos o deteriorados
- Golpes repetidos o elementos claramente dañados
- Elementos metálicos con corrosión visible',
  '- Puerta de acceso principal
- Puerta de vivienda representativa
- Herrajes con deterioro visible
- Cerraduras o elementos problemáticos',
  '- ¿Hay problemas recurrentes de acceso o cierre de puertas?
- ¿Se cambian cerraduras con frecuencia por incidencias?',
  '- Operación y mantenimiento del activo',
  310, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0006-000000000008',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Patios, encuentros exteriores y puntos de drenaje superficial',
  'Acabados exteriores',
  'Patios y zonas exteriores',
  'alta',
  'Revisar visualmente los patios, encuentros exteriores y puntos de evacuación superficial por su riesgo de generar humedades o filtraciones al interior.',
  '- Pendientes de pavimento en patios: hacia sumideros
- Sumideros: estado y limpieza
- Encuentros entre pavimento exterior y base de fachada o zócalo
- Zócalos: estado e impermeabilización aparente
- Fisuras en pavimento o encuentros
- Vegetación no controlada junto a fachada o zócalos',
  '- Agua estancada en patios sin pendiente suficiente
- Sumideros obstruidos o colmatados
- Humedad ascendente en zócalos o base de fachada
- Fisuras en encuentros entre pavimento exterior y paramentos
- Vegetación con raíces que puedan afectar a la impermeabilización',
  '- Vista general del patio
- Sumideros: detalle de estado y limpieza
- Encuentros con fachada o zócalos
- Zonas con signos de agua estancada',
  '- ¿Hay incidencias de filtración desde patios al interior o al sótano?
- ¿Quién realiza el mantenimiento de patios y limpieza de sumideros?',
  '- Alcance DD Técnica No Invasiva',
  320, 'pendiente', NULL, false, true, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 3 · Electricidad y climatización
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0006-000000000009',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Alumbrado común y alumbrado de emergencia',
  'Electricidad',
  'Portal, escaleras, zonas comunes',
  'alta',
  'Revisar el estado visible y el funcionamiento básico del alumbrado común y el alumbrado de emergencia.',
  '- Iluminación de portal, escaleras y pasillos: estado y cobertura
- Alumbrado de emergencia: presencia, estado y señalización
- Interruptores, sensores o temporizadores: funcionamiento aparente
- Luminarias: tipo, estado y completitud',
  '- Zonas comunes con iluminación claramente insuficiente
- Luminarias de emergencia apagadas, dañadas o ausentes donde deberían existir
- Luminarias sin protección adecuada en zonas de paso
- Sensores o temporizadores que no funcionan',
  '- Luminarias en zonas comunes
- Emergencias en escalera y pasillos
- Zonas con iluminación deficiente',
  '- ¿Se revisa periódicamente el funcionamiento del alumbrado de emergencia?
- ¿Hay contrato de mantenimiento eléctrico de zonas comunes?',
  '- Certificados eléctricos si existen
- Facturas de electricidad (suministros comunes)',
  330, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000010',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Telecomunicaciones, red y conectividad',
  'Telecomunicaciones',
  'Zonas comunes, rack, viviendas',
  'media',
  'Revisar la infraestructura visible de telecomunicaciones y su capacidad operativa para dar servicio en un activo de renta residencial.',
  '- Router, rack o armario de telecomunicaciones: ubicación, orden y ventilación
- Canalizaciones visibles: estado y orden
- Tomas de datos en viviendas: presencia y estado
- WiFi o red común si existe
- Cableado visible: estado y tipo',
  '- Cableado improvisado o desordenado sin canalizar
- Equipos sin ventilación adecuada o en zonas inadecuadas
- Tomas de datos dañadas o inexistentes
- Red completamente improvisada sin infraestructura estable
- Falta de acceso para intervención en equipos comunes',
  '- Rack o router: vista general y detalle
- Tomas de datos en viviendas
- Canalizaciones visibles
- Cableado visible',
  '- ¿Qué operador presta el servicio de telecomunicaciones?
- ¿Hay incidencias frecuentes de conectividad?
- ¿La red es común para todo el activo o por unidad?',
  '- Facturas de telecomunicaciones si existen',
  340, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0006-000000000011',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Ventilación de baños, cocinas y zonas interiores',
  'Ventilación',
  'Baños, cocinas, interiores',
  'alta',
  'Revisar visualmente la existencia y funcionamiento aparente de la ventilación en piezas interiores y zonas húmedas de las unidades visitadas.',
  '- Rejillas de extracción: presencia, ubicación y estado
- Extractores: existencia y estado aparente de funcionamiento
- Conductos de ventilación visibles
- Olores en baños o cocinas
- Humedad o condensación en paramentos
- Funcionamiento básico verificable',
  '- Rejillas de extracción tapadas, pintadas o selladas
- Extractores visiblemente parados, deteriorados o ausentes
- Olores persistentes a humedad o saneamiento
- Condensación visible en techos o paramentos de baños
- Baños completamente interiores sin ventilación mecánica aparente',
  '- Rejillas de extracción en baños y cocinas
- Extractores visibles
- Zonas con humedad o condensación aparente
- Cocinas o baños interiores',
  '- ¿Hay quejas de usuarios por olores o humedad ambiental?
- ¿Se realiza mantenimiento de la ventilación?
- ¿Existe plano o memoria de la instalación de ventilación?',
  '- Documentación técnica disponible
- Alcance DD Técnica No Invasiva',
  350, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000012',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Equipos eléctricos comunes y automatismos',
  'Electricidad y servicios comunes',
  'Accesos, zonas comunes, cuartos técnicos',
  'media',
  'Revisar los equipos eléctricos comunes, automatismos y elementos de control visibles que condicionan la operación del activo.',
  '- Portero automático o videoportero: estado y funcionamiento
- Cerraduras eléctricas de acceso
- Automatismos de apertura si existen
- Temporizadores y sensores de presencia
- Tomas eléctricas comunes
- Equipos en cuartos técnicos: orden, estado e identificación',
  '- Automatismos que no funcionan o que han sido inutilizados
- Equipos sin identificar en cuartos técnicos
- Cableado visto improvisado en zonas comunes
- Tomas comunes deterioradas o sin usar
- Fallos recurrentes de acceso por automatismos',
  '- Portero automático o videoportero
- Automatismos de acceso
- Tomas comunes
- Equipos en cuartos técnicos',
  '- ¿Hay fallos recurrentes en los sistemas de acceso?
- ¿Quién mantiene estos equipos?',
  '- Documentación operativa del activo',
  360, 'pendiente', NULL, false, false, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 4 · Fontanería, saneamiento y calefacción
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0006-000000000013',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Presión de agua y funcionamiento básico de puntos de consumo',
  'Fontanería',
  'Viviendas, baños, cocinas',
  'alta',
  'Revisar de forma visual y operativa básica la presión y el funcionamiento de los puntos de consumo accesibles durante la visita.',
  '- Presión en lavabos: apertura y caudal aparente
- Presión en duchas: caudal
- Funcionamiento de griferías: apertura, cierre y estanqueidad
- Tiempo de llegada de ACS si es posible verificar
- Ruidos o golpes de ariete en tuberías',
  '- Baja presión evidente en más de un punto de consumo
- Presión irregular o con fluctuaciones
- Golpes de ariete audibles al cerrar grifería
- Griferías con fugas activas o rastros de fugas
- ACS que tarda excesivamente en llegar o no llega',
  '- Puntos de consumo probados durante la visita
- Griferías con defectos visibles
- Evidencia visual de fugas o rastros',
  '- ¿Hay quejas de usuarios por baja presión o mala presión?
- ¿Hay incidencias frecuentes de ACS (agua caliente)?
- ¿Se han cambiado griferías o equipos recientemente?',
  '- Facturas de agua (Canal de Isabel II)
- Histórico de incidencias si existe',
  370, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000014',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Llaves de corte, válvulas y accesibilidad de mantenimiento',
  'Fontanería',
  'Viviendas, cuartos técnicos, contadores',
  'alta',
  'Verificar la accesibilidad y el estado visual de las llaves de corte y válvulas, como elemento clave para la operación y mantenimiento del activo.',
  '- Llave de corte general por unidad: existencia, accesibilidad e identificación
- Llaves de corte bajo aparatos: estado y accesibilidad
- Válvulas accesibles: estado y posibilidad de maniobra
- Corrosión visible en elementos de corte
- Facilidad de cierre en caso de emergencia',
  '- Llaves de corte por unidad inaccesibles o sin identificar
- Llaves o válvulas con corrosión que impida su maniobra
- Válvulas bloqueadas en posición fija
- Ausencia de cortes sectorizados por zona o planta
- Falta de identificación de llaves en batería de contadores',
  '- Llaves de corte general por unidad
- Llaves bajo aparatos sanitarios
- Válvulas en cuartos técnicos
- Elementos con deterioro visible',
  '- ¿Se sabe cómo cortar el agua por unidad sin afectar al resto?
- ¿Existe plano o esquema de la instalación de fontanería?',
  '- Batería de contadores
- Facturas Canal de Isabel II',
  380, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000015',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Pluviales, sumideros y evacuación de cubierta y patios',
  'Pluviales y saneamiento',
  'Cubierta, patios, exteriores',
  'alta',
  'Revisar visualmente la evacuación de aguas pluviales y los puntos de riesgo de filtración al interior.',
  '- Sumideros de cubierta: estado y limpieza
- Canalones si existen: estado y uniones
- Bajantes pluviales: estado y uniones visibles
- Pendientes en cubierta y patios: hacia puntos de evacuación
- Rejillas de patios: estado y limpieza
- Encuentros de bajantes pluviales con paramentos',
  '- Sumideros colmatados u obstruidos en cubierta o patios
- Agua estancada visible en cubierta o patios
- Bajantes pluviales con fisuras o fugas en uniones
- Rejillas deterioradas o con sedimentos
- Humedad en paramentos en zonas inferiores a bajantes',
  '- Sumideros de cubierta y patios
- Bajantes pluviales visibles
- Cubierta: zonas con agua estancada
- Patios: puntos de drenaje',
  '- ¿Se limpian periódicamente los sumideros de cubierta y patios?
- ¿Hay filtraciones al interior en días de lluvia?
- ¿Se han realizado reparaciones recientes en pluviales?',
  '- Histórico de incidencias si existe
- Alcance DD Técnica No Invasiva',
  390, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0006-000000000016',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Olores, ventilación sanitaria y posibles retornos de saneamiento',
  'Saneamiento',
  'Baños, cocinas, lavaderos, patios',
  'media',
  'Identificar visual y sensorialmente posibles problemas de olores, pérdida de cierre hidráulico en sifones o retornos de saneamiento.',
  '- Olores en baños: durante y después de apertura de grifería
- Olores en cocinas y lavaderos
- Olores en patios interiores o zonas comunes
- Estado visual de sifones accesibles
- Sumideros secos o con cierre hidráulico dudoso
- Ventilaciones sanitarias visibles en cubierta o patios',
  '- Olor persistente a saneamiento en baños o cocinas
- Sumideros sin agua o con cierre hidráulico perdido
- Sifones mal instalados o sin trampa visible
- Ventilación sanitaria inexistente o con salida dudosa
- Quejas recurrentes de usuarios por olores',
  '- Sifones visibles bajo lavabos
- Sumideros de ducha o cocina
- Registros accesibles
- Zonas con olor identificado',
  '- ¿Hay quejas frecuentes de usuarios por olores?
- ¿Se han realizado trabajos de desatasco recientemente?
- ¿Existe mantenimiento preventivo del saneamiento?',
  '- Histórico de incidencias si existe
- Facturas de mantenimiento si existen',
  400, 'pendiente', NULL, false, false, true
)

ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
