/* env.js — bangunan gudang, dock, kantor, dekorasi, forklift & NPC (dinamis) */
import { Chunker, rgb, mix, wallCanvas, slatCanvas, asphaltCanvas, tileCanvas, lightmapCanvas, glowCanvas } from './kit.js';
import { mulberry32, KIND, KIND_H } from './items.js';
import { C } from './world.js';
import { CUST } from './data.js';

const PI = Math.PI;

export function buildEnvironment(w) {
  const e = w.eng, B = w.bounds, RB = w.rackBox, H = C.H, rnd = mulberry32(7);
  const W = B.x1 - B.x0, D = B.z1 - B.z0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const colliders = w.colliders, circles = [];
  const col = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1 });
  const Cwall = rgb(0xdfe3e7), Cyellow = rgb(0xf2c200), Cblack = rgb(0x1d2024), Cgrey = rgb(0x6f757c), Cdark = rgb(0x2f343a);
  const dec = new Chunker(e, w.gBox, { size: 26, name: 'dekor' });
  const decCyl = new Chunker(e, w.gCyl, { size: 26, name: 'dekor-silinder' });
  const glass = new Chunker(e, w.gBox, { size: 40, transparent: true, alpha: 0.26, name: 'kaca' });
  const decal = new Chunker(e, w.gFloorQuad, { size: 40, tex: w.atlasTex, name: 'decal' });
  const signs = w.signs, S = w.struct;
  const uv = (n) => w.atlas.uv(n);
  const sign = (name, x, y, z, sw, sh, yaw) => { const u = uv(name); signs.add(x, y, z, sw, sh, 1, yaw, 0, 1, 1, 1, 0, u[0], u[1], u[2], u[3]); };
  const floorDecal = (name, x, z, sw, sd, yaw = 0) => { const u = uv(name); decal.add(x, 0.03, z, sw, 1, sd, yaw, 0, 1, 1, 1, 0, u[0], u[1], u[2], u[3]); };

  /* ---------- lantai, langit-langit, dinding ---------- */
  const floor = e.batch(w.gBox, { tex: w.floorTex, cull: false, name: 'lantai' });
  floor.add(cx, -0.1, cz, W, 0.2, D, 0, 0, 1, 1, 1, 0, 0, 0, D / 8, W / 8); floor.finalize();
  const ground = e.batch(w.gBox, { tex: e.texture(asphaltCanvas(), { repeat: true }), cull: false, name: 'aspal' });
  ground.add(cx, -0.18, cz, 700, 0.2, 700, 0, 0, 1, 1, 1, 0, 0, 0, 90, 90); ground.finalize();
  const ceil = e.batch(w.gBox, { cull: false, name: 'plafon' });
  ceil.add(cx, H + 0.2, cz, W + 1, 0.4, D + 1, 0, 0, 0.16, 0.17, 0.19, 0); ceil.finalize();
  const wallB = e.batch(w.gBox, { tex: e.texture(wallCanvas(), { repeat: true }), cull: false, name: 'dinding' });
  const wall = (x0, x1, z0, z1, h = H, y0 = 0) => {
    const alongX = (x1 - x0) >= (z1 - z0), len = alongX ? x1 - x0 : z1 - z0, th = alongX ? z1 - z0 : x1 - x0;
    wallB.add((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, len, h, th, alongX ? 0 : PI / 2, 0, 1, 1, 1, 0, 0, 0, len / 4, h / 4);
  };
  const slatTex = e.texture(slatCanvas(), { repeat: true });
  const slatB = e.batch(w.gBox, { tex: slatTex, cull: false, name: 'rolling-door' });
  const T = 0.5;
  wall(B.x0 - T, B.x0, B.z0 - T, B.z1 + T); wall(B.x1, B.x1 + T, B.z0 - T, B.z1 + T);
  // dinding utara & selatan memiliki pintu dock
  const doorsS = [], doorsN = [];
  for (let i = 0; i < 11; i++) doorsS.push(8 + i * 11.6);
  for (let i = 0; i < 7; i++) doorsN.push(16 + i * 17.5);
  const DW = 3.7, DH = 4.5;
  const wallDoors = (z0, z1, doors) => {
    let x = B.x0 - T;
    for (const d of doors) { wall(x, d - DW / 2, z0, z1); wall(d - DW / 2, d + DW / 2, z0, z1, H - DH, DH); x = d + DW / 2; }
    wall(x, B.x1 + T, z0, z1);
  };
  wallDoors(B.z0 - T, B.z0, doorsN); wallDoors(B.z1, B.z1 + T, doorsS);
  // kick-plate gelap di kaki dinding
  dec.box(cx, 0.6, B.z0 + 0.02, W, 1.2, 0.05, Cdark); dec.box(cx, 0.6, B.z1 - 0.02, W, 1.2, 0.05, Cdark);
  dec.box(B.x0 + 0.02, 0.6, cz, 0.05, 1.2, D, Cdark); dec.box(B.x1 - 0.02, 0.6, cz, 0.05, 1.2, D, Cdark);

  /* ---------- rangka atap & lampu high-bay ---------- */
  const steel = rgb(0x39424e);
  for (let z = B.z0 + 6; z < B.z1; z += 12) S.box(cx, H - 0.5, z, W, 0.45, 0.28, steel);
  for (let x = B.x0 + 8; x < B.x1; x += 16) S.box(x, H - 0.22, cz, 0.22, 0.3, D, steel);
  const aisleX = [];
  for (let i = 1; i < w.cols.length; i++) if (w.cols[i] - w.cols[i - 1] > 1) aisleX.push((w.colX[i] + w.colX[i - 1]) / 2);
  const lampPos = [];
  for (const x of aisleX) for (let z = 3; z < w.rackBox.z1; z += 9.5) lampPos.push([x, z]);
  for (let x = B.x0 + 6; x < w.rackBox.x0 - 2; x += 8) for (let z = B.z0 + 6; z < B.z1; z += 10) lampPos.push([x, z]);
  for (let x = w.rackBox.x1 + 4; x < B.x1; x += 8) for (let z = B.z0 + 6; z < B.z1; z += 10) lampPos.push([x, z]);
  for (let x = w.rackBox.x0; x < w.rackBox.x1; x += 10) for (const z of [B.z0 + 8, B.z0 + 18, w.rackBox.z1 + 8, w.rackBox.z1 + 18, w.rackBox.z1 + 28]) lampPos.push([x, z]);
  for (const [x, z] of lampPos) {
    S.box(x, H - 1.4, z, 0.04, 2.2, 0.04, steel);
    S.box(x, H - 2.6, z, 0.5, 0.14, 3.6, rgb(0x20262d));
    S.box(x, H - 2.70, z, 0.36, 0.05, 3.3, [0.93, 0.97, 1.0], 1);
  }
  w.lampCount = lampPos.length;
  { const lm = lightmapCanvas(w, lampPos, C); e.setLightmap(lm.canvas, lm.bounds); e.setLamps(lampPos, H - 2.7); }
  /* halo cahaya di bawah tiap lampu (dua bidang tegak bersilang + satu bidang datar) */
  const glowOpt = { size: 40, transparent: true, alpha: 0.9, tex: e.texture(glowCanvas()), name: 'halo' };
  const glowV = new Chunker(e, w.gQuad, glowOpt), glowH = new Chunker(e, w.gFloorQuad, glowOpt);
  for (const [x, z] of lampPos) {
    glowV.add(x, H - 2.9, z, 6, 6, 1, 0, 0, 0.92, 0.96, 1, 1); glowV.add(x, H - 2.9, z, 6, 6, 1, PI / 2, 0, 0.92, 0.96, 1, 1);
    glowH.add(x, H - 2.9, z, 6, 1, 6, 0, 0, 0.92, 0.96, 1, 1);
  }
  glowV.finalize(); glowH.finalize();
  /* jendela tinggi & sempit di dinding (cahaya siang) */
  const winC = new Chunker(e, w.gBox, { size: 40, name: 'jendela' });
  for (let x = B.x0 + 5; x < B.x1 - 3; x += 7.5) { winC.box(x, 14.5, B.z0 + 0.04, 1.3, 6.5, 0.05, [0.82, 0.93, 1.0], 1); winC.box(x, 14.5, B.z1 - 0.04, 1.3, 6.5, 0.05, [0.82, 0.93, 1.0], 1); }
  for (let z = B.z0 + 5; z < B.z1 - 3; z += 7.5) { winC.box(B.x0 + 0.04, 14.5, z, 0.05, 6.5, 1.3, [0.82, 0.93, 1.0], 1); winC.box(B.x1 - 0.04, 14.5, z, 0.05, 6.5, 1.3, [0.82, 0.93, 1.0], 1); }
  winC.finalize();
  const setGlow = (on) => { for (const b of [...glowV.map.values(), ...glowH.map.values(), ...winC.map.values()]) b.visible = on && b.n > 0; };

  /* ---------- marka lantai: garis kuning tepi lorong ---------- */
  const lineY = rgb(0xe5b800);
  for (const r of w.rackRects) {
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? r.x0 - 0.3 : r.x1 + 0.3;
      dec.box(x, 0.012, (r.z0 + r.z1) / 2, 0.1, 0.024, r.z1 - r.z0, lineY);
    }
  }
  // zebra cross di lorong silang antara blok A dan B
  for (let i = 0; i < 9; i++) dec.box(2 + i * 0.8, 0.013, w.crossZ, 0.4, 0.026, 3.0, rgb(0xeeeeee));
  for (let i = 0; i < 9; i++) dec.box(24 + i * 0.8, 0.013, w.crossZ, 0.4, 0.026, 3.0, rgb(0xeeeeee));

  /* ---------- pilar dengan APAR ---------- */
  const pillar = (x, z, withSign = true) => {
    dec.box(x, H / 2, z, 0.7, H, 0.7, rgb(0xb6bcc3)); dec.box(x, 0.6, z, 0.78, 1.2, 0.78, Cyellow); dec.box(x, 0.6, z, 0.8, 0.3, 0.8, Cblack);
    col(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
    if (withSign) { sign('apar', x, 1.6, z + 0.37, 0.5, 0.25, 0); sign('apar', x, 1.6, z - 0.37, 0.5, 0.25, PI); dec.box(x, 1.05, z + 0.42, 0.22, 0.46, 0.14, rgb(0xc1121f)); }
  };
  for (const x of [8, 34, 60, 86, 112]) { pillar(x, -11); pillar(x, w.rackBox.z1 + 12); }
  for (const z of [10, 30, 50, 70]) { pillar(B.x0 + 3, z, false); pillar(B.x1 - 3, z, false); }

  /* ---------- palet lantai (staging) ---------- */
  const clientColors = CUST.map((c) => rgb(parseInt(c.color.slice(1), 16)));
  const floorPallet = (x, z, y0, kind) => {
    const c = clientColors[Math.floor(rnd() * clientColors.length)];
    w.decorPallets.push({ x, z, y0, kind, h: KIND_H[kind], tint: w.tintFor(rnd, kind, Math.floor(rnd() * CUST.length)), jx: (rnd() - 0.5) * 0.08, jz: (rnd() - 0.5) * 0.08, jyaw: (rnd() - 0.5) * 0.3, face: 0 });
  };
  const stage = (x0, z0, nx, nz) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const kind = [0, 0, 1, 2, 3, 3, 5][Math.floor(rnd() * 7)];
      if (rnd() < 0.12) continue;
      const x = x0 + i * 1.25, z = z0 + j * 1.3;
      floorPallet(x, z, 0, kind);
      if (rnd() < 0.35 && KIND_H[kind] < 1.3) floorPallet(x, z, C.PAL + KIND_H[kind], kind === 5 ? 0 : kind);
    }
    col(x0 - 0.65, x0 + (nx - 1) * 1.25 + 0.65, z0 - 0.7, z0 + (nz - 1) * 1.3 + 0.7);
    dec.box(x0 + (nx - 1) * 0.625, 0.01, z0 + (nz - 1) * 0.65, nx * 1.25 + 0.3, 0.02, nz * 1.3 + 0.3, rgb(0x3d6e8f));
  };
  for (let i = 0; i < 9; i++) stage(12 + i * 12.5, -17, 5, 2);
  for (let i = 0; i < 6; i++) stage(20 + i * 15, -9, 4, 2);
  for (let i = 0; i < 9; i++) stage(10 + i * 12.5, w.rackBox.z1 + 4, 5, 2);
  for (let i = 0; i < 8; i++) stage(14 + i * 14, w.rackBox.z1 + 19, 5, 3);
  for (let i = 0; i < 5; i++) stage(26 + i * 18, w.rackBox.z1 + 28, 4, 2);
  w.stagedCount = w.decorPallets.length;

  /* ---------- area dock (pintu, leveler, trailer) ---------- */
  const dockIdx = { N: 0, S: 0 };
  const dock = (side, x, open) => {
    const zIn = side === 'S' ? B.z1 : B.z0, dir = side === 'S' ? 1 : -1; // dir: arah keluar bangunan
    const n = ++dockIdx[side] + (side === 'S' ? 0 : 11);
    dec.box(x - DW / 2 - 0.15, DH / 2, zIn - dir * 0.15, 0.3, DH, 0.4, Cyellow); dec.box(x + DW / 2 + 0.15, DH / 2, zIn - dir * 0.15, 0.3, DH, 0.4, Cyellow);
    dec.box(x, DH + 0.15, zIn - dir * 0.15, DW + 0.6, 0.3, 0.4, Cyellow);
    sign('dock' + Math.min(14, n), x, DH + 0.9, zIn - dir * 0.3, 1.6, 0.8, side === 'S' ? PI : 0);
    dec.box(x, 0.06, zIn - dir * 1.3, 3.2, 0.12, 2.4, rgb(0x59616a));
    dec.box(x - 1.6, 0.0 + 0.5, zIn - dir * 0.4, 0.3, 1.0, 0.3, Cblack); dec.box(x + 1.6, 0.5, zIn - dir * 0.4, 0.3, 1.0, 0.3, Cblack);
    dec.box(x + DW / 2 + 0.55, 3.2, zIn - dir * 0.35, 0.16, 0.16, 0.1, open ? rgb(0x30e060) : rgb(0xff3030), 1);
    if (open) {
      const L = 13, zc = zIn + dir * (L / 2 - 0.2), wallc = rgb(0xdadee3);
      dec.box(x, 1.15, zc, 2.7, 0.2, L, rgb(0x70767c));
      dec.box(x - 1.3, 2.6, zc, 0.12, 2.8, L, wallc); dec.box(x + 1.3, 2.6, zc, 0.12, 2.8, L, wallc);
      dec.box(x, 4.05, zc, 2.8, 0.12, L, rgb(0xf3f5f7)); dec.box(x, 2.6, zIn + dir * (L - 0.2), 2.7, 2.8, 0.12, wallc);
      for (let k = 0; k < 6; k++) { const c = [rgb(0xc9a06a), rgb(0xb88e55), rgb(0xd6b07c)][k % 3]; dec.box(x + (k % 2 ? 0.55 : -0.55), 1.25 + 0.4 + (k > 3 ? 0.8 : 0), zIn + dir * (2.5 + Math.floor(k / 2) * 1.5), 0.95, 0.8, 1.1, c); }
      dec.box(x, 0.9, zIn + dir * (L - 0.4), 2.2, 1.0, 0.5, Cdark);
    } else {
      slatB.add(x, DH / 2, zIn - dir * 0.05, DW, DH, 0.1, 0, 0, 1, 1, 1, 0, 0, 0, 3, 14);
    }
  };
  doorsS.forEach((x, i) => dock('S', x, i % 2 === 0 || i === 5));
  doorsN.forEach((x, i) => dock('N', x, i % 3 === 0));
  slatB.finalize();
  // pagar & bollard pada tepi dock leveler (visual)
  for (let i = 0; i < 30; i++) {
    const x = 6 + i * 4.3, z = w.rackBox.z1 + 2.2;
    decCyl.add(x, 0.5, z, 0.22, 1.0, 0.22, 0, 0, 0.95, 0.78, 0.1, 0); circles.push({ x, z, r: 0.2 });
  }

  /* ---------- zona barat: kantor Opname ---------- */
  const oz0 = w.crossZ - 9.4, oz1 = w.crossZ + 9.4, ox0 = -28, ox1 = -14, OH = 3.4;
  const tile = e.batch(w.gBox, { tex: e.texture(tileCanvas(), { repeat: true }), cull: false, name: 'lantai-kantor' });
  tile.add((ox0 + ox1) / 2, 0.03, (oz0 + oz1) / 2, ox1 - ox0, 0.06, oz1 - oz0, 0, 0, 1, 1, 1, 0, 0, 0, 8, 6); tile.finalize();
  const ow = rgb(0xe9ece9);
  const oWall = (x0, x1, z0, z1, h = OH, y0 = 0, c = ow) => { dec.box((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, c); };
  oWall(ox0, ox0 + 0.2, oz0, oz1); col(ox0 - 0.1, ox0 + 0.3, oz0, oz1);
  oWall(ox0, ox1, oz0, oz0 + 0.2); col(ox0, ox1, oz0 - 0.1, oz0 + 0.3);
  oWall(ox0, ox1, oz1 - 0.2, oz1); col(ox0, ox1, oz1 - 0.3, oz1 + 0.1);
  const dgap = 1.7;
  oWall(ox1 - 0.2, ox1, oz0, w.crossZ - dgap, 1.0); oWall(ox1 - 0.2, ox1, w.crossZ + dgap, oz1, 1.0);
  oWall(ox1 - 0.2, ox1, oz0, w.crossZ - dgap, OH - 2.8, 2.8); oWall(ox1 - 0.2, ox1, w.crossZ + dgap, oz1, OH - 2.8, 2.8);
  oWall(ox1 - 0.2, ox1, w.crossZ - dgap, w.crossZ + dgap, OH - 2.6, 2.6);
  glass.box(ox1 - 0.1, 1.9, (oz0 + w.crossZ - dgap) / 2, 0.06, 1.8, w.crossZ - dgap - oz0, [0.55, 0.78, 0.9]);
  glass.box(ox1 - 0.1, 1.9, (oz1 + w.crossZ + dgap) / 2, 0.06, 1.8, oz1 - w.crossZ - dgap, [0.55, 0.78, 0.9]);
  col(ox1 - 0.3, ox1 + 0.05, oz0, w.crossZ - dgap); col(ox1 - 0.3, ox1 + 0.05, w.crossZ + dgap, oz1);
  dec.box((ox0 + ox1) / 2, OH + 0.12, (oz0 + oz1) / 2, ox1 - ox0 + 0.4, 0.24, oz1 - oz0 + 0.4, rgb(0x58606a));
  sign('office', ox1 + 0.1, 3.0, w.crossZ, 2.6, 1.3, PI / 2 * 1);
  for (let k = 0; k < 4; k++) dec.box(-21 + (k % 2) * 5, OH - 0.05, w.crossZ - 5 + Math.floor(k / 2) * 10, 1.4, 0.06, 0.5, [1, 0.97, 0.88], 1);
  // furnitur
  const wood = rgb(0x9a7a56), screen = rgb(0xaed6ff);
  const desk = (x, z, yaw = 0, wd = 2.0, dp = 0.9) => { dec.box(x, 0.74, z, wd, 0.06, dp, wood, 0, yaw); dec.box(x, 0.36, z, wd - 0.2, 0.72, dp - 0.2, rgb(0x6a5a46), 0, yaw); };
  desk(-24.2, oz0 + 2.1, 0, 3.2, 1.0); dec.box(-24.9, 1.1, oz0 + 2.0, 0.6, 0.38, 0.05, screen, 0.9); dec.box(-23.5, 1.1, oz0 + 2.0, 0.6, 0.38, 0.05, screen, 0.9);
  dec.box(-24.2, 0.5, oz0 + 3.15, 0.5, 0.9, 0.5, Cdark); col(-25.9, -22.5, oz0 + 1.4, oz0 + 2.8);
  desk(-18.6, oz1 - 2.0, 0, 2.6, 1.0); dec.box(-18.6, 1.1, oz1 - 2.1, 0.7, 0.42, 0.05, screen, 0.9); col(-20, -17.3, oz1 - 2.6, oz1 - 1.3);
  dec.box(-18.6, 0.5, oz1 - 3.2, 0.5, 0.9, 0.5, Cdark);
  // meja rapat tengah
  dec.box(-21, 0.74, w.crossZ, 4.2, 0.08, 1.6, wood); dec.box(-21, 0.36, w.crossZ, 3.9, 0.7, 1.3, rgb(0x6a5a46)); col(-23.2, -18.8, w.crossZ - 1, w.crossZ + 1);
  for (let k = 0; k < 6; k++) dec.box(-22.5 + (k % 3) * 1.45, 0.82, w.crossZ - 0.35 + Math.floor(k / 3) * 0.7, 0.4, 0.04, 0.3, [1, 1, 0.95]);
  for (const z of [oz0 + 5.5, oz0 + 6.6, oz1 - 5.5]) { dec.box(-27.2, 0.9, z, 0.9, 1.8, 0.6, rgb(0x8b949c)); col(-27.7, -26.7, z - 0.4, z + 0.4); }
  dec.box(-27.2, 1.0, oz1 - 7, 0.9, 0.2, 0.6, rgb(0xc9ced3));
  // papan opname (whiteboard bertekstur, dapat diperbarui)
  const board = document.createElement('canvas'); board.width = 1024; board.height = 512;
  const boardTex = e.texture(board, { mip: false });
  const boardB = e.batch(w.gQuad, { tex: boardTex, cull: false, name: 'papan-opname' });
  boardB.add(ox0 + 0.35, 1.95, w.crossZ - 1.2, 6.4, 3.2, 1, PI / 2, 0, 1, 1, 1, 0); boardB.finalize();
  dec.box(ox0 + 0.28, 1.95, w.crossZ - 1.2, 0.08, 3.4, 6.7, rgb(0x7d858d));
  function setBoard(lines, title) {
    const g = board.getContext('2d');
    g.fillStyle = '#f4f6f2'; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#103866'; g.fillRect(0, 0, 1024, 84);
    g.fillStyle = '#ffd23f'; g.font = '800 44px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.fillText(title || 'PAPAN STOCK OPNAME — JDC', 28, 58);
    g.fillStyle = '#1b2430'; g.font = '600 30px "Segoe UI", Arial, sans-serif';
    lines.slice(0, 8).forEach((l, i) => { g.fillStyle = l.done ? '#1c7c3a' : '#b0232a'; g.fillRect(28, 112 + i * 48, 20, 20); g.fillStyle = '#1b2430'; g.fillText(l.text, 64, 130 + i * 48); });
    g.strokeStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(20, 104 + i * 48); g.lineTo(1004, 104 + i * 48); g.stroke(); }
    boardTex.needsUpdate = true;
  }
  setBoard([{ text: 'Menunggu penugasan shift…', done: false }]);

  /* ---------- zona barat: loker & pantry ---------- */
  for (let i = 0; i < 10; i++) { dec.box(B.x0 + 0.6, 1.0, 5 + i * 1.0, 0.6, 2.0, 0.9, i % 2 ? rgb(0x3b6ea5) : rgb(0x4a7fb8)); }
  col(B.x0 + 0.2, B.x0 + 1.0, 4.4, 15);
  sign('hardhat', B.x0 + 0.1, 2.7, 10, 1.6, 0.8, PI / 2 * -1 + PI);
  sign('assembly', B.x0 + 0.1, 2.7, 70, 2.2, 1.1, PI / 2 * -1 + PI);
  floorDecal('assembly', B.x0 + 8, 70, 8, 4, 0); floorDecal('forklift', 4, w.crossZ - 5.2, 4.5, 2.2, 0);
  // meja pantry + toilet
  dec.box(B.x0 + 2, 0.45, 55, 1.4, 0.9, 5, rgb(0xb0b6bb)); col(B.x0 + 1.2, B.x0 + 2.8, 52.5, 57.5);
  dec.box(B.x0 + 4, 1.0, 62, 6, 2.0, 0.3, rgb(0x8a95a0)); sign('toilet', B.x0 + 4, 2.3, 62.2, 1.8, 0.9, 0); col(B.x0 + 1, B.x0 + 7, 61.8, 62.3);
  // tumpukan pallet kosong
  for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) dec.box(B.x0 + 5 + i * 1.3, 0.07 + k * 0.14, 80, 1.0, 0.12, 1.2, rgb(0xb98a55));
  col(B.x0 + 4.3, B.x0 + 9.5, 79.3, 80.7);

  /* ---------- zona timur: QC cage, charging, NPC ---------- */
  const ex = w.rackBox.x1 + 3;
  // kandang QC
  const qx0 = ex + 2, qx1 = ex + 12, qz0 = 8, qz1 = 24;
  for (let x = qx0; x <= qx1; x += 1) { dec.box(x, 1.2, qz0, 0.05, 2.4, 0.05, Cyellow); dec.box(x, 1.2, qz1, 0.05, 2.4, 0.05, Cyellow); }
  for (let z = qz0; z <= qz1; z += 1) { dec.box(qx0, 1.2, z, 0.05, 2.4, 0.05, Cyellow); if (z < 14 || z > 17) dec.box(qx1, 1.2, z, 0.05, 2.4, 0.05, Cyellow); }
  glass.box((qx0 + qx1) / 2, 1.2, qz0, qx1 - qx0, 2.2, 0.03, [0.9, 0.85, 0.4]); glass.box((qx0 + qx1) / 2, 1.2, qz1, qx1 - qx0, 2.2, 0.03, [0.9, 0.85, 0.4]);
  glass.box(qx0, 1.2, (qz0 + qz1) / 2, 0.03, 2.2, qz1 - qz0, [0.9, 0.85, 0.4]);
  dec.box((qx0 + qx1) / 2, 2.45, qz0, qx1 - qx0, 0.08, 0.1, Cyellow); dec.box((qx0 + qx1) / 2, 2.45, qz1, qx1 - qx0, 0.08, 0.1, Cyellow);
  col(qx0 - 0.1, qx1 + 0.1, qz0 - 0.1, qz0 + 0.1); col(qx0 - 0.1, qx1 + 0.1, qz1 - 0.1, qz1 + 0.1); col(qx0 - 0.1, qx0 + 0.1, qz0, qz1); col(qx1 - 0.1, qx1 + 0.1, qz0, 14); col(qx1 - 0.1, qx1 + 0.1, 17, qz1);
  sign('qc', qx1 + 0.2, 2.9, 15.5, 2.4, 1.2, PI / 2); floorDecal('qc', qx0 + 5, 20, 6, 3);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = qx0 + 1.6 + i * 2.2, z = qz0 + 2 + j * 1.9; w.decorPallets.push({ x, z, y0: 0, kind: [0, 3, 5][(i + j) % 3], h: KIND_H[[0, 3, 5][(i + j) % 3]], tint: [1, 0.55, 0.5], jx: 0, jz: 0, jyaw: 0.1 * i, face: 0 }); }
  // charging station
  const chx = ex + 4, chz0 = 40;
  for (let i = 0; i < 5; i++) {
    const z = chz0 + i * 3.4;
    dec.box(chx + 4.4, 0.9, z, 0.5, 1.8, 0.6, Cdark); dec.box(chx + 4.15, 1.5, z, 0.04, 0.3, 0.2, rgb(0x30e060), 1);
    dec.box(chx + 4.15, 1.1, z, 0.04, 0.2, 0.25, rgb(0x303030));
  }
  col(chx + 4.0, chx + 4.8, chz0 - 0.5, chz0 + 4 * 3.4 + 0.5);
  sign('charge', chx + 4.1, 2.6, chz0 + 7, 2.6, 1.3, -PI / 2);
  floorDecal('charge', chx, chz0 + 7, 7, 3.2, PI / 2);
  floorDecal('forklift', chx - 2, 60, 4.5, 2.2, 0);
  // blok toilet / ruang panel di tepi timur
  oWall(B.x1 - 10, B.x1 - 0.2, 4, 4.2, 3.4); oWall(B.x1 - 10, B.x1 - 9.8, 4, 14, 3.4); oWall(B.x1 - 10, B.x1 - 0.2, 14, 14.2, 3.4);
  col(B.x1 - 10, B.x1 - 0.2, 3.9, 4.3); col(B.x1 - 10.1, B.x1 - 9.7, 4, 14); col(B.x1 - 10, B.x1 - 0.2, 13.9, 14.3);
  sign('toilet', B.x1 - 10.2, 2.7, 9, 1.8, 0.9, -PI / 2);
  // tangga & jalur pejalan kaki di timur (visual)
  for (let i = 0; i < 14; i++) dec.box(B.x1 - 14, 0.012, 20 + i * 1.4, 0.2, 0.024, 0.9, rgb(0x2fa84f));

  /* ---------- area receiving & outbound (decal besar) ---------- */
  floorDecal('recv', 62, -3.2, 9, 4.5, 0); floorDecal('outb', 62, w.rackBox.z1 + 8.5, 9, 4.5, 0);
  floorDecal('forklift', 40, -3.2, 4.5, 2.2, 0); floorDecal('forklift', 90, w.rackBox.z1 + 8.5, 4.5, 2.2, 0);
  sign('recv', 62, 7, B.z0 + 0.4, 5.5, 2.75, 0); sign('outb', 62, 7, B.z1 - 0.4, 5.5, 2.75, PI);
  sign('exit', B.x0 + 0.3, 3.6, 36, 1.8, 0.9, PI / 2 * -1 + PI); sign('exit', B.x1 - 0.3, 3.6, 100, 1.8, 0.9, -PI / 2 + PI);
  // timbangan pallet & mesin wrapping
  dec.box(30, 0.08, -4.5, 1.6, 0.16, 1.6, Cyellow); dec.box(30, 0.5, -3.2, 0.1, 1, 0.1, Cgrey); dec.box(30, 1.05, -3.2, 0.5, 0.35, 0.08, rgb(0x103866)); col(29.1, 30.9, -5.3, -3.6);
  dec.box(100, 1.3, w.rackBox.z1 + 14, 0.3, 2.6, 0.3, Cgrey); decCyl.add(100, 0.1, w.rackBox.z1 + 14, 1.9, 0.2, 1.9, 0, 0, 0.35, 0.37, 0.4, 0); col(98.8, 101.2, w.rackBox.z1 + 12.8, w.rackBox.z1 + 15.2);

  /* ---------- landmark untuk petunjuk ---------- */
  w.landmarks = [
    { name: 'Kantor Opname', x: -13, z: w.crossZ },
    { name: 'Lorong silang A/B', x: 20, z: w.crossZ },
    { name: 'Area Receiving (utara)', x: 62, z: -3.2 },
    { name: 'Dock Outbound (selatan)', x: 62, z: w.rackBox.z1 + 8.5 },
    { name: 'Charging Forklift (timur)', x: chx, z: chz0 + 7 },
    { name: 'Zona QC (timur)', x: qx0 + 5, z: 20 },
    { name: 'Titik Kumpul (barat)', x: B.x0 + 8, z: 70 },
    { name: 'Loker & Pantry (barat)', x: B.x0 + 4, z: 10 },
  ];
  w.spawn = { x: ox1 + 2.0, z: w.crossZ, yaw: PI / 2 };

  /* ---------- finalisasi batch statis ---------- */
  dec.finalize(); decCyl.finalize(); glass.finalize(); decal.finalize(); S.finalize(); signs.finalize();

  /* =============== objek dinamis =============== */
  const dynBox = e.batch(w.gBox, { dynamic: true, cull: false, cap: 1400, name: 'dinamis' });
  const glow = e.batch(w.gBox, { dynamic: true, cull: false, transparent: true, alpha: 0.3, cap: 64, name: 'cahaya-catatan' });
  const markB = e.batch(w.gBox, { dynamic: true, cull: false, transparent: true, alpha: 0.3, cap: 64, name: 'tanda-ditemukan' });
  const hoverB = e.batch(w.gBox, { dynamic: true, cull: false, transparent: true, alpha: 0.3, cap: 4, name: 'sorot-scanner' });
  const part = (b, px, py, pz, yaw, lx, ly, lz, sx, sy, sz, c, emis = 0) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    b.add(px + cs * lx + sn * lz, py + ly, pz - sn * lx + cs * lz, sx, sy, sz, yaw, 0, c[0], c[1], c[2], emis);
  };
  const Y = rgb(0xe4501c), K = rgb(0x25282c), G = rgb(0x4d535a), WOOD = rgb(0xb98a55), CHR = rgb(0x9aa1a8);
  function drawForklift(f, t) {
    const yaw = -f.heading, lift = f.lift;
    const P = (lx, ly, lz, sx, sy, sz, c, em) => part(dynBox, f.x, 0, f.z, yaw, lx, ly, lz, sx, sy, sz, c, em);
    // bodi oranye-merah (gaya forklift listrik 3 roda), kap belakang hitam
    P(0, 0.62, 0.1, 1.1, 0.6, 1.5, Y); P(0, 0.98, 0.1, 1.04, 0.1, 1.46, K);                       // sasis + tutup atas
    P(0, 0.85, 0.98, 1.12, 0.95, 0.52, Y); P(0, 1.36, 0.98, 1.1, 0.12, 0.5, K);                  // counterweight + kap
    P(0, 0.52, -0.86, 1.04, 0.5, 0.26, Y); P(0, 0.3, 0.1, 1.06, 0.16, 1.5, K);                    // kaki depan & rok
    P(0, 1.1, 0.35, 0.46, 0.1, 0.5, K); P(0, 1.46, 0.6, 0.46, 0.62, 0.1, K);                       // jok + sandaran
    P(0, 1.28, -0.28, 0.06, 0.5, 0.06, K); P(0, 1.55, -0.34, 0.34, 0.04, 0.34, K);                  // kolom & roda kemudi
    for (const sx of [-1, 1]) { P(sx * 0.52, 1.62, -0.45, 0.06, 1.28, 0.06, K); P(sx * 0.52, 1.62, 0.78, 0.06, 1.28, 0.06, K); }  // tiang pelindung kepala
    P(0, 2.27, 0.17, 1.14, 0.05, 1.3, K); for (const z of [-0.2, 0.17, 0.54]) P(0, 2.3, z, 1.1, 0.03, 0.05, K);
    for (const sx of [-1, 1]) { P(sx * 0.3, 1.25, -1.08, 0.09, 2.4, 0.12, K); P(sx * 0.3, 1.25 + lift * 0.5, -1.12, 0.05, 2.0, 0.05, CHR); }  // tiang mast + rantai
    P(0, 2.4, -1.08, 0.7, 0.1, 0.12, K); P(0, 1.1, -1.08, 0.7, 0.07, 0.12, K); P(0, 0.58 + lift, -1.16, 0.92, 0.5, 0.07, G);
    for (const sx of [-1, 1]) { P(sx * 0.3, 0.17 + lift, -1.9, 0.12, 0.05, 1.5, G); P(sx * 0.62, 0.32, -0.55, 0.22, 0.64, 0.64, K); P(sx * 0.55, 0.28, 0.85, 0.2, 0.56, 0.56, K); P(sx * 0.62, 0.32, -0.55, 0.24, 0.3, 0.3, G); }
    P(0, 2.4, 0.6, 0.16, 0.12, 0.16, [1, 0.5, 0.05], Math.sin(t * 8 + f.id) > 0 ? 1 : 0.25);       // lampu kuning berkedip
    P(-0.3, 0.7, 0.9, 0.16, 0.1, 0.04, [1, 0.2, 0.15], 0.8); P(0.3, 0.7, 0.9, 0.16, 0.1, 0.04, [1, 0.2, 0.15], 0.8);  // lampu belakang
    if (f.carry) { P(0, 0.25 + lift, -1.9, 1.0, 0.12, 1.0, WOOD); P(0, 0.88 + lift, -1.9, 0.92, 1.1, 0.92, f.carry); }
  }
  const worker = (n, x, z, yaw, vest, helmet, skin) => ({ n, x, z, yaw, vest, helmet, skin, base: yaw });
  const npcs = [
    { id: 'hendra', name: 'Pak Hendra', role: 'Supervisor Gudang', x: ox0 + 2.6, z: w.crossZ + 0.4, yaw: PI / 2, vest: rgb(0xff8a00), helmet: rgb(0xffffff), skin: rgb(0xd9a577), turn: true },
    { id: 'sari', name: 'Sari', role: 'Admin Inventory', x: -24.2, z: oz0 + 3.0, yaw: PI, vest: rgb(0x3b6ea5), helmet: null, skin: rgb(0xe0b48a), turn: false },
    { id: 'rudi', name: 'Rudi', role: 'Operator Forklift', x: chx - 1.5, z: chz0 - 2.0, yaw: -PI / 2, vest: rgb(0xd7e600), helmet: rgb(0xffcc00), skin: rgb(0xc99468), turn: true },
    { id: 'wawan', name: 'Pak Wawan', role: 'Checker Receiving', x: 50, z: -6.3, yaw: 0, vest: rgb(0xff8a00), helmet: rgb(0xf2c200), skin: rgb(0xd2a074), turn: true },
  ];
  for (const n of npcs) circles.push({ x: n.x, z: n.z, r: 0.42, npc: n.id });
  function drawNpc(n, t) {
    const bob = Math.sin(t * 1.6 + n.x) * 0.012, yaw = -n.yaw;
    const P = (lx, ly, lz, sx, sy, sz, c, em) => part(dynBox, n.x, bob, n.z, yaw, lx, ly, lz, sx, sy, sz, c, em);
    P(-0.13, 0.4, 0, 0.2, 0.8, 0.26, K); P(0.13, 0.4, 0, 0.2, 0.8, 0.26, K);
    P(0, 1.1, 0, 0.5, 0.6, 0.28, n.vest); P(0, 1.0, 0, 0.52, 0.06, 0.3, [0.95, 0.95, 0.85], 0.4);
    P(-0.34, 1.08, 0, 0.12, 0.56, 0.16, n.vest); P(0.34, 1.08, 0, 0.12, 0.56, 0.16, n.vest);
    P(0, 1.55, 0, 0.24, 0.26, 0.24, n.skin);
    if (n.helmet) { P(0, 1.73, 0, 0.3, 0.12, 0.3, n.helmet); P(0, 1.67, -0.16, 0.3, 0.03, 0.12, n.helmet); } else P(0, 1.72, 0, 0.26, 0.1, 0.26, K);
  }
  const pathF = (pts, speed, loop, carry, id) => ({ id, pts, speed, loop, carry, x: pts[0][0], z: pts[0][1], heading: 0, seg: 0, dir: 1, lift: 0.1, wait: 0 });
  const forklifts = [
    pathF([[8, -13.5], [118, -13.5], [118, -5.2], [8, -5.2]], 2.6, true, rgb(0xc9a06a), 1),
    pathF([[12, w.rackBox.z1 + 8.2], [120, w.rackBox.z1 + 8.2], [120, w.rackBox.z1 + 24.5], [12, w.rackBox.z1 + 24.5]], 2.4, true, rgb(0xbdd7ee), 2),
    pathF([[-10.5, w.crossZ], [34, w.crossZ]], 2.3, false, null, 3),
    pathF([[ex + 0.5, 28], [ex + 0.5, 74]], 2.0, false, rgb(0xe8c19a), 4),
  ];
  // parkir forklift di charging
  const parked = [0, 1, 2, 3].map((i) => ({ id: 20 + i, x: chx + 1.8, z: chz0 + i * 3.4 + 0.2, heading: PI / 2, lift: 0.1, carry: null }));
  forklifts[2].x = 4; forklifts[2].seg = 0;
  const circlesDyn = [];

  function stepForklift(f, dt) {
    const pts = f.pts, n = pts.length;
    if (f.wait > 0) { f.wait -= dt; return; }
    let a = pts[f.seg], bIdx = f.loop ? (f.seg + 1) % n : f.seg + f.dir;
    if (!f.loop && (bIdx < 0 || bIdx >= n)) { f.dir *= -1; f.seg += f.dir; bIdx = f.seg + f.dir; f.wait = 1.2; return; }
    const b = pts[bIdx], dx = b[0] - f.x, dz = b[1] - f.z, d = Math.hypot(dx, dz);
    const target = Math.atan2(dx, -dz);
    let dh = target - f.heading; while (dh > PI) dh -= 2 * PI; while (dh < -PI) dh += 2 * PI;
    f.heading += Math.max(-dt * 2.2, Math.min(dt * 2.2, dh));
    const move = Math.abs(dh) < 0.5 ? f.speed * dt : f.speed * dt * 0.25;
    if (d <= move + 0.05) { f.x = b[0]; f.z = b[1]; f.seg = bIdx; if (!f.loop && (f.seg === 0 || f.seg === n - 1)) { f.dir = f.seg === 0 ? 1 : -1; f.wait = 1.5; } }
    else { f.x += (dx / d) * move; f.z += (dz / d) * move; }
  }

  const notes = []; let marks = []; let hover = null;
  const Ysoft = [1, 0.93, 0.35];
  function update(dt, t, player) {
    dynBox.clear(); glow.clear(); markB.clear(); hoverB.clear(); circlesDyn.length = 0;
    let nearest = 1e9;
    for (const f of forklifts) {
      stepForklift(f, dt); f.lift = 0.1 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.7 + f.id)); drawForklift(f, t);
      circlesDyn.push({ x: f.x + Math.sin(f.heading) * -0.3, z: f.z + Math.cos(f.heading) * 0.3 + 0, r: 1.35, fork: true });
      if (player) nearest = Math.min(nearest, Math.hypot(f.x - player.x, f.z - player.z));
    }
    for (const p of parked) { p.lift = 0.1; drawForklift(p, t); }
    for (const n of npcs) {
      if (n.turn && player) {
        const dx = player.x - n.x, dz = player.z - n.z;
        if (Math.hypot(dx, dz) < 9) { const target = Math.atan2(dx, -dz); let dh = target - n.yaw; while (dh > PI) dh -= 2 * PI; while (dh < -PI) dh += 2 * PI; n.yaw += dh * Math.min(1, dt * 4); }
      }
      drawNpc(n, t);
    }
    for (const n of notes) {
      if (n.taken) continue;
      const by = n.y + 0.12 * Math.sin(t * 2.4 + n.id);
      dynBox.add(n.x, by, n.z, 0.3, 0.3, 0.03, t * 1.4 + n.id, 0, Ysoft[0], Ysoft[1], Ysoft[2], 1);
      dynBox.add(n.x, by, n.z, 0.12, 0.12, 0.05, t * 1.4 + n.id, 0, 0.8, 0.45, 0.0, 1);
      glow.add(n.x, n.y + 1.6, n.z, 0.07, 3.4, 0.07, 0, 0, 1, 0.9, 0.2, 1);
    }
    markB.alpha = 0.22 + 0.1 * Math.sin(t * 4);
    for (const s of marks) markB.add(s.x, s.y0 + (C.PAL + s.h) / 2, s.z, 1.08, C.PAL + s.h + 0.08, 1.08, 0, 0, 0.2, 1, 0.45, 1);
    if (hover) { hoverB.alpha = 0.28 + 0.1 * Math.sin(t * 8); hoverB.add(hover.x, hover.y0 + (C.PAL + hover.h) / 2, hover.z, 1.06, C.PAL + hover.h + 0.06, 1.06, 0, 0, 0.3, 0.9, 1, 1); }
    for (const b of [dynBox, glow, markB, hoverB]) { b.visible = b.n > 0; b.upload(); }
    return { nearestForklift: nearest };
  }
  return {
    update, setBoard, setGlow, forklifts, parked, npcs, notes, circles, circlesDyn,
    addNote(id, x, y, z) { notes.push({ id, x, y, z, taken: false }); },
    removeNote(id) { const n = notes.find((q) => q.id === id); if (n) n.taken = true; },
    clearNotes() { notes.length = 0; },
    setHover(s) { hover = s; },
    markFound(s) { if (!marks.includes(s)) marks.push(s); },
    clearMarks() { marks = []; },
  };
}
