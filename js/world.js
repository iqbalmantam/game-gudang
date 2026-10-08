/* world.js — dunia gudang JDC: rak, slot pallet, isi barang, pencarian (pick) */
import { MeshBuilder, hex } from './gl.js';
import { RACKS, CUST } from './data.js';
import { KIND, KIND_H, defFor, makeItem, itemOf, kindFor, newLot, mulberry32, rint } from './items.js';
import { Chunker, mix, mul, rgb, buildAtlas, concreteCanvas } from './kit.js';
import { buildEnvironment } from './env.js';

export const C = { CELL: 1.1, DEPTH: 1.1, GAP: 0.08, AISLE: 3.0, LVH: 1.8, PAL: 0.14, H: 21, BAY: 3, BEAM_Y: 0.16, EYE: 1.65 };
const key = (col, row, lvl) => ((col * 1000) + row) * 16 + lvl;
export const BLOCKS = {
  A: 'Blok A · barat-laut', B: 'Blok B · barat-daya', C: 'Blok C · tengah', D: 'Blok D · timur', S: 'Rak Sample · tepi timur',
};

export class World {
  constructor(eng) {
    this.eng = eng;
    this._layout();
    this._geos();
    this._slots();
    this._atlas();
    this._rackStructure();
    this.pal = new Map();
    this.decorPallets = [];
    this.env = buildEnvironment(this);
    this.generateItems(1);
    this.rebuildInstances();
  }

  /* ---------- tata letak ---------- */
  _layout() {
    const cols = [...new Set(RACKS.flatMap((r) => r.cells.map((c) => c[1])))].sort((a, b) => a - b);
    this.cols = cols; this.xc = new Map();
    let x = 0;
    cols.forEach((c, i) => { if (i > 0) x += (c - cols[i - 1] === 1) ? C.DEPTH + C.GAP : C.DEPTH + C.AISLE; this.xc.set(c, x); });
    this.colX = cols.map((c) => this.xc.get(c));
    this.rmin = Math.min(...RACKS.flatMap((r) => r.cells.map((c) => c[0])));
    this.rmax = Math.max(...RACKS.flatMap((r) => r.cells.map((c) => c[0])));
    this.zOf = (r) => (r - this.rmin) * C.CELL;
    const xMax = this.colX[this.colX.length - 1], zMax = this.zOf(this.rmax);
    this.rackBox = { x0: -C.DEPTH / 2, x1: xMax + C.DEPTH / 2, z0: -C.CELL / 2, z1: zMax + C.CELL / 2 };
    this.bounds = { x0: -30, x1: xMax + 20, z0: -22, z1: zMax + 34 };
    this.crossZ = (this.zOf(48) + this.zOf(50)) / 2; // lorong silang antara blok A dan B
  }

  _geos() {
    const e = this.eng, B = (f) => { const m = new MeshBuilder(); f(m); return e.geo(m); };
    this.gBox = B((m) => m.box(0, 0, 0, 1, 1, 1));
    this.gCyl = B((m) => m.cyl(0, 0, 0, 0.5, 1, 10));
    this.gQuad = B((m) => m.quad());
    this.gFloorQuad = B((m) => m.floorQuad());
    const W = [1, 1, 1];
    this.gPalBase = B((m) => { const wood = hex(0xb98a55), dark = hex(0x8a6238); m.box(0, 0.115, 0, 0.98, 0.05, 0.98, wood); m.box(-0.38, 0.045, 0, 0.14, 0.09, 0.98, dark); m.box(0.38, 0.045, 0, 0.14, 0.09, 0.98, dark); });
    this.gKinds = [
      B((m) => { for (const ix of [-1, 1]) for (const iz of [-1, 1]) m.box(ix * 0.235, 0.55, iz * 0.235, 0.44, 1.1, 0.44, W); }),
      B((m) => { for (const ix of [-1, 1]) for (const iz of [-1, 1]) m.cyl(ix * 0.25, 0.46, iz * 0.25, 0.22, 0.92, 7, W); }),
      B((m) => { for (let i = 0; i < 4; i++) m.box((i % 2 ? 0.02 : -0.02), 0.14 + i * 0.28, (i % 2 ? -0.015 : 0.015), 0.96 - 0.04 * (i % 2), 0.28, 0.94 - 0.03 * (i % 2), i % 2 ? [0.92, 0.92, 0.92] : W); }),
      B((m) => { m.box(0, 0.55, 0, 0.92, 1.1, 0.92, W); m.box(0, 1.16, 0, 0.7, 0.12, 0.7, [0.8, 0.8, 0.8]); m.box(0, 0.55, 0, 0.945, 0.07, 0.945, [0.86, 0.88, 0.9]); }),
      B((m) => { for (const ix of [-1, 1]) for (const iz of [-1, 1]) m.cyl(ix * 0.25, 0.425, iz * 0.25, 0.23, 0.85, 6, W); m.box(0, 0.865, 0, 0.98, 0.03, 0.98, [0.88, 0.88, 0.88]); }),
      B((m) => { m.box(-0.23, 0.625, 0, 0.44, 1.25, 0.9, W); m.box(0.23, 0.625, 0, 0.44, 1.25, 0.9, [0.94, 0.94, 0.94]); m.box(0, 0.62, 0, 0.94, 0.06, 0.94, [0.3, 0.3, 0.32]); }),
    ];
  }

