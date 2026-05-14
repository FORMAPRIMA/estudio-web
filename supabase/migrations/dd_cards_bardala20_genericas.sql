-- DD Visits — Cards genéricas complementarias Bardala 20
-- Due Diligence Técnica No Invasiva — capa estándar de revisión ejecutiva
-- Complementa dd_cards_bardala20.sql (cards específicas, IDs rango 0007-*, orden 10–240)
-- Rango de IDs: dd000000-0000-0000-0008-000000000001 a ...0016
-- orden: continúa desde 250 (las cards específicas terminan en 240)
-- Idempotente: ON CONFLICT (id) DO NOTHING — no borra ni modifica cards existentes

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
  'dd000000-0000-0000-0008-000000000001',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Recorrido general del edificio y lectura de estado global',
  'Dirección técnica DD',
  'Todo el activo',
  'alta',
  'Obtener una lectura global del estado aparente del edificio, identificando incidencias generales, zonas críticas y coherencia de uso.',
  '- Acceso principal
- Portal
- Escalera
- Ascensor desde perspectiva de uso
- Zonas comunes
- Circulaciones
- Estado general de conservación
- Limpieza y mantenimiento
- Señales de uso intensivo
- Sensación general de operación',
  '- Deterioro general superior al esperado para un edificio reciente
- Falta de mantenimiento visible
- Zonas comunes degradadas
- Señales de uso intensivo sin mantenimiento suficiente
- Inconsistencias entre uso real y uso previsto',
  '- Fachada principal
- Portal
- Escalera
- Ascensor
- Circulaciones
- Estado general por planta',
  '- ¿Qué uso operativo tiene actualmente el activo?
- ¿Qué zonas son comunes y cuáles privativas?
- ¿Existe responsable de mantenimiento?
- ¿Qué incidencias se han repetido desde la entrega?',
  '- Alcance DD Técnica No Invasiva
- Documentación general aportada por propiedad',
  250, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0008-000000000002',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Seguridad de uso y accesibilidad visual básica',
  'Seguridad de uso y accesibilidad',
  'Accesos, escaleras, ascensor, garaje y zonas comunes',
  'media',
  'Revisar visualmente condiciones básicas de seguridad de uso y accesibilidad dentro del alcance no invasivo.',
  '- Accesos
- Escaleras
- Barandillas
- Pasamanos
- Ascensor desde uso ordinario
- Resbaladicidad aparente
- Desniveles
- Iluminación de zonas comunes
- Obstáculos en recorridos
- Recorridos hacia garaje y trasteros',
  '- Barandillas inestables o insuficientes
- Desniveles sin protección
- Escaleras mal iluminadas
- Obstáculos en recorridos
- Zonas con riesgo de tropiezo o caída
- Accesos técnicos inseguros',
  '- Escaleras
- Barandillas
- Accesos
- Desniveles
- Recorridos comunes
- Garaje/sótano desde acceso',
  '- ¿Ha habido incidencias de caídas o reclamaciones?
- ¿Hay zonas con acceso restringido?
- ¿Hay incidencias recurrentes con el ascensor o accesos?',
  '- Alcance DD Técnica No Invasiva',
  260, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0008-000000000003',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Compatibilidad operativa para hold/renta',
  'Operación inmobiliaria',
  'Todo el activo',
  'media',
  'Evaluar visualmente si el activo funciona adecuadamente para una estrategia de hold/renta y qué puntos pueden afectar su operación.',
  '- Estado de zonas comunes
- Facilidad de mantenimiento
- Accesibilidad a instalaciones
- Robustez de acabados
- Zonas de mayor desgaste
- Distribuciones y recorridos
- Relación entre zonas privativas y comunes
- Zonas de servicio, basura, bicicletas, lavandería y sala común',
  '- Acabados delicados para uso intensivo
- Instalaciones difíciles de mantener
- Zonas sin acceso técnico
- Desgaste acelerado
- Necesidad de mantenimiento frecuente
- Espacios comunes que generan ambigüedad operativa',
  '- Zonas de alto tránsito
- Zonas comunes
- Sala común
- Cuarto de basuras
- Bicicletas
- Puntos de desgaste',
  '- ¿Cuál es el modelo actual de explotación?
- ¿Qué incidencias se repiten más?
- ¿Qué zonas requieren más mantenimiento?
- ¿Hay rotación frecuente de usuarios?',
  '- Facturas de mantenimiento
- Documentación operativa aportada',
  270, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0008-000000000004',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Documentación pendiente y limitaciones observadas en visita',
  'Control de alcance',
  'General',
  'alta',
  'Registrar durante la visita qué documentación o accesos siguen pendientes y qué limitaciones deben reflejarse en el informe.',
  '- Documentación no aportada
