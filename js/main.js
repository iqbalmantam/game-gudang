/* main.js — OPNAME: Misteri Barang Hilang. Alur game, input, HUD, misi. */
import { Engine } from './gl.js';
import { World, C, BLOCKS } from './world.js';
import { CUST } from './data.js';
import { Player } from './player.js';
import { MapView } from './map.js';
import { Sound } from './audio.js';
import { LEVELS, NPC_INFO, buildMission, knownFrom } from './missions.js';
import * as ui from './ui.js';
import { $, $$ } from './ui.js';

const PI = Math.PI, pad2 = (n) => String(n).padStart(2, '0');
const canvas = $('#gl');

/* ------------------------------------------------------------ atmosfer */
const ATMOS = {
  day: { sky: [0.78, 0.82, 0.9], ground: [0.34, 0.33, 0.33], key: [0.32, 0.30, 0.26], fog: [0.055, 0.07, 0.09], lamp: 0.9, near: 40, far: 190 },
  noon: { sky: [0.86, 0.80, 0.70], ground: [0.38, 0.33, 0.28], key: [0.44, 0.34, 0.20], fog: [0.10, 0.08, 0.06], lamp: 0.8, near: 48, far: 200 },
  night: { sky: [0.24, 0.27, 0.40], ground: [0.12, 0.12, 0.16], key: [0.07, 0.08, 0.12], fog: [0.012, 0.016, 0.03], lamp: 2.0, near: 16, far: 105 },
};

/* ------------------------------------------------------------ progres tersimpan */
const KEY = 'opname.gudang.v1';
function loadProg() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* abaikan */ }
  p = p && typeof p === 'object' ? p : { unlocked: 1, best: {} };
  if (/[?&]unlock/.test(location.search)) p.unlocked = 3;
  return p;
}
function saveProg() { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* abaikan */ } }
let prog = loadProg();

/* ------------------------------------------------------------ keadaan */
const S = {
  mode: 'loading', prevMode: 'play', overlay: null, clock: 0, levelIdx: 0, L: LEVELS[0], mission: null, cases: [], clues: [], selected: 1,
  t: 0, penalty: 0, wrongs: 0, radarUses: 0, radarT: -99, verified: 0, safety: 3, reportReady: false,
  hover: null, scanned: new Set(), scanSlot: null, scanT: -99, dlg: null, ping: null, hornT: -99, locked: false, usedLock: false,
  touch: false, touchRun: false, joy: { x: 0, y: 0 }, hudT: 0, lastPrompt: '', fail: null,
};
let eng, world, env, player, mapView, baseSpeeds = [];
const cam = { x: 0, y: 1.65, z: 0, yaw: 0, pitch: 0, fov: 1.2566 };
const keys = new Set();

/* ------------------------------------------------------------ boot */
async function boot() {
  try {
    eng = new Engine(canvas);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));
    world = new World(eng); env = world.env;
    player = new Player(world, env);
    mapView = new MapView(world);
    baseSpeeds = env.forklifts.map((f) => f.speed);
    ui.renderLegend();
    resize(); window.addEventListener('resize', resize);
    initInput(); initTouch();
    setMode('title');
    ui.renderLevels(LEVELS, prog, (i) => openBrief(i));
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    $('#err-text').textContent = String(err && err.message ? err.message : err) + ' — pastikan browser mendukung WebGL2 dan halaman dibuka lewat http(s), bukan file://.';
    ui.showScreen('error');
  }
}

function resize() { eng.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 1.5)); }

function setMode(m) {
  S.mode = m;
  const hud = m === 'play' || m === 'dialog' || m === 'paused';
  ui.toggle($('#hud'), hud);
  if (m === 'title') ui.showScreen('title');
  else if (m === 'brief') ui.showScreen('brief');
  else if (m === 'paused') ui.showScreen('pause');
  else if (m === 'result') ui.showScreen('result');
  else if (m === 'play' || m === 'dialog') ui.showScreen('none');
  ui.toggle($('#touch'), S.touch && (m === 'play' || m === 'dialog'));
}

function applyAtmos(name) {
  const a = ATMOS[name] || ATMOS.day;
  eng.sky = a.sky.slice(); eng.ground = a.ground.slice(); eng.key = a.key.slice(); eng.fogCol = a.fog.slice();
  eng.lamp = a.lamp; eng.fogNear = a.near; eng.fogFar = a.far;
}

