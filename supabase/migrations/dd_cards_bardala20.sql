-- DD Visits — Cards específicas Bardala 20
-- Due Diligence Técnica No Invasiva
-- Sustituye las 12 cards placeholder por 24 cards con contenido técnico específico del activo.
-- Idempotente: DELETE condicional (solo sin datos de usuario) + ON CONFLICT DO NOTHING en inserts.

BEGIN;

-- ─── Actualizar datos del activo ──────────────────────────────────────────────

UPDATE public.dd_assets
SET
  cliente       = 'Grupo Hive / ARGIS TETUAN SL',
  superficie_m2 = 557,
  uso_previsto  = 'Hold / renta residencial',
  alcance_dd    = 'Due Diligence Técnica No Invasiva — alcance ejecutivo, visual, no destructivo. Edificio de nueva construcción con 3 viviendas, garaje, trasteros, cuarto de fontanería, sala común, patio, cubierta técnica no transitable y equipos comunes (aerotermia, VRF, grupo de presión, ascensor, CCTV). Base documental relativamente completa con puntos sensibles a confirmar en visita.',
  updated_at    = now()
WHERE id = 'dd000000-0000-0000-0001-000000000001';

-- ─── Actualizar zonas previstas de la visita ──────────────────────────────────

UPDATE public.dd_visits
SET
  zonas_previstas = ARRAY[
    'Fachada exterior y patio',
    'Acceso, portal y escalera',
    'Planta baja — sala común, cuarto de basuras, zona bicicletas',
    'Sótano — garaje, trasteros y cuarto de fontanería',
    'Vivienda 1ª',
    'Vivienda 2ª',
    'Ático / vivienda 3ª y terraza',
    'Cubierta técnica no transitable',
    'Batería de contadores y cuadros eléctricos',
    'Cuarto técnico de instalaciones'
  ],
  updated_at = now()
WHERE id = 'dd000000-0000-0000-0002-000000000001';

-- ─── Eliminar cards placeholder sin datos de usuario ─────────────────────────
-- Solo elimina si: estado = pendiente, sin comentario técnico y sin media adjunta.

DELETE FROM public.dd_cards
WHERE
  id IN (
    'dd000000-0000-0000-0003-000000000001',
    'dd000000-0000-0000-0003-000000000002',
    'dd000000-0000-0000-0003-000000000003',
    'dd000000-0000-0000-0003-000000000004',
    'dd000000-0000-0000-0003-000000000005',
    'dd000000-0000-0000-0003-000000000006',
    'dd000000-0000-0000-0003-000000000007',
    'dd000000-0000-0000-0003-000000000008',
    'dd000000-0000-0000-0003-000000000009',
    'dd000000-0000-0000-0003-000000000010',
    'dd000000-0000-0000-0003-000000000011',
    'dd000000-0000-0000-0003-000000000012'
  )
  AND estado = 'pendiente'
  AND comentario_tecnico IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.dd_card_media WHERE card_id = dd_cards.id
  );

-- ─── Cards específicas Bardala 20 ────────────────────────────────────────────
-- Rango de IDs: dd000000-0000-0000-0007-000000000001 a ...0024
-- orden: múltiplos de 10 para facilitar reordenación posterior

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
  'dd000000-0000-0000-0007-000000000001',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Alcance real de visita y zonas accesibles',
  'Dirección técnica DD',
  'Todo el activo',
  'alta',
  'Confirmar el alcance real de inspección y dejar trazabilidad clara de zonas inspeccionadas, zonas no accesibles y limitaciones de la visita.',
  '- Confirmar acceso a mínimo dos de las tres viviendas
- Confirmar acceso a sótano, garaje, trasteros, cuarto de fontanería, planta baja, patio y cubierta
- Confirmar acceso a zona de equipos, cuadros eléctricos y batería de contadores
- Registrar zonas no accesibles y motivo
- Confirmar quién acompaña la visita y quién valida accesos',
  '- Viviendas sin acceso sin justificación
- Cubierta inaccesible
- Cuartos técnicos cerrados sin posibilidad de revisión
- Falta de acceso a cuarto de fontanería o batería de contadores
- Imposibilidad de revisar equipos comunes (aerotermia, VRF, grupo de presión)',
  '- Acceso principal: fachada y portal
- Zonas no accesibles durante la visita
- Puertas cerradas o cuartos técnicos sin acceso
- Vista representativa por planta inspeccionada',
  '- ¿Qué zonas no se podrán visitar y por qué?
- ¿Se podrá acceder a cubierta y cuarto de fontanería?
- ¿Hay viviendas ocupadas con acceso restringido?',
  '- Alcance Due Diligence Técnica No Invasiva
