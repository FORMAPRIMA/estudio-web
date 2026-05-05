-- Due Diligence Visits — seed data inicial
-- Activos: Bardala 20 y Sierra Bullones 2
-- Cards son placeholders; se reemplazarán por migración específica posterior

-- ─── Roles técnicos ───────────────────────────────────────────────────────────

INSERT INTO public.dd_roles (id, nombre, descripcion, color, orden) VALUES
  ('dd000000-0000-0000-0000-000000000001',
   'Arquitecto / Director técnico',
   'Revisión general del activo, coherencia documental, cubierta, fachada y zonas comunes',
   '#1A1A1A', 1),
  ('dd000000-0000-0000-0000-000000000002',
   'Construcción y acabados',
   'Tabiquería, pladur, falsos techos, acabados interiores, baños, cocinas y zonas húmedas',
   '#5B7FA6', 2),
  ('dd000000-0000-0000-0000-000000000003',
   'Electricidad y climatización',
   'Cuadros eléctricos, climatización, ventilación, CCTV y telecomunicaciones',
   '#D85A30', 3),
  ('dd000000-0000-0000-0000-000000000004',
   'Fontanería, saneamiento y calefacción',
   'Fontanería, contadores, ACS, calefacción, saneamiento y humedades',
   '#2D7D5A', 4)
ON CONFLICT (id) DO NOTHING;

-- ─── Activo: Bardala 20 ───────────────────────────────────────────────────────

INSERT INTO public.dd_assets (id, nombre, direccion, cliente, status, alcance_dd) VALUES
  ('dd000000-0000-0000-0001-000000000001',
   'Bardala 20',
   'Calle Bardala 20, Madrid',
   'Por definir',
   'visita_programada',
   'Due Diligence Técnica No Invasiva — alcance ejecutivo. Inspección visual de estructura aparente, envolvente, instalaciones visibles, acabados y zonas comunes.')
ON CONFLICT (id) DO NOTHING;

-- ─── Activo: Sierra Bullones 2 ────────────────────────────────────────────────

INSERT INTO public.dd_assets (id, nombre, direccion, cliente, status, alcance_dd) VALUES
  ('dd000000-0000-0000-0001-000000000002',
   'Sierra Bullones 2',
   'Calle Sierra Bullones 2, Madrid',
   'Por definir',
   'visita_programada',
   'Due Diligence Técnica No Invasiva — alcance ejecutivo. Inspección visual de estructura aparente, envolvente, instalaciones visibles, acabados y zonas comunes.')
ON CONFLICT (id) DO NOTHING;

-- ─── Visita: Bardala 20 ───────────────────────────────────────────────────────

INSERT INTO public.dd_visits (id, asset_id, fecha, status, zonas_previstas) VALUES
  ('dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0001-000000000001',
   '2026-05-15',
   'programada',
   ARRAY[
     'Fachada exterior',
     'Acceso y portal',
     'Escalera y zonas comunes',
     'Cubierta',
     'Viviendas tipo',
     'Sótano y garaje',
     'Cuarto de instalaciones',
     'Cuarto de contadores'
   ])
ON CONFLICT (id) DO NOTHING;

-- ─── Visita: Sierra Bullones 2 ────────────────────────────────────────────────

INSERT INTO public.dd_visits (id, asset_id, fecha, status, zonas_previstas) VALUES
  ('dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0001-000000000002',
   '2026-05-22',
   'programada',
   ARRAY[
     'Fachada exterior',
     'Acceso y portal',
     'Escalera y zonas comunes',
     'Cubierta',
     'Viviendas tipo',
     'Sótano y garaje',
     'Cuarto de instalaciones',
     'Cuarto de contadores'
   ])
ON CONFLICT (id) DO NOTHING;

-- ─── Cards placeholder: Bardala 20 ───────────────────────────────────────────
-- Arquitecto / Director técnico