/* ------------------------------------------------------------ level */
function openBrief(idx) {
  Sound.unlock();
  S.levelIdx = idx; S.L = LEVELS[idx];
  prepareLevel();
  ui.renderBrief(S.L, S.cases);
  setMode('brief');
}

function prepareLevel() {
  const L = S.L, seed = (Math.floor(Math.random() * 60000) + 11) | 0;
  const m = buildMission(world, L, seed);
  S.mission = m; S.cases = m.cases; S.clues = [];
  world.rebuildInstances();
  env.clearNotes(); env.clearMarks(); env.setHover(null);
  for (const n of m.notes) env.addNote(n.id, n.x, n.y, n.z);
  env.forklifts.forEach((f, i) => { f.speed = baseSpeeds[i] * L.forkSpeed; f.wait = 0; });
  applyAtmos(L.atmos);
  Object.assign(S, { t: 0, penalty: 0, wrongs: 0, radarUses: 0, radarT: -99, verified: 0, safety: 3, reportReady: false, hover: null, scanSlot: null, scanT: -99, ping: null, selected: 1, fail: null, overlay: null });
  S.scanned = new Set();
  const sp = world.spawn; player.reset(sp.x, sp.z, sp.yaw);
  refreshCases(); updateBoard(); ui.hideScan(); ui.hideDialog();
  ui.setText($('#lv-name'), `SHIFT ${L.id} · ${L.name.toUpperCase()}`); ui.setText($('#lv-sub'), L.sub);
  $('#helpbar').classList.remove('fade');
  $('#toasts').innerHTML = '';
}

function startPlay() {
  Sound.unlock();
  setMode('play');
  requestLock();
  setTimeout(() => $('#helpbar').classList.add('fade'), 22000);
  ui.toast(`Shift ${S.L.id} dimulai — mulai dari lokasi sistem ke-1 (titik merah di peta)`, 'good', 4500);
  if (S.L.limit) ui.toast(`Batas waktu ${Math.round(S.L.limit / 60)} menit`, 'warn', 4500);
}

function requestLock() {
  if (S.touch) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* mode tanpa kunci mouse */ }
}

function refreshCases() { ui.renderCases(S.cases, S.selected); if (S.overlay === 'notebook') ui.renderNotebook(S.cases, S.clues); }

function updateBoard() {
  const lines = S.cases.map((c) => ({ text: `${c.sku} · lot ${c.lot}`, done: c.done }));
  env.setBoard(lines, `PAPAN OPNAME — SHIFT ${S.L.id}`);
}

const liveScore = () => Math.max(0, S.cases.filter((c) => c.done).length * 500 + S.verified * 50 - S.penalty);

/* ------------------------------------------------------------ kamera */
function attractCam(t) {
  const B = world.rackBox, span = Math.min(60, B.x1 - B.x0 - 20), ph = t * 0.045;
  const x = 8 + span * (0.5 - 0.5 * Math.cos(ph)), dirn = Math.max(-1, Math.min(1, Math.sin(ph) * 4));
  cam.x = x; cam.z = world.crossZ + Math.sin(t * 0.3) * 0.5; cam.y = 1.8 + Math.sin(t * 0.5) * 0.08;
  cam.yaw = dirn * PI / 2 + Math.sin(t * 0.25) * 0.18; cam.pitch = 0.16 + Math.sin(t * 0.35) * 0.07;
}
function playerCam() {
  cam.x = player.x; cam.z = player.z; cam.y = player.eyeY(); cam.yaw = player.yaw; cam.pitch = player.pitch;
  cam.fov = 1.2566 + (player.running ? 0.05 : 0);
}

/* ------------------------------------------------------------ targeting scanner */
function pickSlot(ox, oy, oz, dx, dy, dz, max = 15) {
  let firstEmpty = null;
  for (let tt = 0.3; tt <= max; tt += 0.12) {
    if (firstEmpty && tt > firstEmpty.dist + 1.4) break;   // slot kosong terkena: jangan tembus ke pallet di lorong seberang
    const x = ox + dx * tt, y = oy + dy * tt, z = oz + dz * tt;
    if (y < 0.05 || y > C.H) break;
    const col = world.colAt(x); if (col < 0) continue;
    const s = world.slotAt(col, Math.round(z / C.CELL) + world.rmin, Math.floor(y / C.LVH) + 1);
    if (!s || s.nw) continue;
    if ((ox - s.x) * s.face <= 0) continue;               // label hanya terbaca dari sisi lorongnya
    if (Math.abs(x - s.x) > 0.5 || Math.abs(z - s.z) > 0.5) continue;
    const yy = y - s.y0;
    if (s.empty) { if (!firstEmpty && yy >= 0 && yy <= C.PAL + 1.3) firstEmpty = { slot: s, empty: true, dist: tt }; continue; }
    if (yy >= 0 && yy <= C.PAL + s.h) return { slot: s, empty: false, dist: tt };
  }
  return firstEmpty;
}