- Correos de coordinación de visita',
  10, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000002',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Licencia modificada, primera ocupación y documentación final',
  'Revisión documental técnica',
  'General / documental',
  'alta',
  'Confirmar que la documentación final del edificio está completa, vigente y corresponde al estado construido.',
  '- Confirmar que la licencia modificada a 3 viviendas es la última versión vigente
- Confirmar existencia de licencia de primera ocupación, declaración responsable de primera ocupación o documento equivalente vigente
- Confirmar si el CFO visado corresponde al estado final construido
- Verificar disponibilidad operativa del Libro del Edificio
- Confirmar existencia de seguro decenal vigente y copia operativa',
  '- Solo existe solicitud de primera ocupación pero no resolución o documento vigente
- Falta de Libro del Edificio o imposibilidad de entregarlo
- Falta de certificado o póliza vigente de seguro decenal
- Diferencias relevantes entre el estado real, la licencia modificada y el As Built',
  '- No aplica salvo documentación física disponible en visita',
  '- ¿Existe licencia o DR de primera ocupación vigente?
- ¿Pueden compartir Libro del Edificio completo?
- ¿Existe certificado vigente del seguro decenal?
- ¿El As Built entregado es el documento final operativo?',
  '- Licencia urbanística residencial y modificación
- Notificación de resolución
- Certificado Final de Obra visado
- Escritura de obra nueva finalizada
- Nota simple registral',
  20, 'pendiente', NULL, true, true, true
),

(
  'dd000000-0000-0000-0007-000000000003',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Coherencia entre As Built, obra nueva registrada y estado real',
  'Arquitectura y control documental',
  'Todo el activo',
  'alta',
  'Verificar visualmente que el edificio ejecutado coincide con la documentación As Built y con la descripción registrada en escritura de obra nueva.',
  '- Confirmar existencia real de 3 viviendas (1ª, 2ª y ático)
- Confirmar planta baja: acceso, sala común, cuarto de basuras, zona de bicicletas y patio
- Confirmar sótano: garaje, trasteros y cuarto de fontanería
- Confirmar ático con terraza y acceso a cubierta
- Verificar si existen espacios usados de manera distinta a lo documentado',
  '- Usos no documentados en ningún plano ni escritura
- Espacios convertidos a habitaciones o usos que no corresponden al As Built
- Cambios en planta baja o zonas comunes no documentados
- Diferencias relevantes entre planos As Built y realidad construida',
  '- Planta baja: sala común, patio y accesos
- Sótano: garaje y trasteros
- Viviendas representativas
- Ático y terraza
- Cualquier espacio de uso dudoso o no documentado',
  '- ¿Hubo cambios posteriores a la emisión del As Built?
- ¿El activo se explota por vivienda completa, habitaciones o fórmula mixta?
- ¿Existen planos finales actualizados posteriores al As Built entregado?',
  '- Proyecto As Built
- Escritura de obra nueva finalizada
- Nota simple registral',
  30, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000004',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Discrepancias de superficies entre documentos',
  'Control documental técnico',
  'General / documental',
  'media',
  'Dejar identificado si existen diferencias de superficies entre licencia, As Built, nota simple y datos comerciales, y qué superficie se está usando como referencia operativa.',
  '- Contrastar superficies declaradas en cada documento disponible
- Revisar si la superficie durante la visita es coherente con el alcance documental
- Identificar si la diferencia puede deberse a criterios de cómputo: rasante, bajo rasante, construida, útil o comercial
- Dejar constancia de qué superficie está usando la propiedad para la operación y la compraventa',
  '- Superficies muy distintas entre documentos sin explicación técnica aparente
- Diferencia entre superficie registral, construida computable y dato comercial
- Uso de superficie comercial para pricing que no corresponde a ningún documento técnico',
  '- No aplica salvo planos o documentación física disponible en visita',
  '- ¿Cuál es la superficie que se está usando para la operación y la compraventa?
- ¿Cuál es la superficie construida total considerada por la propiedad?
- ¿Existe cuadro de superficies final consolidado entre todos los documentos?',
  '- Licencia urbanística y modificación
- Proyecto As Built
- Nota simple registral
- Escritura de obra nueva',
  40, 'pendiente', NULL, true, false, true
),

