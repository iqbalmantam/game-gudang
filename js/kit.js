/* kit.js — alat bantu: pengelompok instance (chunk), tekstur prosedural, atlas papan nama */
import { Atlas } from './gl.js';

export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const rgb = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/* Mengelompokkan instance ke sel-sel ruang agar culling frustum bekerja */
export class Chunker {
  constructor(eng, geo, opt = {}) { this.eng = eng; this.geo = geo; this.opt = opt; this.size = opt.size || 28; this.map = new Map(); this.count = 0; }
  add(px, py, pz, sx = 1, sy = 1, sz = 1, yaw = 0, rz = 0, r = 1, g = 1, b = 1, emis = 0, u0 = 0, v0 = 0, du = 1, dv = 1) {
    const key = Math.floor(px / this.size) + '|' + Math.floor(pz / this.size);
    let bt = this.map.get(key);
    if (!bt) { bt = this.eng.batch(this.geo, { ...this.opt, cap: 128 }); this.map.set(key, bt); }
    bt.add(px, py, pz, sx, sy, sz, yaw, rz, r, g, b, emis, u0, v0, du, dv);
    this.count++;
  }
  /* kotak berwarna: c = [r,g,b] */
  box(px, py, pz, sx, sy, sz, c, emis = 0, yaw = 0, rz = 0) { this.add(px, py, pz, sx, sy, sz, yaw, rz, c[0], c[1], c[2], emis); }
  finalize() { for (const b of this.map.values()) b.finalize(); return this; }
}

const rnd = Math.random;
function noiseFill(g, w, h, base, amp, n) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(128 + (rnd() - 0.5) * amp);
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.12})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 1 + rnd() * 5);
  }
}
export function concreteCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  noiseFill(g, 512, 512, '#8d8b84', 70, 14000);
  // noda besar tak merata (oli, bekas ban, air)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 90, d = rnd() < 0.7;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, d ? 'rgba(40,38,34,.18)' : 'rgba(210,200,175,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // goresan bekas roda & dasar kotor
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(35,32,28,${0.05 + rnd() * 0.1})`; g.fillRect(rnd() * 512, rnd() * 512, 20 + rnd() * 120, 1 + rnd() * 3); }
  // sambungan kontrol & retak rambut
  g.strokeStyle = 'rgba(25,24,22,.55)'; g.lineWidth = 2.5; g.strokeRect(1, 1, 510, 510);
  g.strokeStyle = 'rgba(25,24,22,.28)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) { g.beginPath(); let x = rnd() * 512, y = rnd() * 512; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 90; g.lineTo(x, y); } g.stroke(); }
  return c;
}
export function wallCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let x = 0; x < 256; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, '#2c3a4a'); gr.addColorStop(0.5, '#4a5b6e'); gr.addColorStop(1, '#2a3644');
    g.fillStyle = gr; g.fillRect(x, 0, 16, 256);
  }
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(10,14,20,${rnd() * 0.12})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 8 + rnd() * 26); }
  return c;
}
export function slatCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let y = 0; y < 128; y += 8) {
    const gr = g.createLinearGradient(0, y, 0, y + 8); gr.addColorStop(0, '#d9dde1'); gr.addColorStop(0.7, '#aeb5bc'); gr.addColorStop(1, '#7c848c');
    g.fillStyle = gr; g.fillRect(0, y, 128, 8);
  }
  return c;
}
export function asphaltCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  noiseFill(g, 256, 256, '#2b2d31', 70, 5000); return c;
}
export function tileCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#d7d9d6'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.04})`; g.fillRect(rnd() * 128, rnd() * 128, 3, 3); }
  return c;
}