- Zonas no inspeccionadas
- Instalaciones no verificables
- Elementos ocultos
- Información verbal recibida
- Diferencia entre documentación recibida y documentación pendiente',
  '- Falta de documentación crítica
- Falta de acceso a zonas técnicas
- Información verbal sin soporte documental
- Áreas no inspeccionadas que condicionan conclusiones
- Equipos o sistemas que no pudieron revisarse visualmente',
  '- Zonas no accesibles
- Cuartos cerrados
- Elementos no verificables
- Accesos técnicos no disponibles',
  '- ¿Qué documentación queda pendiente?
- ¿Qué zonas no se pudieron visitar?
- ¿Qué información se entregará después?
- ¿Quién confirma las limitaciones de acceso?',
  '- Correos de solicitud documental
- Checklist DIU
- Alcance contratado',
  280, 'pendiente', NULL, false, false, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 2 · Construcción y acabados
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0008-000000000005',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Pavimentos interiores y exteriores',
  'Acabados',
  'Viviendas, zonas comunes, garaje, patio y terraza',
  'media',
  'Revisar el estado visual de pavimentos y su desgaste aparente.',
  '- Pavimentos interiores
- Pavimentos de zonas comunes
- Pavimentos en patio
- Pavimentos en terraza
- Pavimento de garaje
- Juntas
- Piezas sueltas
- Desniveles
- Golpes o desgaste',
  '- Piezas sueltas o rotas
- Desniveles o cejas
- Desgaste superior al esperado
- Pavimento levantado por humedad
- Juntas abiertas
- Pavimentos exteriores con mala pendiente',
  '- Pavimentos por zona
- Detalles de piezas dañadas
- Juntas abiertas
- Zonas húmedas o exteriores
- Garaje',
  '- ¿Hay quejas por pavimentos?
- ¿Se han hecho reparaciones recientes?
- ¿Hay zonas con entrada de agua o acumulación?',
  '- Alcance DD Técnica No Invasiva',
  290, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0008-000000000006',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Carpinterías exteriores, puertas a exterior y sellados',
  'Envolvente y acabados',
  'Fachadas, patio, viviendas y terraza',
  'alta',
  'Revisar estado visual de carpinterías exteriores y sellados, por su impacto en filtraciones, confort y mantenimiento.',
  '- Ventanas
- Puertas exteriores
- Puertas a terraza
- Sellados perimetrales
- Persianas o protecciones si existen
- Vierteaguas
- Encuentros con fachada
- Condensación visible',
  '- Sellados deteriorados
- Filtraciones alrededor de huecos
- Carpinterías desajustadas
- Condensaciones
- Fisuras en encuentros
- Dificultad de apertura/cierre',
  '- Ventanas por estancia
- Puertas a exterior
- Sellados
- Vierteaguas
- Encuentros con fachada',
  '- ¿Ha habido entrada de agua o aire?
- ¿Se han reparado ventanas o sellados?
- ¿Hay garantías vigentes de carpinterías?',
  '- Proyecto As Built
- Documentación técnica disponible',
  300, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0008-000000000007',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Puertas, cerrajería y elementos de uso frecuente',
  'Acabados y mantenimiento',
  'Accesos, viviendas, trasteros, garaje y zonas comunes',
  'media',
  'Revisar funcionamiento y desgaste de puertas, cerraduras, herrajes y elementos sometidos a uso frecuente.',
  '- Puerta de acceso
- Puertas de viviendas
- Puertas interiores
- Puertas de trasteros
- Puertas de garaje o accesos técnicos
- Cerraduras
- Herrajes
- Manillas
- Topes
- Elementos metálicos',
  '- Puertas que no cierran bien
- Cerraduras duras o deterioradas
- Herrajes sueltos
- Golpes repetidos
- Elementos metálicos corroídos
- Problemas de control de acceso',
  '- Puertas principales
- Herrajes deteriorados
- Cerraduras
- Elementos golpeados
- Puertas técnicas',
  '- ¿Hay problemas recurrentes de acceso?
- ¿Se cambian cerraduras con frecuencia?
- ¿Hay incidencias de usuarios con puertas o garaje?',
  '- Operación y mantenimiento del activo',
  310, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0008-000000000008',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Patios, encuentros exteriores y puntos de drenaje superficial',
  'Acabados exteriores',
  'Patio, terraza, accesos y zonas exteriores',
  'alta',
  'Revisar visualmente patios, terraza, encuentros exteriores y puntos de evacuación superficial por riesgo de humedad o filtración.',
  '- Pendientes
- Sumideros
- Encuentros con fachada
- Zócalos
- Pavimentos exteriores
- Jardineras o zonas ajardinadas si existen
- Umbrales de puertas exteriores
- Puntos de acumulación de agua',
  '- Agua estancada
- Sumideros obstruidos
- Humedad en zócalos
- Fisuras en encuentros
- Vegetación sin control
- Umbrales mal resueltos',
  '- Patio completo