(
  'dd000000-0000-0000-0007-000000000005',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Cubierta no transitable, accesos y equipos técnicos',
  'Cubierta, mantenimiento y seguridad',
  'Cubierta, terraza ático y zonas técnicas',
  'alta',
  'Revisar visualmente la cubierta no transitable, sus accesos de mantenimiento seguros y el estado visible de los equipos técnicos instalados.',
  '- Acceso técnico: pates, escotilla o acceso por terraza de ático
- Seguridad del acceso y elementos de protección
- Estado de impermeabilización visible
- Sumideros: estado y limpieza
- Pendientes y encuentros con paramentos y petos
- Equipos instalados: aerotermia, VRF, ventilación u otros
- Soportes, bancadas y silentblocks
- Riesgo de ruido o vibración hacia ático',
  '- Acceso inseguro o impracticable sin EPI
- Equipos sin acceso razonable para mantenimiento
- Sumideros obstruidos o sin rejilla
- Impermeabilización con levantamientos, burbujeos o parches visibles
- Soportes corroídos, inestables o sin silentblocks
- Riesgo de transmisión de ruido o vibración hacia la vivienda ático',
  '- Acceso a cubierta: escotilla o pates
- Vista general de cubierta
- Equipos: vistas generales y soportes
- Sumideros y pendientes
- Petos y encuentros
- Detalle de impermeabilización en zona conflictiva',
  '- ¿Quién tiene acceso habitual a cubierta?
- ¿Hay protocolo de mantenimiento de cubierta?
- ¿Ha habido filtraciones desde cubierta o quejas por ruido en el ático?',
  '- Proyecto As Built
- Certificado energético
- Documentación de aerotermia y climatización (Ness Energy)',
  50, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000006',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000001',
  'Planta baja, sala común, patio y uso operativo',
  'Operación y zonas comunes',
  'Planta baja y patio',
  'alta',
  'Revisar si la planta baja y el patio funcionan correctamente para la operación prevista del activo como hold/renta.',
  '- Sala común: estado, uso real y mantenimiento
- Cuarto de basuras: ventilación, estado y limpieza
- Zona de bicicletas: estado y uso
- Patio posterior: pavimento, drenajes y encuentros con fachada
- Accesos: estado general y señalización
- Desgaste visible por uso operativo',
  '- Patio con pendientes insuficientes o agua estancada
- Humedades en encuentros entre pavimento exterior y base de fachada
- Cuarto de basuras sin ventilación adecuada u olor persistente
- Sala común usada de forma distinta a lo documentado
- Desgaste visible incompatible con antigüedad del edificio',
  '- Sala común: vista general
- Patio: vista general y sumideros
- Cuarto de basuras
- Zona de bicicletas
- Encuentros de pavimento exterior con fachada',
  '- ¿Qué uso operativo tiene actualmente la sala común?
- ¿Quién mantiene el patio y el cuarto de basuras?
- ¿Hay incidencias de olores o filtraciones en planta baja?',
  '- Proyecto As Built
- Escritura de obra nueva',
  60, 'pendiente', NULL, false, true, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 2 · Construcción y acabados
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0007-000000000007',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Fachada SATE, huecos y encuentros con carpinterías',
  'Envolvente y acabados exteriores',
  'Fachada principal y fachada posterior / patio',
  'alta',
  'Revisar el estado visual del SATE, los sellados perimetrales de huecos y los encuentros con carpinterías exteriores.',
  '- Fisuras en el SATE: verticales, horizontales u oblicuas
- Golpes, deterioro o manchas superficiales
- Sellados perimetrales de ventanas y puertas exteriores
- Vierteaguas: estado y encuentro con fachada
- Encuentros entre carpintería y SATE
- Fachada a calle y fachada a patio',
  '- Fisuras lineales en SATE que puedan indicar puente térmico o movimiento
- Sellados perimetrales abiertos o deteriorados (riesgo de entrada de agua)
- Manchas de humedad bajo huecos
- Desprendimientos superficiales del SATE
- Encuentros mal resueltos entre carpintería y revestimiento',
  '- Fachada completa: vista general
- Huecos representativos: sellado perimetral y vierteaguas
- Zonas con fisuras o manchas visibles
- Detalle de encuentros problemáticos',
  '- ¿Ha habido entradas de agua por ventanas o encuentros de fachada?
- ¿Se han realizado repasos o reparaciones en fachada?
- ¿Existe garantía activa sobre SATE o carpinterías exteriores?',
  '- Proyecto As Built
- Certificado energético
- Documentación de fachada',
  70, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000008',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Acabados interiores en viviendas y desgaste operativo',
  'Acabados interiores',
  'Viviendas 1ª, 2ª y ático',
  'media',
  'Evaluar el estado visual de los acabados interiores de las viviendas y su desgaste aparente en relación con el tiempo en operación.',
  '- Pintura: estado, manchas, golpes y reparaciones puntuales
- Rodapiés: remates, golpes, piezas sueltas
- Pavimentos: estado, desgaste y piezas dañadas
- Puertas interiores: ajuste y herrajes
- Mobiliario fijo si existe: estado y funcionamiento
- Zonas de mayor tránsito: pasillos, accesos y cocinas',
  '- Desgaste general superior al esperado para la antigüedad del edificio
- Pintura con deterioro generalizado que requiera repaso completo
- Rodapiés con piezas sueltas o desprendidas
- Reparaciones puntuales visibles en múltiples puntos',
  '- Estado representativo de cada vivienda visitada
- Zonas de mayor desgaste visible
- Rodapiés y encuentros
- Pavimentos
- Puertas con deterioro',
  '- ¿Cuánto tiempo lleva el edificio en operación?
- ¿Se han realizado repasos generales de pintura?
- ¿Hay incidencias recurrentes de usuarios en acabados?',
  '- Proyecto As Built
- Histórico de incidencias si existe',
  80, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0007-000000000009',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Falsos techos, registros y accesibilidad a instalaciones',
  'Falsos techos y mantenimiento',
  'Viviendas, baños, pasillos, zonas comunes',
  'alta',
  'Revisar si los falsos techos permiten mantenimiento razonable de las instalaciones ocultas y si hay signos de incidencias.',
  '- Registros en falsos techos: presencia y accesibilidad
- Rejillas de ventilación e instalaciones
- Manchas de humedad en placas
- Fisuras o deformaciones visibles
- Zonas con instalaciones ocultas sin registro
- Accesibilidad a unidades interiores de climatización y conductos',
  '- Ausencia total de registros en zonas con instalaciones ocultas
- Manchas de humedad activa en falso techo
- Deformaciones visibles en placas
- Instalaciones completamente inaccesibles para mantenimiento',
  '- Registros existentes: estado y accesibilidad
- Falsos techos en baños: posibles manchas
- Pasillos y zonas de paso
- Rejillas y pasos de instalaciones',
  '- ¿Se han abierto falsos techos por averías de instalaciones?
- ¿Dónde se accede a equipos o conductos ocultos?
- ¿Existen planos de instalaciones con trazado por falso techo?',
  '- Proyecto As Built
- Documentación de climatización y ventilación',
  90, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000010',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Baños en suite, platos de ducha y sellados',
  'Acabados en zonas húmedas',
  'Baños de viviendas',
  'alta',
  'Revisar visualmente los baños de las viviendas por riesgo de filtraciones, deterioro de sellados o incidencias de mantenimiento recurrentes.',
  '- Platos de ducha: nivelación, sumidero y sellado
- Siliconas: estado en platos, lavabos y mamparas
- Alicatados: estado, lechadas y piezas sueltas
- Encuentros de azulejo con mamparas o carpinterías
- Muebles bajo lavabo: humedad
- Falsos techos de baños: manchas',
  '- Silicona deteriorada, abierta o inexistente en ducha o lavabo
- Lechadas con juntas abiertas (riesgo de filtración)
- Humedad visible en muebles de baño o paramentos
- Fisuras en alicatados
- Pendiente deficiente en plato de ducha',
  '- Platos de ducha: nivelación y sellado
- Juntas y siliconas: detalle
- Bajo lavabos: posibles humedades
- Falsos techos en baños
- Alicatados con incidencias',
  '- ¿Ha habido filtraciones entre plantas relacionadas con baños?
- ¿Hay partes de mantenimiento por incidencias en baños?
- ¿Se han renovado sellados o siliconas recientemente?',
  '- Proyecto As Built
- Histórico de incidencias si existe',
  100, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000011',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Garaje, trasteros y acabados en sótano',
  'Acabados y sótano',
  'Sótano, garaje y trasteros',
  'alta',
  'Revisar el estado visual del sótano, el garaje y los trasteros, con especial atención a humedades, ventilación y estado general.',
  '- Pavimentos del garaje: estado y manchas
- Muros y techos: signos de humedad, manchas o fisuras
- Trasteros: estado de acabados y ventilación
- Puertas de trasteros: ajuste y cerrajería
- Rampa y acceso de vehículos: estado
- Golpes en pilares o muros de garaje
- Pintura y revestimiento del sótano',
  '- Humedades activas en muros o techos del sótano
- Pintura levantada o eflorescencias en muro
- Fisuras en estructura visible del sótano
- Olores persistentes
- Trasteros con ventilación deficiente
- Golpes o deterioro relevante en estructura del garaje',
  '- Garaje: vista general
- Trasteros: estado y detalle
- Muros del sótano: zonas con humedad o eflorescencias
- Techos: manchas o fisuras
- Rampa de acceso',
  '- ¿Ha habido filtraciones en sótano?
- ¿Hay incidencias de ventilación u olores en garaje?
- ¿Se usa el garaje habitualmente?',
  '- Proyecto As Built
- Escritura de obra nueva',
  110, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000012',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'Terraza de ático y encuentros exteriores',
  'Acabados exteriores e impermeabilización visible',
  'Terraza ático',
  'alta',
  'Revisar la terraza del ático como zona de uso privativo con impacto directo sobre cubierta, impermeabilización y riesgo de filtración.',
  '- Pavimento exterior: estado, pendientes y juntas
- Sumideros: estado y limpieza
- Encuentros entre pavimento y base de fachada
- Petos: estado, capa de remate e impermeabilización visible
- Puertas de salida a terraza: sellado y umbral
- Señales de filtración hacia la planta inferior
- Elementos de acceso a cubierta si existen desde terraza',
  '- Agua estancada en terraza sin pendientes suficientes
- Sumideros obstruidos o colmatados
- Sellados deteriorados en encuentros de pavimento con petos o fachada
- Manchas de humedad en paramentos interiores bajo terraza
- Acceso a cubierta desde terraza en condiciones inseguras',
  '- Terraza: vista general
- Sumideros: estado y detalle
- Encuentros entre pavimento y fachada o petos
- Puertas de salida a terraza
- Petos: remate y estado',
  '- ¿La terraza es de uso exclusivo del ático?
- ¿Quién mantiene la terraza y realiza limpieza de sumideros?
- ¿Ha habido filtraciones desde terraza?',
  '- Proyecto As Built
- Escritura de obra nueva',
  120, 'pendiente', NULL, false, true, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 3 · Electricidad y climatización
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0007-000000000013',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Suministro eléctrico general Bardala 20 Bajo',
  'Electricidad',
  'Bajo, servicios generales y cuadros',
  'alta',
  'Identificar qué alimenta el suministro eléctrico general con tarifa 3.0TD y verificar si el consumo y la potencia contratada tienen explicación técnica coherente.',
  '- Localizar el cuadro general asociado al suministro Bardala 20 Bajo
- Identificar las cargas conectadas: aerotermia, VRF/climatización, bombas, grupo de presión, ascensor, garaje, ventilación, CCTV e iluminación común
- Verificar etiquetado de circuitos
- Comprobar si la potencia 3.0TD contratada es coherente con las cargas detectadas
- Verificar estado general del cuadro y protecciones',
  '- Cargas conectadas no identificables
- Cuadro sin etiquetado o con etiquetado ilegible
- Consumo mensual elevado sin explicación por las cargas visibles
- Potencia 3.0TD sobredimensionada o mal optimizada
- Servicios comunes y privativos mezclados sin claridad',
  '- Contador y cabecera del suministro
- Cuadro general: frontal y abierto
- Etiquetado de circuitos
- Protecciones
- Cargas principales conectadas',
  '- ¿Qué alimenta exactamente el suministro Bardala 20 Bajo con tarifa 3.0TD?
- ¿Existe esquema unifilar de la instalación?
- ¿Se ha analizado la optimización de potencia contratada?
- ¿Hay histórico de averías o disparos de protecciones?',
  '- Factura Gesternova Bardala 20 Bajo
- Certificados de instalación de baja tensión
- Proyecto As Built',
  130, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000014',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Cuadros eléctricos y certificados de baja tensión',
  'Electricidad',
  'Viviendas, garaje, servicios comunes, LGA',
  'alta',
  'Revisar visualmente los cuadros eléctricos de viviendas y zonas comunes, verificando su correspondencia con los certificados de instalación aportados.',
  '- Cuadro de vivienda 1ª: protecciones y etiquetado
- Cuadro de vivienda 2ª: protecciones y etiquetado
- Cuadro ático: protecciones y etiquetado
- Cuadro de garaje: estado y protecciones
- Cuadro de servicios comunes: etiquetado y orden
- LGA (Línea General de Alimentación): estado y accesibilidad
- Diferenciales, magnetotérmicos y protección contra sobretensiones',
  '- Cuadros sin identificar o sin etiquetado claro
- Circuitos sin etiquetar que no permitan identificar cargas
- Protecciones ausentes o en estado dudoso
- Cableado desordenado o improvisado
- Diferencias evidentes entre los CIE aportados y la instalación real visible',
  '- Cada cuadro: frontal y abierto con protecciones
- Etiquetado de circuitos
- LGA: estado y accesibilidad',
  '- ¿Los certificados de instalación eléctrica (CIE) aportados son los definitivos y están actualizados?
- ¿Existe esquema unifilar actualizado?
- ¿Hay revisiones o ampliaciones posteriores a la puesta en marcha?',
  '- Certificados de instalación de baja tensión
- Proyecto As Built',
  140, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000015',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Aerotermia, ACS y alimentación eléctrica',
  'Electricidad y climatización',
  'Cubierta, cuarto técnico, servicios generales',
  'alta',
  'Revisar el estado visual, la alimentación eléctrica y el mantenimiento aparente del sistema de aerotermia que da servicio al ACS centralizado.',
  '- Equipo de aerotermia: ubicación, estado y accesibilidad
- Alimentación eléctrica: cuadro y protección dedicada
- Display del equipo: temperatura, alarmas o errores visibles
- Condensados: desagüe y estado
- Soportes y bancada: corrosión y estabilidad
- Ruido o vibración aparente
- Mantenimiento aparente: limpieza y estado general',
  '- Equipo sin acceso claro para mantenimiento
- Alarmas o mensajes de error visibles en display
- Falta evidente de mantenimiento (suciedad, acumulación)
- Condensados sin desagüe resuelto correctamente
- Ruido o vibración que pueda transmitirse a la vivienda ático
- Instalación eléctrica asociada no identificada en cuadro',
  '- Equipo completo: vista general
- Placa de características
- Display si es accesible
- Alimentación eléctrica y protección
- Condensados y desagüe
- Soportes y bancada',
  '- ¿Existe parte técnico del último mantenimiento realizado por Ness Energy?
- ¿Qué servicio incluye el contrato con Ness Energy?
- ¿Hay averías recurrentes o alarmas frecuentes?
- ¿Cuál es la temperatura de consigna y horario de operación del ACS?',
  '- Factura Ness Energy
- Certificado energético
- Proyecto As Built',
  150, 'pendiente', NULL, true, true, true
),

