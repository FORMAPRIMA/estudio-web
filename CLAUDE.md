# CLAUDE.md — Contexto permanente del proyecto estudio-web

> Este archivo es leído por Claude Code al inicio de cada sesión. Describe el
> proyecto completo para que no sea necesario re-explorar el código desde cero.

---

## 0. Estilo de respuesta preferido

Respuestas **concisas y conversacionales**. Nada de muros de texto con especificaciones
técnicas detalladas, mockups ASCII, listas exhaustivas de cambios en código o tablas
comparativas largas en una primera vuelta. Prefiero ir desarrollando ideas pregunta
a pregunta: tú das una respuesta breve con una recomendación o pregunta acotada,
yo respondo, y vamos avanzando. Si el plan necesita detalle técnico, dame el titular
y espera a que pida los detalles.

---

## 1. Descripción general

**Forma Prima** (`GEINEX GROUP, S.L.`) es un estudio de arquitectura y diseño.
Este repositorio es su plataforma digital completa: web pública, portal de clientes
y herramienta interna de gestión.

**Tres audiencias:**
| Zona | URL | Quién accede |
|---|---|---|
| Web pública | `/`, `/proyectos`, `/real-estate`, `/estudio`, `/contacto` | Público general |
| Portal de clientes | `/portal/[id]`, `/bienvenida/[token]`, `/area-privada` | Clientes |
| Área interna del equipo | `/team/*` | Staff FP (roles `fp_*`) |
| Portal FP Execution | `/execution-portal/[token]` | Partners/subcontratistas |

**Stack tecnológico:**
- **Next.js 14.2.5** — App Router, Server Components, Server Actions
- **React 18** + TypeScript 5
- **Supabase** — PostgreSQL (base de datos), Auth, Storage (buckets: `portal`, `design-hunter`, `marketing`)
- **Tailwind CSS** — utilidades CSS (no se usa casi en el área interna; los estilos son inline)
- **Resend** — envío de emails transaccionales
- **@react-pdf/renderer 4.x** — generación de PDFs en servidor (actas, propuestas, contratos, facturas, due diligence)
- **Anthropic Claude API** (`claude-haiku-4-5-20251001`) — mejora de textos con IA en visitas de obra y due diligencia
- **DocuSign eSignature API** — firma electrónica de contratos
- **pdf-lib + pdfjs-dist** — lectura y manipulación de PDFs (scanner de tickets)
- **xlsx + jszip** — exportación a Excel y ZIP
- **`@anthropic-ai/sdk` `^0.82.0`**

---

## 2. Estructura de carpetas

```
estudio-web/
├── app/
│   ├── (public)/           # Layout para web pública (Header/Footer)
│   ├── actions/            # Server Actions (todas las mutaciones de BD)
│   ├── api/                # API Routes (PDFs, webhooks, IA, cron jobs)
│   ├── area-privada/       # Portal de clientes (auth Supabase)
│   ├── bienvenida/         # Flujo de onboarding de cliente nuevo
│   ├── execution-portal/   # Portal externo para partners de FP Execution
│   ├── login/              # Página de login compartida
│   ├── portal/[id]/        # Vista de proyecto del cliente
│   └── team/               # Área interna del equipo (layout protegido)
├── components/
│   ├── dev/                # RulerOverlay (solo dev)
│   ├── fp-execution-portal/# PortalPage para partners externos
│   ├── layout/             # Header y Footer públicos
│   ├── pdfs/               # Componentes @react-pdf/renderer (6 PDFs)
│   ├── portal/             # ClientPortal, ClientPortalGate
│   ├── public/             # BienvenidaPage
│   ├── team/               # Todos los componentes del área interna
│   └── ui/                 # ProjectCard, PropertyCard (web pública)
├── lib/
│   ├── data/mock.ts        # Datos mock para la web pública
│   ├── dashboard/          # avisos-permisos.ts (esAvisoVisiblePara, VISIBLE_ROLES_*)
│   ├── design-hunter.ts    # Tipos DesignHunterEntry, isVideoUrl()
│   ├── docusign/           # auth.ts + client.ts (DocuSign integration)
│   ├── email.ts            # sendEmail() + wrapEmail() con template de Resend
│   ├── facturasUtils.ts    # calcTotals(), formatNumeroCompleto()
│   ├── finanzas/           # costs.ts, fixedCostHistory.ts, salaryHistory.ts
│   ├── fp-execution/       # domain.ts (tipos Fpe*), schedule.ts
│   ├── marketing.ts        # Tipos MarketingPost, PostStatus, RedSocial; getTransitions()
│   ├── pdfs/               # dueDiligenciaDefaults.ts
│   ├── propuestas/config.ts# SERVICIOS_CONFIG, calcPropuesta(), tipos
│   ├── supabase/           # admin.ts, client.ts, server.ts
│   └── types/index.ts      # Tipos compartidos + FpRole + FP_ROLES
├── middleware.ts            # Protección de rutas /team/* y /area-privada/*
├── next.config.mjs
└── public/                 # FORMA_PRIMA_BLANCO.png (logo para PDFs y emails)
```

---

## 3. Arquitectura: Server Actions vs API Routes

**Regla general:** mutaciones → Server Actions. Acceso externo / PDFs server-side / webhooks → API Routes.

| Patrón | Cuándo usarlo |
|---|---|
| `app/actions/*.ts` | CRUD de BD, lógica de negocio, todo lo que solo necesita un fetch interno |
| `app/api/*/route.ts` | Generación de PDFs (respuesta binaria), webhooks DocuSign, jobs cron, endpoints de IA, endpoints que necesitan autenticación por header (`CRON_SECRET`, `PORTAL_SECRET`) |

**Supabase clients:**
- `lib/supabase/server.ts` — cliente con cookies de sesión (para leer el usuario autenticado)
- `lib/supabase/admin.ts` — cliente con `SUPABASE_SERVICE_ROLE_KEY` (bypasea RLS, solo en servidor)
- `lib/supabase/client.ts` — cliente browser (para componentes client-side)

El patrón estándar en cada Server Action:
```typescript
async function requirePartner() {          // o requireManagerOrPartner() / requireAnyFP()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}
// Luego: const admin = createAdminClient() para todas las operaciones de BD
```

---

## 4. Sistema de roles

```typescript
type FpRole = 'fp_team' | 'fp_manager' | 'fp_partner' | 'fp_biz_dev'
```

| Rol | Descripción | Acceso |
|---|---|---|
| `fp_partner` | Socio/dueño | Todo: finanzas, costes, contratos, equipo, facturas emitidas |
| `fp_manager` | Manager | Captación, proyectos, clientes, FP Execution (sin finanzas macro) |
| `fp_team` | Equipo técnico | Proyectos, time tracker, clientes (solo plataforma), proveedores |
| `fp_biz_dev` | Biz development | Captación (leads, propuestas, contratos, due diligencia), proyectos, time tracker, marketing |
| `cliente` | Cliente externo | Solo `/portal/[id]` y `/area-privada` |

Los guards de rutas están en `app/team/layout.tsx` (sidebar) y en el `middleware.ts`
(redirección). Los guards de actions están en cada función `require*()`.

---

## 5. Bloques funcionales (módulos)

### 5.1 Captación (`/team/captacion`)
Funnel comercial completo. Acceso: `fp_partner`, `fp_manager`, `fp_biz_dev`.

**Flujo:** (Business development →) Lead → Propuesta → Contrato (firmado vía DocuSign o manualmente)