- Terraza
- Sumideros
- Encuentros con fachada
- Zócalos
- Umbrales',
  '- ¿Hay incidencias de filtración desde patios o terraza?
- ¿Quién mantiene patios, terraza y sumideros?
- ¿Con qué frecuencia se limpian sumideros?',
  '- Alcance DD Técnica No Invasiva
- Proyecto As Built',
  320, 'pendiente', NULL, false, true, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 3 · Electricidad y climatización
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0008-000000000009',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Alumbrado común y alumbrado de emergencia',
  'Electricidad',
  'Portal, escaleras, zonas comunes, garaje y sótano',
  'alta',
  'Revisar estado visible y funcionamiento básico del alumbrado común y de emergencia.',
  '- Iluminación de portal
- Iluminación de escaleras
- Iluminación de pasillos
- Iluminación de garaje
- Iluminación de trasteros
- Alumbrado de emergencia
- Interruptores, sensores o temporizadores',
  '- Zonas comunes con iluminación insuficiente
- Emergencias apagadas o deterioradas
- Luminarias sin protección
- Sensores defectuosos
- Zonas oscuras en garaje o sótano',
  '- Luminarias comunes
- Emergencias
- Escalera iluminada
- Garaje
- Zonas oscuras',
  '- ¿Se revisa el alumbrado de emergencia?
- ¿Hay contrato de mantenimiento eléctrico?
- ¿Hay incidencias recurrentes en garaje o zonas comunes?',
  '- Certificados eléctricos
- Facturas de electricidad',
  330, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0008-000000000010',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Telecomunicaciones, red y conectividad',
  'Telecomunicaciones',
  'Zonas comunes, rack, viviendas y sala común',
  'media',
  'Revisar infraestructura visible de telecomunicaciones y su capacidad operativa para renta residencial.',
  '- Router o rack
- Canalizaciones
- Tomas de datos
- WiFi si existe
- Cableado visible
- Orden y ventilación de equipos
- Cobertura en zonas comunes
- Conectividad en viviendas si es verificable',
  '- Cableado desordenado
- Equipos sin ventilación
- Tomas dañadas
- Red improvisada
- Falta de acceso a equipos
- Quejas por conectividad',
  '- Rack o router
- Tomas
- Canalizaciones
- Cableado visible
- Sala común si tiene red',
  '- ¿Qué operador presta servicio?
- ¿Hay incidencias de conectividad?
- ¿La red es común o por vivienda?
- ¿Hay mantenimiento de telecomunicaciones?',
  '- Facturas de telecomunicaciones si existen
- Documentación operativa',
  340, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0008-000000000011',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Ventilación general de piezas interiores y zonas húmedas',
  'Ventilación',
  'Baños, cocinas, sala común, cuarto de basuras y zonas interiores',
  'media',
  'Revisar visualmente la existencia y funcionamiento aparente de ventilación en piezas interiores y zonas húmedas, como capa de verificación estándar de alcance genérico.',
  '- Rejillas de extracción
- Extractores
- Conductos visibles
- Olores
- Humedad o condensación
- Funcionamiento básico si es posible
- Ventilación de cuarto de basuras
- Ventilación de sala común si aplica',
  '- Rejillas tapadas
- Extractores apagados o ruidosos
- Olores persistentes
- Condensación
- Baños interiores sin ventilación aparente
- Cuarto de basuras con olores o mala ventilación',
  '- Rejillas
- Extractores
- Zonas con humedad
- Cocinas/baños interiores
- Cuarto de basuras',
  '- ¿Hay quejas por olores?
- ¿Se mantiene la ventilación?
- ¿Existe plano o memoria de ventilación?
- ¿Ha habido condensaciones?',
  '- Proyecto As Built
- Documentación técnica disponible
- Alcance DD no invasiva',
  350, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0008-000000000012',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Equipos eléctricos comunes y automatismos',
  'Electricidad y servicios comunes',
  'Accesos, zonas comunes, garaje, cuartos técnicos',
  'media',
  'Revisar equipos eléctricos comunes, automatismos y elementos de control visibles.',
  '- Portero automático
- Cerraduras eléctricas
- Automatismos de acceso
- Puerta de garaje si aplica
- Temporizadores
- Sensores
- Tomas comunes
- Equipos en cuartos técnicos',
  '- Automatismos que no funcionan
- Equipos sin identificar
- Cableado visto improvisado
- Tomas deterioradas
- Fallos recurrentes de acceso
- Puerta de garaje con funcionamiento irregular',
  '- Portero
- Automatismos
- Tomas comunes
- Equipos de control
- Puerta de garaje',
  '- ¿Hay fallos recurrentes de acceso?
