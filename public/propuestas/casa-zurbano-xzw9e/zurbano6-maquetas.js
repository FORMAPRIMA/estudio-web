// Zurbano 6 · 3º izq. — three clay maquettes of the same flat.
// Plan coordinates in metres, measured from the drawings (F3. ARQ-01/02/03, 1:70):
// x → east (0 = inner face of the party wall), v → north (0 = inner face of the street façade).
// World: X = x − CX, Z = CZ − v, Y up (0 = finished floor).

export const CX = 10.5;
export const CZ = 5.1;
const D = Math.PI / 180;

const COMMON_ROOMS = {
  2: ['Salón', 18.7, 7.9],
  3: ['Comedor', 18.46, 1.69],
  4: ['Cocina', 14.29, 1.6],
  6: ['Distribuidor', 7.2, 6.97],
};

export const PLANS = {
  1: {
    code: '01',
    specs: { dorm: 3, bano: 3, aseo: 1, vest: 2, lav: true },
    summary: '3 dormitorios con baño · 2 vestidores · lavadero',
    rooms: {
      1: ['Recibidor', 14.26, 5.04], ...COMMON_ROOMS,
      5: ['Aseo de cortesía', 15.3, 6.95],
      7: ['Lavadero', 3.6, 8.3],
      8: ['Dormitorio máster', 10.6, 1.7],
      9: ['Vestidor máster', 10.3, 5.0],
      10: ['Baño máster', 7.75, 5.1],
      11: ['Dormitorio 02', 6.1, 1.7],
      12: ['Baño dormitorio 02', 4.6, 5.5],
      13: ['Dormitorio 03', 1.4, 1.7],
      14: ['Vestidor dormitorio 03', 1.0, 4.7],
      15: ['Baño dormitorio 03', 1.6, 7.05],
    },
  },
  2: {
    code: '02',
    specs: { dorm: 3, bano: 3, aseo: 1, vest: 1, lav: false },
    summary: '3 dormitorios con baño · vestidor máster · baño en el antiguo lavadero',
    rooms: {
      1: ['Recibidor', 14.26, 5.04], ...COMMON_ROOMS,
      5: ['Aseo de cortesía', 15.3, 6.95],
      7: ['Dormitorio máster', 10.6, 1.7],
      8: ['Vestidor máster', 9.1, 5.0],
      9: ['Baño máster', 5.8, 1.3],
      10: ['Dormitorio 02', 1.4, 1.7],
      11: ['Baño dormitorio 02', 5.8, 5.3],
      12: ['Dormitorio 03', 1.4, 5.55],
      13: ['Baño dormitorio 03', 3.0, 8.3],
    },
  },
  3: {
    code: '03',
    specs: { dorm: 3, bano: 3, aseo: 1, vest: 2, lav: false },
    summary: '3 dormitorios con baño · 2 vestidores · recibidor ampliado',
    rooms: {
      1: ['Recibidor', 13.88, 5.54], ...COMMON_ROOMS,
      5: ['Aseo de cortesía', 11.3, 4.7],
      7: ['Dormitorio 01', 10.6, 1.7],
      8: ['Vestidor dormitorio 01', 9.4, 5.0],
      9: ['Baño dormitorio 01', 7.9, 5.2],
      10: ['Dormitorio 02', 1.4, 5.55],
      11: ['Baño dormitorio 02', 3.0, 8.3],
      12: ['Dormitorio máster', 1.4, 1.7],
      13: ['Vestidor máster', 5.9, 1.5],
      14: ['Baño máster', 6.1, 4.8],
    },
  },
};