- **Business development** (`/team/captacion/business-development`) — CRM estratégico de **partners** (agencias, promotoras, fondos, family offices, prescriptores, constructoras…), distinto de Leads (que son clientes potenciales). Port fiel del artifact de Ana ("CRM estratégico Forma Prima"), restilado a la plataforma. Acceso: `fp_partner`, `fp_manager`, `fp_biz_dev` (sub-tab justo encima de Leads).
  - **Motor de scoring** (`lib/business-development/engine.ts`, port de `crm-data.js`): 7 criterios (potencial, fit, valor, acceso, temporalidad, posicionamiento, facilidad) + bonuses/penalties → `finalScore`/`tierOf`; métricas derivadas `deriveMetrics` (EBV/PTC/ROE/timing/partnership type); regla de elegibilidad `applyEligibility` (exclusión de constructoras de Madrid, con excepciones); `leadReminder`, `strategicRecommendation`. Tipos en `types.ts`; `seed.ts` = 58 empresas (fallback si la migración no está aplicada).
  - **12 vistas** (componente único `components/team/business-development/BusinessDevelopmentClient.tsx`, clase React con `React.createElement`, `// @ts-nocheck`): Executive Dashboard · Weekly Update (IA en lenguaje natural) · Weekly Update Log (con deshacer) · Lead Reminders · tablas España/Ecuador/México/Master · Priority Ranking · Pipeline · Research Queue · Partner Profiles · Action Center · Import/Export Excel (paquete `xlsx`) · Admin & Reglas · ficha por empresa. Sub-nav lateral clara propia dentro del contenido.
  - **Persistencia**: `app/actions/business-development.ts` (`requireCaptacionRole`, service_role) — `getBusinessDevelopmentData`, `saveCompanies` (upsert del array completo), `replaceWeeklyLog`, `setRule`, `restoreSeed`, `crearLeadDesdePartner`. Tablas `bd_companies`/`bd_weekly_log`/`bd_config` (RLS sin políticas). **Migración `business_development.sql` pendiente de ejecutar** (hasta entonces usa el SEED en solo-lectura).
  - **IA**: `app/api/business-development/asistente/route.ts` (Claude Haiku) — redacta hipótesis comercial y interpreta el Weekly Update. Con fallback heurístico.
  - **Puente con Leads**: botón "Generar lead" en la ficha → `crearLeadDesdePartner` inserta en `leads` (`origen='Business development'`, `bd_company_id`), sin duplicar.
- **Leads** — `app/actions/leads.ts` + `LeadsPage.tsx`
- **Propuestas** — `app/actions/propuestas.ts` + `PropuestaDetalle.tsx`
  - Genera PDF con `@react-pdf/renderer` (`components/pdfs/PropuestaPDF.tsx`)
  - Se envía por email vía `app/api/propuestas/[id]/enviar/route.ts`
  - Previsualización vía `app/api/propuestas/preview-pdf/route.ts`
- **Contratos** — `app/actions/contratos.ts` + `ContratoDetalle.tsx`
  - Número auto-generado: `C-YYYY-NNN`
  - PDF: `components/pdfs/ContratoPDF.tsx`
  - Firma DocuSign: `lib/docusign/client.ts`, webhook en `app/api/webhooks/docusign/route.ts`
  - Compartir vía email: `app/api/contratos/[id]/compartir/route.ts`
- **Plantilla propuestas** — `app/actions/plantillaPropuestas.ts`
  - 5 servicios base definidos en `lib/propuestas/config.ts`: `anteproyecto`, `proyecto_ejecucion`, `direccion_obra`, `interiorismo` + 1 más
  - Tabla `propuestas_servicios_plantilla` — sobrescribe los defaults del config
  - Soporte de traducción EN por servicio
- **Due Diligencia Técnica** — `app/actions/...` + `DueDiligenciaPage.tsx`
  - PDF vía `app/api/due-diligencia/preview/route.ts` y `enviar/route.ts`
  - Defaults en `lib/pdfs/dueDiligenciaDefaults.ts`

### 5.2 Proyectos (`/team/proyectos`)
Gestión interna de proyectos activos. Acceso: todos los roles FP.

- `ProyectoDetalle.tsx` — ficha completa: fases, tasks, responsables, documentación
- `DocumentacionTab.tsx` — planos PDF, renders, uploads a Supabase Storage (`portal` bucket)
- `KanbanBoard.tsx` — vista kanban de tasks por proyecto
- `PlantillaManager.tsx` — plantilla de fases reutilizable
- `RatiosTable.tsx` — ratios objetivo por fase (solo `fp_partner`)
- Tabla `catalogo_fases` — fases tipo (Anteproyecto, Proyecto de Ejecución, Obra, etc.)
- Tabla `proyecto_fases` — fases asignadas a un proyecto concreto

### 5.3 Finanzas (`/team/finanzas`) — solo `fp_partner`
Sistema de control financiero completo.

**Sub-módulos:**
| Ruta | Componente | Función |
|---|---|---|
| `/operativas/costes` | `CostesOperativasPage` | Costes fijos del estudio, salarios del equipo |
| `/operativas/proyectos` | `ProyectosAnalisisPage` → `ProyectoFinanzasDetalle` | P&L por proyecto |
| `/macro/costes` | `CostesGeneralesPage` | Costes fijos + variables + historial |
| `/facturacion/control` | `FacturacionKanbanPage` → `FacturacionProyectoDetalle` | Facturas por proyecto (kanban) |
| `/facturacion/emitidas` | `FacturasEmitidasPage` | Facturas emitidas en PDF |
| `/facturacion/empresa` | `InfoEmpresaPage` | Datos fiscales del estudio |
| `/team/gastos` (fuera de finanzas) | `ScannerPage` | Gastos y facturas: escaneo con OCR (IA) + autocrop (jscanify). Partner ve todo; el resto de roles FP solo sube y ve SUS gastos (modo "personal") |
| `/conciliacion` | `ReconciliationPage` | Conciliación bancaria. Matching automático al guardar cada scan (`lib/finanzas/reconciliation.ts`, tolerancia importe ±0,02) |
| `/gestor` | `GestorAccesosPage` | Tokens de acceso del portal del gestor (solo lectura, revocables) |
| `/dashboard` | `FinanzasDashboard` | Dashboard general (aún en construcción) |

**Sistema de históricos** (muy importante):
- `salarios_historia` — snapshot de salario+horas cada vez que cambia un miembro
- `costos_fijos_historia` — snapshot de coste fijo cada vez que cambia
- Esto garantiza que los cálculos de costes pasados no se alteran con cambios presentes
- Helpers: `lib/finanzas/salaryHistory.ts`, `lib/finanzas/fixedCostHistory.ts`

**Facturas emitidas** (`facturas_emitidas`):
- Se generan desde contratos (`emitirFacturaDesdeContrato` en `facturacion.ts`)
- O se crean manualmente desde la lista de emitidas
- Numeración: serie `F`, formato `F-NNN`, con offset configurable en `estudio_config`
- PDF: `components/pdfs/FacturaEmitidaPDF.tsx`
- Envío por email con recordatorio/reenvío

### 5.4 Clientes (`/team/clientes`)
- **Base de datos** (`/base-datos`) — `ClientesBDPage` — CRUD de clientes. `fp_partner` + `fp_manager`
- **Plataforma interna** (`/plataforma/interna`) — `PlataformaInternaPage` + `PlataformaInternaDetalle` — vista de proyectos del cliente para el equipo
- **Vista del cliente** (`/plataforma/externa`) — `PlataformaExternaPage` — simulación de lo que ve el cliente
- **Portal real** (`/portal/[id]`) — `ClientPortal` — acceso del cliente (token-based vía `PORTAL_SECRET`)

**Visitas de obra** (desde `PlataformaInternaDetalle`):
- Modal `RegistrarVisitaModal.tsx` — registra visita, genera PDFs (acta cliente + acta constructor), envía emails
- Action: `createActaVisita` + `sendActaByEmail` en `app/actions/actas.ts`
- PDF: `components/pdfs/ActaVisitaObraPDF.tsx`
- IA mejora instrucciones: `app/api/profesionalizar-instrucciones/route.ts` (Claude Haiku)

### 5.5 Proveedores (`/team/proveedores`)
CRUD de proveedores con contactos secundarios. Acceso: `fp_partner`, `fp_manager`, `fp_team`.
- Tabla `proveedores` + `proveedor_contactos`
- Datos fiscales para facturación (NIF, razón social, IBAN, forma de pago)

### 5.6 FP Execution (`/team/fp-execution`) — `fp_partner`, `fp_manager`
Sistema de gestión de licitaciones y subcontratación. Es un módulo independiente y complejo.

**Flujo:** Proyecto FPE → Template (scope) → Tender (licitación) → Invitaciones a partners → Bids → Contrato FPE

- Tablas con prefijo `fpe_*`: `fpe_projects`, `fpe_partners`, `fpe_tenders`, `fpe_invitations`, `fpe_bids`, `fpe_contracts`, `fpe_documents`
- Portal externo para partners: `/execution-portal/[token]` (`components/fp-execution-portal/PortalPage.tsx`)
- PDF de contrato FPE (Orden de Ejecución de Obra): `components/pdfs/FpeContractPDF.tsx`
- Tipos en `lib/fp-execution/domain.ts` (prefijo `Fpe*`)

