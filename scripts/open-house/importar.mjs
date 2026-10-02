#!/usr/bin/env node
// Importa el Open House de Claudio Coello 38 desde Claude Design y lo deja
// funcional contra el servidor.
//
//   node scripts/open-house/importar.mjs <carpeta-origen>
//
// La carpeta tiene lo que se baja del proyecto de diseño:
//   "Open House CC38 v2.dc.html", "Postal CC38.dc.html", support.js, assets/
//
// Genera:
//   lib/open-house/plantillas.ts      ← invitación y postal (las sirve el servidor)
//   public/open-house/cc38/           ← runtime e imágenes optimizadas
//   public/open-house/_rt/qrcode.js   ← generador de QR (antes, de jsdelivr)
//
// El prototipo guardaba todo en localStorage (cada navegador tenía su copia y
// nadie veía las reservas de los demás). Aquí cada acción —reservar, unirse,
// cancelar, no asistir; y en el panel crear, exclusiva, liberar, eliminar— va
// al servidor, que valida y devuelve el estado real. Cada arreglo busca un
// fragmento exacto del diseño: si el diseño cambia, el importador PARA.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { arreglarSupport } from '../propuestas/arreglos-dc.mjs'

const origen = process.argv[2]
if (!origen) { console.error('Uso: node scripts/open-house/importar.mjs <carpeta-origen>'); process.exit(1) }

const RAIZ = path.resolve(new URL('../..', import.meta.url).pathname)
const PUB = path.join(RAIZ, 'public', 'open-house', 'cc38')
const RT = path.join(RAIZ, 'public', 'open-house', '_rt')
const src = (f) => path.join(origen, f)

function cambia(texto, buscar, poner, nombre) {
  const hay = typeof buscar === 'string' ? texto.includes(buscar) : buscar.test(texto)
  if (!hay) throw new Error(`Arreglo "${nombre}": no encuentro el fragmento esperado (¿ha cambiado el diseño?)`)
  return texto.replace(buscar, poner)
}

const sinEditor = (html) => {
  html = html.replace(/<(script|style) data-omelette-injected[^>]*>[\s\S]*?<\/\1>/g, '')
  if (html.includes('data-omelette-injected')) throw new Error('Queda instrumentación del editor (omelette)')
  return html
}

// Fecha límite para confirmar (el evento es el jueves 8).
const RSVP = 'Te rogamos que confirmes tu asistencia antes del martes 6 de octubre.'

// Lo que sustituye a localStorage: window.__OH lo pone el servidor al servir.
const METODO_SERVIDOR = `
  servidor(accion, extra, alHecho) {
    const yo = this.ctx();
    const cuerpo = Object.assign({ accion, token: yo.token }, extra || {});
    fetch(window.__OH.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(cuerpo) })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.datos) this.setState({ data: res.datos });
        if (res && res.ok) { if (alHecho) alHecho(); } else this.flash((res && res.mensaje) || 'No se ha podido guardar. Inténtalo de nuevo.');
      })
      .catch(() => this.flash('Sin conexión. Inténtalo de nuevo.'));
  }
`

