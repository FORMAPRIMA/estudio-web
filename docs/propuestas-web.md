# Propuestas de honorarios como página web

`formaprima.es/propuesta/<slug>` — un enlace por cliente, con PIN, que se abre como
presentación en escritorio (clic, flechas, rueda) y como scroll vertical en móvil.

## Dos tipos

- **`deck`** (Ciudad Celeste): diapositivas en dos versiones, desktop y mobile. Se
  extraen y las reproduce nuestro visor. Importador: `importar.mjs`.
- **`dc`** (Casa Zurbano): un dossier **interactivo** (botones, idiomas, vídeo,
  maquetas 3D). Se sirve tal cual con su propio runtime de Claude Design dentro de
  un iframe, solo con PIN (`app/propuesta/[slug]/deck/route.ts`). Importador:
  `importar-dc.mjs`. Si es un diseño solo móvil, en escritorio se ve centrado como
  historia vertical.

Y dos audiencias: `cliente` (una persona; el final pide **aceptar**) y `comprador`
(un dossier que circula entre compradores; el final pide sus datos y crea un
**lead** en Captación con la distribución y el nivel que elija).

## Publicar un dossier interactivo (`dc`)

1. Bajar a `~/Downloads/PROPUESTAS/<proyecto>/` el `.dc.html`, todos los `.js`
   de la raíz del proyecto de diseño y `assets/` (el token de descarga se saca
   abriendo el proyecto en Chrome, ver memoria del asistente).
2. Vídeos: dejar en `web/<nombre>.av1.mp4` y `web/<nombre>.hevc.mp4` las versiones
   optimizadas de cada `assets/<nombre>.mp4`. Sin ellas, el vídeo se copia tal cual
   (y un AV1 sin HEVC no se ve en la mayoría de iPhone).
   Si un vídeo H.264 ya pesa poco y recodificarlo no lo aligera, basta con
   `web/<nombre>.mp4` (remuxado con `+faststart`). Valen también los vídeos que el
   dossier asigna por código (`'uploads/<nombre>.mp4'`, como en Torre del Mangle).
3. `node scripts/propuestas/importar-dc.mjs <slug> <carpeta> "<archivo>.dc.html" [--quitar "Etiqueta"] [--perfil zurbano]`
   (Casa Zurbano se importa con `--quitar "Cierre" --perfil zurbano`: su cierre lo sustituye
   nuestra diapositiva final, y el perfil aplica sus arreglos propios —presupuesto,
   recorrido, carrusel, controles—.)
4. Alta en `lib/propuestas/registro.ts` con `tipo: 'dc'`, `pantallaPin` y `tema`. Si el
   diseño es una presentación horizontal (1920×1080), `formato: 'horizontal'`: se ve a
   pantalla completa (en un móvil en vertical pide girarlo) y, con `audiencia: 'cliente'`,
   el final es **Aceptar propuesta** + obras + formaprima.es, en el estilo oscuro del deck.
5. `og.jpg` (1200×630): captura de la portada (o `og-con-logos.mjs`).
6. (Opcional) **Versión de escritorio de un dossier vertical.** Sin ella, en un
   ordenador se ve como historia vertical centrada. Con ella, a pantalla completa:
   `deck?escritorio=1&alto=<1000–1320>` sirve el mismo documento en un lienzo de 1920
   de ancho y le aplica `lib/propuestas/escritorio/<dossier>.ts` (alta en `index.ts`):
   una capa de estilos que reordena cada diapositiva en horizontal y los retoques de
   código que hagan falta (vídeo horizontal, carrusel de lado…). Va por la posición de
   cada bloque: **si se reimporta un diseño cambiado, revisar esa capa** (si no
   encuentra un fragmento, falla en vez de servir algo roto).
   Casa Zurbano la tiene desde el 2 oct 2026 (vídeo de inicio horizontal
   `assets/zurbano6-video-h.{av1,hevc}.mp4`, original en `~/Downloads/PROPUESTAS/casa-zurbano/horizontal/`).

Publicadas así: Casa Zurbano (vertical, comprador, sin PIN) y Torre del Mangle
(`torre-del-mangle-zxu7z`, horizontal, Javier Ponce · PONCE3, PIN 3333, 2 oct 2026).

## Publicar una propuesta de diapositivas (`deck`)

1. **Diseño.** En Claude Design, dos archivos por propuesta: la versión horizontal
   (deck 1920×1080) y la vertical (1080×1920), con las mismas diapositivas.
