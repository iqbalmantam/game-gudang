/* missions.js — level, kasus "barang hilang", petunjuk (clue) & naskah cerita */
import { mulberry32, itemOf, defFor, newLot } from './items.js';
import { CUST } from './data.js';
import { BLOCKS, C } from './world.js';

/* ---------------------------------------------------------------- level */
export const LEVELS = [
  {
    id: 1, name: 'Shift Pagi', sub: 'Selisih Pertama', cases: 3, maxLvl: 3, assist: true, decoys: 2, nearMiss: 0,
    par: 420, limit: 0, forkSpeed: 0.7, yield: 6, atmos: 'day', mode: 'direct', sysMin: 14, sysMax: 50,
    brief: [
      'Pagi! Auditor klien datang jam 14.00. Hasil cycle count semalam: beberapa SKU tercatat di sistem, tapi slot rak-nya KOSONG.',
      'Tugasmu: lacak pallet fisiknya. Mulai dari lokasi sistem — biasanya pemindah barang meninggalkan catatan di situ.',
      'Ingat aturan opname: PINDAI dulu, cocokkan SKU DAN lot, baru KONFIRMASI. Ada pallet SKU sama dengan lot berbeda — jangan tertipu.',
    ],
    win: 'Tiga selisih pertama beres. Tapi kenapa pallet-pallet ini berpindah tanpa tercatat? Catatan tulisan tangan itu bertanda "D."... Siapkan diri untuk shift siang.',
  },
  {
    id: 2, name: 'Shift Siang', sub: 'Jejak Forklift', cases: 4, maxLvl: 5, assist: true, decoys: 3, nearMiss: 1,
    par: 660, limit: 0, forkSpeed: 0.95, yield: 4, atmos: 'noon', mode: 'split', sysMin: 20, sysMax: 75,
    brief: [
      'Selisihnya bertambah: empat SKU. Kali ini petunjuknya TERPISAH — sebagian di catatan tercecer, sebagian ada di kepala Sari, Wawan, dan Rudi.',
      'Kumpulkan kepingan: blok, client, bay, level. Lalu cari pallet yang SKU dan lot-nya persis sama. Ada pallet yang lot-nya mirip — teliti.',
      'Lalu lintas forklift padat siang ini. Dengarkan klakson dan jangan melintas tiba-tiba di depannya. Tiap tabrakan mengurangi nilai K3.',
    ],
    win: 'Jejaknya jelas sekarang: semua pallet dipindah oleh orang yang sama, dengan terburu-buru, dan tanpa scan. Tinggal satu shift lagi.',
  },
  {
    id: 3, name: 'Shift Malam', sub: 'Gudang Gelap', cases: 5, maxLvl: 7, assist: false, decoys: 4, nearMiss: 2,
    par: 780, limit: 960, forkSpeed: 1.15, yield: 2.6, atmos: 'night', mode: 'riddle', sysMin: 25, sysMax: 95,
    brief: [
      'Listrik jalur dihemat, hanya senter scanner dan lampu high-bay yang menyala. Auditor datang pagi — kamu punya 16 menit untuk lima SKU.',
      'Scanner malam tidak lagi menandai cocok / tidak cocok. Baca sendiri SKU dan lot-nya. Beberapa petunjuk berupa hitungan singkat.',
      'Forklift malam jarang mengalah. Kalau nilai K3 habis, shift dihentikan. Selamat bekerja.',
    ],
    win: 'Kasus ditutup. Semua pallet kembali tercatat — dan pelakunya akhirnya jelas.',
  },
];

export const NPC_INFO = {
  hendra: { name: 'Pak Hendra', role: 'Supervisor Gudang' },
  sari: { name: 'Sari', role: 'Admin Inventory' },
  rudi: { name: 'Rudi', role: 'Operator Forklift' },
  wawan: { name: 'Pak Wawan', role: 'Checker Receiving' },
};

const pad2 = (n) => String(n).padStart(2, '0');
const sideWord = (s) => (s.face < 0 ? 'barat' : 'timur');
const pick = (r, a) => a[Math.floor(r() * a.length)];

/* ungkapan hitungan untuk teka-teki level malam */
function riddle(n, r) {
  const o = [];
  for (let a = 2; a <= 9; a++) if (n % a === 0 && n / a >= 2 && n / a <= 9) o.push(`${a} × ${n / a}`);
  if (n >= 2) { const a = 1 + Math.floor(r() * (n - 1)); o.push(`${a} + ${n - a}`); }
  const k = 1 + Math.floor(r() * 6); o.push(`${n + k} − ${k}`);
  return pick(r, o);
}

/* ---------------------------------------------------------------- petunjuk */
function pieceValues(world, t, r) {
  const rack = t.rack, maxBay = Math.floor((rack.r1 - rack.r0) / C.BAY) + 1;
  const num = parseInt(t.code.slice(1), 10) || 0;
  return {
    block: BLOCKS[t.grp], client: CUST[t.cl].name, rack: t.code, side: sideWord(t),
    bay: pad2(t.bay), bayrange: [pad2(Math.max(1, t.bay - 1)), pad2(Math.min(maxBay, t.bay + 1))],
    level: String(t.lvl), rackparity: num % 2 ? 'ganjil' : 'genap', bayriddle: riddle(t.bay, r),
  };
}