export function createBuilder(THREE, clay, baseMat = clay) {

  const G = { x: -CX, z: CZ };
  const L0 = { x: 0, z: 0 };

  function build(planId, { H = 1.3, furniture = true } = {}) {
    const root = new THREE.Group();
    root.name = `Zurbano6_Propuesta_${PLANS[planId].code}`;
    const base = group(root, 'base');
    const up = group(root, 'alzado');
    const muros = group(up, 'muros');
    const fachada = group(up, 'balcones');
    const escalera = group(up, 'escalera');
    const tab = group(up, 'tabiques');
    const mob = group(up, 'mobiliario');
    const K = kit(H);
    let wn = 0, wg = muros;
    const W = (x1, v1, x2, v2) => K.box(wg, `muro_${String(++wn).padStart(3, '0')}`, x1, v1, x2, v2, 0, H);
    const sill = (x1, v1, x2, v2) => {
      K.box(wg, `antepecho_${++wn}`, x1, v1, x2, v2, 0, 0.9);
      if (H > 2.3) K.box(wg, `dintel_${++wn}`, x1, v1, x2, v2, 2.3, H);
    };
    const lintel = (x1, v1, x2, v2) => { if (H > 2.3) K.box(muros, `dintel_${++wn}`, x1, v1, x2, v2, 2.3, H); };

    // ── Base: board + floor slab (stair well cut through) ─────────────────
    K.rbox(base, 'peana', -1.3, -2.0, 22.3, 12.2, -0.36, -0.2, 0.32, 0.03, G, false);
    const slab = new THREE.Shape();
    slab.moveTo(-0.1, -0.55);
    slab.lineTo(17.9, -0.55);
    slab.absarc(17.9, 2.3, 2.85, -90 * D, 0, false);
    [[20.75, 10.2], [16.92, 10.2], [16.92, 10.94], [11.51, 10.94], [11.51, 7.68], [5.2, 7.68],
      [5.2, 9.45], [2.13, 9.45], [2.13, 7.68], [-0.1, 7.68]].forEach(([x, v]) => slab.lineTo(x, v));
    const well = new THREE.Path();
    well.moveTo(13.5, 8.8); well.lineTo(16.65, 8.8); well.lineTo(16.65, 9.6); well.lineTo(13.5, 9.6); well.lineTo(13.5, 8.8);
    slab.holes.push(well);
    K.ext(base, 'forjado', slab, -0.2, 0, { bevel: 0.008, seg: 32, clip: false });

    // ── Shell (identical in the three proposals) ──────────────────────────
    // street façade piers (v −0.55…0) and balcony openings
    [[-0.1, 1.32], [2.8, 5.0], [6.47, 7.7], [9.18, 10.33], [11.78, 14.05], [15.47, 17.9]].forEach(([a, b]) => W(a, -0.55, b, 0));
    const streetOpenings = [[1.32, 2.8], [5.0, 6.47], [7.7, 9.18], [10.33, 11.78], [14.05, 15.47]];
    streetOpenings.forEach(([a, b]) => lintel(a, -0.55, b, 0));
    // east façade (salón)
    [[9.36, 9.94], [6.15, 7.86], [2.3, 4.65]].forEach(([a, b]) => W(20.2, a, 20.75, b));
    const eastOpenings = [[4.65, 6.15], [7.86, 9.36]];
    eastOpenings.forEach(([a, b]) => lintel(20.2, a, 20.75, b));
    W(16.92, 9.94, 20.75, 10.2);
    // curved corner (comedor)
    const arc = { cx: 17.9, cv: 2.3, r1: 2.3, r2: 2.85 };
    [[-90, -88], [-75, -61], [-36, -22], [-3, 0]].forEach(([a, b], i) =>
      K.sector(muros, `muro_curvo_${i + 1}`, arc.cx, arc.cv, arc.r1, arc.r2, a * D, b * D, 0, H));
    const arcOpenings = [[-88, -75], [-61, -36], [-22, -3]];
    if (H > 2.3) arcOpenings.forEach(([a, b], i) =>
      K.sector(muros, `dintel_curvo_${i + 1}`, arc.cx, arc.cv, arc.r1, arc.r2, a * D, b * D, 2.3, H));
    // party wall
    W(-0.1, 0, 0.18, 7.42);
    // courtyard façade (north) with windows onto the patio
    W(-0.1, 7.42, 0.63, 7.68); sill(0.63, 7.42, 1.72, 7.56);
    W(1.72, 7.42, 2.49, 7.7); W(2.13, 7.7, 2.42, 7.92);
    W(3.17, 7.42, 4.18, 7.7);
    W(4.92, 7.42, 8.58, 7.68); sill(8.58, 7.46, 9.7, 7.6);
    W(9.7, 7.42, 10.37, 7.68); sill(10.37, 7.46, 11.51, 7.6);
    W(11.51, 7.42, 11.89, 7.68);
    // lavadero volume on the patio
    W(4.92, 7.68, 5.2, 9.45); W(2.13, 9.3, 3.61, 9.45); W(3.61, 9.08, 4.92, 9.45);
    sill(2.13, 7.92, 2.3, 8.46); W(2.13, 8.46, 2.42, 8.77); sill(2.13, 8.77, 2.3, 9.3);
    // stair core
    W(11.51, 7.68, 11.85, 10.94); W(11.85, 10.66, 16.92, 10.94); W(16.65, 6.15, 16.92, 10.66); W(13.23, 7.41, 16.65, 7.71);
    // day zone
    W(19.15, 3.41, 20.2, 3.65);                     // salón | comedor
    W(15.48, 3.41, 16.65, 3.65); W(16.92, 3.41, 17.98, 3.65);
    W(16.65, 2.4, 16.92, 4.9); W(16.65, 0, 16.92, 0.95); // cross wall
    W(11.85, 3.41, 14.19, 3.65);                     // recibidor | cocina (door 14.19–15.48)
    W(11.86, 0, 11.96, 3.41);                        // cocina | dormitorio
    // bedroom-row bearing line (v 3.40–3.65) + pillar
    W(3.83, 3.65, 4.21, 3.77);

    // ── Stairs (context) ──────────────────────────────────────────────────
    const run = (16.65 - 13.5) / 14;
    for (let i = 0; i < 14; i++) K.box(escalera, `peldano_${i + 1}`, 13.5 + i * run, 9.6, 13.5 + (i + 1) * run, 10.66, 0, (i + 1) * 0.175);

    // ── Balconies ─────────────────────────────────────────────────────────
    let bn = 0;
    streetOpenings.forEach(([a, b]) => balconyStraight(K, fachada, `balcon_${++bn}`, a - 0.12, b + 0.12, 'S'));
    eastOpenings.forEach(([a, b]) => balconyStraight(K, fachada, `balcon_${++bn}`, a - 0.12, b + 0.12, 'E'));
    arcOpenings.forEach(([a, b]) => balconyArc(K, fachada, `balcon_${++bn}`, arc, (a - 2.5) * D, (b + 2.5) * D));

    // ── Proposal-specific partitions ──────────────────────────────────────
    wg = tab;
    const P = { W, sill, K, mob, H, furniture };
    if (planId === 1) plan1(P); else if (planId === 2) plan2(P); else plan3(P);
    if (planId !== 3) hallWithAseo(P); else hallOpen(P);
    if (furniture) dayZoneFurniture(P, planId);
    base.traverse((o) => { if (o.isMesh) o.material = baseMat; });
    return root;
  }

  // ═══ Proposal 01 ═══════════════════════════════════════════════════════
  function plan1({ W, sill, K, mob, furniture }) {
    W(0.18, 3.4, 1.49, 3.65); W(2.4, 3.4, 2.97, 3.65); W(3.67, 3.4, 4.28, 3.65); W(5.09, 3.4, 8.68, 3.65); W(9.5, 3.4, 11.86, 3.65);
    sill(2.49, 7.42, 3.17, 7.56);                    // bath 15 window to lavadero
    W(3.83, 6.4, 8.78, 6.51); W(9.5, 6.4, 11.89, 6.51); // corridor
    W(0.18, 5.73, 1.59, 5.8);                        // 15 | 14
    W(2.88, 5.78, 2.97, 7.42); W(2.3, 3.65, 2.4, 5.68); W(2.3, 5.68, 2.97, 5.78);
    W(3.83, 4.65, 4.21, 6.4);                        // bath 12 thick wall
    W(4.99, 3.65, 5.1, 4.85);
    W(5.95, 3.65, 6.07, 6.4);                        // 12 | 10
    W(6.07, 5.06, 6.9, 5.16); W(6.87, 5.74, 6.93, 6.4); W(6.87, 3.65, 6.93, 4.43);
    W(8.56, 3.65, 8.68, 4.47); W(8.56, 5.2, 8.68, 6.4); // 10 | 9
    W(11.78, 3.65, 11.89, 6.4);
    W(3.67, 0, 3.77, 3.4); W(7.24, 0, 7.35, 3.4);   // bedroom partitions
    if (!furniture) return;
    const F = furn(K, mob);
    F.bedRoom('d13', 'W', 0.18, 0.82, 2.2, 2.62);
    F.bedRoom('d11', 'E', 5.24, 0.82, 7.24, 2.62);
    F.bedRoom('d08', 'E', 9.87, 0.8, 11.86, 2.6);
    F.low('tv_d08', 7.35, 0.35, 7.7, 3.35, 0.55);
    F.armchair('butaca_d08', 8.15, 2.95, -24 * D);
    F.closet('armario_d11', 3.77, 0, 4.31, 3.4);
    F.closet('armario_v14a', 0.18, 5.15, 1.59, 5.73);
    F.closet('armario_v14b', 0.18, 3.65, 1.49, 4.2);
    F.closet('armario_paso', 2.4, 3.65, 2.97, 5.68);
    // baño 15
    F.toilet('inodoro_b15', 0.18, 7.02, 0);
    F.tray('plato_b15', 0.18, 5.8, 1.49, 6.7);
    F.vanity('lavabo_b15', 2.42, 5.83, 2.88, 7.38, 1);
    // baño 12
    F.vanity('lavabo_b12', 4.21, 6.0, 5.15, 6.4, 1);
    F.toilet('inodoro_b12', 5.58, 6.4, -90 * D);
    F.tray('plato_b12', 5.1, 3.65, 5.95, 4.85);
    // baño 10
    F.toilet('inodoro_b10', 6.48, 6.4, -90 * D);
    F.tray('plato_b10', 6.07, 3.65, 6.87, 5.06);
    F.vanity('lavabo_b10', 7.02, 5.94, 8.52, 6.4, 2);
    F.tub('banera_b10', 7.02, 3.72, 8.52, 4.39);
    // vestidor 9
    F.closet('vestidor_09a', 9.5, 5.82, 11.78, 6.4);
    F.closet('vestidor_09b', 9.5, 3.65, 11.78, 4.2);
    F.closet('vestidor_09c', 11.18, 4.2, 11.78, 5.82);
    // lavadero
    F.low('lavadero_encimera_a', 2.42, 8.72, 3.61, 9.3, 0.9);
    F.low('lavadero_encimera_b', 3.61, 8.72, 4.92, 9.08, 0.9);
  }

  // ═══ Proposal 02 ═══════════════════════════════════════════════════════
  function plan2({ W, K, mob, furniture }) {
    W(0.18, 3.4, 4.27, 3.65); W(5.09, 3.4, 8.68, 3.65); W(9.5, 3.4, 11.86, 3.65);
    W(4.18, 7.42, 4.92, 7.52);                       // old lavadero door closed
    W(4.96, 6.41, 8.72, 6.52); W(9.46, 6.41, 11.89, 6.52);
    W(3.87, 3.77, 4.21, 6.52); W(4.1, 6.52, 4.21, 6.69);
    W(5.08, 3.65, 5.17, 4.85); W(5.08, 5.52, 5.17, 6.41);
    W(5.83, 4.56, 6.52, 4.65);
    W(6.52, 3.65, 6.62, 6.41);
    W(11.78, 3.65, 11.89, 6.41);
    W(3.87, 2.4, 5.17, 2.5); W(4.5, 0, 4.6, 2.4); W(5.08, 2.5, 5.17, 3.4); W(6.17, 2.5, 6.23, 3.4);
    W(7.29, 0, 7.39, 1.57); W(7.29, 2.32, 7.39, 3.4);
    if (!furniture) return;
    const F = furn(K, mob);
    F.bedRoom('d12', 'W', 0.18, 4.63, 2.17, 6.44, true);
    F.closet('armario_d12', 3.27, 3.65, 3.87, 6.52);
    F.bedRoom('d10', 'W', 0.18, 0.82, 2.2, 2.62);
    F.closet('armario_d10', 3.87, 0, 4.5, 2.4);
    F.bedRoom('d07', 'E', 9.87, 0.8, 11.86, 2.6);
    F.armchair('butaca_d07', 8.15, 2.9, -24 * D);
    // baño 9
    F.vanity('lavabo_b09', 4.6, 0.24, 4.95, 2.2, 2, true);
    F.tub('banera_b09', 6.52, 0.12, 7.22, 1.5);
    F.toilet('inodoro_b09', 6.89, 3.4, -90 * D);
    F.tray('plato_b09', 5.17, 2.5, 6.17, 3.4);
    // baño 11
    F.toilet('inodoro_b11', 5.56, 6.41, -90 * D);
    F.vanity('lavabo_b11', 6.1, 4.65, 6.52, 6.41, 1, true);
    F.tray('plato_b11', 5.17, 3.65, 6.52, 4.56);
    // vestidor 8
    F.closet('vestidor_08a', 6.62, 5.8, 8.68, 6.41);
    F.closet('vestidor_08b', 6.62, 4.23, 7.24, 5.8);
    F.closet('vestidor_08c', 6.62, 3.65, 8.68, 4.23);
    F.closet('vestidor_08d', 9.46, 5.8, 11.78, 6.41);
    F.closet('vestidor_08e', 11.2, 4.23, 11.78, 5.8);
    F.closet('vestidor_08f', 9.46, 3.65, 11.78, 4.23);
    lavaderoBath(F);
  }

  // ═══ Proposal 03 ═══════════════════════════════════════════════════════
  function plan3({ W, K, mob, furniture }) {
    W(0.18, 3.4, 4.27, 3.65); W(5.09, 3.4, 8.68, 3.65); W(9.5, 3.4, 11.86, 3.65);
    W(4.18, 7.42, 4.92, 7.52);
    W(4.96, 6.41, 8.81, 6.52); W(9.54, 6.41, 11.89, 6.52);
    W(3.87, 3.77, 4.21, 6.52); W(4.1, 6.52, 4.21, 6.69);
    W(5.08, 3.65, 5.17, 4.39); W(5.08, 5.0, 5.17, 6.41);
    W(7.02, 3.65, 7.12, 6.41);
    W(7.24, 4.54, 7.95, 4.63);
    W(8.56, 3.65, 8.68, 5.06); W(8.56, 5.67, 8.68, 6.41);
    W(10.7, 3.65, 10.8, 6.41);
    W(11.8, 3.65, 11.89, 4.3); W(11.8, 4.94, 11.89, 6.41);
    W(10.8, 5.7, 11.8, 5.8);
    W(3.88, 0.91, 3.96, 3.4); W(7.29, 0, 7.39, 3.4);
    if (!furniture) return;
    const F = furn(K, mob);
    F.bedRoom('d10', 'W', 0.18, 4.63, 2.17, 6.44, true);
    F.closet('armario_d10', 3.27, 3.65, 3.87, 6.52);
    F.bedRoom('d12', 'W', 0.18, 0.82, 2.2, 2.62);
    F.bedRoom('d07', 'E', 9.87, 0.8, 11.86, 2.6);
    F.armchair('butaca_d07', 8.15, 2.95, -24 * D);
    F.low('mueble_d07', 7.39, 0.2, 7.7, 3.4, 0.55);
    // vestidor máster 13
    F.low('tv_v13', 3.96, 0.91, 4.31, 2.5, 0.55);
    F.low('isla_v13', 4.31, 0.95, 5.17, 2.45, 0.9, 0.03);
    F.closet('vestidor_13a', 5.17, 2.78, 7.29, 3.4);
    F.closet('vestidor_13b', 6.69, 0, 7.29, 2.78);
    // baño máster 14
    F.tray('plato_b14', 5.17, 5.17, 6.15, 6.41);
    F.toilet('inodoro_b14', 6.64, 6.41, -90 * D);
    F.vanity('lavabo_b14', 5.17, 3.65, 7.02, 4.1, 2);
    // baño 9
    F.vanity('lavabo_b09', 7.12, 4.9, 7.62, 5.5, 1, true);
    F.toilet('inodoro_b09', 8.2, 6.41, -90 * D);
    F.tray('plato_b09', 7.24, 3.65, 8.56, 4.54);
    // vestidor 8 + aseo 5
    F.closet('vestidor_08', 10.09, 3.65, 10.7, 6.41);
    F.closet('gabanero', 10.8, 5.8, 11.8, 6.41);
    F.toilet('inodoro_aseo', 11.36, 5.7, -90 * D);
    F.vanity('lavabo_aseo', 10.8, 3.65, 11.8, 4.13, 1);
    lavaderoBath(F);
  }

  function lavaderoBath(F) {
    F.toilet('inodoro_b_lav', 2.73, 9.3, -90 * D);
    F.vanity('lavabo_b_lav', 3.4, 8.3, 3.86, 9.3, 1, true);
    F.tray('plato_b_lav', 3.86, 7.7, 4.92, 9.08);
  }

  // Proposals 01/02: vestibule + aseo strip under the stair core
  function hallWithAseo({ W, K, mob, furniture }) {
    W(13.42, 6.42, 14.71, 6.5); W(15.44, 6.42, 16.65, 6.5); W(14.03, 6.5, 14.12, 7.41);
    if (!furniture) return;
    const F = furn(K, mob);
    F.closet('gabanero', 13.42, 6.5, 14.03, 7.41);
    F.toilet('inodoro_aseo', 14.12, 6.96, 0);
    F.vanity('lavabo_aseo', 16.2, 6.5, 16.65, 7.41, 1, true);
    F.soft('banco_recibidor', 11.9, 4.08, 12.2, 6.0, 0.45, 0.14);
    F.roundTable('mesa_recibidor', 14.26, 5.04, 0.65, 1.05);
  }
  function hallOpen({ K, mob, furniture }) {
    if (!furniture) return;
    const F = furn(K, mob);
    F.closet('armario_recibidor_a', 16.05, 6.15, 16.65, 7.41);
    F.closet('armario_recibidor_b', 16.05, 3.65, 16.65, 4.9);
    F.roundTable('mesa_recibidor', 13.88, 5.54, 0.65, 1.05);
  }

  function dayZoneFurniture({ K, mob }) {
    const F = furn(K, mob);
    // salón
    F.rug('alfombra_salon', 17.36, 5.21, 19.5, 9.59);
    const mods = [[6.21, 7.12], [7.12, 8.03], [8.03, 8.94]];
    mods.forEach(([a, b], i) => F.sofaModule(`sofa_${i + 1}`, 16.93, a, 17.86, b, ['W']));
    F.sofaModule('sofa_esquina', 16.93, 8.94, 17.86, 9.84, ['W', 'N']);
    F.sofaModule('sofa_5', 17.86, 8.96, 18.73, 9.84, ['N']);
    F.disc('mesa_centro', 18.77, 7.55, 0.45, 0, 0.36, 0.025);
    F.disc('mesa_auxiliar', 18.38, 4.94, 0.3, 0, 0.48, 0.015);
    F.armchair('butaca_salon', 19.19, 5.59, 102 * D);
    F.soft('chaise_salon', 19.78, 6.21, 20.16, 7.78, 0.42, 0.12);
    // cocina
    F.low('encimera', 11.96, 0.05, 12.58, 2.55, 0.9, 0.012);
    F.closet('columnas_cocina', 11.96, 2.55, 12.58, 3.41);
    F.closet('columna_cocina_b', 16.05, 2.3, 16.65, 3.41);
    F.closet('columna_cocina_c', 16.05, 0, 16.65, 0.95);
    F.low('isla', 13.43, 0.81, 15.15, 2.4, 0.9, 0.02);
    [[14.55, 2.72], [14.55, 0.5], [15.44, 2.0], [15.44, 1.2]].forEach(([x, v], i) => F.disc(`taburete_${i + 1}`, x, v, 0.18, 0, 0.64, 0.03));
    // comedor
    F.roundTable('mesa_comedor', 18.46, 1.69, 0.62, 0.98, 6);
  }

  // ═══ Furniture kit ═════════════════════════════════════════════════════
  function furn(K, p) {
    const F = {
      rug: (n, x1, v1, x2, v2) => K.rbox(p, n, x1, v1, x2, v2, 0, 0.014, 0.12, 0.005),
      disc: (n, x, v, r, y1, y2, bevel = 0.01) => K.disc(p, n, x, v, r, y1, y2, bevel),
      closet: (n, x1, v1, x2, v2) => K.rbox(p, n, x1 + 0.01, v1 + 0.01, x2 - 0.01, v2 - 0.01, 0, Math.min(2.25, K.H > 2.3 ? 2.25 : K.H - 0.2), 0.02, 0.008),
      low: (n, x1, v1, x2, v2, h, r = 0.03) => K.rbox(p, n, x1 + 0.01, v1 + 0.01, x2 - 0.01, v2 - 0.01, 0, h, r, 0.01),
      soft: (n, x1, v1, x2, v2, h, r) => K.rbox(p, n, x1, v1, x2, v2, 0, h, r, 0.035),
      tray: (n, x1, v1, x2, v2) => K.rbox(p, n, x1 + 0.02, v1 + 0.02, x2 - 0.02, v2 - 0.02, 0, 0.035, 0.03, 0.008),
      vanity(n, x1, v1, x2, v2, basins = 1, alongV = false) {
        K.rbox(p, n, x1 + 0.01, v1 + 0.01, x2 - 0.01, v2 - 0.01, 0, 0.86, 0.02, 0.008);
        for (let i = 0; i < basins; i++) {
          const t = (i + 0.5) / basins;
          const x = alongV ? (x1 + x2) / 2 : x1 + (x2 - x1) * t;
          const v = alongV ? v1 + (v2 - v1) * t : (v1 + v2) / 2;
          const r = Math.min(0.17, Math.min(x2 - x1, v2 - v1) / 2 - 0.05);
          K.disc(p, `${n}_seno_${i + 1}`, x, v, r, 0.86, 0.99, 0.015);
        }
      },
      toilet(n, x, v, theta) {
        const g = local(p, n, x, v, theta);
        K.rbox(g, `${n}_cisterna`, 0, -0.19, 0.18, 0.19, 0, 0.78, 0.04, 0.015, L0);
        K.rbox(g, `${n}_taza`, 0.12, -0.18, 0.62, 0.18, 0, 0.41, 0.17, 0.03, L0);
      },
      tub(n, x1, v1, x2, v2) {
        const r = Math.min(x2 - x1, v2 - v1) / 2, t = 0.07;
        const s = K.rr(x1, v1, x2, v2, r);
        s.holes.push(K.rr(x1 + t, v1 + t, x2 - t, v2 - t, r - t));
        K.ext(p, n, s, 0, 0.56, { bevel: 0.014, seg: 16 });
        K.rbox(p, `${n}_fondo`, x1 + t, v1 + t, x2 - t, v2 - t, 0, 0.16, r - t, 0.004);
      },
      chair(n, x, v, theta) {
        const g = local(p, n, x, v, theta);
        K.rbox(g, `${n}_asiento`, -0.15, -0.21, 0.22, 0.21, 0, 0.46, 0.08, 0.025, L0);
        K.rbox(g, `${n}_respaldo`, -0.22, -0.2, -0.15, 0.2, 0, 0.82, 0.03, 0.012, L0);
      },
      armchair(n, x, v, theta) {
        const g = local(p, n, x, v, theta);
        K.disc(g, `${n}_asiento`, 0, 0, 0.37, 0, 0.4, 0.05, L0);
        K.sector(g, `${n}_respaldo`, 0, 0, 0.27, 0.43, 105 * D, 255 * D, 0, 0.72, { o: L0, bevel: 0.03, seg: 20 });
      },
      roundTable(n, x, v, r, rugR, chairs = 0) {
        K.disc(p, `alfombra_${n}`, x, v, rugR, 0, 0.014, 0.005);
        K.disc(p, `${n}_pie`, x, v, 0.24, 0.014, 0.05, 0.012);
        K.disc(p, `${n}_fuste`, x, v, 0.07, 0.05, 0.72, 0);
        K.disc(p, `${n}_tablero`, x, v, r, 0.72, 0.76, 0.012);
        for (let i = 0; i < chairs; i++) {
          const a = (i / chairs) * Math.PI * 2 + Math.PI / chairs;
          F.chair(`${n}_silla_${i + 1}`, x + Math.cos(a) * (r + 0.26), v + Math.sin(a) * (r + 0.26), a + Math.PI);
        }
      },
      sofaModule(n, x1, v1, x2, v2, backs) {
        K.rbox(p, `${n}_asiento`, x1 + 0.01, v1 + 0.01, x2 - 0.01, v2 - 0.01, 0, 0.42, 0.09, 0.035);
        if (backs.includes('W')) K.rbox(p, `${n}_respaldo_w`, x1, v1 + 0.01, x1 + 0.22, v2 - 0.01, 0.2, 0.76, 0.08, 0.04);
        if (backs.includes('N')) K.rbox(p, `${n}_respaldo_n`, x1 + (backs.includes('W') ? 0.22 : 0.01), v2 - 0.22, x2 - 0.01, v2, 0.2, 0.76, 0.08, 0.04);
      },
      bedRoom(tag, head, x1, v1, x2, v2, upper = false) {
        const s = head === 'W' ? 1 : -1;
        const hx = head === 'W' ? x1 : x2;
        const len = Math.abs(x2 - x1);
        // rug, offset from the head wall
        const rugA = hx + s * 0.49, rugB = hx + s * (len + 0.7);
        F.rug(`alfombra_${tag}`, Math.min(rugA, rugB), v1 - 0.3, Math.max(rugA, rugB), v2 + 0.3);
        // headboard
        K.rbox(p, `cabecero_${tag}`, Math.min(hx, hx + s * 0.08), v1 - 0.05, Math.max(hx, hx + s * 0.08), v2 + 0.05, 0, 1.08, 0.03, 0.012);
        const m1 = hx + s * 0.08, m2 = hx + s * len;
        const mx1 = Math.min(m1, m2), mx2 = Math.max(m1, m2);
        K.rbox(p, `somier_${tag}`, mx1 + 0.02, v1 + 0.02, mx2 - 0.02, v2 - 0.02, 0.014, 0.3, 0.04, 0.012);
        K.rbox(p, `colchon_${tag}`, mx1, v1, mx2, v2, 0.3, 0.52, 0.09, 0.04);
        // duvet over the foot two-thirds
        const d1 = hx + s * (len - 1.35), d2 = hx + s * (len + 0.02);
        K.rbox(p, `edredon_${tag}`, Math.min(d1, d2), v1 - 0.02, Math.max(d1, d2), v2 + 0.02, 0.5, 0.57, 0.08, 0.025);
        // pillows
        const pw = (v2 - v1 - 0.3) / 2, p1 = hx + s * 0.16, p2 = hx + s * 0.56;
        [[v1 + 0.12, v1 + 0.12 + pw], [v2 - 0.12 - pw, v2 - 0.12]].forEach(([a, b], i) =>
          K.rbox(p, `almohada_${tag}_${i + 1}`, Math.min(p1, p2), a, Math.max(p1, p2), b, 0.5, 0.66, 0.1, 0.05));
        // nightstands
        const n1 = hx + s * 0.02, n2 = hx + s * 0.5;
        K.rbox(p, `mesilla_${tag}_1`, Math.min(n1, n2), v2 + 0.03, Math.max(n1, n2), v2 + 0.55, 0, 0.5, 0.07, 0.014);
        K.rbox(p, `mesilla_${tag}_2`, Math.min(n1, n2), v1 - 0.55, Math.max(n1, n2), v1 - 0.03, 0, 0.5, 0.07, 0.014);
        // bench at the foot
        const b1 = hx + s * (len + 0.02), b2 = hx + s * (len + 0.4);
        K.rbox(p, `banqueta_${tag}`, Math.min(b1, b2), v1 + 0.14, Math.max(b1, b2), v2 - 0.14, 0, 0.45, 0.12, 0.035);
      },
    };
    return F;
  }

  function balconyStraight(K, p, n, a, b, side) {
    const posts = [];
    const depth = 0.42;
    if (side === 'S') {
      const v0 = -0.55, v1 = v0 - depth;
      K.rbox(p, `${n}_losa`, a, v1, b, v0, -0.1, 0, 0.02, 0.008, G, false);
      for (let x = a + 0.05; x <= b - 0.04; x += 0.105) posts.push([x, v1 + 0.04]);
      for (let v = v1 + 0.145; v < v0 - 0.04; v += 0.105) { posts.push([a + 0.04, v]); posts.push([b - 0.04, v]); }
      railing(K, p, n, posts, [[a + 0.02, v1 + 0.02, b - 0.02, v1 + 0.06], [a + 0.02, v1 + 0.06, a + 0.06, v0], [b - 0.06, v1 + 0.06, b - 0.02, v0]]);
    } else {
      const x0 = 20.75, x1 = x0 + depth;
      K.rbox(p, `${n}_losa`, x0, a, x1, b, -0.1, 0, 0.02, 0.008, G, false);
      for (let v = a + 0.05; v <= b - 0.04; v += 0.105) posts.push([x1 - 0.04, v]);
      for (let x = x1 - 0.145; x > x0 + 0.04; x -= 0.105) { posts.push([x, a + 0.04]); posts.push([x, b - 0.04]); }
      railing(K, p, n, posts, [[x1 - 0.06, a + 0.02, x1 - 0.02, b - 0.02], [x0, a + 0.02, x1 - 0.06, a + 0.06], [x0, b - 0.06, x1 - 0.06, b - 0.02]]);
    }
  }

  function balconyArc(K, p, n, arc, a0, a1) {
    const rIn = arc.r2, rOut = arc.r2 + 0.42, rRail = rOut - 0.04;
    K.sector(p, `${n}_losa`, arc.cx, arc.cv, rIn, rOut, a0, a1, -0.1, 0, { bevel: 0.008, seg: 24, clip: false });
    const posts = [];
    const step = 0.105 / rRail;
    for (let a = a0 + 0.05 / rRail; a <= a1 - 0.04 / rRail; a += step) posts.push([arc.cx + Math.cos(a) * rRail, arc.cv + Math.sin(a) * rRail]);
    for (let r = rRail - 0.105; r > arc.r2 + 0.04; r -= 0.105) {
      [a0 + 0.04 / r, a1 - 0.04 / r].forEach((a) => posts.push([arc.cx + Math.cos(a) * r, arc.cv + Math.sin(a) * r]));
    }
    railing(K, p, n, posts, []);
    K.sector(p, `${n}_pasamanos`, arc.cx, arc.cv, rRail - 0.02, rRail + 0.02, a0 + 0.02 / rRail, a1 - 0.02 / rRail, 0.93, 0.97, { seg: 24 });
  }

  // merged posts + rails → one mesh per balcony
  function railing(K, p, n, posts, rails) {
    const H = K.H, geos = [];
    const topP = Math.min(0.93, H);
    if (topP > 0.01) posts.forEach(([x, v]) => {
      const g = new THREE.BoxGeometry(0.016, topP, 0.016);
      g.translate(x - CX, topP / 2, CZ - v);
      geos.push(g);
    });
    rails.forEach(([x1, v1, x2, v2]) => {
      [[0.93, 0.97], [0.06, 0.085]].forEach(([y1, y2]) => {
        if (y2 > H) return;
        const g = new THREE.BoxGeometry(x2 - x1, y2 - y1, v2 - v1);
        g.translate((x1 + x2) / 2 - CX, (y1 + y2) / 2, CZ - (v1 + v2) / 2);
        geos.push(g);
      });
    });
    if (!geos.length) return;
    const m = new THREE.Mesh(merge(geos), clay);
    m.name = `${n}_barandilla`;
    p.add(m);
  }

  function merge(geos) {
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let count = 0;
    parts.forEach((g) => (count += g.attributes.position.count));
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
    let o = 0;
    parts.forEach((g) => {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  }

  function group(parent, name) { const g = new THREE.Group(); g.name = name; parent.add(g); return g; }
  function local(parent, name, x, v, theta) {
    const g = new THREE.Group(); g.name = name;
    g.position.set(x - CX, 0, CZ - v); g.rotation.y = theta;
    parent.add(g); return g;
  }

  // ═══ Geometry kit (clay primitives in plan coordinates) ════════════════
  function kit(H) {
    const add = (p, geo, name) => { const m = new THREE.Mesh(geo, clay); m.name = name; p.add(m); return m; };
    const box = (p, name, x1, v1, x2, v2, y1, y2, o = G, clip = true) => {
      const yt = clip ? Math.min(y2, H) : y2;
      if (yt - y1 < 0.003) return null;
      const xa = Math.min(x1, x2), xb = Math.max(x1, x2), va = Math.min(v1, v2), vb = Math.max(v1, v2);
      const m = add(p, new THREE.BoxGeometry(xb - xa, yt - y1, vb - va), name);
      m.position.set(o.x + (xa + xb) / 2, (y1 + yt) / 2, o.z - (va + vb) / 2);
      return m;
    };
    const rr = (xa, va, xb, vb, r) => {
      r = Math.max(0.0006, Math.min(r, (xb - xa) / 2 - 0.0005, (vb - va) / 2 - 0.0005));
      const s = new THREE.Shape();
      s.moveTo(xa + r, va); s.lineTo(xb - r, va); s.absarc(xb - r, va + r, r, -Math.PI / 2, 0, false);
      s.lineTo(xb, vb - r); s.absarc(xb - r, vb - r, r, 0, Math.PI / 2, false);
      s.lineTo(xa + r, vb); s.absarc(xa + r, vb - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(xa, va + r); s.absarc(xa + r, va + r, r, Math.PI, Math.PI * 1.5, false);
      return s;
    };
    const ext = (p, name, shape, y1, y2, { o = G, bevel = 0, seg = 10, clip = true } = {}) => {
      const yt = clip ? Math.min(y2, H) : y2, h = yt - y1;
      if (h < 0.003) return null;
      const b = bevel > 0 ? Math.min(bevel, h * 0.45) : 0;
      const bev = b > 0.0006;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(h - (bev ? 2 * b : 0), 0.0005), curveSegments: seg,
        bevelEnabled: bev, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3,
      });
      const m = add(p, geo, name);
      m.rotation.x = -Math.PI / 2;
      m.position.set(o.x, y1 + (bev ? b : 0), o.z);
      return m;
    };
    const rbox = (p, name, x1, v1, x2, v2, y1, y2, r = 0.05, bevel = 0.012, o = G, clip = true) => {
      const xa = Math.min(x1, x2), xb = Math.max(x1, x2), va = Math.min(v1, v2), vb = Math.max(v1, v2);
      const bb = Math.min(bevel, (xb - xa) / 4, (vb - va) / 4);
      return ext(p, name, rr(xa, va, xb, vb, r), y1, y2, { o, bevel: bb, seg: 6, clip });
    };
    const disc = (p, name, x, v, r, y1, y2, bevel = 0.01, o = G) => {
      const s = new THREE.Shape();
      s.absarc(x, v, r, 0, Math.PI * 2, false);
      return ext(p, name, s, y1, y2, { o, bevel: Math.min(bevel, r / 3), seg: r > 0.5 ? 72 : 40 });
    };
    const sector = (p, name, cx, cv, r1, r2, a0, a1, y1, y2, { o = G, bevel = 0, seg = 24, clip = true } = {}) => {
      const s = new THREE.Shape();
      s.moveTo(cx + r2 * Math.cos(a0), cv + r2 * Math.sin(a0));
      s.absarc(cx, cv, r2, a0, a1, false);
      s.lineTo(cx + r1 * Math.cos(a1), cv + r1 * Math.sin(a1));
      s.absarc(cx, cv, r1, a1, a0, true);
      return ext(p, name, s, y1, y2, { o, bevel, seg, clip });
    };
    return { H, box, rr, ext, rbox, disc, sector };
  }

  return { build };
}
