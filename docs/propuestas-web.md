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
3. `node scripts/propuestas/importar-dc.mjs <slug> <carpeta> "<archivo>.dc.html" [--quitar "Etiqueta"]`
   (Casa Zurbano se importa con `--quitar "Cierre"`: su cierre lo sustituye nuestra diapositiva final.)
4. Alta en `lib/propuestas/registro.ts` con `tipo: 'dc'`, `pantallaPin` y `tema`.

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
