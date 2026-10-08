/* items.js — katalog barang per client, pembuat SKU/lot, RNG berbenih */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];

/* jenis tampilan barang di atas pallet */
export const KIND = { CARTON: 0, DRUM: 1, SACK: 2, WRAP: 3, PAINT: 4, BOX: 5 };
export const KIND_H = [1.1, 0.92, 1.12, 1.22, 0.86, 1.25]; // tinggi barang (m) di atas pallet

/* product: [nama, satuan, qtyMin, qtyMax] */
const DEFS = {
  'ECOLAB': { prefix: 'ECO', kinds: [KIND.DRUM, KIND.CARTON], products: [
    ['Sanitizer Permukaan 20L', 'jerigen', 24, 48], ['Detergen Industri 25kg', 'sak', 30, 60],
    ['Pembersih Lantai 5L', 'dus', 40, 96], ['Disinfektan Hand Rub 10L', 'jerigen', 30, 72], ['Degreaser Dapur 20L', 'jerigen', 24, 48]] },
  'OATSIDE & LAMIPACK': { prefix: 'OLP', kinds: [KIND.CARTON, KIND.WRAP], products: [
    ['Oat Milk Original 1L', 'dus', 60, 120], ['Oat Milk Barista 1L', 'dus', 60, 120],
    ['Kemasan Laminasi Roll A4', 'roll', 20, 40], ['Karton Pack Susu 1L', 'bundle', 40, 80]] },
  'OATSIDE': { prefix: 'OAT', kinds: [KIND.CARTON, KIND.WRAP], products: [
    ['Oat Milk Cokelat 1L', 'dus', 60, 120], ['Oat Milk Vanilla 1L', 'dus', 60, 120], ['Oat Milk Unsweetened 1L', 'dus', 60, 120]] },
  'YOKE F&N': { prefix: 'YKE', kinds: [KIND.CARTON, KIND.SACK], products: [
    ['Mi Instan Goreng', 'dus', 80, 160], ['Saus Sambal 5kg', 'dus', 30, 60],
    ['Bumbu Dasar Putih 1kg', 'dus', 50, 100], ['Kerupuk Udang 500g', 'dus', 60, 120]] },
  'JOTUN': { prefix: 'JTN', kinds: [KIND.PAINT, KIND.CARTON], products: [
    ['Cat Tembok Putih 20L', 'ember', 24, 36], ['Cat Tembok Biru 20L', 'ember', 24, 36], ['Cat Besi Anti Karat 4L', 'kaleng', 80, 120],
    ['Thinner Super 18L', 'jerigen', 24, 40], ['Cat Kayu Vernis 4L', 'kaleng', 80, 120], ['Cat Genteng Merah 20L', 'ember', 24, 36]] },
  'MONDE': { prefix: 'MON', kinds: [KIND.CARTON, KIND.WRAP], products: [
    ['Biskuit Serena 12x', 'dus', 50, 100], ['Wafer Cokelat 24x', 'dus', 50, 100], ['Crackers Keju 20x', 'dus', 50, 100]] },
  'VIVERE': { prefix: 'VIV', kinds: [KIND.CARTON, KIND.WRAP], products: [
    ['Sabun Cair 1L', 'dus', 40, 90], ['Sampo Herbal 750ml', 'dus', 40, 90], ['Lotion Tubuh 500ml', 'dus', 40, 90]] },
  'TOSHIBA': { prefix: 'TSB', kinds: [KIND.BOX, KIND.WRAP], products: [
    ['Kulkas 2 Pintu 320L', 'unit', 6, 10], ['AC Split 1PK', 'unit', 10, 16], ['Mesin Cuci 8kg', 'unit', 8, 12],
    ['TV LED 43 inch', 'unit', 10, 18], ['Rice Cooker 1.8L', 'dus', 20, 40]] },
  'OSRAM & TRAXON': { prefix: 'OSR', kinds: [KIND.BOX, KIND.CARTON], products: [
    ['Lampu LED 12W Box', 'dus', 60, 120], ['Downlight Panel 18W', 'dus', 40, 80], ['Strip LED 5m', 'dus', 40, 80], ['Kabel Ballast 1.5mm', 'roll', 20, 40]] },
  'DAELIM': { prefix: 'DLM', kinds: [KIND.WRAP, KIND.DRUM], products: [
    ['Pipa PE 110mm', 'bundle', 10, 20], ['Resin Polietilen 25kg', 'sak', 40, 60], ['Katup Industri DN50', 'dus', 20, 40], ['Sambungan Flange DN80', 'dus', 20, 40]] },
  'CJ FOOD LESTARI': { prefix: 'CJF', kinds: [KIND.CARTON, KIND.SACK], products: [
    ['Bumbu Serbaguna 1kg', 'dus', 40, 80], ['Minyak Wijen 1L', 'dus', 40, 80], ['Dumpling Beku 1kg', 'dus', 30, 60], ['Saus Gochujang 2kg', 'dus', 30, 60]] },
  'CJI': { prefix: 'CJI', kinds: [KIND.SACK, KIND.CARTON], products: [
    ['Pakan Ternak 25kg', 'sak', 40, 60], ['Premix Vitamin 20kg', 'sak', 40, 60], ['Pakan Ikan Pelet 20kg', 'sak', 40, 60]] },
  'SHKKEVA': { prefix: 'SHK', kinds: [KIND.WRAP, KIND.CARTON], products: [
    ['Sparepart Mesin Tipe A', 'dus', 10, 30], ['Bearing Industri 6205', 'dus', 30, 60], ['Filter Oli Heavy Duty', 'dus', 30, 60]] },
  GENERIC: { prefix: 'GEN', kinds: [KIND.CARTON, KIND.WRAP, KIND.SACK, KIND.BOX], products: [
    ['Barang Umum Campur', 'dus', 20, 60], ['Pallet Retur', 'pcs', 10, 30], ['Kemasan Kosong', 'bundle', 20, 40], ['Material Packing', 'roll', 10, 30]] },
};
export const defFor = (name) => DEFS[name] || DEFS.GENERIC;

export function newLot(r) {
  const yy = rint(r, 25, 26), mm = rint(r, 1, 12);
  return `L${yy}${String(mm).padStart(2, '0')}-${String.fromCharCode(65 + rint(r, 0, 25))}${rint(r, 1, 9)}`;
}
export function kindFor(r, clientName) {
  const d = defFor(clientName);
  return r() < 0.72 ? d.kinds[0] : d.kinds[1 % d.kinds.length];
}
/* barang acak untuk satu client */
export function makeItem(r, clientName) {
  const d = defFor(clientName), pIdx = Math.floor(r() * d.products.length), p = d.products[pIdx];
  return itemOf(r, d, pIdx, clientName);
}
export function itemOf(r, d, pIdx, clientName) {
  const p = d.products[pIdx];
  return {
    client: clientName || 'UMUM', prefix: d.prefix, pIdx,
    sku: `${d.prefix}-${1100 + pIdx * 37}`, name: p[0], unit: p[1],
    qty: rint(r, p[2], p[3]), lot: newLot(r),
  };
}
