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
  h = cambia(h,
    '              <span style="font-size:12px;color:#7a746e;">{{ slotsSub }}</span>',
    '              <span style="font-size:12px;color:#7a746e;">{{ slotsSub }}</span>\n' +
    '              <span style="font-size:12px;color:#8c6a55;">' + RSVP + '</span>',
    'aviso de confirmación en el enlace')
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