function nearNpc() {
  const f = player.forward(); let best = null, bd = 3.1;
  for (const n of env.npcs) {
    const dx = n.x - player.x, dz = n.z - player.z, d = Math.hypot(dx, dz);
    if (d > bd) continue;
    if (d > 1.4 && (dx * f[0] + dz * f[2]) / d < 0.35) continue;
    best = n; bd = d;
  }
  return best;
}
function nearNote() {
  let best = null, bd = 2.5;
  for (const n of S.mission.notes) { if (n.taken) continue; const d = Math.hypot(n.x - player.x, n.z - player.z); if (d < bd) { best = n; bd = d; } }
  return best;
}

/* ------------------------------------------------------------ aksi pemain */
function doScan() {
  if (S.mode !== 'play') return;
  const h = S.hover;
  if (!h) { ui.toast('Arahkan scanner ke pallet atau slot rak, lalu klik.', 'warn', 2200); return; }
  const s = h.slot, d = world.describe(s), loc = d.short;
  Sound.scan(); S.scanned.add(s.id); S.scanSlot = s; S.scanT = S.t;
  if (h.empty) {
    const lines = [{ k: 'info', t: 'Slot kosong — tidak ada barcode terbaca.' }];
    const c = S.cases.find((q) => q.sys === s);
    if (c) {
      lines.push({ k: 'ok', t: `Selisih terverifikasi untuk ${c.sku}` });
      if (!c.verified) { c.verified = true; S.verified++; ui.toast(`Selisih #${c.id} terverifikasi (+50). Cari catatan di dekat sini.`, 'good'); }
    }
    ui.showScan({ loc, empty: true, lines });
    return;
  }
  const it = s.item, lines = [];
  if (S.L.assist) {
    const open = S.cases.filter((q) => !q.done);
    const bySku = open.find((q) => q.sku === it.sku), sel = S.cases.find((q) => q.id === S.selected && !q.done) || open[0];
    const c = bySku || sel;
    if (c) {
      lines.push({ k: it.sku === c.sku ? 'ok' : 'no', t: `SKU ${it.sku === c.sku ? '✔ cocok' : '✘ beda'} (kasus #${c.id})` });
      lines.push({ k: it.lot === c.lot ? 'ok' : 'no', t: `LOT ${it.lot === c.lot ? '✔ cocok' : `✘ beda (cari ${c.lot})`}` });
    }
  } else lines.push({ k: 'info', t: 'Mode malam: cocokkan sendiri SKU dan lot.' });
  lines.push({ k: 'info', t: 'Tekan F untuk konfirmasi pallet ini.' });
  ui.showScan({ loc, sku: it.sku, name: it.name, client: it.client, lot: it.lot, qty: it.qty, unit: it.unit, lines });
}

function doConfirm() {
  if (S.mode !== 'play') return;
  const h = S.hover;
  if (!h) { ui.toast('Arahkan ke pallet yang mau dikonfirmasi.', 'warn', 2200); return; }
  const s = h.slot;
  if (h.empty) { ui.toast('Slot kosong — tidak ada yang bisa dikonfirmasi.', 'warn', 2200); Sound.bad(); return; }
  if (!S.scanned.has(s.id)) { ui.toast('Pindai dulu (klik) sebelum konfirmasi — aturan opname.', 'warn'); Sound.bad(); return; }
  if (s.found) { ui.toast('Pallet ini sudah dikonfirmasi.', '', 2000); return; }
  const c = S.cases.find((q) => !q.done && q.target === s);
  if (c) {
    c.done = true; s.found = true; env.markFound(s); S.penalty = Math.max(0, S.penalty);
    Sound.ok();
    const left = S.cases.filter((q) => !q.done).length;
    ui.toast(`✔ ${c.sku} lot ${c.lot} ditemukan di ${world.describe(s).text}`, 'good', 5000);
    ui.toast(`Tag serah-terima di pallet: "dipindah D. — TANPA SCAN".`, '', 4200);
    if (!left) {
      S.reportReady = true; Sound.win();
      ui.toast('Semua barang ditemukan! Kembali ke Kantor Opname, lapor ke Pak Hendra.', 'good', 7000);
    } else if (S.selected === c.id) S.selected = (S.cases.find((q) => !q.done) || { id: 1 }).id;
    refreshCases(); updateBoard(); ui.hideScan();
    return;
  }
  const same = S.cases.find((q) => !q.done && q.sku === s.item.sku);
  S.wrongs++; Sound.bad(); ui.flash();
  if (same) { S.penalty += 100; ui.toast(`✘ SKU benar tapi LOT salah (${s.item.lot} ≠ ${same.lot}). −100`, 'bad', 4200); }
  else { S.penalty += 50; ui.toast('✘ Bukan barang yang dicari. −50', 'bad', 3200); }
}