**Convenciones FPE — no negociables:**
- **Unidad temporal: días hábiles.** Toda duración dentro de FP execution (oferta del EP, cronograma, plazos contractuales como el de pago) se expresa en días hábiles, no naturales. Única excepción explícita: el preaviso de activación de fase (5 días naturales) y similares cuando el contrato así lo indique. Cuando renderices duraciones, etiqueta siempre "días háb." o "días hábiles".
- **Plazo de pago al EP:** 10 días hábiles desde que concurren acumulativamente (a) cumplimiento del hito de organización de obra que activa el pago y (b) certificación de ejecución correcta del EP por FP execution. La sola formalización del hito de organización no activa el plazo.
- **Trigger de inicio de fase:** FP execution intenta avisar 5 días naturales antes. Si la fecha real coincide con la prevista → el EP entra en la prevista. Si difiere → 2 días hábiles de margen desde la activación efectiva.

### 5.7 Área Interna (`/team/area-interna`)
Panel de gestión interna: avisos, mejoras/bugs, datos personales del equipo.
- `AdminPanel.tsx` — gestión de equipo (solo `fp_partner`)
- `AreaInternaPage.tsx` — panel general del equipo
- `PersonalDashboard.tsx` — información personal
- Tablas: `avisos`, `mejoras`

### 5.8 Apps (`/team/apps`)
Aplicaciones internas. Acceso: todos los roles FP.

- **Design Hunter** (`/team/apps/design-hunter`) — `components/team/design-hunter/DesignHunterPage.tsx`
  - Registro visual de inspiración/referencias organizados por viajes (`design_hunter_viajes`)
  - Cada entrada (`design_hunter_entries`) tiene: titulo, descripcion, categoria, tags, foto_url, `media_urls text[]` (múltiples imágenes/videos)
  - Subida a Supabase Storage bucket `design-hunter` (público). RLS policies requeridas en `storage.objects`
  - Soporta multiselección, cámara directa (`capture="environment"`), thumbnails de vídeo (primer frame), lightbox fullscreen, vista "Stories" tipo Instagram
  - `lib/design-hunter.ts` — tipos + `isVideoUrl()`

- **Repasos de obra** (`/team/apps/repasos`) — **todos los roles FP** — `components/team/repasos/RepasoProyectoView.tsx`
  - Repasos (remates/incidencias) **geolocalizados sobre el plano** de un proyecto. Enfoque **mobile-first**: el visor ocupa la pantalla, la lista vive en un *bottom sheet* con tres posiciones y el alta se hace con el dedo en obra.
  - **Coordenadas normalizadas** (`x`, `y` de 0 a 1 sobre la imagen del plano): el pin sobrevive a zoom, rotación de pantalla, cambio de dispositivo y sustitución del plano por otro de distinta resolución.
  - **Planos**: un proyecto tiene N planos (plantas). Si se sube un PDF se **rasteriza la página 1 en el navegador** (`pdfjs`, mismo patrón que `ClientPortal.tsx`) y se guardan imagen + PDF original. Pintar pins sobre una imagen es instantáneo en móvil; sobre un PDF vivo no.
  - **Alta de repaso**: `+ Agregar repaso` → modo colocación (banner *«Toca el plano para situar el repaso»*) → tap → **pin fantasma arrastrable** → `Confirmar posición` → modal. El paso de confirmación existe porque el dedo es impreciso.
  - **Modal**: foto (cámara directa o galería, comprimida en cliente antes de subir), descripción, oficio (catálogo de 28 gremios), estado, visibilidad, prioridad, responsable, fecha objetivo e historial. **No se cierra al tocar fuera**; al cerrar con cambios pregunta guardar / descartar / seguir editando; el borrador se guarda en `localStorage` (en móvil abrir la cámara puede matar la pestaña).
  - **Visibilidad jerárquica**: `interno` ⊂ `constructora` ⊂ `cliente`. El filtrado por audiencia se hace **en servidor**: lo que un cliente no debe ver nunca llega a su payload.
  - **Enlaces externos** de solo lectura, uno por audiencia, revocables y con traza de accesos: `/repasos/[token]` (modo presentación, sin sesión, sin edición). Patrón de `gestor_tokens`, sin PIN.
  - **Informe PDF** (`components/pdfs/RepasosObraPDF.tsx`): portada + una página horizontal por plano con los pins numerados + una ficha por repaso con sus fotos. Se descarga desde el propio enlace externo (`/api/repasos/[token]/pdf`, la audiencia sale del token, nunca de la petición) y desde el área interna con las tres vistas — interno / constructora / cliente — en `/api/repasos/proyecto/[id]/pdf?audiencia=`. `lib/repasos/pdfData.ts` monta los datos y **vuelve a filtrar por visibilidad** aunque la query ya lo hizo (colar un repaso interno en un informe de cliente no se puede deshacer); `lib/repasos/imageSize.ts` lee las dimensiones reales del plano de sus bytes (PNG/JPEG) para que los pins caigan exactos sin depender de lo guardado en BD.
  - **Trazabilidad**: `repaso_eventos` es un log append-only (creado, cambio de estado/visibilidad, foto, movido, editado) con autor y fecha, visible en el modal. El código `R-014` por proyecto es además **el número que se pinta en el pin**, para poder referenciarlo por teléfono en obra.
  - **Selección bidireccional**: tocar un pin resalta y hace scroll a su fila; tocar una fila hace zoom y centra el pin con un halo. En el equipo, el segundo toque abre la ficha de edición.
  - **Portal externo (`RepasoVisorPublico.tsx`)**: la foto es la protagonista. **Un solo toque** en el pin o en la fila abre una ficha a pantalla completa con la foto al máximo tamaño posible sin recortar (`object-fit: contain` — recortar podría esconder el desperfecto) y los datos montados encima: estado en píldora de color y número arriba, descripción y oficio sobre degradado abajo. Con incidencia y evidencia de resuelto aparecen pestañas «Incidencia / Resuelto» para compararlas. Se recorre el resto de repasos con swipe o con Anterior/Siguiente, un toque limpio en la foto oculta los datos para verla limpia, y «Ver dónde está en el plano» cierra y centra el pin. La lista del portal usa miniatura de 68 px con el número encima y el estado en chip.
  - `lib/repasos/domain.ts` (tipos, `OFICIOS`, `ESTADOS`, `VISIBILIDADES`, `esVisiblePara`, `nextCodigo`, filtros) · `lib/repasos/data.ts` (**no es `'use server'` a propósito**: si `loadProyectoData` fuese Server Action, cualquiera podría pedir los repasos internos de un proyecto) · `lib/repasos/auth.ts` (validación de token) · `lib/repasos/upload.ts` (compresión de fotos, rasterizado de planos)
  - `app/actions/repasos.ts` — todas las mutaciones (`requireAnyFP()`)
  - Estilos en clases `.rp-*` al final de `app/globals.css` (mobile-first; desktop a partir de `min-width: 1024px`, el mismo breakpoint donde el layout de `/team` quita la barra superior de 56 px)
  - Tablas `repaso_*` + bucket público `repasos`. Solo `service_role` (RLS sin políticas). **Migración `repasos_obra.sql` pendiente de ejecutar**

- **Control de obra** (`/team/apps/control-obra`) — **`fp_partner` + allowlist por email** (`CONTROL_OBRA_ALLOWED_EMAILS` en `lib/control-obra/domain.ts`; incluye a Aitana `acascante@formaprima.es`) — `components/team/control-obra/ControlObraPage.tsx`
  - Control económico de obra por proyecto. Parte de un **baseline congelado** (presupuesto firmado) y registra los cambios encima (subidas de precio, cantidades, partidas nuevas, partidas no ejecutadas), con motivo interno y comentario para el cliente.
  - 5 tabs: **Partidas** (baseline vs actual, estado igual/modificada/nueva/eliminada, **proveedor por partida**, toggle coste/cliente) · **Proveedores y pagos** (comprometido/pagado/pendiente + libro de pagos) · **Tesorería** (depósitos del cliente y balance = depósitos con IVA − pagos a proveedores) · **Vista cliente** (modo presentación limpio: solo su presupuesto y los cambios; sin coste/margen/proveedores/tesorería) · **Histórico**
  - `lib/control-obra/domain.ts` — tipos + helpers (`ceilCent` redondeo al céntimo, `autoPucl`, cálculos de importe/balance)
  - `app/actions/control-obra.ts` — todas las mutaciones (`requirePartner()`)
  - Tablas `obra_control_*` (obras, partidas, proveedores, pagos, depositos, log). Solo `service_role` (RLS sin políticas). Seed inicial: **Casa Claudio Coello 38** (baseline 14/01/2026, 11 capítulos, 259 partidas)