INSERT INTO public.dd_cards (id, asset_id, visit_id, rol_id, titulo, especialidad, zona_edificio, prioridad, objetivo_revision, que_revisar, senales_alerta, fotos_recomendadas, orden) VALUES
  ('dd000000-0000-0000-0003-000000000001',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000001',
   'Revisión general del activo',
   'Arquitectura general', 'Todo el edificio', 'alta',
   'Obtener una visión general del estado de conservación del edificio, identificar incidencias relevantes y confirmar coherencia entre documentación y estado construido.',
   'Estado general de la estructura visible. Coherencia entre planos y construcción real. Señales de movimiento estructural, fisuras o humedades generalizadas. Estado de zonas comunes. Accesos y circulaciones.',
   'Fisuras en muros estructurales o pilares. Deformaciones visibles en forjados. Humedades generalizadas. Discrepancias graves entre planos y realidad construida.',
   'Fachada principal y trasera. Escalera y zonas comunes representativas. Cualquier incidencia estructural visible.',
   1),

  ('dd000000-0000-0000-0003-000000000002',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000001',
   'Cubierta, fachada y envolvente',
   'Envolvente exterior', 'Cubierta y fachada', 'alta',
   'Evaluar el estado de la envolvente exterior del edificio: cubierta, fachadas, carpinterías y juntas.',
   'Cubierta: revestimiento, impermeabilización visible, puntos de evacuación, sumideros. Fachada: revestimientos, fisuras, desprendimientos. Carpinterías exteriores. Juntas de dilatación.',
   'Burbujeo o levantamiento de impermeabilización. Manchas de humedad bajo cubierta. Desprendimientos de aplacado. Carpinterías deterioradas con posible entrada de agua.',
   'Cubierta desde acceso o perímetro visible. Encuentros con paramentos. Desagüe y canalones. Fachada completa con detalle de patologías.',
   2),

  ('dd000000-0000-0000-0003-000000000003',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000001',
   'Coherencia documental y estado construido',
   'Documentación técnica', 'Todo el edificio', 'media',
   'Verificar que la documentación recibida corresponde con la realidad construida e identificar discrepancias relevantes.',
   'Comparar superficie real con documentación. Verificar número de viviendas y distribución. Confirmar usos de los espacios. Obras recientes o reformas no documentadas.',
   'Superficies significativamente distintas a las documentadas. Usos no coincidentes. Obras recientes sin reflejo documental.',
   'Distribución general. Zonas atípicas. Elementos que evidencien reformas recientes no documentadas.',
   3)
ON CONFLICT (id) DO NOTHING;

-- Construcción y acabados
INSERT INTO public.dd_cards (id, asset_id, visit_id, rol_id, titulo, especialidad, zona_edificio, prioridad, objetivo_revision, que_revisar, senales_alerta, fotos_recomendadas, orden) VALUES
  ('dd000000-0000-0000-0003-000000000004',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000002',
   'Tabiquería, pladur y falsos techos',
   'Construcción interior', 'Viviendas y zonas comunes', 'media',
   'Evaluar el estado de tabiques, divisorias y falsos techos. Identificar fisuras, deformaciones, humedades o deterioros relevantes.',
   'Tabiques y divisorias: fisuras, desplomes, deformaciones. Falsos techos: manchas, deformaciones, paneles sueltos. Encuentros entre tabique y forjado. Registros de instalaciones visibles.',
   'Fisuras diagonales en tabiques (movimiento estructural). Manchas de humedad en falso techo. Paneles de falso techo deformados o sueltos. Olor a humedad en zona de falso techo.',
   'Tabiques con fisuras visibles. Estado general de falso techo por estancia representativa. Encuentros con forjado. Registros de instalaciones.',
   4),

  ('dd000000-0000-0000-0003-000000000005',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000002',
   'Acabados interiores y desgaste',
   'Acabados', 'Viviendas', 'media',
   'Valorar el estado general de los acabados interiores para estimar nivel de reforma necesaria y CAPEX orientativo.',
   'Pavimentos: estado, tipo, desgaste, levantamientos. Paredes: pintura, alicatado, revocos. Techos: manchas, pintura. Carpinterías interiores: estado, funcionamiento, herrajes. Rodapiés y remates.',
   'Pavimento muy deteriorado o con levantamientos generalizados. Revocos desprendidos. Carpinterías sin funcionamiento correcto. Manchas de humedad en paramentos.',
   'Estado representativo de acabados por vivienda tipo. Pavimentos. Carpinterías interiores. Rodapiés.',
   5),

  ('dd000000-0000-0000-0003-000000000006',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000002',
   'Baños, cocinas y zonas húmedas',
   'Zonas húmedas', 'Viviendas', 'alta',
   'Revisar el estado de baños y cocinas como zonas de mayor riesgo de humedades, deterioro de acabados y problemas de fontanería visible.',
   'Azulejos y alicatados: estado, juntas. Silicona en platos de ducha, bañeras, encimeras. Muebles de cocina. Signos de humedades en paramentos de zonas húmedas. Ventilación de baños.',
   'Humedades o manchas en paramentos de baños. Silicona deteriorada o inexistente. Azulejos sueltos. Olor a humedad persistente. Ventilación deficiente o inexistente.',
   'Estado general de baño tipo. Detalle de silicona y juntas deterioradas. Manchas de humedad. Estado de cocina representativa.',
   6)