function doRadar() {
  if (S.mode !== 'play') return;
  const wait = 14 - (S.t - S.radarT);
  if (wait > 0) { ui.toast(`Radar mengisi daya… ${Math.ceil(wait)} dtk`, 'warn', 1800); return; }
  const open = S.cases.filter((c) => !c.done);
  if (!open.length) { ui.toast('Semua barang sudah ditemukan. Lapor ke Pak Hendra.', '', 2400); return; }
  let best = null, bd = 1e9;
  for (const c of open) { const d = Math.hypot(c.target.x - player.x, c.target.z - player.z); if (d < bd) { bd = d; best = c; } }
  const t = best.target, dx = t.x - player.x, dz = t.z - player.z;
  const names = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
  const dir = names[Math.round(((Math.atan2(dx, -dz) + 2 * PI) % (2 * PI)) / (PI / 4)) % 8];
  S.radarT = S.t; S.radarUses++; S.penalty += 75; Sound.radar();
  S.ping = { x: t.x + (Math.random() - 0.5) * 14, z: t.z + (Math.random() - 0.5) * 14, r: 15, life: 0, ttl: 9 };
  ui.toast(`Radar: kasus #${best.id} sekitar ${Math.round(bd / 5) * 5} m ke arah ${dir} (−75)`, 'warn', 5200);
}

function selectCase(id) { if (S.cases.find((c) => c.id === id)) { S.selected = id; refreshCases(); } }

/* ------------------------------------------------------------ petunjuk, catatan, dialog */
function addClue(caseId, from, text, pieces) {
  const c = S.cases.find((q) => q.id === caseId);
  S.clues.push({ caseId, from, text });
  if (c) for (const p of pieces) knownFrom(p, c.pieces, c.known);
  ui.toast(`Petunjuk baru untuk kasus #${caseId} — lihat buku catatan (Tab)`, 'good', 3600);
  if (S.overlay === 'notebook') ui.renderNotebook(S.cases, S.clues);
}

function openDialog(name, role, lines, note, onEnd) {
  S.dlg = { name, role, lines, i: 0, note: !!note, onEnd };
  S.mode = 'dialog'; document.body.dataset.dlg = '1';
  ui.showDialog(name, role, lines[0], note); Sound.talk();
}
function advanceDialog() {
  const d = S.dlg; if (!d) return;
  d.i++; Sound.talk();
  if (d.i >= d.lines.length) {
    S.dlg = null; ui.hideDialog(); S.mode = 'play'; delete document.body.dataset.dlg;
    if (d.onEnd) d.onEnd();
  } else ui.showDialog(d.name, d.role, d.lines[d.i], d.note);
}

function readNote(n) {
  n.taken = true; env.removeNote(n.id); Sound.note();
  const c = S.cases.find((q) => q.id === n.caseId);
  openDialog('Catatan tertinggal', n.from, [n.text], true, () => addClue(n.caseId, n.from, n.text, n.pieces));
  if (c) c.cluesGot = (c.cluesGot || 0) + 1;
}

const CHAT = {
  sari: ['Semua SKU di papan itu tercatat di WMS sebagai "ada". Makanya auditor heran kenapa raknya kosong.', 'Kalau kamu butuh lokasi sistem, tabel briefing atau peta (M) menandainya dengan titik merah.'],
  wawan: ['Aku jaga receiving sejak subuh. Truk Toshiba menumpuk, semua orang buru-buru.', 'Pallet yang dipindah tanpa scan itu biang masalahnya. Selalu scan, ya.'],
  rudi: ['Forklift ini sensitif kalau ada yang melintas mendadak. Dengarkan klakson.', 'Rak baru di blok timur masih kosong, tapi beberapa pallet sempat diparkir sementara di sana.'],
  hendra: ['Ingat urutannya: pindai dulu, cocokkan SKU dan lot, baru konfirmasi.', 'Catatan tangan itu bertanda "D." — nanti kita bahas siapa dia setelah semua barang ketemu.', 'Kalau bingung arah, buka peta (M). Radar (Q) bisa membantu, tapi memotong skor.'],
};
let chatIdx = 0;

