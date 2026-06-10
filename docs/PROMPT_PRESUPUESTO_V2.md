# Continuación — Presupuesto de obra v2 (EP cards + impacto plazos + template promotion)

> **Cómo usar este archivo:** Tras un `/clear`, pega su contenido completo. Da contexto suficiente para que retomes el trabajo sin necesidad de que repita las decisiones que ya tomamos.

---

## Contexto rápido

Estoy trabajando en el módulo de **FP Execution → Gestión de Obra** del proyecto `estudio-web` (Forma Prima). Lee `/Users/joseloragonzalez/estudio-web/CLAUDE.md` para arquitectura general del proyecto.

**Estado actual (lo que ya está en producción):**
- Gestión de obra activable desde Dream Team (tabla `fpe_obra_*` espejos de licitación).
- Dashboard de obra con Gantt vivo + CPM forward pass (`recomputeObraSchedule` en `lib/fp-execution/obra-apply.ts`).
- Editor de fase con plan (CPM-driven) + estado + overrides de realidad.
- Pestaña Presupuesto con sesiones de cambios + actas cliente (DocuSign) + interna.
- Validación de razones con Claude Haiku (fallback graceful).
- Cambios cliente quedan en estado **pendiente de aprobación** hasta firma DocuSign; cambios interna aplican inmediato.

**Archivos clave:**
- `app/actions/fpe-obra.ts` — actions del Gantt vivo
- `app/actions/fpe-obra-presupuesto.ts` — actions de sesiones/log
- `lib/fp-execution/obra-apply.ts` — helpers (`applyOneLog`, `buildLogsSnapshot`, `recomputeObraSchedule`, `applyClienteChangesForActa`, `cancelClienteChangesForActa`)
- `lib/fp-execution/obra-presupuesto.ts` — tipos + `buildPresupuestoView`
- `components/team/fp-execution/obra/` — toda la UI de obra
- `app/api/webhooks/docusign/route.ts` — webhook (ya soporta actas)
- `components/pdfs/ObraActaPDF.tsx` — PDF de actas

---

## Trabajo pendiente — todo lo que voy a pedir que implementes

### 1. Migración nueva

**A. Cambios en `fpe_obra_change_log`:**
- `reflect_to_partner` boolean default false
- `effective_partner_id` uuid → fpe_partners(id) (el partner al que se reflejará el delta económico)
- `add_to_template` boolean default false

**B. Cambios en `fpe_obra_payment_schedule`:**
- `kind` text default 'original' check (`original` | `modification`)
- `source_change_log_id` uuid → fpe_obra_change_log(id)
- Ampliar CHECK del campo `status` para incluir `pending_aprobacion` y `cancelado_cliente`

**C. Nueva tabla `fpe_obra_acta_phase_impacts`:**
- `id` uuid PK
- `acta_id` uuid → fpe_obra_actas(id) ON DELETE CASCADE
- `obra_phase_id` uuid → fpe_obra_phases(id) ON DELETE CASCADE
- `extra_dias` int (puede ser negativo si el cambio adelanta plazos)
- `created_at` timestamptz default now()
- UNIQUE(acta_id, obra_phase_id)

**D. Cambios en `fpe_obra_change_log` para soportar descripción/disciplina en new partidas/UEs:**
- Los snapshots quedan en el campo `new_value` JSONB existente — no requiere columna nueva.

RLS unificada como las demás tablas obra. `NOTIFY pgrst, 'reload schema'` al final.

---

### 2. Modificaciones a modales de cambio

#### EditPartidaModal, NewPartidaModal, NewUnitModal

Después del bloque `CategorizationFields`, añadir:

**Checkbox "Reflejar el delta económico al execution partner [Nombre EP]":**
- SIN defaults (el user decide cada vez). Decidido explícitamente — un cambio puede ser interno sin repercutir al EP (margen para la constructora).
- Para partidas: muestra el nombre del partner derivado de la UE (UE → fpe_obra_unit_partners).
- Para new_unit: usa el partner_id seleccionado en el modal.
- Si marca: el delta económico de este cambio se acumulará en el último hito de pago del EP al aplicarse.