/* kalimat pendek per kepingan petunjuk */
function frag(piece, v) {
  switch (piece) {
    case 'rack': return `sekarang di Rak ${v.rack}`;
    case 'block': return `ada di ${v.block}`;
    case 'client': return `rak milik ${v.client}`;
    case 'side': return `diambil dari lorong sisi ${v.side}`;
    case 'bay': return `Bay ${v.bay}`;
    case 'bayrange': return `antara Bay ${v.bayrange[0]} dan Bay ${v.bayrange[1]}`;
    case 'level': return `Level ${v.level}`;
    case 'rackparity': return `nomor rak-nya ${v.rackparity}`;
    case 'bayriddle': return `nomor Bay = ${v.bayriddle}`;
    default: return '';
  }
}

/* nilai yang tampil di tabel deduksi buku catatan */
function knownFrom(piece, v, known) {
  switch (piece) {
    case 'rack': known.rack = v.rack; break;
    case 'rackparity': if (!known.rack) known.rack = `nomor ${v.rackparity}`; break;
    case 'block': known.block = v.block.split(' · ')[0]; break;
    case 'client': known.client = v.client; break;
    case 'side': known.side = `lorong ${v.side}`; break;
    case 'bay': known.bay = v.bay; break;
    case 'bayrange': if (!known.bay) known.bay = `${v.bayrange[0]}–${v.bayrange[1]}`; break;
    case 'bayriddle': if (!known.bay) known.bay = `hitung: ${v.bayriddle}`; break;
    case 'level': known.level = v.level; break;
    default: break;
  }
  if (piece === 'bay') known.bay = v.bay;
}
export { knownFrom };

const NOTE_AUTHOR = ['Dimas — Shift Malam', 'D. (Shift Malam)', 'Dimas'];
const NOTE_INTRO_SYS = ['Slot ini kosong, pallet saya geser tadi malam.', 'Maaf, pallet dari sini sudah saya pindah.', 'Lokasi lama — pallet sudah tidak di sini.'];
const NOTE_INTRO_LM = ['Catatan tercecer:', 'Terselip di area ini:', 'Kertas kusut ditemukan:'];
const NPC_OPEN = {
  sari: ['Aku cek WMS dan log mutasi:', 'Dari rekap yang kupegang:', 'Menurut data yang kuingat:'],
  wawan: ['Waktu truk masuk, aku lihat sendiri:', 'Aku ingat pallet itu lewat sini:', 'Seingatku begini:'],
  rudi: ['Aku yang bantu angkat, jadi aku ingat:', 'Jujur, aku lupa scan. Tapi ingat ini:', 'Forklift-ku yang bawa pallet itu:'],
};

function noteText(c, v, pieces, where, r) {
  const intro = where === 'sys' ? pick(r, NOTE_INTRO_SYS) : pick(r, NOTE_INTRO_LM);
  const body = pieces.map((p) => frag(p, v)).join(', ');
  return `${intro} Pallet ${c.sku} (lot ${c.lot}) — ${body}. — ${pick(r, NOTE_AUTHOR)}`;
}
function npcText(npc, c, v, pieces, r) {
  const body = pieces.map((p) => frag(p, v)).join(', ');
  return `${pick(r, NPC_OPEN[npc])} pallet ${c.sku}, lot ${c.lot} → ${body}.`;
}