function talkTo(n) {
  const info = NPC_INFO[n.id] || { name: n.name, role: n.role };
  if (n.id === 'hendra') {
    if (S.reportReady) { openDialog(info.name, info.role, ['Semua barang sudah ketemu? Bagus sekali. Coba kulihat laporanmu…'], false, () => finishLevel(true)); return; }
    const left = S.cases.filter((c) => !c.done).length, tip = CHAT.hendra[chatIdx++ % CHAT.hendra.length];
    openDialog(info.name, info.role, [`Masih ${left} dari ${S.cases.length} SKU belum ketemu. ${tip}`]); return;
  }
  const pending = (S.mission.npcClues[n.id] || []).filter((c) => !c.given);
  if (pending.length) {
    const lines = pending.map((p) => { const c = S.cases.find((q) => q.id === p.caseId); return `[Kasus #${c.id} · ${c.sku}] ${p.text}`; });
    openDialog(info.name, info.role, lines, false, () => pending.forEach((p) => addClue(p.caseId, `${info.name} (${info.role})`, p.text, p.pieces)));
    pending.forEach((p) => { p.given = true; });
  } else {
    const list = CHAT[n.id] || ['…'];
    openDialog(info.name, info.role, [list[chatIdx++ % list.length]]);
  }
}

function interact() {
  if (S.mode === 'dialog') { advanceDialog(); return; }
  if (S.mode !== 'play') return;
  const n = nearNpc(); if (n) { talkTo(n); return; }
  const note = nearNote(); if (note) { readNote(note); return; }
  doScan();
}

/* ------------------------------------------------------------ overlay */
function toggleOverlay(name) {
  if (S.mode !== 'play') return;
  S.overlay = S.overlay === name ? null : name;
  ui.toggle($('#notebook'), S.overlay === 'notebook'); ui.toggle($('#bigmap'), S.overlay === 'map');
  if (S.overlay === 'notebook') ui.renderNotebook(S.cases, S.clues);
  if (S.overlay === 'map') { const bc = $('#bigmap-canvas'); if (bc.width !== mapView.W) { bc.width = mapView.W; bc.height = mapView.H; } mapView.drawFull(bc, mapState()); }
}
function closeOverlay() { if (S.overlay) { S.overlay = null; ui.toggle($('#notebook'), false); ui.toggle($('#bigmap'), false); } }

/* ------------------------------------------------------------ jeda & akhir shift */
function pause() {
  if (S.mode !== 'play' && S.mode !== 'dialog') return;
  S.prevMode = S.mode; closeOverlay(); S.mode = 'paused'; ui.showScreen('pause');
}
function resume() { S.mode = S.prevMode === 'dialog' ? 'dialog' : 'play'; ui.showScreen('none'); requestLock(); }