#### NewPartidaModal + NewUnitModal

Añadir campos para emparejar con el template:

**NewPartidaModal:**
- `descripcion` (textarea, opcional)
- `discipline_id` (select de fpe_disciplines, **preseleccionado** desde `template_unit.principal_discipline_id` del UE parent o del chapter)
- Checkbox "También añadir esta partida al template de proyectos"
  - **Bloqueado** si la UE parent es custom (sin template_unit_id). Tooltip: "Promueve antes la UE al template para poder añadir esta partida también."

**NewUnitModal:**
- `descripcion` (textarea, opcional)
- `principal_discipline_id` (select, preseleccionado desde el chapter)
- Checkbox "También añadir esta UE al template de proyectos"

Los campos extra se incluyen en `new_value` JSONB del change_log row.

---

### 3. Server actions (extensión de `app/actions/fpe-obra-presupuesto.ts`)

Las funciones existentes `logEditPartida`, `logNewPartida`, `logNewUnit` se extienden para aceptar:
- `reflect_to_partner: boolean`
- `add_to_template: boolean` (sólo new_partida, new_unit)
- `descripcion`, `discipline_id` (para new_partida); `descripcion`, `principal_discipline_id` (para new_unit)

Al persistir, resolver `effective_partner_id`:
- new_unit: `partner_id` del modal
- edit_partida / new_partida: partner derivado del UE (via fpe_obra_unit_partners)
- delete_partida: partner derivado del UE
- delete_unit: el partner asignado al UE

### 4. Extensión de `applyOneLog` (en `lib/fp-execution/obra-apply.ts`)

Después de aplicar el cambio al presupuesto vivo:

**Si `reflect_to_partner = true`:**
1. Buscar el último hito de pago del `effective_partner_id` en `fpe_obra_payment_schedule` (orden DESC, kind='original').
2. Si no existe → crear un milestone sintético "Pendiente antes de cierre" con kind='original', status='pendiente', monto=0, vinculado al partner.
3. Insertar nueva fila en `fpe_obra_payment_schedule` con:
   - `kind = 'modification'`
   - `source_change_log_id = log.id`
   - `obra_milestone_id = id del último hito de pago`
   - `partner_id = effective_partner_id`
   - `nombre = "Modificación obra · [acta_codigo] · [partida_nombre]"`
   - `pct = 0` (no es % del contrato)
   - `monto = log.delta_monto`
   - `status`:
     - Si `destino_acta = 'cliente'` → `'pending_aprobacion'`
     - Si `destino_acta = 'interna'` → `'pendiente'`

**Si `add_to_template = true`:**
- new_unit: insertar fila en `fpe_template_units` con (nombre, descripcion, chapter_id derivado, principal_discipline_id, orden=siguiente disponible, activo=true)
- new_partida: validar que la UE parent tiene template_unit_id (sino, error — debería estar bloqueado en UI igualmente). Insertar fila en `fpe_template_line_items` bajo ese template_unit_id.

### 5. Extensión de `applyClienteChangesForActa` y `cancelClienteChangesForActa`

**applyClienteChangesForActa (cuando DocuSign devuelve signed):**
- Aplica los logs cliente (ya existente)
- **Adicional:** para cada log con `reflect_to_partner=true`, busca su row de `fpe_obra_payment_schedule` (por `source_change_log_id`) y actualiza `status: 'pending_aprobacion'` → `'pendiente'`.
- **Adicional:** lee todos los `fpe_obra_acta_phase_impacts` asociados al acta y aplica las modificaciones a `fpe_obra_phases.planned_duration_dias += extra_dias`. Luego dispara `recomputeObraSchedule` para cascadear.