ON CONFLICT (id) DO NOTHING;

-- Electricidad y climatización
INSERT INTO public.dd_cards (id, asset_id, visit_id, rol_id, titulo, especialidad, zona_edificio, prioridad, objetivo_revision, que_revisar, senales_alerta, fotos_recomendadas, orden) VALUES
  ('dd000000-0000-0000-0003-000000000007',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000003',
   'Cuadros eléctricos y suministros',
   'Instalación eléctrica', 'Cuarto de instalaciones / viviendas', 'alta',
   'Revisar el estado visible de los cuadros eléctricos generales e individuales. Verificar presencia de protecciones y nivel de actualización aparente.',
   'Cuadro general: tipo, antigüedad aparente, etiquetado, estado físico. Cuadros de vivienda: magnetotérmicos, diferenciales, estado. Cableado visible: tipo, estado, orden. Suministro eléctrico: acometida visible.',
   'Cuadros sin protecciones diferenciales. Cableado visto deteriorado o con empalmes irregulares. Cuadro muy antiguo (anterior a 2002 sin actualización visible). Señales de sobrecalentamiento.',
   'Cuadro general (frontal y interior si accesible). Cuadro individual representativo de vivienda. Cableado visible en zonas comunes.',
   7),

  ('dd000000-0000-0000-0003-000000000008',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000003',
   'Climatización, ventilación y equipos',
   'Climatización', 'Cubierta / viviendas', 'media',
   'Revisar el estado visible de los equipos de climatización, ventilación y aerotermia si existen.',
   'Equipos de climatización: existencia, estado aparente, antigüedad. Ventilación: rejillas, caudal, estado. Aerotermia en cubierta si existe. Chimeneas y extractores de cocina.',
   'Equipos muy deteriorados o sin mantenimiento aparente. Aerotermia sin acceso para revisión. Ventilación obstruida o inexistente en baños.',
   'Equipos de climatización en vivienda tipo. Aerotermia o equipos en cubierta si accesible. Rejillas de ventilación en baños y cocinas.',
   8),

  ('dd000000-0000-0000-0003-000000000009',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000003',
   'CCTV, telecomunicaciones y servicios comunes',
   'Telecomunicaciones', 'Zonas comunes', 'baja',
   'Verificar la existencia y estado visible de sistemas de telecomunicaciones, CCTV y servicios comunes.',
   'CCTV: cámaras visibles, central si accesible, estado. Telecomunicaciones: RITI/RITS, ICT. Porteros automáticos. Ascensor: existencia, placa de revisión, estado visible. Iluminación de zonas comunes.',
   'Ausencia de ICT actualizado. CCTV deteriorado. Ascensor sin placa de revisión vigente.',
   'RITI/RITS si accesible. Cámaras CCTV. Portero automático. Ascensor con placa de revisión.',
   9)
ON CONFLICT (id) DO NOTHING;

-- Fontanería, saneamiento y calefacción
INSERT INTO public.dd_cards (id, asset_id, visit_id, rol_id, titulo, especialidad, zona_edificio, prioridad, objetivo_revision, que_revisar, senales_alerta, fotos_recomendadas, orden) VALUES
  ('dd000000-0000-0000-0003-000000000010',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000004',
   'Fontanería y contadores',
   'Fontanería', 'Cuarto de contadores / zonas comunes', 'alta',
   'Revisar el estado visible de la instalación de fontanería y contadores de agua.',
   'Batería de contadores: estado, tipo, antigüedad aparente. Red de distribución visible: estado, materiales, señales de fugas. Llaves de paso generales. Presión aparente.',
   'Contadores muy antiguos o con signos de humedad. Tuberías con señales de fugas antiguas. Manchas de óxido o depósitos de cal. Presión aparentemente baja.',
   'Batería de contadores. Cuarto de instalaciones con fontanería visible. Tuberías en zonas accesibles.',
   10),

  ('dd000000-0000-0000-0003-000000000011',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000004',
   'ACS, calefacción y equipos asociados',
   'ACS y calefacción', 'Cuarto de máquinas / viviendas', 'alta',
   'Revisar el estado visible de los sistemas de ACS y calefacción del edificio.',
   'Caldera o sistema de ACS centralizado: existencia, estado, antigüedad, mantenimiento visible. Sistemas individuales por vivienda. Radiadores o suelo radiante. Acumuladores.',
   'Caldera muy antigua o sin evidencia de mantenimiento. Acumuladores con signos de corrosión. Radiadores con fugas. Ausencia de llaves de corte por vivienda.',
   'Caldera o equipo de ACS principal. Equipos individuales en vivienda tipo. Radiadores si existen. Placa de mantenimiento si visible.',
   11),

  ('dd000000-0000-0000-0003-000000000012',
   'dd000000-0000-0000-0001-000000000001', 'dd000000-0000-0000-0002-000000000001',
   'dd000000-0000-0000-0000-000000000004',
   'Saneamiento, olores y humedades',
   'Saneamiento', 'Sótano / zonas húmedas', 'alta',
   'Revisar el estado visible del sistema de saneamiento y detectar posibles problemas de humedades asociadas.',
   'Bajantes visibles: estado, materiales, uniones. Arquetas accesibles: estado, olor. Saneamiento en sótano si accesible. Olores en zonas comunes o sótano. Humedades en sótano o planta baja.',
   'Olor a aguas residuales en zonas comunes o sótano. Manchas de humedad en sótano. Bajantes con fisuras visibles. Arquetas con desbordamiento.',
   'Bajantes visibles en zonas comunes. Arquetas si accesibles. Sótano: estado general y humedades. Incidencias de saneamiento visibles.',
   12)