function finishLevel(win, reason) {
  const L = S.L, n = S.cases.filter((c) => c.done).length;
  closeOverlay(); S.dlg = null; ui.hideDialog(); delete document.body.dataset.dlg;
  if (document.pointerLockElement) document.exitPointerLock();
  const par = L.par, tb = win ? Math.round(500 * Math.max(0, Math.min(1, (par * 1.4 - S.t) / (par * 0.9)))) : 0;
  const k3 = win ? S.safety * 150 : 0, base = n * 500, ver = S.verified * 50;
  const total = Math.max(0, base + ver + tb + k3 - S.penalty);
  const max = S.cases.length * 550 + 500 + 450, ratio = total / max;
  const stars = !win ? 0 : ratio >= 0.74 ? 3 : ratio >= 0.5 ? 2 : 1;
  const fmt = (t) => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;
  const rows = [
    { label: `Barang ditemukan (${n}/${S.cases.length})`, value: `+${base}` },
    { label: `Selisih terverifikasi (${S.verified})`, value: `+${ver}` },
    { label: `Bonus kecepatan (${fmt(S.t)})`, value: `+${tb}` },
    { label: `Bonus K3 (sisa ${S.safety} nyawa)`, value: `+${k3}` },
    { label: `Salah konfirmasi (${S.wrongs}) & radar (${S.radarUses})`, value: `−${S.penalty}`, neg: true },
    { label: 'TOTAL SKOR', value: String(total), tot: true },
  ];
  let story = win ? L.win : (reason || 'Shift dihentikan.');
  let nextLabel = '';
  if (win) {
    nextLabel = S.levelIdx < LEVELS.length - 1 ? `Lanjut: ${LEVELS[S.levelIdx + 1].name} ▸` : 'Selesai ▸';
    if (S.levelIdx === LEVELS.length - 1) story += ' Dimas, staf shift malam, memindahkan belasan pallet saat truk Toshiba menumpuk di receiving — dan lupa scan. Ia sendiri yang menulis catatan "D." agar barangnya bisa dilacak. Moral gudang: setiap perpindahan, scan. Selisih ditutup, auditor pulang puas.';
    const b = prog.best[L.id];
    if (!b || total > b.score) prog.best[L.id] = { score: total, stars: Math.max(stars, b ? b.stars : 0) };
    else if (stars > b.stars) b.stars = stars;
    prog.unlocked = Math.max(prog.unlocked, Math.min(3, L.id + 1)); saveProg();
    Sound.win();
  } else { story += ' Auditor sudah menunggu. Coba lagi — kali ini mulai dari catatan di lokasi sistem.'; Sound.lose(); }
  S.fail = { win, nextLabel };
  ui.renderResult({ win, title: win ? `${L.name} — Selesai` : `${L.name} — Gagal`, stars, story, rows, nextLabel });
  ui.renderLevels(LEVELS, prog, (i) => openBrief(i));
  env.setHover(null);
  setMode('result');
}

/* ------------------------------------------------------------ input */
function readMove() {
  const k = (c) => (keys.has(c) ? 1 : 0);
  let fwd = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'), strafe = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
  fwd += -S.joy.y; strafe += S.joy.x;
  return { fwd: Math.max(-1, Math.min(1, fwd)), strafe: Math.max(-1, Math.min(1, strafe)), run: keys.has('ShiftLeft') || keys.has('ShiftRight') || S.touchRun };
}

let drag = null;
function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    keys.add(e.code);
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (S.mode === 'dialog') { if (['KeyE', 'Space', 'Enter'].includes(e.code)) advanceDialog(); else if (e.code === 'Escape') { S.dlg.i = S.dlg.lines.length - 1; advanceDialog(); } return; }
    if (S.mode === 'paused') { if (e.code === 'Escape' || e.code === 'Enter') resume(); return; }
    if (S.mode !== 'play') return;
    switch (e.code) {
      case 'KeyE': interact(); break;
      case 'KeyF': doConfirm(); break;
      case 'KeyQ': doRadar(); break;
      case 'Tab': case 'KeyN': toggleOverlay('notebook'); break;
      case 'KeyM': toggleOverlay('map'); break;
      case 'KeyU': ui.toast(Sound.toggle() ? 'Suara dimatikan' : 'Suara dinyalakan', '', 1500); break;
      case 'KeyH': $('#helpbar').classList.toggle('fade'); break;
      case 'Escape': if (S.overlay) closeOverlay(); else if (!S.locked) pause(); break;
      default:
        if (/^Digit[1-5]$/.test(e.code)) selectCase(+e.code.slice(5));
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('pointerlockchange', () => {
    S.locked = document.pointerLockElement === canvas;
    if (S.locked) S.usedLock = true;
    else if (S.usedLock && (S.mode === 'play' || S.mode === 'dialog')) pause();
  });
  window.addEventListener('mousemove', (e) => {
    if (S.mode !== 'play' || S.overlay) return;
    if (S.locked) player.look(e.movementX, e.movementY);
    else if (drag) { player.look(e.movementX, e.movementY, 0.004); drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); }
  });
  window.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('button, .sheet, .screen')) return;
    Sound.unlock();
    if (S.mode === 'dialog') { advanceDialog(); return; }
    if (S.mode !== 'play' || S.overlay || e.button !== 0) return;
    if (S.locked) doScan(); else drag = { moved: 0 };
  });
  window.addEventListener('mouseup', () => { if (drag) { if (drag.moved < 5 && S.mode === 'play') doScan(); drag = null; } });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  $('#btn-start').addEventListener('click', startPlay);
  $('#btn-back').addEventListener('click', () => { applyAtmos('day'); setMode('title'); });
  $('#btn-resume').addEventListener('click', resume);
  $('#btn-quit').addEventListener('click', () => { closeOverlay(); applyAtmos('day'); setMode('title'); });
  $('#btn-next').addEventListener('click', () => { if (S.fail && S.fail.win && S.levelIdx < LEVELS.length - 1) openBrief(S.levelIdx + 1); else { applyAtmos('day'); setMode('title'); } });
  $('#btn-retry').addEventListener('click', () => openBrief(S.levelIdx));
  $('#btn-menu').addEventListener('click', () => { applyAtmos('day'); setMode('title'); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
}

/* kontrol sentuh */
function initTouch() {
  S.touch = window.matchMedia('(pointer: coarse)').matches || /[?&]touch/.test(location.search);
  if (!S.touch) return;
  const joy = $('#joy'), knob = $('i', joy); let jid = null, lid = null, lx = 0, ly = 0;
  const jmove = (e) => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    S.joy.x = dx; S.joy.y = dy; knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); Sound.unlock(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e); });
  const jend = (e) => { if (e.pointerId === jid) { jid = null; S.joy.x = S.joy.y = 0; knob.style.transform = ''; } };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  canvas.addEventListener('pointerdown', (e) => { if (lid === null && S.mode === 'play') { lid = e.pointerId; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(lid); } else if (S.mode === 'dialog') advanceDialog(); });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId === lid) { player.look(e.clientX - lx, e.clientY - ly, 0.0042); lx = e.clientX; ly = e.clientY; } });
  const lend = (e) => { if (e.pointerId === lid) lid = null; };
  canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
  const act = { scan: doScan, confirm: doConfirm, use: interact, radar: doRadar, notes: () => toggleOverlay('notebook'), map: () => toggleOverlay('map'), run: () => { S.touchRun = !S.touchRun; } };
  $$('#tbtns button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.unlock(); act[b.dataset.act](); b.style.opacity = b.dataset.act === 'run' && S.touchRun ? 0.6 : 1; }));
}