- ¿Quién mantiene estos equipos?
- ¿Hay partes de avería o mantenimiento?',
  '- Documentación operativa del activo',
  360, 'pendiente', NULL, false, false, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 4 · Fontanería, saneamiento y calefacción
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0008-000000000013',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Presión de agua y funcionamiento básico de puntos de consumo',
  'Fontanería',
  'Viviendas, baños, cocinas, sala común y lavandería',
  'alta',
  'Revisar de forma visual y operativa básica la presión y funcionamiento de puntos de consumo accesibles, como verificación estándar complementaria.',
  '- Presión en lavabos
- Presión en duchas
- Presión en cocina
- Presión en lavandería
- Funcionamiento de griferías
- Tiempo básico de respuesta de ACS si aplica
- Ruidos o golpes de ariete',
  '- Baja presión
- Presión irregular
- Golpes de ariete
- Griferías con fugas
- ACS tarda demasiado
- Diferencias importantes entre plantas',
  '- Puntos probados
- Griferías defectuosas
- Evidencia de fugas
- Zonas con baja presión',
  '- ¿Hay quejas de presión?
- ¿Hay incidencias de ACS?
- ¿Se han cambiado griferías o equipos?
- ¿Hay diferencias entre viviendas?',
  '- Facturas de agua
- Histórico de incidencias si existe
- Proyecto As Built',
  370, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0008-000000000014',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Llaves de corte, válvulas y accesibilidad de mantenimiento',
  'Fontanería',
  'Viviendas, cuartos técnicos, contadores, cuarto de fontanería',
  'alta',
  'Verificar accesibilidad y estado visual de llaves de corte, válvulas y elementos básicos de mantenimiento.',
  '- Llave de corte por vivienda
- Llaves bajo aparatos
- Válvulas accesibles
- Identificación
- Estado de corrosión
- Facilidad de cierre
- Sectorización de usos comunes
- Válvulas en cuarto de fontanería',
  '- Llaves inaccesibles
- Llaves sin identificar
- Corrosión
- Válvulas bloqueadas
- Falta de cortes sectorizados
- Mantenimiento difícil',
  '- Llaves generales
- Llaves por vivienda
- Válvulas en cuartos
- Elementos deteriorados
- Etiquetado',
  '- ¿Se sabe cortar agua por vivienda?
- ¿Hay planos o esquema de fontanería?
- ¿Quién opera el sistema en caso de fuga?',
  '- Requisitos de batería de contadores
- Facturas Canal de Isabel II
- Proyecto As Built',
  380, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0008-000000000015',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Pluviales, sumideros y evacuación de cubierta, patio y terraza',
  'Pluviales y saneamiento',
  'Cubierta, patio, terraza, exteriores y sótano',
  'alta',
  'Revisar visualmente la evacuación de aguas pluviales y puntos de riesgo de filtración, como capa de verificación estándar complementaria.',
  '- Sumideros
- Canalones si existen
- Bajantes pluviales
- Pendientes
- Rejillas
- Patio
- Terraza
- Cubierta
- Sótano/garaje bajo zonas exteriores',
  '- Sumideros obstruidos
- Agua estancada
- Bajantes con fugas
- Rejillas deterioradas
- Humedad en zonas inferiores
- Pendientes insuficientes',
  '- Sumideros
- Bajantes
- Cubierta
- Patio
- Terraza
- Zonas con agua estancada
- Humedades bajo rasante',
  '- ¿Se limpian sumideros periódicamente?
- ¿Hay filtraciones en lluvia?
- ¿Se han reparado pluviales?
- ¿Ha habido agua en sótano/garaje?',
  '- Histórico de incidencias si existe
- Proyecto As Built
- Alcance DD no invasiva',
  390, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0008-000000000016',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Olores, ventilación sanitaria y posibles retornos de saneamiento',
  'Saneamiento',
  'Baños, cocinas, lavandería, cuarto de basuras, patio y garaje',
  'media',
  'Identificar visual y sensorialmente posibles problemas de olores, sifonados o retornos de saneamiento.',
  '- Olores en baños
- Olores en cocinas
- Olores en lavandería
- Olores en cuarto de basuras
- Olores en patio/garaje
- Sifones
- Sumideros secos
- Ventilaciones sanitarias visibles',
  '- Olor persistente
- Sumideros sin agua
- Sifones mal instalados
- Ventilación sanitaria inexistente o dudosa
- Quejas recurrentes
- Olores relacionados con cuarto de basuras o garaje',
  '- Sifones
- Sumideros
- Registros
- Cuarto de basuras
- Zonas con olor',
  '- ¿Hay quejas por olores?
- ¿Se han realizado desatascos?
- ¿Hay mantenimiento de saneamiento?
- ¿Hay incidencias en cuarto de basuras?',
  '- Histórico de incidencias
- Facturas de mantenimiento si existen
- Proyecto As Built',
  400, 'pendiente', NULL, false, true, true
)

ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