2. **Bajar el material** a `~/Downloads/PROPUESTAS/<proyecto>/`:
   `desktop.html`, `mobile.html` y `assets/` con las imágenes que usan.
3. **Importar** (elige un slug con sufijo aleatorio, para que no se adivine):
   ```bash
   node scripts/propuestas/importar.mjs <proyecto>-<5 letras> ~/Downloads/PROPUESTAS/<proyecto>
   ```
   Genera `lib/propuestas/decks/<slug>.ts` y `public/propuestas/<slug>/` (imágenes
   optimizadas + `og.jpg` para la vista previa en WhatsApp).
4. **Dar de alta** en `lib/propuestas/registro.ts`: nombre del cliente, proyecto, PIN,
   portada, og y descripción.
5. **Desplegar** (`vercel --prod --yes`) y enviar el enlace + el PIN por separado.

Para retirar una propuesta: `activa: false` en el registro y desplegar.

## Qué pasa cuando el cliente la abre

- PIN correcto → cookie firmada (90 días) solo para esa propuesta.
- Aviso a socios en `/team` al abrirla y al llegar al final (una vez cada 12 h).
- Las visitas con sesión del equipo **no** avisan: no son el cliente.
- Última diapositiva (no viene del diseño, la pone la web): **Aceptar propuesta**
  (aviso `importante` + correo a contacto@ con los socios en copia), **Tengo dudas**
  (mailto) y las 4 primeras obras de la web enlazando a su ficha en formaprima.es.
- En escritorio hay botón **PDF** (imprime las diapositivas a 1920×1080).

## Piezas

| Archivo | Qué hace |
|---|---|
| `scripts/propuestas/importar.mjs` | .dc.html → diapositivas limpias (sin notas del orador, sin "Borrador") + imágenes |
| `lib/propuestas/registro.ts` | Alta de propuestas (solo servidor: tiene los PIN) |
| `app/propuesta/[slug]/page.tsx` | PIN o presentación; elige variante por user-agent |
| `components/propuesta/PropuestaDeck.tsx` | Reproductor desktop/mobile (sustituye al deck-stage del editor) |
| `components/propuesta/animaciones.ts` | Animaciones del diseño, portadas del script del .dc.html |
| `components/propuesta/SlideSiguiente.tsx` | Diapositiva final: aceptar, dudas, obras, web |
| `app/actions/propuestasWeb.ts` | PIN, avisos y aceptación |

## Rendimiento y robustez de los dossiers `dc` (auditoría 30 sep 2026)

Todo se aplica al importar (`scripts/propuestas/arreglos-dc.mjs`) o al servir
(`app/propuesta/[slug]/deck/route.ts`); si el diseño cambia y un arreglo no
encuentra su fragmento, el importador se para y lo dice.

- **Imágenes**: al tamaño al que se pintan (`medidas.json`, medido recorriendo el
  dossier en un iPhone emulado; ×1,25) y en WebP. Se cargan por proximidad
  (diapositiva actual ± 1) y se descargan las lejanas.
- **Vídeos**: AV1 + HEVC; una sola descarga (las fuentes van inertes hasta la
  versión interactiva). Portada en vídeo a 720p.
- **Maquetas 3D**: arrancan con su diapositiva, a resolución de pantalla; las de
  la ficha son fijas y quedan como imagen.
- **Runtime**: React y three.js servidos desde `public/propuestas/_rt` (no unpkg).
- **Sin instrumentación del editor** (omelette) y sin zoom con los dedos.
- **Pista "Desliza para continuar"** tras 5 s en cada diapositiva.

## Seguridad

- Acciones públicas con límite por IP y en base de datos; campo trampa en el
  formulario de interés; "Aceptar" solo en propuestas a cliente.
- PIN: 10 intentos / 15 min por IP.
- Cada propuesta sin PIN (`pin: null`) es pública pero con `noindex`.

## Salas · seguimiento de leads (fase 1, 6 oct 2026)

Un dossier es **sala** si tiene fila en `sala_salas` (piloto: Casa Zurbano). Cada lead
recibe un **PIN de 6 cifras** que lo identifica sin pedirle datos.

- Enlace personal: `formaprima.es/propuesta/<slug>/acceso` (pide el PIN aunque el dossier
  sea público). El enlace de siempre sigue abierto si `acceso_anonimo = true`: esas visitas
  se miden como anónimas.
