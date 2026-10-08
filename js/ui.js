/* ui.js — pembantu DOM: HUD, toast, dialog, buku catatan, layar */
import { CUST } from './data.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cache = new Map();
export function setText(node, v) { if (cache.get(node) !== v) { cache.set(node, v); node.textContent = v; } }
export function setHTML(node, v) { if (cache.get(node) !== v) { cache.set(node, v); node.innerHTML = v; } }
export function toggle(node, on) { node.classList.toggle('hidden', !on); }

/* ---------- toast ---------- */
export function toast(msg, kind = '', ms = 3400) {
  const box = $('#toasts'), t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 450);
}
export function flash() { const f = $('#flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

/* ---------- layar ---------- */
const SCREENS = ['loading', 'title', 'brief', 'pause', 'result', 'error'];
export function showScreen(name) { for (const s of SCREENS) toggle($('#screen-' + s), s === name); }

/* ---------- panel kasus ---------- */
export function renderCases(cases, sel) {
  const html = cases.map((c) => `<li class="${c.done ? 'done' : ''} ${c.id === sel && !c.done ? 'sel' : ''}">
    <span class="n">${c.done ? '✔' : c.id}</span>
    <div><div class="sku">${esc(c.sku)}</div><div class="nm">${esc(c.name)}</div>
    <div class="meta">Lot <b>${esc(c.lot)}</b> · ${c.qty} ${esc(c.unit)}</div></div></li>`).join('');
  setHTML($('#case-list'), html);
}

/* ---------- kartu hasil pindai ---------- */
export function showScan(info) {
  const c = $('#scan-card'); c.classList.remove('hidden');
  $('.sc-loc', c).textContent = info.loc;
  const st = $('.sc-state', c); st.textContent = info.empty ? 'KOSONG' : 'TERBACA'; st.classList.toggle('empty', !!info.empty);
  $('.sc-sku', c).textContent = info.empty ? '— — —' : info.sku;
  $('.sc-name', c).textContent = info.empty ? 'Tidak ada pallet di slot ini' : info.name;
  $('.sc-client', c).textContent = info.empty ? '-' : info.client;
  $('.sc-lot', c).textContent = info.empty ? '-' : info.lot;
  $('.sc-qty', c).textContent = info.empty ? '-' : `${info.qty} ${info.unit}`;
  $('.sc-match', c).innerHTML = (info.lines || []).map((l) => `<div class="${l.k}">${esc(l.t)}</div>`).join('');
}
export function hideScan() { $('#scan-card').classList.add('hidden'); }

/* ---------- dialog ---------- */
export function showDialog(name, role, text, note) {
  const d = $('#dialog'); d.classList.remove('hidden'); d.classList.toggle('note', !!note);
  $('#dlg-name').textContent = name; $('#dlg-role').textContent = role; $('#dlg-text').textContent = text;
}
export function hideDialog() { $('#dialog').classList.add('hidden'); }

/* ---------- buku catatan ---------- */
const FIELDS = [['block', 'BLOK'], ['client', 'CLIENT'], ['rack', 'RAK'], ['side', 'SISI'], ['bay', 'BAY'], ['level', 'LEVEL']];
export function renderNotebook(cases, clues) {
  const html = cases.map((c) => {
    const mine = clues.filter((q) => q.caseId === c.id);
    const cells = FIELDS.map(([k, label]) => `<div class="${c.known[k] ? 'k' : ''}"><small>${label}</small><b>${esc(c.known[k] || '?')}</b></div>`).join('');
    const list = mine.length ? mine.map((q) => `<div class="clue">${esc(q.text)}<em>${esc(q.from)}</em></div>`).join('') : '<div class="nb-empty">Belum ada petunjuk. Mulai dari lokasi sistem.</div>';
    return `<section class="nb-case ${c.done ? 'done' : ''}"><h3><span class="n">${c.done ? '✔' : c.id}</span>${esc(c.sku)} · lot ${esc(c.lot)}</h3>
      <div class="nb-sub">${esc(c.name)} — ${esc(c.client)} · ${c.qty} ${esc(c.unit)} · sistem: ${esc(c.sysText)}</div>
      <div class="deduce">${cells}</div>${list}</section>`;
  }).join('');
  $('#nb-body').innerHTML = html;
}

/* ---------- legenda peta ---------- */
export function renderLegend() {
  $('#legend').innerHTML = CUST.map((c) => `<span><i style="background:${c.color}"></i>${esc(c.name)}</span>`).join('')
    + '<span><i style="background:#8c949c"></i>Umum / campur</span><span><i style="background:#59626c"></i>Racking baru (kosong)</span>';
}

/* ---------- briefing & hasil ---------- */
export function renderBrief(level, cases) {
  $('#brief-tag').textContent = `SHIFT ${level.id} · ${cases.length} KASUS`;
  $('#brief-title').textContent = `${level.name} — ${level.sub}`;
  $('#brief-text').innerHTML = level.brief.map((p) => `<p>${esc(p)}</p>`).join('');
  $('#brief-table tbody').innerHTML = cases.map((c) => `<tr><td><b>${c.id}</b></td><td class="mono"><b>${esc(c.sku)}</b><br>${esc(c.name)} <span style="color:#93a6bf">· ${esc(c.client)}</span></td>
    <td class="mono">${esc(c.lot)}</td><td>${c.qty} ${esc(c.unit)}</td><td>${esc(c.sysText)}<br><span style="color:#ff8e8e">slot kosong — selisih</span></td></tr>`).join('');
}
export function renderResult(r) {
  $('#res-tag').textContent = r.win ? 'KASUS SELESAI' : 'SHIFT GAGAL';
  $('#res-title').textContent = r.title;
  $('#res-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('');
  $('#res-story').textContent = r.story;
  $('#res-table tbody').innerHTML = r.rows.map((x) => `<tr class="${x.tot ? 'tot' : ''}"><td>${esc(x.label)}</td><td class="${x.neg ? 'neg' : ''}">${esc(x.value)}</td></tr>`).join('');
  const nx = $('#btn-next'); nx.textContent = r.nextLabel; nx.classList.toggle('hidden', !r.nextLabel);
}
export function renderLevels(levels, prog, onPick) {
  const box = $('#level-btns'); box.innerHTML = '';
  for (const L of levels) {
    const b = document.createElement('button'); b.className = 'lvbtn';
    const open = L.id <= prog.unlocked, best = prog.best[L.id];
    b.disabled = !open;
    b.innerHTML = `<small>SHIFT ${L.id}</small><b>${esc(L.name)}</b><span>${esc(L.sub)} · ${L.cases} SKU${L.limit ? ' · ' + Math.round(L.limit / 60) + ' menit' : ''}</span>
      ${best ? `<span class="stars">${'★'.repeat(best.stars)}</span>` : open ? '' : '<span class="stars">🔒</span>'}`;
    b.addEventListener('click', () => onPick(L.id - 1));
    box.appendChild(b);
  }
  const bests = levels.filter((L) => prog.best[L.id]).map((L) => `Shift ${L.id}: ${prog.best[L.id].score}`).join(' · ');
  $('#best').textContent = bests ? `Skor terbaik — ${bests}` : 'Selesaikan Shift 1 untuk membuka Shift 2 dan 3.';
}