ON CONFLICT (id) DO NOTHING;

-- ─── Cards placeholder: Sierra Bullones 2 ────────────────────────────────────
-- Mismas categorías de revisión que Bardala 20 (placeholder)
-- Se sustituirán por migración específica con contenido técnico de Sierra Bullones 2

INSERT INTO public.dd_cards (id, asset_id, visit_id, rol_id, titulo, especialidad, zona_edificio, prioridad, objetivo_revision, que_revisar, senales_alerta, fotos_recomendadas, orden)
VALUES
  ('dd000000-0000-0000-0004-000000000001',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000001',
   'Revisión general del activo', 'Arquitectura general', 'Todo el edificio', 'alta',
   'Obtener una visión general del estado de conservación del edificio, identificar incidencias relevantes y confirmar coherencia entre documentación y estado construido.',
   'Estado general de la estructura visible. Coherencia entre planos y construcción real. Señales de movimiento estructural, fisuras o humedades generalizadas. Estado de zonas comunes.',
   'Fisuras en muros estructurales. Deformaciones en forjados. Humedades generalizadas. Discrepancias graves con documentación.',
   'Fachada principal y trasera. Escalera. Zonas comunes. Cualquier incidencia estructural visible.', 1),

  ('dd000000-0000-0000-0004-000000000002',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000001',
   'Cubierta, fachada y envolvente', 'Envolvente exterior', 'Cubierta y fachada', 'alta',
   'Evaluar el estado de la envolvente exterior del edificio: cubierta, fachadas, carpinterías y juntas.',
   'Cubierta: revestimiento, impermeabilización visible, evacuación. Fachada: revestimientos, fisuras, desprendimientos. Carpinterías exteriores.',
   'Burbujeo en impermeabilización. Manchas de humedad bajo cubierta. Desprendimientos de aplacado. Carpinterías deterioradas.',
   'Cubierta desde acceso visible. Encuentros con paramentos. Fachada completa.', 2),

  ('dd000000-0000-0000-0004-000000000003',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000001',
   'Coherencia documental y estado construido', 'Documentación técnica', 'Todo el edificio', 'media',
   'Verificar que la documentación recibida corresponde con la realidad construida.',
   'Superficie real vs documentada. Número de viviendas. Usos de espacios. Reformas recientes no documentadas.',
   'Superficies distintas a las documentadas. Usos no coincidentes. Obras sin reflejo documental.',
   'Distribución general. Zonas atípicas. Reformas recientes.', 3),

  ('dd000000-0000-0000-0004-000000000004',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000002',
   'Tabiquería, pladur y falsos techos', 'Construcción interior', 'Viviendas y zonas comunes', 'media',
   'Evaluar el estado de tabiques, divisorias y falsos techos.',
   'Tabiques: fisuras, desplomes. Falsos techos: manchas, deformaciones, paneles sueltos. Encuentros con forjado.',
   'Fisuras diagonales en tabiques. Manchas en falso techo. Paneles sueltos. Olor a humedad.',
   'Tabiques con fisuras. Estado de falso techo. Registros de instalaciones.', 4),

  ('dd000000-0000-0000-0004-000000000005',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000002',
   'Acabados interiores y desgaste', 'Acabados', 'Viviendas', 'media',
   'Valorar el estado general de los acabados interiores para estimar CAPEX orientativo.',
   'Pavimentos: estado, desgaste. Paredes: pintura, alicatado. Carpinterías interiores: estado, funcionamiento.',
   'Pavimento muy deteriorado. Revocos desprendidos. Carpinterías sin funcionamiento.',
   'Acabados por vivienda tipo. Pavimentos. Carpinterías.', 5),

  ('dd000000-0000-0000-0004-000000000006',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000002',
   'Baños, cocinas y zonas húmedas', 'Zonas húmedas', 'Viviendas', 'alta',
   'Revisar el estado de baños y cocinas como zonas de mayor riesgo de humedades.',
   'Azulejos, juntas, silicona. Platos de ducha y bañeras. Muebles de cocina. Signos de humedades. Ventilación.',
   'Humedades en paramentos. Silicona deteriorada. Azulejos sueltos. Olor a humedad. Ventilación deficiente.',
   'Baño tipo. Silicona y juntas. Manchas de humedad. Cocina representativa.', 6),

  ('dd000000-0000-0000-0004-000000000007',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000003',
   'Cuadros eléctricos y suministros', 'Instalación eléctrica', 'Cuarto de instalaciones / viviendas', 'alta',
   'Revisar el estado visible de los cuadros eléctricos generales e individuales.',
   'Cuadro general: tipo, antigüedad, etiquetado. Cuadros de vivienda: protecciones. Cableado visible.',
   'Cuadros sin diferenciales. Cableado deteriorado. Cuadro muy antiguo. Señales de sobrecalentamiento.',
   'Cuadro general. Cuadro individual de vivienda. Cableado visible en zonas comunes.', 7),

  ('dd000000-0000-0000-0004-000000000008',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000003',
   'Climatización, ventilación y equipos', 'Climatización', 'Cubierta / viviendas', 'media',
   'Revisar el estado visible de los equipos de climatización y ventilación.',
   'Equipos de climatización: existencia, estado. Ventilación: rejillas, estado. Aerotermia en cubierta si existe.',
   'Equipos deteriorados. Aerotermia sin acceso. Ventilación obstruida.',
   'Equipos de climatización. Aerotermia en cubierta. Rejillas de ventilación.', 8),

  ('dd000000-0000-0000-0004-000000000009',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000003',
   'CCTV, telecomunicaciones y servicios comunes', 'Telecomunicaciones', 'Zonas comunes', 'baja',
   'Verificar la existencia y estado de sistemas de telecomunicaciones, CCTV y servicios comunes.',
   'CCTV. Telecomunicaciones: RITI/RITS, ICT. Portero automático. Ascensor.',
   'Ausencia de ICT actualizado. CCTV deteriorado. Ascensor sin revisión vigente.',
   'RITI/RITS. Cámaras CCTV. Portero. Ascensor.', 9),

  ('dd000000-0000-0000-0004-000000000010',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000004',
   'Fontanería y contadores', 'Fontanería', 'Cuarto de contadores / zonas comunes', 'alta',
   'Revisar el estado visible de la instalación de fontanería y contadores.',
   'Batería de contadores: estado, antigüedad. Red de distribución visible. Llaves de paso generales.',
   'Contadores con signos de humedad. Tuberías con señales de fugas. Óxido o cal. Presión baja.',
   'Batería de contadores. Fontanería visible en cuarto de instalaciones.', 10),

  ('dd000000-0000-0000-0004-000000000011',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000004',
   'ACS, calefacción y equipos asociados', 'ACS y calefacción', 'Cuarto de máquinas / viviendas', 'alta',
   'Revisar el estado visible de los sistemas de ACS y calefacción.',
   'Caldera o ACS centralizado: estado, antigüedad, mantenimiento. Sistemas individuales. Radiadores o suelo radiante.',
   'Caldera sin mantenimiento aparente. Acumuladores con corrosión. Radiadores con fugas.',
   'Caldera o equipo de ACS. Equipos individuales. Radiadores. Placa de mantenimiento.', 11),

  ('dd000000-0000-0000-0004-000000000012',
   'dd000000-0000-0000-0001-000000000002', 'dd000000-0000-0000-0002-000000000002',
   'dd000000-0000-0000-0000-000000000004',
   'Saneamiento, olores y humedades', 'Saneamiento', 'Sótano / zonas húmedas', 'alta',
   'Revisar el estado visible del sistema de saneamiento y detectar problemas de humedades.',
   'Bajantes visibles. Arquetas accesibles. Sótano. Olores en zonas comunes. Humedades en planta baja.',
   'Olor a aguas residuales. Manchas de humedad en sótano. Bajantes con fisuras. Arquetas con desbordamiento.',
   'Bajantes visibles. Arquetas si accesibles. Sótano: estado y humedades.', 12)

ON CONFLICT (id) DO NOTHING;