(
  'dd000000-0000-0000-0007-000000000016',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Sistema VRF, climatización y unidades exteriores',
  'Climatización',
  'Cubierta y viviendas',
  'alta',
  'Revisar visualmente el sistema de climatización VRF, las unidades exteriores y el estado de la instalación en viviendas.',
  '- Unidades exteriores: ubicación en cubierta, estado y soportes
- Silentblocks y bancada: estado y eficacia antivibratoria
- Líneas frigoríficas: aislamiento y estado
- Desagüe de condensados de unidades exteriores
- Unidades interiores en viviendas: estado y filtros
- Controles por estancia: funcionamiento aparente
- Accesibilidad para mantenimiento',
  '- Aislamiento de líneas frigoríficas dañado o ausente
- Condensados sin solución de evacuación adecuada
- Acceso muy difícil para mantenimiento de unidades exteriores
- Ruido o vibración evidente
- Filtros visiblemente sucios en unidades interiores
- Equipos sin identificación o sin etiquetado de circuito',
  '- Unidades exteriores: vista general y soportes
- Líneas frigoríficas: estado del aislamiento
- Condensados: desagüe
- Unidades interiores representativas
- Controles de usuario',
  '- ¿Existe contrato o partes de mantenimiento del VRF?
- ¿Hay quejas por climatización en alguna vivienda?
- ¿El consumo eléctrico del suministro general incluye la climatización de viviendas?',
  '- Proyecto As Built
- Certificado energético
- Factura Gesternova (suministro general)',
  160, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000017',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'Ventilación de garaje, baños, cocinas y zonas interiores',
  'Ventilación',
  'Garaje, baños, cocinas, zonas comunes',
  'alta',
  'Revisar visualmente la existencia y funcionamiento aparente de la ventilación en el garaje y en las piezas interiores de las viviendas.',
  '- Ventilación de garaje: rejillas, extractor o ventilación natural, sensor de CO si existe
- Ventilación de baños: rejillas o extractores
- Ventilación de cocinas: extractor si existe
- Conductos visibles: estado
- Olores en garaje o baños
- Funcionamiento básico aparente',
  '- Garaje sin ventilación mecánica ni natural suficiente aparente
- Olores persistentes en garaje
- Extractores apagados, ruidosos o claramente no operativos
- Rejillas tapadas o selladas
- Condensación visible en piezas sin ventilación suficiente',
  '- Ventilación de garaje: rejillas o extractores
- Baños: extractores y rejillas
- Cocinas: extractor
- Garaje: estado general de ventilación',
  '- ¿Existe parte de mantenimiento de la ventilación del garaje?
- ¿Hay quejas por olores en garaje o en viviendas?
- ¿La ventilación del garaje funciona de forma automática por sensor de CO?',
  '- Proyecto As Built
- Documentación de instalaciones',
  170, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000018',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000003',
  'CCTV, telecomunicaciones y sistemas comunes',
  'Telecomunicaciones y seguridad',
  'Zonas comunes, acceso, garaje, rack',
  'media',
  'Revisar la infraestructura visible de CCTV, telecomunicaciones y sistemas comunes, contrastando con la facturación recibida.',
  '- Cámaras: número, ubicación y estado aparente
- Grabador o rack: ubicación, estado y accesibilidad
- Alimentación eléctrica del sistema
- Cableado visible: estado y orden
- Cartelería de videovigilancia en accesos
- Portero automático o control de acceso
- Red y telecomunicaciones: tomas, canalización y equipos',
  '- Cámaras visiblemente no operativas o deterioradas
- Ausencia de cartelería reglamentaria de videovigilancia
- Grabador inaccesible o en ubicación inadecuada
- Cableado improvisado o sin canalizar
- Factura de CCTV agregada sin evidencia de sistema operativo en el activo',
  '- Cámaras: ubicación y estado
- Grabador o rack
- Cartelería de videovigilancia
- Cableado visible
- Control de acceso o portero',
  '- ¿Cuántas cámaras tiene instaladas Bardala 20?
- ¿Quién mantiene el sistema de CCTV?
- ¿Dónde está el grabador y cuántos días de grabación conserva?
- ¿Ha habido incidencias de seguridad en el activo?',
  '- Factura SeguridadTV (factura agregada con otros activos)
- Documentación operativa del activo',
  180, 'pendiente', NULL, false, false, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 4 · Fontanería, saneamiento y calefacción
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0007-000000000019',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Esquema de contadores de agua y usos asociados',
  'Fontanería',
  'Batería de contadores / cuarto técnico',
  'alta',
  'Verificar la correspondencia entre los contadores de agua y los usos reales del activo, contrastando con las facturas recibidas.',
  '- Contadores de vivienda 1ª, 2ª y 3ª (ático): etiquetado y estado
- Contador de ACS: identificación y consumo aparente
- Contador de cocina común: identificación
- Contador de lavandería: identificación
- Posible contador de riego u otros usos
- Llaves de corte: accesibilidad e identificación',
  '- Contadores sin identificar o con etiquetado ilegible
- Derivaciones cuya función no está clara
- Dificultad para cortar el agua por uso sin afectar otros
- Consumos que no cuadran con los documentados en facturas
- Falta de correspondencia entre número de contadores y usos declarados',
  '- Batería completa de contadores: vista general
- Detalle de etiquetas individuales
- Llaves de corte
- Esquema si existe en cuarto',
  '- ¿Qué contador alimenta exactamente cada uso?
- ¿Existe contador de riego o de zonas comunes adicional?
- ¿Cómo se reparte el consumo de ACS entre viviendas y zonas comunes?
- ¿Existe esquema de fontanería o batería documentado?',
  '- Facturas Canal de Isabel II (por uso)
- Requisitos batería de agua
- Proyecto As Built',
  190, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000020',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'ACS centralizada, acumulación y recirculación',
  'ACS y calefacción',
  'Cuarto de fontanería, cubierta, zonas técnicas',
  'alta',
  'Revisar visualmente el sistema de ACS centralizada, los depósitos de acumulación y el circuito de recirculación.',
  '- Depósitos de ACS: número, capacidad visible y estado
- Aerotermia asociada: ya revisada en card de electricidad, verificar conexión hidráulica
- Bombas de recirculación: estado y funcionamiento aparente
- Tuberías de ACS: aislamiento térmico
- Válvulas de seguridad y elementos de corte
- Temperatura si existe display o termómetro visible
- Señales de fuga, corrosión o deterioro',
  '- Consumo ACS centralizada alto sin explicación por el número de usuarios
- Tuberías de distribución o acumulación sin aislamiento térmico
- Fugas activas o rastros de fugas en depósitos o conexiones
- Corrosión visible en depósitos o bombas
- Falta evidente de mantenimiento sanitario o legionella
- Recirculación activa sin control aparente de temperatura o horario',
  '- Depósitos de ACS: vista general y placas
- Bombas de recirculación
- Tuberías: aislamiento
- Válvulas y conexiones
- Displays o termómetros visibles',
  '- ¿Existe protocolo de mantenimiento sanitario o certificado de legionella?
- ¿Hay partes técnicos del último mantenimiento?
- ¿Cómo se controla la recirculación (horario, temperatura)?
- ¿Hay quejas por temperatura del ACS o tiempo de llegada?',
  '- Factura Canal de Isabel II (ACS)
- Factura Ness Energy
- Proyecto As Built
- Certificado energético',
  200, 'pendiente', NULL, true, true, true
),