- **Modelo Café Goya** (`/team/apps/modelo-cafe`) — **SOLO `fp_partner`** — `components/team/modelo-cafe/ModeloCafePage.tsx`
  - Modelo financiero interactivo del quiosco → café de especialidad to-go (Calle Goya 63, Madrid): P&L mensual/anual, financiación (entrada + aplazamiento del traspaso al vendedor + préstamo bancario), punto de equilibrio, caja mensual por fases, payback y ROI sobre capital propio
  - **5 secciones (tabs grandes)**:
    - **Modelo financiero** — envuelve las 3 sub-tabs originales: **Modelo** (supuestos editables + resultados + conclusión) · **Sensibilidad** (matriz cafés/día × precio) · **Comparativa** (escenarios recalculados lado a lado). Aquí vive la barra de escenarios (guardar/guardar como/renombrar/eliminar/descartar/defaults). Financiación con **sliders** (precio traspaso, entrada, plazo del aplazamiento 0–72m, interés, % financiado, TIN, plazo préstamo, comisión). Punto de equilibrio con 3 umbrales: operativo (EBITDA 0), beneficio 0 (+amort+intereses) y **caja arranque ≥ 0** (+cuotas banco y vendedor, el «no pierdes dinero» real)
    - **CAPEX / equipamiento** — tabla editable agrupada por categoría (Extracción de café · Frío · Agua · Barra y servicio) con concepto, marca/modelo, estado nuevo/2ª mano, cantidad, precio, subtotal, link de compra y nota; totales por categoría y global; **persistencia compartida en Supabase** (`modelo_cafe_capex`, una fila 'default', autoguardado con debounce; fallback a `CAPEX_DEFAULT` si la migración no está aplicada); botón «usar total como equipamiento del modelo». Datos por defecto investigados (La Marzocco 2ª mano, Mahlkönig E65S ×2, Marco SP9, hielo, neveras, vitrina, BWT, TPV…) en `lib/modelo-cafe/capex.ts`
    - **Dossier bancario** — eliges qué escenario guardado es el CONSERVADOR y con dos sliders (% cafés/día) se derivan pesimista y optimista; toggle para **incluir el equipamiento del CAPEX** (sustituye el `equipo` del escenario y recalcula desembolso/préstamo/capital propio, con detalle por categorías en el PDF); botón genera un PDF hiper-profesional para el banco (negocio, usos/fuentes, P&L conservador, 3 escenarios con DSCR/payback, servicio de deuda, mitigantes, solicitud y páginas de mercado)
    - **Análisis de mercado** — tabla de precios de carta de 7 cafeterías del entorno (Good News, Pink Bourbon, Utópico, East Crema, Hola Coffee, Bell's, Ágora) por bebida + media de mercado + ticket medio por local; panel de ventas/día reportadas por los baristas; KPIs de posicionamiento (renta CBRE, ticket)
    - **Propuesta final** — formulario con los números editables de la propuesta a los vendedores (dos opciones de pago + fiscalidad); botón renderiza el PDF (carta cálida + impuestos explicados + acuerdo de reserva)
  - **Escenarios guardados en Supabase** con nombre y notas: guardar, guardar como, renombrar, eliminar (el base no), descartar cambios, valores por defecto. Indicador de cambios sin guardar
  - `lib/modelo-cafe/domain.ts` — tipos `ModeloInputs`/`Escenario`, `BASE_INPUTS`, `computeModelo()` (motor de cálculo), `cuotaFrancesa()`, `normalizeInputs()` (sanea jsonb), formateadores
  - `lib/modelo-cafe/dossier.ts` — `derivarEscenarios()` (pesimista/conservador/optimista desde inputs + % cafés) y `estructuraInversion()` (usos/fuentes); fuente única del dossier
  - `lib/modelo-cafe/mercado.ts` — datos de mercado estáticos (cafeterías, precios, ventas de baristas, traspasos comparables, CBRE) + helpers de media por bebida / ticket por local
  - `lib/modelo-cafe/capex.ts` — tipos `CapexItem` + `CAPEX_DEFAULT` (equipamiento investigado) + helpers de total
  - `components/team/modelo-cafe/{ModeloCafePage,DossierTab,MercadoTab,PropuestaTab,CapexTab}.tsx` + `theme.ts` (paleta compartida) + `Field.tsx` (`NumField`, `RangeField`)
  - `components/pdfs/DossierBancarioPDF.tsx` y `components/pdfs/PropuestaTraspasoPDF.tsx` (patrón import dinámico; formateadores con `useGrouping:'always'` para uniformar miles)
  - `app/api/modelo-cafe/{dossier-pdf,propuesta-pdf}/route.ts` — POST que renderizan los PDFs (`fp_partner`)
  - `app/actions/modelo-cafe.ts` — CRUD de escenarios + `getCapex()`/`saveCapex()` (`requirePartner()`)
  - Tablas `modelo_cafe_escenarios` (inputs jsonb, es_base; seed escenario base) y `modelo_cafe_capex` (items jsonb, fila única 'default'). Solo `service_role` (RLS sin políticas). **Migración `modelo_cafe_capex.sql` pendiente de ejecutar** (hasta entonces el CAPEX usa los valores por defecto y el guardado avisa)

### 5.9 Marketing (`/team/marketing`) — `fp_partner`, `fp_biz_dev`
Gestión de contenido para redes sociales.

- **Post Manager** (`/team/marketing/post-manager`) — `components/team/PostManagerPage.tsx`
  - Kanban con 6 columnas de estado: `borrador → en_revision → feedback_disponible → aprobado → programado → publicado`
  - Tabs por red social: Instagram / LinkedIn
  - Creación/edición de posts con: tipo, título, caption, hashtags, ubicación (Instagram), fecha programada, media (imagen/vídeo)
  - Media subida a bucket `marketing` (público). Registros en `marketing_post_media`
  - Comentarios/feedback en `marketing_post_comentarios`
  - Flujo de aprobación con notificaciones via `avisos` (ver tabla)
  - Transiciones de estado según rol: `fp_biz_dev` crea y gestiona, `fp_partner` aprueba/rechaza
  - `lib/marketing.ts` — tipos + `getTransitions(status, rol)` + `POST_STATUSES`
  - `app/actions/marketing-posts.ts` — todas las acciones CRUD
- **Time Tracker Sections** (`/team/marketing/time-tracker-sections`) — placeholder, en desarrollo

**Flujo de aprobación:**
`biz_dev` crea borrador → envía a revisión → `partner` aprueba o rechaza con feedback → `biz_dev` reenvía → `partner` aprueba → `biz_dev` programa → marca publicado

**Avisos generados automáticamente:**
- `en_revision` → aviso `informativo` a `fp_partner`
- `aprobado` → aviso `informativo` a `fp_biz_dev`
- `publicado` → aviso `informativo` a ambos
- rechazo (`borrador` por partner) → aviso `importante` a `fp_biz_dev`
- feedback (comentario de partner en `en_revision`) → aviso `importante` a `fp_biz_dev`

### 5.10 Memorias de Calidades (`/team/memorias-calidad`) — `fp_partner`, `fp_manager`, `fp_team`
Catálogo de producto + generación de memorias de calidades. **Desacoplado de FP Execution a propósito**
(v2, jul 2026): cuelga de su propio catálogo de capítulos/subcapítulos de presupuesto, no de la plantilla FPE.

**Estructura de presupuesto** (`presupuesto_capitulos` / `presupuesto_subcapitulos`): catálogo global sembrado
con la estructura real de nuestras obras — 11 capítulos y 53 subcapítulos extraídos de Casa Claudio Coello 38.
Es el eje de clasificación de todo el módulo. Control de obra sigue guardando su capítulo/subcapítulo
denormalizado por obra; **no comparten tablas** (sería la migración natural si algún día se unifica).

**Warehouse** (`/warehouse`) — `WarehousePage.tsx`
- `warehouse_items` cuelga de `subcapitulo_id` + `nivel_calidad` (`functional` | `select` | `master_piece`),
  con marca/modelo/referencia, foto de producto, foto de ambiente, ficha técnica, acabados, tags,
  **`precio_pvp` + `precio_coste`**, proveedor preferente y `url_producto`.
- **Favorito FP**: `es_favorito` con **índice único parcial** `(subcapitulo_id, nivel_calidad) WHERE es_favorito AND activo`.
  Solo uno por subcapítulo y nivel; al marcar otro, la action libera el hueco antes (`liberarFavorito`).
  Es lo que alimenta la memoria de anteproyecto.
- **Alta con IA por URL** (`app/api/warehouse/analizar-url/route.ts`): `claude-opus-5` con **structured outputs**
  (`output_config.format` json_schema; nullable vía `anyOf`, subcapítulo como `enum` de los 53 códigos para que
  no pueda alucinar uno). Primero lee la página desde nuestro servidor (`lib/memorias/scrape.ts`: JSON-LD
  schema.org → meta og → texto plano, más candidatos de imagen de og/srcset/img); si la web bloquea o es SPA,
  **fallback a la herramienta nativa `web_fetch_20260209`** y las imágenes se piden a mano.
  Las imágenes elegidas se **re-suben a nuestro bucket** (`app/api/warehouse/importar-imagen`): nunca se
  guarda la URL del CDN de la tienda, que caduca y rompería memorias ya emitidas.
  🔴 `lib/memorias/scrape.ts` tiene **guardas anti-SSRF** (resolución DNS + bloqueo de rangos privados). No quitarlas.

**Memoria de anteproyecto** (`/anteproyecto`) — `AnteproyectoPage.tsx`
- Elige proyecto + nivel → coge los Favoritos FP de ese nivel → PDF lookbook brandeado
  (`components/pdfs/MemoriaAnteproyectoPDF.tsx`, `app/api/memorias/anteproyecto/pdf`).
- **No se persiste nada**: es 100% derivado de los favoritos del momento. Documento comercial para clientes
  aún no cerrados, sin cantidades y **sin precios** salvo `?precios=1`.
- La UI avisa de los subcapítulos sin favorito (huecos); los huecos **no** salen en el PDF.

**Memoria de ejecución** (`/proyectos`, `/proyectos/[id]`) — `EjecucionPage.tsx`
- Organizada por **estancias** (`memoria_estancias`: solo un título, es una carpeta) con items
  (`memoria_estancia_items`) que son **snapshot** del warehouse: si mañana cambia el precio del catálogo,
  la memoria del proyecto no se mueve. Mismo criterio que los históricos de finanzas.
- Por item: cantidad, **proveedor asignado**, `precio_pvp` + `precio_coste`, acabado elegido, estado de compra
  (pendiente → pedido → en tránsito → recibido → instalado), notas. Margen calculado con `ceilCent`.
- `addItemLibre` para one-offs fuera de catálogo + `guardarItemEnWarehouse` para subirlos después (el catálogo
  crece con el uso real). `duplicarEstancia` copia estancia e items (tres baños iguales).
- **Tres PDFs** desde `app/api/memorias/[id]/ejecutivo/pdf` (`MemoriaEjecutivaPDF.tsx`):
  cliente (solo PVP) · `?costes=1` interno (coste + margen) · `?proveedor_id=X` orden de pedido de ese
  proveedor **a coste, sin PVP nunca**.

**UI compartida**: toggle **tarjetas / listado desplegable** en todas las pantallas del módulo
(`VistaToggle.tsx` + `useVistaModo`, preferencia en `localStorage`). El listado es la vista de trabajo
(edición en línea de cantidad, proveedor y precios con autoguardado al salir del campo).

- `lib/memorias/domain.ts` — tipos, `NIVELES`, `ESTADOS_COMPRA`, `ceilCent`, `autoPvp` (margen 1,16 como
  control de obra), `totales`, formateadores · `lib/memorias/pdfData.ts` (monta los PDFs y **descarga las
  imágenes a data URI**: si una falla, ese item sale sin foto en vez de tumbar el render) ·
  `lib/memorias/scrape.ts` (solo servidor)
- `app/actions/warehouse.ts` (items, favoritos, subcapítulos) · `app/actions/memorias.ts` (estancias e items)
- Tablas `presupuesto_*`, `warehouse_items`, `memoria_estancias`, `memoria_estancia_items` + bucket público
  `warehouse`. Solo `service_role`. **Migración `memorias_calidad_v2.sql` pendiente de ejecutar**
- Pendiente: manual PDF del módulo (el anterior describía el flujo FPE y se eliminó)

### 5.11 Time Tracker (`/team/time-tracker`)
Registro de horas por proyecto y fase. Todos los roles FP.
- `TimeTracker.tsx` — UI principal (cliente)
- `app/actions/time-tracker.ts` — deleteTimeEntry
- Tabla `time_entries` (user_id, fecha, hora_inicio, horas, proyecto_id, fase_id, etc.)
- Cron job de recordatorio: `app/api/cron/horas-faltantes/route.ts`

---

## 6. Base de datos — tablas principales

### Usuarios y acceso
| Tabla | Propósito |
|---|---|
| `profiles` | Perfil de cada usuario autenticado (nombre, rol, salario, horas_mensuales, avatar_url) |
| `salarios_historia` | Histórico de salario+horas (valid_from / valid_to) |

### Captación
| Tabla | Propósito |
|---|---|
| `leads` | Potenciales clientes (origin, estado_lead, presupuesto_estimado) |
| `propuestas` | Propuestas comerciales (servicios, PEM, honorarios calculados) |
| `contratos` | Contratos (número C-YYYY-NNN, estado, DocuSign envelope_id) |
| `propuestas_servicios_plantilla` | Override de textos de servicios (id = service_id o uuid para custom) |

### Proyectos
| Tabla | Propósito |
|---|---|
| `proyectos` | Proyectos internos (nombre, codigo, superficie, status, nivel_calidad) |
| `proyecto_clientes` | Join many-to-many proyectos↔clientes |
| `catalogo_fases` | Catálogo global de fases (numero, label, seccion, ratio) |
| `proyecto_fases` | Fases activas de un proyecto (responsables, status, horas_objetivo) |
| `tasks` | Tasks de un proyecto (codigo, titulo, responsable_ids, status, urgencia) |
| `time_entries` | Registro de horas (user_id, fecha, hora_inicio, horas, proyecto_id, fase_id) |
| `visitas_obra` | Actas de visita (PDFs en Storage, visible_cliente flag) |
| `due_diligencia` | Informes de due diligencia técnica |

### Clientes y proveedores
| Tabla | Propósito |
|---|---|
| `clientes` | Base de datos de clientes (datos personales + fiscales) |
| `proveedores` | Proveedores/constructores (datos fiscales, IBAN, forma_pago) |
| `proveedor_contactos` | Contactos secundarios de un proveedor |

### Finanzas
| Tabla | Propósito |
|---|---|
| `facturas` | Facturas vinculadas a contratos (seccion, monto, status, clientes_ids) |
| `facturas_emitidas` | Facturas reales emitidas (número, emisor, cliente, items, IVA, IRPF) |
| `costos_fijos` | Costes fijos actuales del estudio |
| `costos_fijos_historia` | Histórico de costes fijos (valid_from / valid_to) |
| `costos_variables` | Costes variables (pueden estar vinculados a un proyecto_id) |
| `estudio_config` | Datos fiscales del estudio, serie de facturación, offset de número |
| `finanzas_config` | Configuración de finanzas (minoracion %, etc.) — key/value store |
| `expense_scans` | Tickets escaneados con IA |
| `bank_statements` | Movimientos bancarios para conciliación |

### FP Execution
| Tabla | Propósito |
|---|---|
| `fpe_projects` | Proyectos de licitación FP Execution |
| `fpe_partners` | Empresas subcontratistas |
| `fpe_tenders` | Licitaciones (vinculadas a un fpe_project) |
| `fpe_invitations` | Invitaciones a partners para una licitación |
| `fpe_bids` | Ofertas recibidas de partners |
| `fpe_contracts` | Contratos FPE (estado, PDF firmado) |
| `fpe_documents` | Documentos del proyecto (planos, specs) |
| `fpe_template_chapters/units` | Template de scope (capítulos y unidades) |

### Design Hunter
| Tabla | Propósito |
|---|---|
| `design_hunter_viajes` | Colecciones/viajes de referencias |
| `design_hunter_entries` | Entradas individuales (foto_url + `media_urls text[]` para múltiples archivos) |

### Repasos de obra
| Tabla | Propósito |
|---|---|
| `repaso_proyectos` | Proyectos con repasos (nombre, dirección, cliente, constructora, status) |
| `repaso_planos` | Planos/plantas de un proyecto (`img_url` raster + `pdf_url` original + width/height) |
| `repasos` | Repasos: `codigo` (R-001), `x`,`y` normalizados (0..1), oficio, estado, visibilidad, prioridad |
| `repaso_fotos` | Fotos del repaso (`tipo`: `antes` = incidencia, `despues` = evidencia de resuelto) |
| `repaso_eventos` | Log append-only de trazabilidad (creado, estado, visibilidad, foto, movido, editado) |
| `repaso_tokens` | Enlaces externos revocables por audiencia (`constructora` \| `cliente`) con traza de accesos |

### Business development
| Tabla | Propósito |
|---|---|
| `bd_companies` | Empresas/partners del CRM (`data jsonb`, una fila por empresa) |
| `bd_weekly_log` | Historial de Weekly Update (`data jsonb`) |
| `bd_config` | Configuración del módulo (key/value jsonb; toggle de la regla) |
| `leads.bd_company_id` | Back-reference del lead al partner que lo originó (puente) |

### Memorias de calidades
| Tabla | Propósito |
|---|---|
| `presupuesto_capitulos` | Capítulos de nuestro presupuesto de obra (numero, nombre) — 11 sembrados |
| `presupuesto_subcapitulos` | Subcapítulos (`codigo` tipo `5_CM_07`, nombre) — 53 sembrados. Eje de clasificación del módulo |
| `warehouse_items` | Catálogo de producto: `subcapitulo_id` + `nivel_calidad`, `precio_pvp`/`precio_coste`, `es_favorito` (único por subcapítulo × nivel) |
| `memoria_estancias` | Estancias de la memoria de ejecución de un proyecto (solo nombre + orden) |
| `memoria_estancia_items` | Items por estancia: **snapshot** del warehouse + cantidad, proveedor asignado, precios, acabado, `estado_compra` |

### Modelo Café Goya
| Tabla | Propósito |
|---|---|
| `modelo_cafe_escenarios` | Escenarios del modelo financiero (nombre, notas, `inputs jsonb`, `es_base`) |

### Marketing
| Tabla | Propósito |
|---|---|
| `marketing_posts` | Posts de Instagram/LinkedIn (titulo, caption, hashtags, status, red_social, autor_nombre) |
| `marketing_post_media` | Media de cada post (url, tipo image/video, orden) |
| `marketing_post_comentarios` | Comentarios/feedback en posts (autor_id, autor_nombre denormalizado) |

### Misc
| Tabla | Propósito |
|---|---|
| `mejoras` | Bugs y mejoras reportadas por el equipo |
| `avisos` | Avisos internos. `visible_roles text[]` filtra por rol (null = todos). `nivel`: `informativo\|recordatorio\|importante\|urgente` |
| `bienvenida_tokens` | Tokens de onboarding para nuevos clientes |
| `gestor_tokens` | Tokens revocables del portal del gestor (acceso solo lectura) |

---

## 7. Variables de entorno

| Variable | Propósito |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypass RLS, solo servidor) |
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio (ej: `https://internal.formaprima.es`) |
| `RESEND_API_KEY` | API key de Resend para envío de emails |
| `ANTHROPIC_API_KEY` | API key de Anthropic para IA |
| `PORTAL_SECRET` | Secret para tokens del portal de clientes (JWT/HMAC) |
| `CRON_SECRET` | Bearer token para proteger los cron endpoints |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token de Mapbox (posiblemente para mapas en el portal) |
| `DOCUSIGN_ACCOUNT_ID` | ID de cuenta DocuSign |
| `DOCUSIGN_BASE_URL` | Base URL de DocuSign (demo vs prod) |
| `DOCUSIGN_*` | Otras vars DocuSign (JWT key, integration key, etc.) |

