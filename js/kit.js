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
  noiseFill(g, 512, 512, '#6d7076', 90, 9000);
  const gr = g.createRadialGradient(256, 256, 40, 256, 256, 360); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.10)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(20,22,26,.55)'; g.lineWidth = 3; g.strokeRect(1, 1, 510, 510);
  g.strokeStyle = 'rgba(20,22,26,.18)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(rnd() * 512, rnd() * 512); for (let k = 0; k < 4; k++) g.lineTo(rnd() * 512, rnd() * 512); g.stroke(); }
  return c;
}
export function wallCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let x = 0; x < 256; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, '#b9c0c8'); gr.addColorStop(0.5, '#e4e8ec'); gr.addColorStop(1, '#a5adb6');
    g.fillStyle = gr; g.fillRect(x, 0, 16, 256);
  }
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(60,70,80,${rnd() * 0.07})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 8 + rnd() * 26); }
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
      g.fillStyle = r.nw ? '#5d6670' : '#14407a'; roundRect(g, 4, 4, w - 8, h - 8, 14); g.fill();
      g.strokeStyle = r.nw ? '#c9d0d6' : '#ffd23f'; g.lineWidth = 6; roundRect(g, 8, 8, w - 16, h - 16, 11); g.stroke();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 66px ${FONT}`; g.fillText(r.code, w / 2, 70);
      g.font = `600 24px ${FONT}`; g.fillStyle = r.nw ? '#e2e6ea' : '#ffd23f';
      g.fillText(r.nw ? 'RACKING BARU' : r.sub, w / 2, 104);
    });
  }
  for (let n = 1; n <= 26; n++) {
    A.add('b:' + n, (g, w, h) => {
      g.fillStyle = '#103866'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 78px ${FONT}`; g.fillText(String(n).padStart(2, '0'), w / 2 + 28, 88);
      g.font = `700 34px ${FONT}`; g.fillStyle = '#ffd23f'; g.textAlign = 'left'; g.fillText('BAY', 18, 82);
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