  /* ---------- slot pallet ---------- */
  _slots() {
    this.racks = []; this.rackByCode = new Map(); this.slots = []; this.slotMap = new Map(); this.rackAtCell = new Map();
    this.colCells = new Map();
    RACKS.forEach((R, ri) => {
      const rows = R.cells.map((c) => c[0]), cols = [...new Set(R.cells.map((c) => c[1]))].sort((a, b) => a - b);
      const lvs = R.cells.map((c) => c[2]);
      const rack = {
        code: R.code, grp: R.grp, index: ri, r0: Math.min(...rows), r1: Math.max(...rows), cols,
        nw: R.cells.every((c) => c[3]), minLv: Math.min(...lvs), maxLv: Math.max(...lvs),
        x: cols.reduce((a, c) => a + this.xc.get(c), 0) / cols.length,
      };
      rack.sub = rack.minLv === rack.maxLv ? `${rack.minLv} LEVEL` : `${rack.minLv}–${rack.maxLv} LEVEL`;
      this.racks.push(rack); this.rackByCode.set(rack.code, rack);
      for (const [row, col, lv, nw, cl = -1] of R.cells) {
        this.rackAtCell.set(col * 1000 + row, rack);
        if (!this.colCells.has(col)) this.colCells.set(col, new Map());
        this.colCells.get(col).set(row, { lv, nw: !!nw, rack });
        // sisi yang menghadap lorong: rak satu kolom yang berpunggungan dengan kolom lain menghadap sisi yang bebas
        const hasW = this.xc.has(col - 1), hasE = this.xc.has(col + 1);
        const face = cols.length > 1 ? (col === cols[0] ? -1 : 1) : (hasE && !hasW ? -1 : hasW && !hasE ? 1 : (ri % 2 ? 1 : -1));
        for (let l = 1; l <= lv; l++) {
          const s = {
            id: this.slots.length, rack, code: R.code, grp: R.grp, col, row, lvl: l, lv, nw: !!nw, cl,
            x: this.xc.get(col), z: this.zOf(row), y0: (l - 1) * C.LVH + C.BEAM_Y,
            bay: Math.floor((row - rack.r0) / C.BAY) + 1, face, item: null, empty: !!nw, kind: 0, h: 1, tint: [1, 1, 1],
            jx: 0, jz: 0, jyaw: 0, found: false, target: null,
          };
          this.slots.push(s); this.slotMap.set(key(col, row, l), s);
        }
      }
    });
    this.slotsSorted = [...this.slots].sort((a, b) => a.col - b.col || a.lvl - b.lvl || a.row - b.row);
  }

  _atlas() {
    const info = this.racks.map((r) => ({ code: r.code, nw: r.nw, sub: r.sub }));
    this.atlas = buildAtlas(info);
    this.atlasTex = this.eng.texture(this.atlas.canvas, { mip: true });
    this.floorTex = this.eng.texture(concreteCanvas(), { repeat: true });
  }