(
  'dd000000-0000-0000-0007-000000000021',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Grupo de presión, aljibe y cuarto de fontanería',
  'Fontanería e instalaciones comunes',
  'Sótano / cuarto de fontanería',
  'alta',
  'Revisar el estado visual del grupo de presión, el aljibe y los componentes de fontanería común en el cuarto técnico.',
  '- Aljibe: estado visible, accesibilidad y limpieza
- Grupo de presión: estado y protecciones
- Bombas: estado y ruido aparente
- Filtros: estado y mantenimiento aparente
- Reductora de presión si existe
- Válvulas de seguridad y by-pass
- Desagüe del cuarto
- Ventilación del cuarto',
  '- Fugas activas en cualquier componente
- Corrosión relevante en aljibe, bombas o filtros
- Ruidos o vibraciones anómalas
- Cuarto sin desagüe adecuado ante un posible vertido
- Cuarto sin ventilación suficiente
- Elementos no identificados o sin mantenimiento aparente',
  '- Cuarto de fontanería: vista general
- Grupo de presión y bombas
- Aljibe
- Válvulas y elementos de corte
- Desagüe del cuarto',
  '- ¿Existen partes de mantenimiento del grupo de presión?
- ¿Ha habido episodios de falta de presión?
- ¿Quién realiza el mantenimiento del cuarto de fontanería?
- ¿Hay alarmas o incidencias recurrentes?',
  '- Proyecto As Built
- Facturas de agua
- Documentación de mantenimiento pendiente',
  210, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000022',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Baños, cocinas y puntos de consumo en viviendas',
  'Fontanería en viviendas',
  'Viviendas, baños, cocinas',
  'alta',
  'Revisar el funcionamiento visual y básico de los puntos de consumo de agua fría, ACS y evacuación en las viviendas visitadas.',
  '- Presión en lavabos y duchas: caudal aparente
- Tiempo de llegada del ACS en cada vivienda
- Griferías: funcionamiento y estado
- Sifones bajo lavabos y fregaderos: estado y olor
- Desagüe de duchas y bañeras: velocidad de evacuación
- Humedad visible bajo muebles de baño o cocina',
  '- Baja presión evidente en más de un punto
- ACS que tarda excesivamente o no llega a temperatura
- Griferías con fugas activas o rastros de fugas
- Evacuación lenta o con olor en desagüe
- Humedad visible en muebles o paramentos de baño o cocina',
  '- Puntos de consumo probados durante la visita
- Griferías con defectos
- Bajo lavabos: posibles humedades
- Duchas: evacuación y pendiente',
  '- ¿Hay quejas de usuarios por temperatura o presión del ACS?
- ¿Hay atascos o fugas recurrentes en viviendas?
- ¿Se han realizado reparaciones de fontanería recientemente?',
  '- Facturas de agua (individuales)
- Histórico de incidencias si existe',
  220, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000023',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Lavandería, cocina común y consumos específicos',
  'Fontanería y operación',
  'Planta baja / zonas comunes',
  'alta',
  'Revisar los usos comunes con consumo propio de agua y verificar el estado de las instalaciones en lavandería y cocina común.',
  '- Tomas de agua y desagüe de lavadora o lavandería
- Desagüe de cocina común: sifón y evacuación
- Ventilación del espacio
- Humedad en muebles o paramentos
- Equipos conectados y su estado
- Correspondencia con contadores individuales',
  '- Consumos que no cuadran con el uso aparente del espacio
- Desagüe improvisado o sin sifón
- Humedad en muebles o pavimentos
- Olores de saneamiento
- Uso intensivo sin mantenimiento aparente',
  '- Lavandería: tomas y desagüe
- Cocina común: fregadero y desagüe
- Contadores asociados
- Zonas con humedad',
  '- ¿Qué uso tiene actualmente la cocina común?
- ¿La lavandería es de uso compartido por los inquilinos?
- ¿Quién mantiene los equipos de lavandería y cocina común?
- ¿Hay incidencias de fugas o atascos en estas zonas?',
  '- Facturas Canal de Isabel II (cocina común y lavandería)
- Proyecto As Built',
  230, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0007-000000000024',
  'dd000000-0000-0000-0001-000000000001',
  'dd000000-0000-0000-0002-000000000001',
  'dd000000-0000-0000-0000-000000000004',
  'Saneamiento, pluviales y riesgo de filtración en sótano, patio y cubierta',
  'Saneamiento y pluviales',
  'Sótano, garaje, patio, cubierta',
  'alta',
  'Revisar visualmente la evacuación de aguas residuales y pluviales, con especial atención a los puntos con mayor riesgo de filtración al interior.',
  '- Bajantes visibles en patios y zonas técnicas: estado y uniones
- Registros accesibles: estado y olor
- Sumideros de cubierta: estado y limpieza
- Sumideros de patio: estado y pendientes
- Garaje y sótano: rastros de agua o humedad en muros
- Olores en zonas técnicas o patios',
  '- Olores persistentes a aguas residuales en sótano, garaje o patio
- Agua estancada en cubierta o patio
- Sumideros colmatados u obstruidos
- Humedad activa en muros del sótano
- Registros inaccesibles o sellados
- Bajantes con fugas o uniones abiertas visibles',
  '- Sumideros de cubierta
- Bajantes visibles en patio o zonas técnicas
- Sótano/garaje: estado de muros y suelo
- Patio: sumideros y pendientes
- Manchas o rastros de humedad',
  '- ¿Ha habido filtraciones en sótano, garaje o patio?
- ¿Se limpian periódicamente los sumideros de cubierta y patio?
- ¿Hay desatascos o reparaciones de saneamiento recurrentes?',
  '- Proyecto As Built
- Histórico de incidencias si existe',
  240, 'pendiente', NULL, false, true, true
)

ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