/* ---------------------------------------------------------------- misi */
export function buildMission(world, level, seed) {
  const r = mulberry32(seed * 7919 + level.id * 104729);
  world.generateItems(seed);
  const accessible = (s) => !s.nw && !world.xc.has(s.col + s.face);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const cand = world.slots.filter((s) => accessible(s) && !s.empty && s.cl >= 0 && s.lvl <= level.maxLvl && s.item);
  const sysCand = world.slots.filter((s) => accessible(s) && s.lvl <= Math.min(3, level.maxLvl));
  const used = new Set(), usedRack = new Set(), usedGrp = [];
  const tryPick = (list, ok, tries = 400) => {
    for (let i = 0; i < tries; i++) { const s = list[Math.floor(r() * list.length)]; if (ok(s)) return s; }
    return null;
  };

  const cases = [];
  for (let n = 0; n < level.cases; n++) {
    const sameLot = (s) => cases.some((c) => c.sku === s.item.sku && c.lot === s.item.lot);
    const base = (s) => !used.has(s.id) && !usedRack.has(s.code) && !sameLot(s) && cases.every((c) => dist(c.target, s) > 24);
    let t = tryPick(cand, (s) => base(s) && !usedGrp.includes(s.grp)) || tryPick(cand, base) || tryPick(cand, (s) => !used.has(s.id) && !sameLot(s));
    used.add(t.id); usedRack.add(t.code); usedGrp.push(t.grp);
    let sys = tryPick(sysCand, (s) => !used.has(s.id) && s.rack !== t.rack && dist(s, t) > level.sysMin && dist(s, t) < level.sysMax)
      || tryPick(sysCand, (s) => !used.has(s.id) && s.rack !== t.rack);
    used.add(sys.id);
    cases.push({ id: n + 1, target: t, sys, sku: t.item.sku, lot: t.item.lot, name: t.item.name, unit: t.item.unit, qty: t.item.qty, client: t.item.client, done: false, verified: false, known: {}, pieces: null });
  }
  // lokasi sistem dikosongkan
  for (const c of cases) world.setItem(c.sys, null);

  // pengecoh: SKU sama lot beda (mirip secara visual), dan lot sama SKU beda
  for (const c of cases) {
    const t = c.target, cn = CUST[t.cl].name, d = defFor(cn);
    const near = world.slots.filter((s) => s.rack === t.rack && s.col === t.col && s !== t && !used.has(s.id) && !s.nw
      && Math.abs(s.row - t.row) <= 8 && Math.abs(s.lvl - t.lvl) <= 2 && s.lvl <= level.maxLvl + 1);
    for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
    let k = 0;
    for (let i = 0; i < level.decoys && k < near.length; i++, k++) {
      const s = near[k], it = itemOf(r, d, t.item.pIdx, cn);
      do { it.lot = newLot(r); } while (it.lot === t.item.lot);
      world.setItem(s, it, t.kind, t.tint); used.add(s.id);
    }
    for (let i = 0; i < level.nearMiss && k < near.length; i++, k++) {
      const s = near[k], it = itemOf(r, d, (t.item.pIdx + 1 + i) % d.products.length, cn);
      it.lot = t.item.lot;
      world.setItem(s, it, t.kind, t.tint); used.add(s.id);
    }
  }
  // pastikan (SKU, lot) tiap target unik di seluruh gudang
  for (const s of world.slots) {
    if (!s.item) continue;
    for (const c of cases) {
      if (s !== c.target && s.item.sku === c.sku && s.item.lot === c.lot) {
        let l; do { l = newLot(r); } while (l === c.lot);
        s.item = { ...s.item, lot: l };
      }
    }
  }
  for (const c of cases) c.target.target = c.id;

  /* ----- petunjuk ----- */
  const notes = [], npcClues = { sari: [], wawan: [], rudi: [] };
  const npcCycle = ['sari', 'wawan', 'rudi'];
  const plan = {
    direct: { sys: ['rack'], lm: [], npc: ['bay', 'level', 'side'] },
    split: { sys: ['block', 'client'], lm: ['bayrange', 'level'], npc: ['side', 'rackparity'] },
    riddle: { sys: ['client'], lm: ['block', 'level'], npc: ['side', 'bayriddle'] },
  }[level.mode];
  const landmarks = world.landmarks.filter((l) => !/Kantor/.test(l.name));
  const free = (x, z) => !world.colliders.some((q) => x > q.x0 - 0.7 && x < q.x1 + 0.7 && z > q.z0 - 0.7 && z < q.z1 + 0.7)
    && !world.env.circles.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + 0.7);
  let nid = 1;

  cases.forEach((c, i) => {
    const v = pieceValues(world, c.target, r); c.pieces = v; c.cluesTotal = 0;
    c.sysText = world.describe(c.sys).text;
    // 1) catatan di lokasi sistem
    const sx = c.sys.x + c.sys.face * 1.75, sz = c.sys.z;
    notes.push({ id: nid++, caseId: c.id, where: 'sys', pieces: plan.sys, text: noteText(c, v, plan.sys, 'sys', r), x: sx, y: 1.25, z: sz, taken: false, from: `Catatan di ${c.sysText}` });
    c.cluesTotal++;
    // 2) catatan tercecer di landmark
    if (plan.lm.length) {
      const lm = landmarks[(i * 3 + Math.floor(r() * 3)) % landmarks.length];
      let x = lm.x, z = lm.z;
      for (let k = 0; k < 40; k++) { const px = lm.x + (r() - 0.5) * 7, pz = lm.z + (r() - 0.5) * 7; if (free(px, pz)) { x = px; z = pz; break; } }
      notes.push({ id: nid++, caseId: c.id, where: 'lm', pieces: plan.lm, text: noteText(c, v, plan.lm, 'lm', r), x, y: 1.25, z, taken: false, from: `Catatan tercecer dekat ${lm.name}` });
      c.cluesTotal++;
    }
    // 3) NPC
    const npc = level.mode === 'direct' ? 'sari' : npcCycle[i % 3];
    npcClues[npc].push({ caseId: c.id, pieces: plan.npc, text: npcText(npc, c, v, plan.npc, r), given: false });
    c.cluesTotal++;
  });

  return { cases, notes, npcClues, level, seed };
}