  /* ---------- struktur rak (tiang, balok, penyilang) ---------- */
  _rackStructure() {
    const e = this.eng, L = C.LVH;
    const blueUp = rgb(0x1f5fb5), orange = rgb(0xee7a1a), grey = rgb(0x8f98a2), greyB = rgb(0xb4bbc2), yellow = rgb(0xf2c200), brace = rgb(0x1a4f98);
    const S = (this.struct = new Chunker(e, this.gBox, { size: 24, name: 'rakstruktur' }));
    const signs = (this.signs = new Chunker(e, this.gQuad, { size: 24, tex: this.atlasTex, name: 'papan' }));
    this.rackRects = [];
    const ubay = (k) => this.atlas.uv('b:' + Math.min(26, k));
    for (const [col, cells] of this.colCells) {
      const x = this.xc.get(col), rows = [...cells.keys()].sort((a, b) => a - b);
      // pecah menjadi run: baris berurutan pada rak yang sama
      const runs = []; let run = null;
      for (const r of rows) {
        const c = cells.get(r);
        if (run && run.end === r - 1 && run.rack === c.rack) { run.end = r; } else { run = { start: r, end: r, rack: c.rack }; runs.push(run); }
      }
      for (const run of runs) {
        const rack = run.rack, n = run.end - run.start + 1;
        const lvAt = (r) => (cells.get(r) || { lv: 0 }).lv;
        const nwAt = (r) => (cells.get(r) || { nw: false }).nw;
        // kotak peta mini
        this.rackRects.push({ x0: x - C.DEPTH / 2, x1: x + C.DEPTH / 2, z0: this.zOf(run.start) - C.CELL / 2, z1: this.zOf(run.end) + C.CELL / 2, grp: rack.grp, nw: rack.nw, code: rack.code, col });
        // balok per segmen (level & status sama)
        let a = run.start;
        while (a <= run.end) {
          let b = a; while (b + 1 <= run.end && lvAt(b + 1) === lvAt(a) && nwAt(b + 1) === nwAt(a)) b++;
          const lv = lvAt(a), nw = nwAt(a), zc = (this.zOf(a) + this.zOf(b)) / 2, len = (b - a + 1) * C.CELL - 0.03;
          for (let l = 1; l <= lv; l++) for (const sx of [-1, 1]) S.box(x + sx * 0.5, (l - 1) * L + 0.08, zc, 0.07, 0.16, len, nw ? greyB : orange);
          a = b + 1;
        }
        // rangka tiang tiap 3 posisi
        const frames = []; for (let k = 0; k < n; k += C.BAY) frames.push(k); frames.push(n);
        for (const k of frames) {
          const z = this.zOf(run.start) - C.CELL / 2 + k * C.CELL;
          const lv = Math.max(lvAt(run.start + k - 1), lvAt(run.start + k)) || lvAt(run.start);
          const nw = nwAt(Math.min(run.end, run.start + Math.min(k, n - 1)));
          const H = lv * L + 0.15, up = nw ? grey : blueUp;
          for (const sx of [-1, 1]) {
            S.box(x + sx * 0.5, H / 2, z, 0.09, H, 0.1, up);
            S.box(x + sx * 0.5, 0.225, z, 0.18, 0.45, 0.18, yellow);
          }
          const dy = L - 0.3, dxw = 1.0, dl = Math.hypot(dxw, dy), ang = Math.atan2(dy, dxw);
          for (let i = 0; i < lv; i++) S.box(x, i * L + 0.2 + dy / 2, z, dl, 0.035, 0.035, nw ? greyB : brace, 0, 0, (i % 2 ? -1 : 1) * ang);
          for (let i = 0; i <= lv; i += 2) S.box(x, i * L + 0.2, z, 1.0, 0.05, 0.05, nw ? greyB : brace);
        }
        // label bay (di balok level 1) — pada sisi menghadap lorong
        const faces = rack.cols.length > 1 ? [col === rack.cols[0] ? -1 : 1] : [-1, 1];
        for (let k = 0; k < n; k += C.BAY) {
          const sRow = run.start + k, eRow = Math.min(run.end, sRow + C.BAY - 1);
          const zc = (this.zOf(sRow) + this.zOf(eRow)) / 2, bay = Math.floor((sRow - rack.r0) / C.BAY) + 1;
          const uv = ubay(bay);
          for (const f of faces) signs.add(x + f * 0.56, 0.085, zc, 0.34, 0.17, 1, f * Math.PI / 2, 0, 1, 1, 1, 0, uv[0], uv[1], uv[2], uv[3]);
        }
      }
    }
    // papan kode rak di ujung utara & selatan
    for (const rack of this.racks) {
      const uv = this.atlas.uv('r:' + rack.code), w = rack.cols.length > 1 ? 2.25 : 1.04, h = w / 2;
      const zN = this.zOf(rack.r0) - C.CELL / 2 - 0.05, zS = this.zOf(rack.r1) + C.CELL / 2 + 0.05;
      signs.add(rack.x, 2.7, zN, w, h, 1, Math.PI, 0, 1, 1, 1, 0, uv[0], uv[1], uv[2], uv[3]);
      signs.add(rack.x, 2.7, zS, w, h, 1, 0, 0, 1, 1, 1, 0, uv[0], uv[1], uv[2], uv[3]);
    }
    // colliders rak
    this.colliders = this.rackRects.map((r) => ({ x0: r.x0 - 0.02, x1: r.x1 + 0.02, z0: r.z0 - 0.02, z1: r.z1 + 0.02 }));
  }