> **⚠️ `PORTAL_SECRET` y `CRON_SECRET` deben estar en Vercel production settings.**
> Están en `.env.local` pero hay que añadirlos manualmente en Vercel si no están.

---

## 8. Rutas principales

### Web pública
```
/                           Página principal (mock data)
/proyectos                  Galería de proyectos
/proyectos/[slug]           Detalle de proyecto
/real-estate                Propiedades en venta
/estudio                    Sobre el estudio
/contacto                   Formulario de contacto
```

### Clientes
```
/login                      Login compartido (redirige según rol)
/area-privada               Portal cliente (autenticado con Supabase)
/portal/[id]                Vista de proyecto del cliente (token)
/bienvenida/[token]         Onboarding de nuevo cliente
/execution-portal/[token]   Portal para partners de FP Execution
/gestor/[token]             Portal de la gestoría (solo lectura: gastos, facturas, conciliación)
/repasos/[token]            Repasos de obra en modo presentación (constructora o cliente, solo lectura)
```

### Área interna `/team`
```
/team/dashboard             Dashboard personal del equipo
/team/time-tracker          Registro de horas
/team/captacion             Índice captación
/team/captacion/business-development  CRM estratégico de partners (Business development)
/team/captacion/leads       CRM de leads
/team/captacion/propuestas  Lista de propuestas
/team/captacion/propuestas/[id]  Detalle/editor de propuesta
/team/captacion/contratos   Lista de contratos
/team/captacion/contratos/[id]   Detalle/editor de contrato
/team/captacion/plantilla-propuestas  Editor de servicios base
/team/captacion/due-diligencia  Due diligencia técnica
/team/proyectos             Lista de proyectos internos
/team/proyectos/[id]        Detalle de proyecto (fases, tasks, docs)
/team/proyectos/plantilla   Plantilla de fases
/team/proyectos/ratios      Ratios objetivo por fase
/team/review                Review de proyectos
/team/clientes/base-datos   Base de datos de clientes
/team/clientes/plataforma/interna       Lista proyectos (equipo)
/team/clientes/plataforma/interna/[id]  Detalle proyecto cliente (equipo)
/team/clientes/plataforma/externa       Vista del cliente (preview)
/team/proveedores           Gestión de proveedores
/team/finanzas              Dashboard finanzas
/team/finanzas/operativas/costes        Costes y salarios
/team/finanzas/operativas/proyectos     P&L por proyecto
/team/finanzas/operativas/proyectos/[id] Detalle finanzas proyecto
/team/finanzas/macro/costes Costes generales (fijos + variables)
/team/finanzas/facturacion/control      Kanban facturación por proyecto
/team/finanzas/facturacion/control/[id] Detalle facturación proyecto
/team/finanzas/facturacion/emitidas     Facturas emitidas
/team/finanzas/facturacion/empresa      Datos fiscales estudio
/team/gastos                Gastos y facturas (todos los roles FP; no-partner solo ve los suyos)
/team/finanzas/scanner      (redirect → /team/gastos)
/team/finanzas/conciliacion Conciliación bancaria
/team/finanzas/gestor       Gestión de accesos del portal del gestor
/team/fp-execution/dashboard     Dashboard FP Execution
/team/fp-execution/projects      Lista proyectos FPE
/team/fp-execution/projects/[id] Detalle proyecto FPE
/team/fp-execution/partners      Directorio de partners
/team/fp-execution/template      Editor de template de scope
/team/area-interna          Panel interno del equipo
/team/mejoras               Bugs y mejoras
/team/equipo                Gestión del equipo (solo fp_partner)
/team/perfil                Perfil personal
/team/apps                  Índice de apps
/team/apps/design-hunter    Design Hunter (inspiración/referencias)
/team/apps/repasos          Repasos de obra — índice de proyectos
/team/apps/repasos/[id]     Repasos de obra — visor del plano con pins
/team/apps/control-obra     Control económico de obra (solo fp_partner)
/team/apps/modelo-cafe      Modelo financiero Café Goya (solo fp_partner)
/team/memorias-calidad/warehouse        Catálogo de producto (warehouse)
/team/memorias-calidad/anteproyecto     Memoria de calidades de anteproyecto (favoritos FP → PDF)
/team/memorias-calidad/proyectos        Memorias de ejecución — lista de proyectos
/team/memorias-calidad/proyectos/[id]   Memoria de ejecución por estancias
/team/marketing             Índice de marketing
/team/marketing/post-manager          Kanban de posts por red social
/team/marketing/time-tracker-sections Time tracker de secciones (en desarrollo)
```