**cancelClienteChangesForActa (cuando DocuSign devuelve voided/declined):**
- Marca logs como cancelled_at (ya existente)
- **Adicional:** para cada log con `reflect_to_partner=true`, marca su row de `fpe_obra_payment_schedule` con `status: 'cancelado_cliente'`. **No se borran** — quedan visibles para discusión posterior con el EP.
- Los phase_impacts NO se aplican (no se tocan obra_phases).

### 6. closeObraChangeSession (modificación)

Después de aplicar logs interna, **para interna también disparar los phase_impacts** asociados a la acta interna (los impactos no esperan firma cuando la sesión es solo interna).

Lógica de a qué acta van los phase_impacts:
- Si la sesión tiene acta cliente → phase_impacts vinculados a la acta cliente (esperan firma).
- Si la sesión es solo interna → phase_impacts vinculados a la acta interna (aplican inmediato).

---

### 7. Wizard de 2 pantallas en CloseSessionModal

El modal `CloseSessionModal` actual muestra el summary + disclaimer cliente. Refactor a wizard:

**Pantalla 1 — Disclaimer cliente (condicional):**
- Solo si hay acta cliente. Si no, se salta.
- Misma info que ya muestra hoy: email del cliente, NIF, summary de cambios.
- Botón "Siguiente" en lugar de "Confirmar".

**Pantalla 2 — Impacto en plazos (siempre):**
- Aparece tanto si hay cliente como solo interna.
- Radio inicial: "Sin impacto en duración" / "Sí, afecta plazos".
- Si marca "Sí", lista de fases candidatas:
  - Cargar las fases (`fpe_obra_phases`) de capítulos donde viven partidas tocadas en la sesión.
  - Cada fase: nombre, duración planificada actual, input numérico "+ días háb." (puede ser negativo para adelantos).
- Banner explicativo: "Estos cambios se aplicarán al cronograma vivo [inmediatamente / cuando el cliente firme el acta]" según haya cliente o no.
- Total acumulado mostrado como resumen.

**Botón final:**
- Texto dinámico: "Confirmar y generar acta(s)" si solo interna, o "Confirmar, generar y enviar a firma" si hay cliente.

**Al confirmar:**
1. Llamar `closeObraChangeSession` (aplica interna + genera actas).
2. Persistir los phase_impacts en `fpe_obra_acta_phase_impacts` vinculados al acta correspondiente.
3. Si hay acta cliente, llamar al endpoint DocuSign.
4. Si la sesión es solo interna, aplicar los phase_impacts a `obra_phases` y disparar `recomputeObraSchedule`.

---

### 8. PDF acta cliente (`components/pdfs/ObraActaPDF.tsx`)

Añadir sección **"Impacto en plazos"** justo después del detalle económico y antes del bloque de firmas:

- Solo si el acta tiene phase_impacts asociados.
- Lista cada fase afectada: nombre, duración antes, duración nueva, días añadidos/quitados.
- Texto explicativo: "La firma de esta acta supone aceptación de la modificación de plazos detallada."
- Total al pie: "Días totales añadidos: N días háb."

El extractor de phase_impacts puede hacerse en `/api/obra/actas/[id]/pdf/route.ts` y `/api/obra/actas/[id]/docusign/route.ts` (cargar de `fpe_obra_acta_phase_impacts` + join con `fpe_obra_phases` para nombres).

**Acta interna:** NO incluye phase_impacts (el cliente no necesita verlos, son operativos).

---

### 9. Nueva sección "Execution Partners" al final de Presupuesto

Componente nuevo `EPCardsList.tsx` en `components/team/fp-execution/obra/presupuesto/`.

**Por cada partner adjudicado en el proyecto, una card longitudinal colapsable:**

**Colapsada:**
- Nombre + contacto (email, teléfono)
- Total contratado original (suma kind='original' del payment_schedule)
- Total modificaciones (separado por estado: aplicadas, pending_aprobacion, cancelado_cliente)
- Total a pagar = original + modificaciones aplicadas