  /* ---------- isi barang ---------- */
  generateItems(seed) {
    const r = mulberry32(seed);
    for (const s of this.slotsSorted) {
      s.found = false; s.target = null; s.hidden = false;
      if (s.nw) { s.empty = true; s.item = null; continue; }
      s.jx = (r() - 0.5) * 0.06; s.jz = (r() - 0.5) * 0.06; s.jyaw = (r() - 0.5) * 0.12;
      if (r() < 0.09) { s.empty = true; s.item = null; continue; }
      s.empty = false;
      const cn = s.cl >= 0 ? CUST[s.cl].name : null, d = defFor(cn);
      const prev = this.slotMap.get(key(s.col, s.row - 1, s.lvl));
      if (prev && !prev.nw && !prev.empty && prev.item && prev.rack === s.rack && prev.cl === s.cl && r() < 0.55) {
        const p = d.products[prev.item.pIdx];
        s.item = { ...prev.item, qty: rint(r, p[2], p[3]), lot: r() < 0.7 ? prev.item.lot : newLot(r) };
        s.kind = prev.kind; s.tint = prev.tint;
      } else {
        s.item = makeItem(r, cn); s.kind = kindFor(r, cn); s.tint = this.tintFor(r, s.kind, s.cl);
      }
      s.h = KIND_H[s.kind];
    }
  }
  tintFor(r, kind, cl) {
    const base = cl >= 0 ? rgb(parseInt(CUST[cl].color.slice(1), 16)) : [0.72, 0.72, 0.7];
    let c;
    switch (kind) {
      case KIND.CARTON: c = mix([0.8, 0.62, 0.4], base, 0.35); break;
      case KIND.DRUM: c = mix([0.9, 0.9, 0.9], base, 0.8); break;
      case KIND.SACK: c = mix([0.95, 0.93, 0.88], base, 0.3); break;
      case KIND.WRAP: c = mix([0.88, 0.92, 0.96], base, 0.25); break;
      case KIND.PAINT: c = mix([1, 1, 1], base, 0.9); break;
      default: c = mix([0.95, 0.95, 0.95], base, 0.4);
    }
    return mul(c, 0.86 + r() * 0.2);
  }
  /* ubah isi satu slot (dipakai misi) */
  setItem(s, item, kind, tint) { s.item = item; s.empty = !item; if (kind !== undefined) { s.kind = kind; s.h = KIND_H[kind]; } if (tint) s.tint = tint; }

  /* ---------- batch instance pallet (dibagi per sel ruang agar culling bekerja) ---------- */
  _chunk(x, z) {
    const k = Math.floor(x / 24) + '|' + Math.floor(z / 24);
    let ch = this.pal.get(k);
    if (!ch) {
      const e = this.eng, o = { cap: 128 };
      ch = { base: e.batch(this.gPalBase, o), kinds: this.gKinds.map((g) => e.batch(g, o)), label: e.batch(this.gQuad, { ...o, tex: this.atlasTex }) };
      this.pal.set(k, ch);
    }
    return ch;
  }
  rebuildInstances() {
    for (const ch of this.pal.values()) { ch.base.clear(); ch.kinds.forEach((b) => b.clear()); ch.label.clear(); }
    const bar = this.atlas.uv('bar'), white = this.atlas.uv('white');
    const brand = CUST.map((c) => rgb(parseInt(c.color.slice(1), 16)));
    const add = (s, label) => {
      const ch = this._chunk(s.x, s.z);
      ch.base.add(s.x, s.y0, s.z);
      ch.kinds[s.kind].add(s.x + s.jx, s.y0 + C.PAL, s.z + s.jz, 1, 1, 1, s.jyaw, 0, s.tint[0], s.tint[1], s.tint[2], 0);
      if (label) {
        ch.label.add(s.x + s.face * 0.51, s.y0 + C.PAL + 0.4, s.z, 0.3, 0.2, 1, s.face * Math.PI / 2, 0, 1, 1, 1, 0, bar[0], bar[1], bar[2], bar[3]);
        // stripe warna client agar tiap rak mudah dikenali dari jauh
        if (s.cl >= 0) {
          const b = brand[s.cl];
          ch.label.add(s.x + s.face * 0.512, s.y0 + C.PAL + 0.7, s.z, 0.78, 0.13, 1, s.face * Math.PI / 2, 0, b[0], b[1], b[2], 0.12, white[0], white[1], white[2], white[3]);
        }
      }
    };
    for (const s of this.slots) if (!s.nw && !s.empty) add(s, true);
    for (const d of this.decorPallets) add(d, false);
    for (const ch of this.pal.values()) { ch.base.finalize(); ch.kinds.forEach((b) => b.finalize()); ch.label.finalize(); }
  }