/* ---------- atlas papan nama ---------- */
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
export function buildAtlas(rackInfo) {
  const A = new Atlas(2048, 256, 128);
  A.add('bar', (g, w, h) => {
    g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111'; let x = 22;
    while (x < w - 22) { const bw = 2 + Math.floor(Math.random() * 6); g.fillRect(x, 18, bw, h - 52); x += bw + 2 + Math.floor(Math.random() * 5); }
    g.font = `bold 22px ${FONT}`; g.textAlign = 'center'; g.fillText('8 99 1234 5678', w / 2, h - 12);
  });
  A.add('white', (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  for (const r of rackInfo) {
    A.add('r:' + r.code, (g, w, h) => {
      g.fillStyle = r.nw ? '#c9d0d6' : '#f4f6f7'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8c949b'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = r.nw ? '#5b6770' : '#1f86d8'; g.textAlign = 'center'; g.font = `600 78px ${FONT}`; g.fillText(r.code.replace(/^([A-Z])/, '$1 '), w / 2, 84);
      g.font = `600 20px ${FONT}`; g.fillStyle = '#58626b'; g.fillText(r.nw ? 'RACKING BARU' : r.sub, w / 2, 112);
    });
  }
  for (let n = 1; n <= 26; n++) {
    A.add('b:' + n, (g, w, h) => {
      g.fillStyle = '#eef1f3'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1f86d8'; g.fillRect(0, h - 10, w, 10);
      g.fillStyle = '#1f86d8'; g.textAlign = 'center'; g.font = `700 78px ${FONT}`; g.fillText(String(n).padStart(2, '0'), w / 2 + 28, 84);
      g.font = `700 32px ${FONT}`; g.fillStyle = '#58626b'; g.textAlign = 'left'; g.fillText('BAY', 18, 80);
    });
  }
  const sign = (name, bg, fg, t1, t2, border) => A.add(name, (g, w, h) => {
    g.fillStyle = bg; roundRect(g, 3, 3, w - 6, h - 6, 12); g.fill();
    if (border) { g.strokeStyle = border; g.lineWidth = 6; roundRect(g, 9, 9, w - 18, h - 18, 8); g.stroke(); }
    g.fillStyle = fg; g.textAlign = 'center';
    if (t2) { g.font = `800 38px ${FONT}`; g.fillText(t1, w / 2, 56); g.font = `600 24px ${FONT}`; g.fillText(t2, w / 2, 94); }
    else { g.font = `800 44px ${FONT}`; g.fillText(t1, w / 2, 76); }
  });
  sign('apar', '#c1121f', '#fff', 'APAR', 'Alat Pemadam', '#fff');
  sign('exit', '#127a3a', '#fff', 'EXIT', 'Pintu Darurat', '#fff');
  sign('assembly', '#127a3a', '#fff', 'TITIK KUMPUL', 'Assembly Point', '#fff');
  sign('forklift', '#ffcc00', '#111', 'AWAS FORKLIFT', 'Kecepatan 5 km/jam', '#111');
  sign('hardhat', '#1b5fa8', '#fff', 'WAJIB HELM', 'Area Gudang', '#fff');
  sign('office', '#222a33', '#ffd23f', 'KANTOR OPNAME', 'Stock Opname · JDC', '#ffd23f');
  sign('qc', '#8a1c1c', '#fff', 'ZONA QC', 'Karantina · Hold', '#fff');
  sign('charge', '#0e6e8c', '#fff', 'CHARGING', 'Forklift Elektrik', '#fff');
  sign('recv', '#222a33', '#ffd23f', 'RECEIVING', 'Barang Masuk', '#ffd23f');
  sign('outb', '#222a33', '#ffd23f', 'OUTBOUND', 'Staging Kirim', '#ffd23f');
  sign('toilet', '#355', '#fff', 'TOILET', 'WC · Pantry', '#fff');
  sign('note', '#fff08a', '#5c4a00', '!', null, '#e0c000');
  for (let i = 1; i <= 14; i++) sign('dock' + i, '#222a33', '#ffd23f', 'DOCK ' + String(i).padStart(2, '0'), null, '#ffd23f');
  A.add('hazard', (g, w, h) => {
    g.fillStyle = '#ffcc00'; g.fillRect(0, 0, w, h); g.fillStyle = '#111';
    for (let x = -h; x < w + h; x += 40) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 20 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
  return A;
}

/* ---------- lightmap lantai ----------
   R = oklusi kontak di kaki rak (1 = terang), G = kolam cahaya lampu high-bay, B = titik lampu (untuk pantulan di lantai). */
export function lightmapCanvas(w, lampPos, C) {
  const Bd = w.bounds, W = Bd.x1 - Bd.x0, D = Bd.z1 - Bd.z0;
  const ppm = Math.min(6, 4096 / Math.max(W, D)), cw = Math.ceil(W * ppm), ch = Math.ceil(D * ppm);
  const mk = (fill) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, cw, ch); return [c, g]; };
  const X = (x) => (x - Bd.x0) * ppm, Z = (z) => (z - Bd.z0) * ppm;
  // --- AO ---
  const [ao, ga] = mk('#fff');
  ga.fillStyle = '#000';
  for (const [col, rows] of w.colCells) {
    const x = w.xc.get(col); if (x === undefined) continue;
    const rs = [...rows.keys()].sort((a, b) => a - b);
    let i = 0;
    while (i < rs.length) {
      let j = i; while (j + 1 < rs.length && rs[j + 1] - rs[j] <= 1) j++;
      const z0 = w.zOf(rs[i]) - C.CELL / 2, z1 = w.zOf(rs[j]) + C.CELL / 2;
      for (let k = 5; k >= 0; k--) {
        const e = k * 0.28; ga.globalAlpha = k === 0 ? 0.55 : 0.13;
        ga.fillRect(X(x - C.DEPTH / 2 - e), Z(z0 - e), (C.DEPTH + e * 2) * ppm, (z1 - z0 + e * 2) * ppm);
      }
      i = j + 1;
    }
  }
  ga.globalAlpha = 1;
  // --- kolam cahaya + titik lampu ---
  const [pool, gp] = mk('#000'), [lamp, gl_] = mk('#000');
  gp.globalCompositeOperation = 'lighter'; gl_.globalCompositeOperation = 'lighter';
  for (const [x, z] of lampPos) {
    let r = 7 * ppm, g = gp.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.5, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    gp.fillStyle = g; gp.fillRect(X(x) - r, Z(z) - r, r * 2, r * 2);
    r = 0.9 * ppm; g = gl_.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    gl_.fillStyle = g; gl_.fillRect(X(x) - r, Z(z) - r, r * 2, r * 2);
  }
  const out = document.createElement('canvas'); out.width = cw; out.height = ch;
  const go = out.getContext('2d'), od = go.createImageData(cw, ch);
  const A = ga.getImageData(0, 0, cw, ch).data, P = gp.getImageData(0, 0, cw, ch).data, Lp = gl_.getImageData(0, 0, cw, ch).data;
  for (let i = 0; i < od.data.length; i += 4) { od.data[i] = A[i]; od.data[i + 1] = P[i]; od.data[i + 2] = Lp[i]; od.data[i + 3] = 255; }
  go.putImageData(od, 0, 0);
  return { canvas: out, bounds: [Bd.x0, Bd.z0, W, D] };
}

/* halo lampu: gradien radial lembut */
export function glowCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,248,225,0.95)'); gr.addColorStop(0.12, 'rgba(255,240,205,0.55)');
  gr.addColorStop(0.4, 'rgba(255,230,180,0.14)'); gr.addColorStop(1, 'rgba(255,225,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