- Se mide: sesiones (30 min), ciudad/región/país y coordenadas de ciudad (cabeceras de
  Vercel, sin servicios externos), IP truncada, dispositivo, **tiempo activo por
  diapositiva** (pestaña visible y señales de vida en el último minuto), hasta dónde llega,
  final, vídeo, maquetas 3D, idioma y «Me interesa». Si deja sus datos al final, su lead de
  Captación queda enlazado (`sala_leads.lead_captacion_id`).
- No se mide al equipo (sesión de /team o PIN del estudio).
- Revocar o caducar un PIN deja al lead como anónimo (y sin acceso si la sala es cerrada).
- Piezas: `lib/salas/servidor.ts` (acceso, PIN, cookies, geo; no es `'use server'`) ·
  `app/api/salas/t/route.ts` (baliza; sesión en token firmado) ·
  `components/propuesta/medicionSala.ts` (reloj y lotes) · puente del iframe en
  `deck/route.ts` (señales `act` y `ev`) · `app/propuesta/[slug]/acceso/page.tsx`.
- Tablas `sala_salas`, `sala_leads`, `sala_sesiones`, `sala_vistas`, `sala_eventos` +
  función `sala_sumar_vistas` (migración `salas_fase1.sql` ✅ aplicada el 6 oct 2026).
- Hasta el panel (fase 2): `node scripts/salas/lead.mjs <slug> "Nombre" [--empresa --canal --email --tel --caduca AAAA-MM-DD]`,
  `--lista`, `--revocar <PIN>`; informe con mapa de calor: `node scripts/salas/informe.mjs <slug> [--lead <PIN>]`.
- Probar en local: Playwright 1.63 (WebKit en caché) con iPhone 14; navegar con
  `document.querySelector('deck-stage').goTo(i)` dentro del iframe; bloquear las server
  actions que no sean el PIN.

## Salas · panel (fase 2, 6 oct 2026)

`salas.formaprima.es` — burbuja aparte de internal: en ese host `next.config` reescribe
todo a `app/salas` (y el middleware de internal se salta), así que /team, /login o la
web no existen ahí; y `/salas` en cualquier otro host da 404.

- Acceso con **código personal de 8 cifras** (se guarda su HMAC con `PORTAL_SECRET`, no el
  código). Sesión: cookie firmada 30 días, revalidada contra la BD en cada petición.
  Roles: `propietario` (todas las salas + Equipo) y `comercial` (sus salas, todos los leads).
- Páginas: dossiers · sala (KPIs, leads, mapa de calor tiempo/alcance, actividad, CSV) ·
  ficha de lead (PIN, datos, su mapa de calor, visitas; editar, nuevo PIN, revocar) ·
  `/equipo` (dar acceso, salas, desactivar, nuevo código; registro de auditoría).
- Piezas: `lib/salas/panel.ts` (sesión y lecturas; no es `'use server'`) ·
  `lib/salas/metricas.ts` (puro) · `app/actions/salas.ts` · `components/salas/*` ·
  `app/salas/**`. Tablas `sala_miembros`, `sala_miembro_salas`, `sala_auditoria`
  (migración `salas_fase2.sql` ✅ aplicada el 6 oct 2026).
- Alta de una persona desde terminal (arranque): `node scripts/salas/miembro.mjs "Nombre"
  --rol propietario --email E --salida <fichero>`. **Ojo**: el `PORTAL_SECRET` de producción
  es distinto del de `.env.local`; un código creado con el local no vale en producción.
- Probar en local: `http://salas.localhost:3000`. WebKit de Playwright no resuelve
  `*.localhost`: usar un proxy HTTP que conserve el Host (ver memoria del asistente).

# Open House · Claudio Coello 38 (8 oct 2026)

- Invitado: `formaprima.es/cc38/<token>` (`app/cc38/[token]/route.ts`). El diseño
  de Claude Design con los datos de SU grupo; del resto, solo la ocupación.
- Panel: `/team/apps/open-house` (sesión del equipo, sin PIN). Postal A5 con QR:
  `/team/apps/open-house/postal?i=<token>`.
- Datos: `oh_grupos` + `oh_invitados` (solo service_role). Las reservas pasan por
  `oh_accion` (plpgsql, con cerrojo): capacidad, exclusivas, cierre el 7 oct.
- Correo de confirmación con .ics al reservar; recordatorio el 7 oct a las 10:00
  (cron `open-house-recordatorio`); aviso en /team por cada reserva o cancelación.
- Importar de nuevo el diseño: `node scripts/open-house/importar.mjs ~/Downloads/PROPUESTAS/open-house-cc38`.