### API Routes
```
/api/propuestas/[id]/enviar         POST — envía propuesta por email
/api/propuestas/preview-pdf         POST — genera PDF preview de propuesta
/api/contratos/[id]/compartir       POST — comparte contrato por email
/api/contratos/[id]/docusign        POST — envía contrato a DocuSign
/api/contratos/preview-pdf          POST — genera PDF preview de contrato
/api/due-diligencia/preview         POST — genera PDF due diligencia
/api/due-diligencia/enviar          POST — envía due diligencia por email
/api/facturas-emitidas/[id]/pdf     GET  — descarga PDF de factura
/api/facturas-emitidas/[id]/enviar  POST — envía factura por email
/api/facturas-emitidas/[id]/recordatorio  POST — recordatorio de pago
/api/facturas-emitidas/[id]/reenviar      POST — reenvía factura
/api/facturas-emitidas/batch-pdf    POST — ZIP con varios PDFs
/api/facturas-emitidas/emit         POST — emite factura borrador
/api/facturas-emitidas/preview-pdf  POST — preview factura
/api/repasos/[token]/pdf            GET  — informe PDF de repasos (audiencia según el token)
/api/repasos/proyecto/[id]/pdf      GET  — informe PDF interno (?audiencia=cliente|constructora)
/api/profesionalizar-instrucciones  POST — mejora texto con IA (Claude Haiku)
/api/business-development/asistente POST — asistente IA del CRM de partners (Claude Haiku)
/api/warehouse/analizar-url         POST — cataloga un producto desde su URL (Claude Opus 5 + structured outputs)
/api/warehouse/importar-imagen      POST — trae una imagen remota al bucket `warehouse`
/api/memorias/anteproyecto/pdf      GET  — memoria de anteproyecto (?proyecto_id=&nivel=&precios=1)
/api/memorias/[id]/ejecutivo/pdf    GET  — memoria de ejecución (?costes=1 interno · ?proveedor_id=X pedido)
/api/scan-ticket                    POST — escanea ticket con IA
/api/portal/verify                  POST — verifica token del portal cliente
/api/bank-statement                 POST — importa extracto bancario
/api/bank-statement/export          GET  — exporta extracto
/api/expense-scans/upload           POST — sube imagen de ticket
/api/expense-scans/backfill-hora    POST — backfill
/api/expense-scans/export           GET  — exporta tickets
/api/exchange-rates                 GET  — tipos de cambio
/api/time-tracker-translator        POST — traduce categorías de time tracker
/api/translate-servicio             POST — traduce servicio al inglés
/api/mejoras/generar-prompt         POST — genera prompt de mejora
/api/execution-portal/document      GET  — descarga documento FPE
/api/fpe-documents/upload           POST — sube documento FPE
/api/fpe-documents/upload-url       POST — URL firmada para upload
/api/fpe-portal/bid                 POST — submit de oferta de partner
/api/fpe-portal/question            POST — pregunta de partner
/api/gestor/[token]/gastos-zip      GET  — ZIP mensual de gastos (portal del gestor)
/api/gestor/[token]/factura/[id]     GET  — PDF de factura emitida (portal del gestor)
/api/webhooks/docusign              POST — webhook de eventos DocuSign
/api/cron/horas-faltantes           GET  — recuerda registrar horas
/api/cron/docs-faltantes            GET  — avisa de documentos pendientes
/api/cron/facturas-cobrables        GET  — avisa de facturas por cobrar
/api/cron/fpe-reminders             GET  — recordatorios FPE
/api/test-email                     GET  — test de envío de email
```

