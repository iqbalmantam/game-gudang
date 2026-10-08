/* map.js — peta 2D (mini & layar penuh) yang digambar dari data rak yang sama dengan dunia 3D */
import { RACKS, CUST } from './data.js';
import { C } from './world.js';

const K = 6; // piksel per meter pada lapisan statis
const GRP = { A: '#3d7fd6', B: '#2fae9a', C: '#e0a526', D: '#a56bd6', S: '#7b838c' };

export class MapView {
  constructor(world) {
    this.w = world; const B = world.bounds; this.B = B;
    this.W = Math.ceil((B.x1 - B.x0) * K); this.H = Math.ceil((B.z1 - B.z0) * K);
    this.layer = document.createElement('canvas'); this.layer.width = this.W; this.layer.height = this.H;
    this._paint(this.layer.getContext('2d'));
  }
  px(x) { return (x - this.B.x0) * K; }
  pz(z) { return (z - this.B.z0) * K; }

  _paint(g) {
    const w = this.w, B = this.B, rb = w.rackBox;
    g.fillStyle = '#0c1522'; g.fillRect(0, 0, this.W, this.H);
    // lantai gudang
    g.fillStyle = '#18283d'; g.fillRect(this.px(B.x0), this.pz(B.z0), (B.x1 - B.x0) * K, (B.z1 - B.z0) * K);
    g.strokeStyle = '#5a7597'; g.lineWidth = 3; g.strokeRect(this.px(B.x0), this.pz(B.z0), (B.x1 - B.x0) * K, (B.z1 - B.z0) * K);
    // kantor opname
    const oz0 = w.crossZ - 9.4, oz1 = w.crossZ + 9.4;
    g.fillStyle = '#243a57'; g.fillRect(this.px(-28), this.pz(oz0), 14 * K, (oz1 - oz0) * K);
    g.strokeStyle = '#7c97b8'; g.lineWidth = 2; g.strokeRect(this.px(-28), this.pz(oz0), 14 * K, (oz1 - oz0) * K);
    // lorong silang
    g.fillStyle = 'rgba(255,210,63,.07)'; g.fillRect(this.px(rb.x0), this.pz(w.crossZ - 1.7), (rb.x1 - rb.x0) * K, 3.4 * K);
    // sel rak, diwarnai per client
    for (const R of RACKS) {
      for (const [row, col, , nw, cl = -1] of R.cells) {
        const x = this.px(w.xc.get(col) - C.DEPTH / 2), z = this.pz(w.zOf(row) - C.CELL / 2);
        g.fillStyle = nw ? '#59626c' : cl >= 0 ? CUST[cl].color : '#8c949c';
        g.globalAlpha = nw ? 0.55 : 0.92;
        g.fillRect(x, z, C.DEPTH * K + 0.6, C.CELL * K + 0.6);
      }
    }
    g.globalAlpha = 1;
    // garis tepi rak per blok
    g.lineWidth = 1.4;
    for (const r of w.rackRects) {
      g.strokeStyle = GRP[r.grp] || '#999';
      g.strokeRect(this.px(r.x0), this.pz(r.z0), (r.x1 - r.x0) * K, (r.z1 - r.z0) * K);
    }
    // kode rak: selang-seling di ujung utara / selatan agar tidak bertumpuk
    g.font = '700 11px "Segoe UI",Arial,sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
    w.racks.forEach((rk, i) => {
      const north = i % 2 === 0, x = this.px(rk.x), z = north ? this.pz(w.zOf(rk.r0) - C.CELL / 2) - 5 : this.pz(w.zOf(rk.r1) + C.CELL / 2) + 13;
      g.lineWidth = 3; g.strokeStyle = '#0c1522'; g.strokeText(rk.code, x, z);
      g.fillStyle = rk.nw ? '#aab3bc' : '#fff'; g.fillText(rk.code, x, z);
    });
    // landmark
    g.font = '600 12px "Segoe UI",Arial,sans-serif';
    for (const l of w.landmarks) {
      const x = this.px(l.x), z = this.pz(l.z);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, z, 4, 0, 7); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#0c1522'; g.strokeText(l.name, x, z - 8); g.fillStyle = '#ffe58a'; g.fillText(l.name, x, z - 8);
    }
    // pintu dock
    g.fillStyle = '#7fa3cc';
    for (let i = 0; i < 11; i++) g.fillRect(this.px(8 + i * 11.6) - 9, this.pz(B.z1) - 3, 18, 6);
    for (let i = 0; i < 7; i++) g.fillRect(this.px(16 + i * 17.5) - 9, this.pz(B.z0) - 3, 18, 6);
    g.fillStyle = '#9fb7d3'; g.font = '700 11px "Segoe UI",Arial,sans-serif';
    g.fillText('RECEIVING (UTARA)', this.px((B.x0 + B.x1) / 2), this.pz(B.z0) + 18);
    g.fillText('OUTBOUND (SELATAN)', this.px((B.x0 + B.x1) / 2), this.pz(B.z1) - 10);
  }

  /* gambar objek dinamis di atas lapisan statis; s = piksel layar per piksel lapisan */
  _dyn(g, ox, oz, s, st) {
    const m = K * s;                                   // piksel layar per meter
    const X = (x) => ox + this.px(x) * s, Z = (z) => oz + this.pz(z) * s;
    g.font = '700 10px "Segoe UI",Arial,sans-serif'; g.textAlign = 'center';
    for (const n of st.npcs) { g.fillStyle = '#5ec8ff'; g.beginPath(); g.arc(X(n.x), Z(n.z), Math.max(3, 0.6 * m), 0, 7); g.fill(); }
    for (const f of st.forklifts) { g.fillStyle = '#ff8a1f'; const q = Math.max(4, 1.4 * m); g.fillRect(X(f.x) - q / 2, Z(f.z) - q / 2, q, q); }
    if (st.showNotes) for (const n of st.notes) {
      if (n.taken) continue; const r = Math.max(3.5, 0.7 * m);
      g.fillStyle = '#fff08a'; g.strokeStyle = '#7a5d00'; g.lineWidth = 1.5; g.beginPath(); g.rect(X(n.x) - r, Z(n.z) - r, r * 2, r * 2); g.fill(); g.stroke();
    }
    for (const c of st.cases) {
      const r = Math.max(6, 1.1 * m);
      if (c.done) {
        g.fillStyle = '#2fd27a'; g.beginPath(); g.arc(X(c.target.x), Z(c.target.z), r, 0, 7); g.fill();
        g.fillStyle = '#04210f'; g.fillText('✔', X(c.target.x), Z(c.target.z) + 3.5); continue;
      }
      const x = X(c.sys.x), z = Z(c.sys.z);
      g.fillStyle = c.id === st.sel ? '#ff4d4d' : 'rgba(255,77,77,.75)'; g.beginPath(); g.arc(x, z, r, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#fff'; g.fillText(String(c.id), x, z + 3.5);
    }
    if (st.ping) {
      const p = st.ping, k = (p.life % 1.2) / 1.2;
      g.strokeStyle = `rgba(94,200,255,${0.9 - k * 0.7})`; g.lineWidth = 2;
      g.beginPath(); g.arc(X(p.x), Z(p.z), p.r * m * (0.35 + k * 0.65), 0, 7); g.stroke();
      g.strokeStyle = 'rgba(94,200,255,.6)'; g.setLineDash([5, 4]); g.beginPath(); g.arc(X(p.x), Z(p.z), p.r * m, 0, 7); g.stroke(); g.setLineDash([]);
    }
    const px = X(st.px), pz = Z(st.pz), len = Math.max(9, 1.9 * m);
    g.fillStyle = 'rgba(255,210,63,.22)'; g.beginPath(); g.moveTo(px, pz);
    g.arc(px, pz, len * 2.2, st.yaw - Math.PI / 2 - 0.55, st.yaw - Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.save(); g.translate(px, pz); g.rotate(st.yaw);
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#111'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(0, -len * 0.7); g.lineTo(len * 0.5, len * 0.55); g.lineTo(0, len * 0.25); g.lineTo(-len * 0.5, len * 0.55); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  /* minimap: jendela 76 m di sekitar pemain */
  drawMini(canvas, st) {
    const g = canvas.getContext('2d'), cw = canvas.width, ch = canvas.height, span = 76;
    g.clearRect(0, 0, cw, ch);
    const sw = span * K, sh = (ch / cw) * span * K;
    let sx = this.px(st.px) - sw / 2, sy = this.pz(st.pz) - sh / 2;
    g.fillStyle = '#0c1522'; g.fillRect(0, 0, cw, ch);
    g.drawImage(this.layer, sx, sy, sw, sh, 0, 0, cw, ch);
    this._dyn(g, -sx * (cw / sw), -sy * (cw / sw), cw / sw, st);
  }
  /* peta penuh */
  drawFull(canvas, st) {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(this.layer, 0, 0, canvas.width, canvas.height);
    this._dyn(g, 0, 0, canvas.width / this.W, st);
  }
}
