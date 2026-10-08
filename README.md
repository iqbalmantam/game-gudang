# OPNAME — Misteri Barang Hilang (Game Gudang 3D)

Game 3D first-person bertema **Stock Opname / Item Hunt**. Kamu staf opname di Gudang JDC:
sistem bilang barang ada, tapi slot rak kosong. Lacak SKU + lot yang hilang di labirin rak sebelum auditor tiba.

Layout rak (A01–A14, B01–B14, C01–C10, D01–D09, jumlah level, blok client) diambil dari peta 3D
[Rak-JDC-View](https://iqbalmantam.github.io/Rak-JDC-View/). Rak diisi pallet/karton/drum per client dengan barcode & label.

## Cara main
- 3 shift: **Pagi** (3 SKU), **Siang** (4 SKU, forklift), **Malam** (5 SKU, gelap, tanpa bantuan scanner).
- Mulai dari lokasi sistem (titik merah di peta) → baca catatan & tanya rekan kerja → temukan pallet fisik.
- Aturan opname: **PINDAI** dulu, cocokkan **SKU dan lot**, baru **KONFIRMASI**. Awas pallet SKU sama lot beda.
- Lapor ke Pak Hendra di kantor setelah semua barang ketemu. Skor: akurasi, kecepatan, K3 (hindari forklift).

| Tombol | Fungsi |
|---|---|
| WASD / Shift | jalan / lari |
| Mouse + klik | arahkan & pindai |
| F | konfirmasi pallet |
| E | bicara / baca catatan |
| Q | radar (−75 poin) |
| M / Tab | peta / buku catatan |
| Esc | jeda · U suara |

Layar sentuh: joystick dan tombol di layar.

## Menjalankan
Tanpa build — file statis (WebGL2, ES modules). Buka lewat server lokal, mis. `python3 -m http.server`
lalu `http://localhost:8000`, atau aktifkan GitHub Pages. Tambahkan `?unlock` untuk membuka semua shift.