function arreglarInvitacion(h) {
  h = sinEditor(h)

  // Carga: del servidor (window.__OH), no de localStorage; sin datos de ejemplo.
  h = cambia(h,
    `    let d = null;
    try { d = JSON.parse(localStorage.getItem(Component.KEY)); } catch (e) {}
    let authed = false;
    try { authed = sessionStorage.getItem('fp-oh-auth') === '1'; } catch (e) {}
    if (!d) { d = Component.seed(); try { localStorage.setItem(Component.KEY, JSON.stringify(d)); } catch (e) {} }`,
    `    const d = (window.__OH && window.__OH.datos) || { groups: [] };
    const authed = !!(window.__OH && window.__OH.modo === 'admin');`,
    'carga desde el servidor')
  // Abrir el enlace lo marca el servidor al servirlo.
  h = cambia(h,
    `    if (this.state.data && c.view === 'guest' && c.guest && !c.guest.openedAt) {
      this.mutate(d => { d.groups.forEach(g => g.members.forEach(x => { if (x.id === c.guest.id) x.openedAt = Date.now(); })); });
    }`,
    '', 'apertura del enlace en servidor')
  // Vista y token: los fija el servidor (el invitado no puede pedir ?admin).
  h = cambia(h,
    `    const view = this.state.viewOv || (url.has('admin') ? 'admin' : (this.props.view || 'guest'));
    const token = this.state.tokenOv || url.get('i') || Component.DEMO[this.props.demoGuest || 'rogelio'];
    const data = this.state.data || Component.seed();`,
    `    const OH = window.__OH || {};
    const view = this.state.viewOv || (OH.modo === 'admin' ? 'admin' : 'guest');
    const token = this.state.tokenOv || OH.token || '';
    const data = this.state.data || { groups: [] };`,
    'vista y token del servidor')
  // Método que habla con el servidor.
  h = cambia(h, '  editGroup(gid, fn) {', METODO_SERVIDOR + '  editGroup(gid, fn) {', 'método servidor')

  // Acciones del invitado.
  h = cambia(h,
    `        this.editGroup(group.id, g => { g.booking = { slot: ps.id, att: att.slice(), by: guest.id, at: Date.now() }; g.declined = (g.declined || []).filter(i => !att.includes(i)); });
        this.setState({ step: null, att: null, pick: null });`,
    `        this.servidor('reservar', { slot: ps.id, att: att.slice() }, () => this.setState({ step: null, att: null, pick: null }));`,
    'reservar')
  h = cambia(h,
    `        this.editGroup(group.id, g => {
          g.declined = Array.from(new Set((g.declined || []).concat(guest.id)));
          if (g.booking) { g.booking.att = g.booking.att.filter(i => i !== guest.id); if (!g.booking.att.length) g.booking = null; }
        });
        this.setState({ step: 'declined', att: null, pick: null });`,
    `        this.servidor('declinar', {}, () => this.setState({ step: 'declined', att: null, pick: null }));`,
    'no asistir')
  h = cambia(h,
    `this.editGroup(group.id, g => { g.booking.att.push(guest.id); g.declined = (g.declined || []).filter(i => i !== guest.id); }); this.setState({ step: null });`,
    `this.servidor('unirse', {}, () => this.setState({ step: null }));`,
    'unirse')
  h = cambia(h,
    `this.editGroup(group.id, g => { g.booking = null; }); this.setState({ step: null });`,
    `this.servidor('cancelar', {}, () => this.setState({ step: null }));`,
    'cancelar')

  // Acciones del panel.
  h = cambia(h, `this.editGroup(g.id, x => { x.exclusive = !ex; });`, `this.servidor('exclusiva', { gid: g.id, valor: !ex });`, 'exclusiva')
  h = cambia(h, `this.editGroup(g.id, x => { x.booking = null; });`, `this.servidor('liberar', { gid: g.id });`, 'liberar')
  h = cambia(h, `this.mutate(d => { d.groups = d.groups.filter(x => x.id !== g.id); });`, `this.servidor('eliminar', { gid: g.id });`, 'eliminar')
  // Enlaces imposibles de adivinar (antes: iniciales + 4 caracteres).
  h = cambia(h,
    `const rnd = () => Math.random().toString(36).slice(2, 6);`,
    `const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');`,
    'tokens fuertes')
  h = cambia(h, `this.mutate(d => { d.groups.push(g); });`, `this.servidor('crear', { grupo: g });`, 'crear invitación')
  // Sin "restablecer datos de ejemplo" en producción: borraría las invitaciones reales.
  h = cambia(h, /<button type="button" onClick="\{\{ resetDemo \}\}"[^>]*>Restablecer datos de ejemplo<\/button>/, '', 'sin restablecer')
  h = cambia(h,
    `resetDemo: () => { if (!confirm('¿Restablecer los datos de ejemplo?')) return; try { localStorage.removeItem(Component.KEY); } catch (e) {} this.setState({ data: Component.seed(), created: null }); }`,
    `resetDemo: () => {}`, 'sin restablecer (lógica)')
  // Salir del panel: vuelve a la app del equipo.
  h = cambia(h,
    `logout: () => { try { sessionStorage.removeItem('fp-oh-auth'); } catch (e) {} this.setState({ authed: false, pin: '' }); },`,
    `logout: () => { (window.top || window).location.href = '/team/apps'; },`, 'salir')
  // Postal: la sirve el panel (solo equipo).
  h = cambia(h,
    `const url = 'Postal CC38.dc.html?i=' + encodeURIComponent(m.token) + '&b=' + encodeURIComponent(this.props.baseUrl || 'https://formaprima.es/cc38') + '&print=1';`,
    `const url = '/team/apps/open-house/postal?i=' + encodeURIComponent(m.token) + '&print=1';`,
    'postal')
  // Sin PIN de prototipo a la vista.
  h = h.replace(/PIN del prototipo: 0838/g, '')

  // Rogamos confirmación antes del martes: en el enlace del invitado y en los
  // textos de WhatsApp y correo (si el grupo aún no ha reservado).
  // Invitación personal, turnos compartidos: «máximo 5 personas» sonaba a que
  // el invitado podía traer acompañantes.
  h = cambia(h, 'text-transform:uppercase;color:#7a746e;">Personas máx.</span>',
    'text-transform:uppercase;color:#7a746e;">Plazas por turno</span>', 'turnos: dato de la visita')
  h = cambia(h,
    '</div>\n      <sc-if value="{{ isExclusive }}">',
    '</div>\n      <sc-if value="{{ notaTurnos }}"><p style="margin:0;font-size:14px;line-height:1.6;color:#5f5953;text-wrap:pretty;">{{ notaTurnos }}</p></sc-if>\n      <sc-if value="{{ isExclusive }}">',
    'turnos: nota en la visita')
  h = cambia(h,
    "`Recorridos de 30 minutos · de 17:00 a 21:00 · máximo ${cap} personas`,",
    "`Recorridos de 30 minutos · de 17:00 a 21:00 · turnos compartidos de hasta ${cap} personas`,\n" +
    "      notaTurnos: (others.length ? 'La invitación es nominal y válida únicamente para las personas indicadas.' : 'Tu invitación es personal e intransferible.') + (excl ? '' : ` Las visitas se organizan en turnos compartidos con otras personas invitadas, de un máximo de ${cap}, para que el recorrido sea cercano y tranquilo.`),",
    'turnos: subtítulo y nota')
  h = cambia(h,
    'para enseñarla en grupos reducidos.` + (others.length ? ` Tu invitación incluye a ${this.join(others)}.` : \'\')',
    'para enseñarla en turnos reducidos y compartidos.` + (others.length ? ` La invitación es nominal e incluye a ${this.join(others)}.` : \' La invitación es personal e intransferible.\')',
    'turnos: WhatsApp')
  h = cambia(h,
    'else P.push(`Las visitas son recorridos guiados de 30 minutos, en grupos reducidos de máximo ${cap} personas, entre las 17:00 y las 21:00.`);',
    'else P.push(`Las visitas son recorridos guiados de 30 minutos, entre las 17:00 y las 21:00, en turnos reducidos de un máximo de ${cap} personas, compartidos con otras personas invitadas.`);\n' +
    "    P.push(n ? 'La invitación es nominal y válida únicamente para las personas indicadas.' : 'La invitación es personal e intransferible.');",
    'turnos: correo')

  // Lenguaje neutro: sin «Estimado/Estimada» (por defecto salía «Estimado»
  // también a mujeres) ni masculinos genéricos.
  h = cambia(h, "salutation: `${guest.salute || 'Estimado'} ${guest.name},`", "salutation: `${guest.name},`", 'neutro: saludo en el enlace')
  h = cambia(h, "const sal = (m.salute || 'Estimado') + ' ' + first + ':';", "const sal = 'Hola, ' + first + ':';", 'neutro: saludo del correo')
  h = cambia(h, /<button type="button" onClick="\{\{ fm\.toggleSalute \}\}"[^>]*>\{\{ fm\.salute \}\}<\/button>/, '', 'neutro: sin selector de saludo en el panel')
  h = cambia(h, 'elige el horario para todos.</p>', 'elige el horario para todo el grupo.</p>', 'neutro: compartís visita')
  h = cambia(h, "elige el horario para ${n === 1 ? 'los dos' : 'todos'}, y el resto quedará confirmado automáticamente", "elige el horario para todo el grupo, y el resto de la invitación quedará confirmada automáticamente", 'neutro: correo conjunto')
  h = cambia(h,
    "'Hemos reservado para vosotros una visita privada: el turno que elijáis será exclusivamente vuestro, sin otros invitados.' : 'Hemos reservado para ti una visita privada: el turno que elijas será exclusivamente tuyo, sin otros invitados.'",
    "'Hemos reservado una visita privada para vuestro grupo: el turno que elijáis será exclusivo, sin nadie más.' : 'Hemos reservado una visita privada para ti: el turno que elijas será exclusivo, sin nadie más.'",
    'neutro: correo visita privada')

  // Solo a quien aún no tiene visita (en el panel no existe la clave: no sale).
  h = cambia(h, 'showDecline: !bk,', 'showDecline: !bk, pedirRsvp: !bk,', 'aviso: clave pedirRsvp')
  // Portada: bajo «Reservar visita».
  h = cambia(h,
    /(<button type="button" onClick="\{\{ toBooking \}\}" style="appearance:none;border:0;background:#fff;[^\n]*\{\{ heroCta \}\} <span>↓<\/span><\/button>)/,
    '<div style="display:flex;flex-direction:column;align-items:flex-start;gap:12px;">$1\n' +
    '          <sc-if value="{{ pedirRsvp }}"><span style="display:block;border-left:2px solid #c9a68c;padding:3px 0 3px 14px;font-size:15px;line-height:1.35;">Confirma tu asistencia<br><strong style="font-weight:500;">antes del martes 6 de octubre</strong></span></sc-if></div>',
    'aviso en la portada')
  // Reserva: recuadro al principio del paso de horarios.
  h = cambia(h,
    '<div style="display:flex;flex-direction:column;gap:40px;animation:fpUp .6s ease both;">',
    '<div style="display:flex;flex-direction:column;gap:40px;animation:fpUp .6s ease both;">\n' +
    '          <sc-if value="{{ pedirRsvp }}"><div style="background:#8c6a55;color:#fff;padding:24px 26px;display:flex;flex-direction:column;gap:8px;"><span style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;">Confirmación de asistencia</span><span style="font-size:clamp(17px,1.6vw,20px);font-weight:400;line-height:1.35;text-wrap:pretty;">' + RSVP + '</span><span style="font-size:13px;line-height:1.5;opacity:.85;">Elige tu horario aquí abajo o, si no puedes venir, avísanos.</span></div></sc-if>',
    'aviso en la reserva')
  h = cambia(h,
    ' Elige tu horario aquí: ${this.link(m.token)}\\n\\nForma Prima`;',
    ' Elige tu horario aquí: ${this.link(m.token)}` + (g.booking ? "" : "\\n\\n' + RSVP + '") + `\\n\\nForma Prima`;',
    'aviso de confirmación en WhatsApp')
  h = cambia(h,
    "    const post = ['Te esperamos.', 'Un saludo,\\nForma Prima'];",
    "    const post = (bk ? [] : ['" + RSVP + "']).concat(['Te esperamos.', 'Un saludo,\\nForma Prima']);",
    'aviso de confirmación en el correo')
  return h
}

function arreglarPostal(h) {
  h = sinEditor(h)
  h = cambia(h,
    `<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>`,
    `<script src="/open-house/_rt/qrcode.js"></script>`, 'postal: QR propio')
  h = cambia(h,
    `    let d = null;
    try { d = JSON.parse(localStorage.getItem('fp-openhouse-cc38-v4')); } catch (e) {}
    this.setState({ data: d || { groups: [] } }, () => {`,
    `    const d = (window.__OH && window.__OH.datos) || { groups: [] };
    this.setState({ data: d }, () => {`, 'postal: datos del servidor')
  h = cambia(h,
    `const token = p.get('i') || 'rl-7k2q';`,
    `const token = p.get('i') || '';`, 'postal: sin invitado de ejemplo')
  h = cambia(h,
    `            <a href="{{ link }}" style="font-size:8pt;color:#8c6a55;word-break:break-all;">{{ linkLabel }}</a>
          </span>`,
    `            <a href="{{ link }}" style="font-size:8pt;color:#8c6a55;word-break:break-all;">{{ linkLabel }}</a>
          </span>
          <span style="font-size:8pt;color:#5f5953;">Rogamos confirmación antes del martes 6 de octubre.</span>`,
    'postal: aviso de confirmación')
  h = cambia(h, "salutation: `${guest.salute || 'Estimado'} ${guest.name},`", "salutation: `${guest.name},`", 'postal: saludo neutro')
  h = cambia(h, "'Visitas en grupos reducidos.'", "'Turnos reducidos y compartidos. Invitación personal e intransferible.'", 'postal: turnos')
  return h
}

async function imagen(rel) {
  const entrada = src(rel)
  const base = path.basename(rel).replace(/\.[^.]+$/, '')
  const logo = /isotipo|logo/.test(base)
  const salida = logo ? `${base}.png` : `${base}.webp`
  const destino = path.join(PUB, 'assets', salida)
  const img = sharp(entrada, { failOn: 'none' }).rotate().resize({ width: logo ? 400 : 1800, withoutEnlargement: true })
  if (logo) await img.png({ compressionLevel: 9, palette: true }).toFile(destino)
  else await img.webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(destino)
  return salida
}

async function main() {
  fs.rmSync(PUB, { recursive: true, force: true })
  fs.mkdirSync(path.join(PUB, 'assets'), { recursive: true })
  fs.mkdirSync(RT, { recursive: true })

  let inv = arreglarInvitacion(fs.readFileSync(src('Open House CC38 v2.dc.html'), 'utf8'))
  let pos = arreglarPostal(fs.readFileSync(src('Postal CC38.dc.html'), 'utf8'))

  fs.writeFileSync(path.join(PUB, 'support.js'), arreglarSupport(fs.readFileSync(src('support.js'), 'utf8')))

  const usadas = [...new Set([...(inv + pos).matchAll(/assets\/((?:web\/)?[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp))/g)].map((m) => m[1]))]
  let peso = 0
  for (const rel of usadas) {
    const salida = await imagen(path.join('assets', rel))
    peso += fs.statSync(path.join(PUB, 'assets', salida)).size
    const re = new RegExp(`assets/${rel.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'g')
    inv = inv.replace(re, `assets/${salida}`)
    pos = pos.replace(re, `assets/${salida}`)
  }

  fs.mkdirSync(path.join(RAIZ, 'lib', 'open-house'), { recursive: true })
  fs.writeFileSync(path.join(RAIZ, 'lib', 'open-house', 'plantillas.ts'),
    `// Generado por scripts/open-house/importar.mjs — no editar a mano.\n\nexport const invitacion: string = ${JSON.stringify(inv)}\n\nexport const postal: string = ${JSON.stringify(pos)}\n`)

  console.log(`✓ invitación y postal · ${usadas.length} imágenes · ${(peso / 1e6).toFixed(1)} MB`)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