  /* ---------- pencarian & deskripsi ---------- */
  colAt(x) {
    const a = this.colX; let lo = 0, hi = a.length - 1;
    if (x < a[0] - 0.56 || x > a[hi] + 0.56) return -1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m; else hi = m; }
    const i = Math.abs(a[lo] - x) < Math.abs(a[hi] - x) ? lo : hi;
    return Math.abs(a[i] - x) <= 0.56 ? this.cols[i] : -1;
  }
  slotAt(col, row, lvl) { return this.slotMap.get(key(col, row, lvl)); }
  /* sinar dari (o) ke arah (d); kembalikan slot berisi pertama yang terkena */
  pick(ox, oy, oz, dx, dy, dz, max = 18) {
    for (let t = 0.25; t <= max; t += 0.1) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y < 0.05 || y > C.H) break;
      const col = this.colAt(x); if (col < 0) continue;
      const row = Math.round(z / C.CELL) + this.rmin;
      const lvl = Math.floor(y / C.LVH) + 1;
      const s = this.slotMap.get(key(col, row, lvl));
      if (!s || s.empty || s.nw) continue;
      const y0 = s.y0, y1 = y0 + C.PAL + s.h;
      if (Math.abs(x - s.x) < 0.5 && Math.abs(z - s.z) < 0.5 && y >= y0 && y <= y1) return { slot: s, dist: t };
    }
    return null;
  }
  describe(s) {
    const two = s.rack.cols.length > 1, side = two ? (s.col === s.rack.cols[0] ? 'barat' : 'timur') : '';
    const pad = (n) => String(n).padStart(2, '0');
    return {
      code: s.code, side, bay: s.bay, lvl: s.lvl, block: BLOCKS[s.grp] || s.grp,
      text: `Rak ${s.code}${side ? ` (sisi ${side})` : ''} · Bay ${pad(s.bay)} · Level ${s.lvl}`,
      short: `${s.code}${side ? '-' + side[0].toUpperCase() : ''}-B${pad(s.bay)}-L${s.lvl}`,
    };
  }
  /* rak & bay terdekat dari posisi pemain (untuk HUD lokasi) */
  where(x, z) {
    const row = Math.round(z / C.CELL) + this.rmin;
    let best = null, bd = 1e9;
    for (const c of this.cols) {
      const dx = Math.abs(this.xc.get(c) - x); if (dx > 4.2 || dx >= bd) continue;
      const rk = this.rackAtCell.get(c * 1000 + Math.max(this.rmin, Math.min(this.rmax, row)));
      if (rk) { bd = dx; best = { rack: rk, col: c }; }
    }
    return best ? { code: best.rack.code, bay: Math.max(1, Math.floor((row - best.rack.r0) / C.BAY) + 1), grp: best.rack.grp, col: best.col, row, d: bd } : null;
  }
  blockOf(x, z) {
    const b = this.bounds, rb = this.rackBox;
    if (x < rb.x0 - 1) return 'Zona Kantor & Loker (barat)';
    if (x > rb.x1 + 1) return 'Zona QC & Charging (timur)';
    if (z < rb.z0 - 1) return 'Area Receiving (utara)';
    if (z > rb.z1 + 1) return 'Area Staging & Dock Outbound (selatan)';
    return null;
  }

  update(dt, t, player) { return this.env.update(dt, t, player); }
}