---

## 9. Convenciones del proyecto

### Naming de Server Actions

| Prefijo | Semántica |
|---|---|
| `create*` | Crea un registro nuevo en BD (antes: `add*`) |
| `update*` | Actualiza un registro existente |
| `delete*` | Elimina un registro |
| `send*` | Envía algo por email u otro canal externo |
| `get*` | Lectura (aunque rara vez; la mayoría de lecturas son en Server Components) |

**Convenciones específicas:**
- `createProveedorVacio()` — crea proveedor vacío (no recibe data)
- `updatePlantillaServicio()` — upsert de servicio de plantilla (no "save")
- `updateServicioTraduccion()` — upsert de traducción EN de un servicio
- `createActaVisita()` — genera PDFs y crea el registro
- `sendActaByEmail()` — envía PDFs por email

### Naming de variables de estado React

| Patrón | Uso |
|---|---|
| `is*` / `setIs*` | Booleanos de estado (loading, error, etc.) |
| `isDocusignLoading` | ¿Está enviando a DocuSign? |
| `isFirmando` | ¿Está en proceso de firma? |
| `isCompartiendo` | ¿Está compartiendo? |
| `isSavingContacto` | ¿Está guardando un contacto? |
| `isUploadingPlanos` | ¿Está subiendo planos? |
| `isSavingResponsables` | ¿Está guardando responsables? |
| Nombre descriptivo completo | `contactoForm`, `contactoError` — sin prefijos crípticos (evitar `cForm`, `cError`) |

### TypeScript / tipos
- `FpRole` y `FP_ROLES` viven **solo** en `lib/types/index.ts`
- No redefinir localmente en layouts ni pages
- Prefijo `Fpe*` para todos los tipos del módulo FP Execution
- `ProyectoInterno` = proyecto del área interna del equipo
- `Proyecto` = tipo web pública (menor, solo para display)

### PDF rendering
- Todos los PDFs usan `@react-pdf/renderer` server-side
- El config de Next.js los excluye del bundle con `serverExternalPackages`
- Las API routes de PDFs hacen `dynamic import` del renderer para evitar bundling estático:
  ```typescript
  const reactPdf = await import('@react-pdf/renderer')
  const { buildXxxElement } = await import('@/components/pdfs/XxxPDF')
  ```
- `stripMd()` se aplica antes de pasar texto a PDF (asteriscos de la IA no funcionan en PDF)
- **NO usar flags regex `s` (dotAll)**  — el target de TS no lo soporta. Usar `[^*]+` en lugar de `.+?`
- **🔴 Headers/footers fijos — REGLA DE ORO (bug recurrente):** los elementos `fixed` se pintan
  ENCIMA del flujo en todas las páginas. Para que nunca se solapen con el contenido, el padding de
  la `<Page>` debe RESERVAR sus bandas: `paddingTop ≥ alto del header fijo` y `paddingBottom ≥ alto
  del footer fijo` (con alturas explícitas en los elementos fijos, anclados a `top: 0`/`bottom: 0`).
  Nunca `paddingTop: 0` con contenido que fluye a página 2+. Si hay una portada con cabecera héroe
  en flujo, va en su **propia `<Page>`** separada de las páginas de contenido, con paddingTop normal
  y `marginTop` negativo en el héroe para el efecto a sangre (así las páginas de desbordamiento de la
  portada conservan el margen superior). Las cajas destacadas (veredicto, KPIs) llevan `wrap={false}`
  para saltar ENTERAS de página en lugar de partirse. Patrón de referencia:
  `components/pdfs/InformeUrbanisticoPDF.tsx` (pageCover + pageTec).
- **Glifos**: Helvetica (fuente base) no tiene `→ ≥ ≤ ≈ ⚠ ★ ✓ ✗` (salen como `'`): sanitizar los
  textos generados por motores/IA antes de renderizar (ver `pdfSafe()` en el route del informe
  urbanístico). Sí soporta `² × · º €`.

### Estilos en el área interna
- **No se usa Tailwind en componentes del área interna** (`/team/*`)
- Todos los estilos son objetos inline `style={{...}}`
- Paleta: `#1A1A1A` (negro base), `#F8F7F4` (cream background), `#D85A30` (naranja accent), `#F0EEE8` (borde suave)