**Expandida:**
- Sección "Alcance contratado": lista de UEs asignadas a este partner con sus partidas + cantidades + precios
- Sección "Plan de pagos original": rows kind='original' con (nombre, %, monto, hito disparador, status, fecha estimada)
- Sección "Modificaciones (paga en hito final)": rows kind='modification' con:
  - Badge de estado: pendiente (gris) / pending_aprobacion (amarillo) / aplicada (azul) / cancelado_cliente (rojo)
  - Link al acta origen (codigo) y a la partida origen
  - Color del delta: rojo si positivo, verde si negativo

**Loading data:** la lista de partners + sus payment_schedules se puede cargar en `page.tsx` y pasar como prop.

---

### 10. Diferenciación visual en la tabla principal

En `PresupuestoTable.tsx`, para partidas y UEs:
- Si el change_log tiene `reflect_to_partner=true`, añadir un pequeño icono "→ EP" al lado del badge MODIFICADA/NUEVA/PENDIENTE APROBACIÓN.
- Tooltip al hover del icono: "Se reflejará al partner [Nombre]."

---

## Decisiones de diseño ya tomadas (no las renegocies)

1. **No defaults en el checkbox "Reflejar al EP"**. Siempre pregunta.
2. **Partidas heredan partner del UE**, no se puede overridear.
3. **Pagos modificación pago al hito final** del EP (no en otros milestones). Si no existe, se crea uno sintético "Pendiente antes de cierre".
4. **Cancelar acta cliente NO borra los pagos al EP**, los marca `cancelado_cliente`. Queda en discusión con el EP.
5. **PDF cliente NO incluye economía interna con EP**, solo el delta cliente y phase_impacts.
6. **Impacto en duración pregunta SIEMPRE** (no solo en cliente acta — también internos pueden afectar plazos).
7. **Acta cliente gatekeeps phase_impacts**: si la sesión tiene acta cliente, los plazos esperan firma. Si solo interna, aplican inmediato.
8. **Añadir capítulos nuevos: diferido a v3**. Solo permitimos UE y partidas nuevas.
9. **Eliminar partidas/UEs**: siempre va a acta interna (delta negativo). Status posibles del payment_schedule:
   - `pendiente`, `facturado`, `cobrado`, `pending_aprobacion`, `cancelado_cliente`
10. **Promoción al template**: para partida bloqueado si UE parent es custom. Mensaje claro al user.

---

## Orden recomendado de implementación

1. Migración.
2. Modificar `logEditPartida`, `logNewPartida`, `logNewUnit` para aceptar nuevos campos.
3. Modificar `applyOneLog` para insertar payment_schedule rows + opcionalmente promover al template.
4. Modificar `applyClienteChangesForActa` / `cancelClienteChangesForActa` para manejar status del payment_schedule.
5. Modificar `closeObraChangeSession` para aplicar phase_impacts cuando solo hay interna.
6. UI: extender CategorizationFields o crear componente nuevo para el bloque "Reflejar al EP" + "Añadir al template" + "Descripción/disciplina".
7. UI: refactor `CloseSessionModal` a wizard de 2 pantallas con pantalla de phase_impacts.
8. UI: nueva sección `EPCardsList` al final de `ObraPresupuestoTab`.
9. UI: icono "→ EP" en `PresupuestoTable`.
10. PDF: sección "Impacto en plazos" en `ObraActaPDF.tsx`.
11. Webhook DocuSign: ya soporta lo nuevo via los helpers actualizados (no toca el webhook directamente).
12. Build + commit + push + deploy.

---

## Estilo

- Conciso, conversacional. Evita walls of text. Sigue el estilo del CLAUDE.md.
- TaskCreate para trackear los bloques principales. Marca completados conforme avances.
- Type-check con `npx tsc --noEmit` después de cada bloque grande.
- Build de validación al final.
- No hagas preguntas para confirmar decisiones que ya están en este prompt. Ejecuta directo.
- Después del deploy, recuerda al usuario las migraciones que tiene que ejecutar manualmente en Supabase SQL Editor.

**Cuando termines todo, escribe un resumen de lo entregado + qué probar.**