/* ------------------------------------------------------------ loop */
let last = 0, fpsAcc = 0, fpsN = 0, qualT = 0;
const DIRN = [];

function frame(ts) {
  requestAnimationFrame(frame);
  const now = ts / 1000; let dt = Math.min(0.05, last ? now - last : 0.016); last = now;
  S.clock += dt;
  const live = S.mode === 'play' || S.mode === 'dialog';
  const active = S.mode === 'play' && !S.overlay;

  if (live || S.mode === 'paused') {
    if (active) {
      S.t += dt;
      const o = player.update(dt, readMove(), true);
      if (o.step) Sound.step(player.running);
      if (o.hit) onForkHit(o.hit);
      if (S.L.limit && S.t >= S.L.limit) { finishLevel(false, 'Waktu habis sebelum semua SKU ketemu.'); return render(); }
    } else if (S.mode === 'dialog') player.update(dt, { fwd: 0, strafe: 0, run: false }, false);
    playerCam();
  } else attractCam(S.clock);

  const frozen = S.mode === 'paused';
  const info = frozen ? { nearestForklift: 99 } : env.update(dt, S.clock, player);
  if (active) gameTick(dt, info);
  render();
  adaptQuality(dt);
}

function render() {
  eng.render(cam, S.clock);
}

function gameTick(dt, info) {
  // forklift mengalah pada pejalan kaki di depannya
  for (const f of env.forklifts) {
    const dx = player.x - f.x, dz = player.z - f.z, d = Math.hypot(dx, dz);
    if (d < S.L.yield && d > 0.01 && (dx * Math.sin(f.heading) + dz * -Math.cos(f.heading)) / d > 0.2) f.wait = Math.max(f.wait, 0.4);
  }
  const nf = info.nearestForklift;
  const w = $('#warn-fork'); w.classList.toggle('on', nf < 7.5);
  if (nf < 9 && S.t - S.hornT > 6) { S.hornT = S.t; Sound.horn(); }

  // pemindaian arah pandang
  const f = player.forward(), ey = player.eyeY();
  S.hover = pickSlot(player.x, ey, player.z, f[0], f[1], f[2]);
  env.setHover(S.hover ? S.hover.slot : null);
  const cr = $('#crosshair'); cr.classList.toggle('hit', !!S.hover && !S.hover.empty); cr.classList.toggle('empty', !!S.hover && S.hover.empty);
  ui.setText($('#hover-tag'), S.hover ? world.describe(S.hover.slot).short + (S.hover.empty ? ' · KOSONG' : '') : '');
  if (S.scanSlot && S.t - S.scanT > 8) { ui.hideScan(); S.scanSlot = null; }

  // prompt
  const npc = nearNpc(), note = npc ? null : nearNote();
  let p = '';
  if (npc) p = `<kbd>E</kbd> ${npc.id === 'hendra' && S.reportReady ? 'Lapor selesai ke' : 'Bicara dengan'} ${(NPC_INFO[npc.id] || npc).name}`;
  else if (note) p = '<kbd>E</kbd> Baca catatan';
  else if (S.hover) p = S.scanned.has(S.hover.slot.id) && !S.hover.empty ? '<kbd>F</kbd> Konfirmasi pallet · <kbd>Klik</kbd> pindai ulang' : '<kbd>Klik</kbd> Pindai';
  const pe = $('#prompt'); if (p !== S.lastPrompt) { S.lastPrompt = p; pe.innerHTML = p; } pe.classList.toggle('on', !!p);

  if (S.ping) { S.ping.life += dt; if (S.ping.life > S.ping.ttl) S.ping = null; }

  // HUD teks (throttle)
  S.hudT -= dt;
  if (S.hudT <= 0) {
    S.hudT = 0.1;
    const L = S.L, tt = L.limit ? Math.max(0, L.limit - S.t) : S.t;
    ui.setText($('#timer b'), `${pad2(Math.floor(tt / 60))}:${pad2(Math.floor(tt % 60))}`);
    $('#timer').classList.toggle('low', !!L.limit && tt < 60);
    ui.setText($('#score b'), String(liveScore()));
    ui.setText($('#safety b'), '♥'.repeat(S.safety) + '♡'.repeat(3 - S.safety)); $('#safety').classList.toggle('low', S.safety <= 1);
    const blk = world.blockOf(player.x, player.z), wh = blk ? null : world.where(player.x, player.z);
    ui.setText($('#zone'), blk || (wh ? `Rak ${wh.code} · Bay ${pad2(wh.bay)} · ${BLOCKS[wh.grp].split(' · ')[0]}` : 'Lorong utama'));
    let obj;
    if (S.reportReady) {
      const h = env.npcs.find((n) => n.id === 'hendra'), d = Math.round(Math.hypot(h.x - player.x, h.z - player.z));
      obj = `Lapor ke <b>Pak Hendra</b> di Kantor Opname · ${d} m`;
    } else {
      const c = S.cases.find((q) => q.id === S.selected && !q.done) || S.cases.find((q) => !q.done);
      obj = c ? `Cari <b>${c.sku}</b> · lot <b>${c.lot}</b> · mulai dari ${c.sysText}` : '';
    }
    ui.setHTML($('#objective'), obj);
  }
  if (S.overlay === 'map') mapView.drawFull($('#bigmap-canvas'), mapState());
  mapView.drawMini($('#minimap'), mapState());
}