### Supabase
- **Siempre usar `createAdminClient()`** para escribir desde Server Actions (bypasea RLS)
- **Usar `createClient()`** solo para leer el usuario autenticado (nunca para escribir en actions que ya verificaron permisos manualmente)
- El admin client tiene `cache: 'no-store'` para evitar caché de fetch
- **Joins anidados** (`tabla:otra_tabla(...)`) requieren que PostgREST haya cacheado las FK. Con tablas recién creadas puede fallar silenciosamente. Usar queries separadas + `.in('post_id', postIds)` como alternativa robusta
- **`avisos.nivel`** acepta solo `'informativo' | 'recordatorio' | 'importante' | 'urgente'`. No usar `'info'` ni `'warning'`
- **Storage upload desde cliente**: usar `createClient()` (browser) con `supabase.storage.from(bucket).upload(...)`. Requiere RLS policy `FOR INSERT TO authenticated WITH CHECK (bucket_id = 'X')` en `storage.objects`
- **Crear bucket público vía SQL**: `INSERT INTO storage.buckets (id, name, public) VALUES ('X', 'X', true) ON CONFLICT (id) DO UPDATE SET public = true`
- **Recargar schema cache** tras crear tablas nuevas: `NOTIFY pgrst, 'reload schema'`
- **Grants en tablas nuevas (desde 30 oct 2026):** Supabase deja de exponer por defecto las tablas de `public` a la Data API. Para proyectos existentes (como este) el cambio se aplica solo a tablas creadas **después del 30 oct 2026**. Las tablas existentes no se tocan. El `service_role` (usado por `createAdminClient()`) conserva sus grants, así que Server Actions y API routes no se ven afectados. Solo si una tabla nueva debe leerse/escribirse desde el navegador (`createClient()`, roles `anon`/`authenticated`) hay que añadir el grant explícito al crearla:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.nueva_tabla TO authenticated;
  GRANT SELECT ON public.nueva_tabla TO anon;  -- solo si debe ser pública sin login
  ```

---

## 10. Partes críticas — qué NO tocar sin entender bien

### 🔴 Sistema de históricos de costes/salarios
`costos_fijos_historia` y `salarios_historia` tienen lógica de `valid_from`/`valid_to` muy específica.
Cada cambio de salario o coste fijo cierra el registro anterior (valid_to = ayer) y abre uno nuevo.
Si se edita el mismo día, actualiza el de hoy en lugar de crear uno nuevo (para evitar gaps).
**Romper este sistema afecta todos los cálculos de P&L histórico.**

### 🔴 `@react-pdf/renderer` — import dinámico
Nunca importar directamente en un Server Component de Next.js.
Siempre usar `await import(...)` en la API route. Si se importa estáticamente, el build falla
porque `@react-pdf/renderer` usa APIs de Node.js incompatibles con el bundler estático de Next.

### 🔴 DocuSign webhook (`/api/webhooks/docusign`)
Recibe eventos de DocuSign cuando se firma un contrato. Actualiza el estado del contrato en BD.
No modificar sin entender el flujo de envelopes y el sistema de autenticación JWT de DocuSign.

### 🔴 Portal de clientes — autenticación por token
`/portal/[id]` no usa Supabase Auth. Usa `PORTAL_SECRET` para firmar/verificar tokens.
`ClientPortalGate.tsx` verifica el token antes de renderizar. No confundir con el flujo `/area-privada` (que sí usa Auth).

### 🟡 `SECCIONES_PRIVADAS` en `lib/finanzas/costs.ts`
La sección `'Margen prorrateado de obra'` nunca debe mostrarse al cliente (se factura a
la constructora). Verificar siempre al añadir nuevas vistas de facturación.

### 🟡 `'Compra de mobiliario'` — depósito pass-through con margen (`SECCION_MOBILIARIO`)
Antes `'Margen de mobiliario'` (sección privada facturada al proveedor). Ahora es un
**depósito por proyecto**: entran los **suplidos** cobrados al cliente (facturables con
normalidad, NO privados) y salen las **compras de mobiliario** (`costos_variables` con
categoría `CATEGORIA_MOBILIARIO = 'Compra de mobiliario'`). El **margen = suplidos −
compras**; nunca es una factura. Cada factura de suplido tiene `facturas.margen_estimado_pct`
(INTERNO — jamás sale al cliente ni al portal ni a `facturas_emitidas`/PDF). La previsión
usa `suplido × %` hasta que se **liquida** (`proyectos.mobiliario_liquidado`), momento en
que se congela el margen real. En el P&L el mobiliario aporta **margen neto**, no el suplido
bruto (evita duplicar ingresos). En la facturación por proyecto se puede **mover facturas
entre secciones** ("Mover a…" en la fila expandida).

### 🟡 Propuesta: `calcPropuesta()` en `lib/propuestas/config.ts`
Los honorarios se calculan sobre el PEM (Presupuesto de Ejecución Material) con splits
por servicio. La lógica de cálculo es delicada y está vinculada a la generación del PDF
y al contrato generado desde la propuesta.

### 🟡 Número de facturas emitidas
El número correlativo de facturas usa serie `F` con un offset configurable en `estudio_config.factura_numero_inicio`.
El cálculo es: `max(número actual, offset) + 1`. No modificar sin entender este sistema.

### 🟡 Middleware y FP_ROLES
`middleware.ts` tiene su propia lista `FP_ROLES` inline (no puede importar de `lib/types`
por potenciales incompatibilidades con edge runtime). Si se añade un rol nuevo, hay que
actualizarlo en **ambos**: `lib/types/index.ts` Y `middleware.ts`.

---

## 11. Estado actual del desarrollo

### ✅ Terminado y en producción
- Web pública completa (proyectos, real estate, estudio, contacto)
- Portal de clientes (visitas de obra, documentos, fases)
- Sistema de captación completo (leads → propuestas → contratos con DocuSign)
- Plantilla de propuestas con servicios base + custom + traducciones EN
- Due Diligencia Técnica (PDF + email)
- Módulo de proyectos internos (fases, tasks, kanban, documentación, renders)
- Time Tracker completo
- Sistema de finanzas: costes fijos/variables, históricos, P&L por proyecto
- Facturación: control por proyecto (kanban), facturas emitidas con PDF y envío
- Conciliación bancaria
- Scanner de tickets (OCR con IA)
- Proveedores con contactos secundarios
- FP Execution (licitaciones, partners, contratos)
- Sistema de avisos y mejoras
- Área interna del equipo + gestión de equipo
- Bienvenida token-based para nuevos clientes
- Cron jobs (horas faltantes, docs faltantes, facturas cobrables)
- Naming audit completo: `create/update/send` prefijos, variables descriptivas
- Design Hunter (multiselección, vídeos, thumbnails, lightbox, vista Stories)
- Marketing Post Manager (kanban, tabs Instagram/LinkedIn, media upload, flujo de aprobación, avisos)
- Repasos de obra (pins sobre plano, visibilidad de 3 niveles, enlaces externos, trazabilidad) — **pendiente ejecutar `repasos_obra.sql`**
- Memorias de calidades v2: warehouse por subcapítulo con Favorito FP, alta por URL con IA, memoria de
  anteproyecto automática y memoria de ejecución por estancias con control económico y PDF por proveedor
  — **pendiente ejecutar `memorias_calidad_v2.sql`**; falta el manual PDF del módulo

### 🚧 En progreso / incompleto
- `/team/finanzas/facturacion/dashboard` — ruta existe pero redirige o está vacía
- `/team/finanzas` (índice) — página de entrada a finanzas, posiblemente básica
- Módulo de review (`/team/review`) — estructura creada, contenido pendiente
- `/team/marketing/time-tracker-sections` — placeholder, en desarrollo

### 📋 Notas de deuda técnica
- `next.config.mjs` usa `serverExternalPackages` (key de Next.js 15), genera warning en Next.js 14. Funciona pero produce un warning de config en cada build.
- Los estilos inline en el área interna hacen el código verboso. No hay plan de migrar a Tailwind (decisión consciente para control total de UI).
- `lib/data/mock.ts` usa datos estáticos para la web pública. No hay CMS conectado.

---

## 12. Información de la empresa (para PDFs y emails)

- **Nombre legal:** GEINEX GROUP, S.L.
- **NIF:** B44873552
- **Dirección:** CL/ Ppe de Vergara 56 6ª 2ª · 28006 Madrid
- **Email:** contacto@formaprima.es
- **Web interna:** `https://internal.formaprima.es`
- **Logo:** `/public/FORMA_PRIMA_BLANCO.png` (fondo oscuro) — referenciado en PDFs y emails

---

## 13. Comandos útiles

```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción (verifica types)
vercel --prod --yes  # Deploy a producción
```

El proyecto está en Vercel, proyecto `estudio-web` bajo el equipo `forma-prima`.
URL de producción: `https://internal.formaprima.es` (alias de Vercel).