function mapState() {
  return { px: player.x, pz: player.z, yaw: player.yaw, npcs: env.npcs, forklifts: env.forklifts, notes: S.mission.notes, showNotes: S.L.assist, cases: S.cases, sel: S.selected, ping: S.ping };
}

function onForkHit(f) {
  S.safety = Math.max(0, S.safety - 1); S.penalty += 50;
  Sound.hit(); Sound.horn(); ui.flash();
  ui.toast(S.safety ? `Tertabrak forklift! Nilai K3 −1 (sisa ${S.safety}). −50` : 'Insiden K3 fatal!', 'bad', 3800);
  if (!S.safety) setTimeout(() => { if (S.mode === 'play') finishLevel(false, 'Insiden K3: nilai keselamatan habis, shift dihentikan.'); }, 600);
}

/* kualitas adaptif: turunkan resolusi render bila FPS rendah */
function adaptQuality(dt) {
  fpsAcc += dt; fpsN++; qualT += dt;
  if (qualT < 2.5) return;
  const avg = fpsAcc / fpsN; fpsAcc = 0; fpsN = 0; qualT = 0;
  if (S.mode === 'paused') return;
  if (avg > 0.03 && eng.scale > 0.5) { eng.scale = Math.max(0.5, +(eng.scale - 0.1).toFixed(2)); resize(); }
  else if (avg < 0.0175 && eng.scale < 1) { eng.scale = Math.min(1, +(eng.scale + 0.05).toFixed(2)); resize(); }
}

window.__GAME = { S, get world() { return world; }, get env() { return env; }, get player() { return player; }, get eng() { return eng; }, LEVELS, openBrief, startPlay, finishLevel, doScan, doConfirm, interact, pickSlot, cam };
boot();
