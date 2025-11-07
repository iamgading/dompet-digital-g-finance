# G-Finance

G-Finance adalah dasbor finansial pribadi (PWA) berbasis Next.js yang membantu mencatat pemasukan, pengeluaran, transfer antar "pocket", mengelola recurring, backup terenkripsi, laporan keuangan, serta kontrol keamanan via PIN/passkey. Proyek dibangun dengan fokus mobile-first, sinkron Supabase, offline-first, dan multi bahasa (ID/EN).

## Tech Stack

| Layer | Teknologi |
| --- | --- |
| Framework | Next.js 14 (App Router, Server Actions) + React 18 |
| Bahasa | TypeScript |
| UI | Tailwind CSS, Radix UI (Dialog/Dropdown/Popover/Tooltip/Progress), Lucide Icons |
| Charting | Recharts |
| State/Storage | Dexie (IndexedDB) untuk offline queue, useTransition hooks |
| BaaS/DB | Supabase (Postgres, `@supabase/supabase-js`), Prisma ORM |
| Keamanan | bcryptjs (PIN), @simplewebauthn (WebAuthn/passkey) |
| PWA | next-pwa (service worker, offline shell) |
| Export | pdfkit (laporan PDF), CSV built-in |
| Utilitas | class-variance-authority, clsx, next-themes, Papaparse, Zod, date-fns |
| Testing | Vitest + React Testing Library |
| Build Tools | ESLint, Tailwind CLI, tsx, ts-node |

## Fitur Utama

1. **Dashboard & Pocket Insight**
   - Total saldo, kartu pocket dengan drag-and-drop reorder, Quick Add dialog.
   - Insight otomatis, riwayat transaksi collapsible, cashflow chart dengan filter rentang.
   - Pocket insight drawer (klik nama pocket) menampilkan statistik, catatan, quick action (transaksi/transfer).

2. **Cashflow Calendar**
   - Halaman `/calendar` menampilkan agenda recurring, payday, dan pengeluaran besar per tanggal.

3. **Transaksi & Import**
   - Quick Add (dialog/inline), transfer antar pocket, import CSV (Papaparse) dengan preview dan validasi.
   - Offline queue (Dexie) menyimpan transaksi saat terputus, otomatis sinkron saat online.

4. **Recurring Automation**
   - CRUD jadwal recurring (mingguan/bulanan) dan jalankan manual.

5. **Backup & Restore Terenkripsi**
   - Backup `.gfin.json` via AES-GCM dengan passphrase; restore mode replace/merge.

6. **Laporan Keuangan**
   - Ekspor CSV & PDF (pdfkit) via `/api/reports/financial` dengan filter tanggal/format.

7. **Keamanan**
   - PIN (bcryptjs) + passkey WebAuthn dengan security gate overlay, dukungan WebAuthn challenge/responses.

8. **Bahasa & Tema**
   - Toggle bahasa ID/EN dan theme (system/light/dark), preferensi disimpan di Supabase `UserPref`.

9. **PWA & Offline**
   - Service worker (next-pwa), offline shell, Dexie queue.

10. **Backup/Debug Tools**
    - Halaman `/settings/backup`, `/debug/db`, integrasi `pdfkit` untuk PDF backup/report.

## Penting: Variabel Lingkungan

Buat `.env` berdasarkan `.env.example`. Variabel utama:

```env
DATABASE_URL=postgres://... (pooled, wajib)
DIRECT_URL=postgres://... (opsional)
SHADOW_DATABASE_URL=postgres://... (opsional)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Opsional untuk WebAuthn:
WEBAUTHN_RP_ID=localhost
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

## Setup Database Lokal

```bash
npm install
npm run migrate:deploy
npm run db:seed
```

Seed menambahkan profil "Pribadi" dan pocket default (Tabungan, Kebutuhan Pokok, Invest, E-Money).

## Menjalankan Aplikasi

```bash
npm run dev       # development server
npm run lint      # verifikasi linting
npm run test      # Vitest
npm run build && npm run start   # production build
```

## UAT Checklist Lokal

1. Jalankan migrasi + seed.
2. `npm run dev` lalu uji alur lengkap: tambah transaksi, transfer, recurring, import CSV, backup/restore, laporan.
3. Cek data di Supabase (opsi: `/debug/db`).
4. Uji offline mode (matikan jaringan, Quick Add tetap menyimpan dan sinkron otomatis).
5. Aktifkan PIN/passkey dan pastikan lock overlay bekerja.

## Deploy ke Vercel

1. Push repo & hubungkan ke Vercel.
2. Set environment variables (DATABASE_URL, DIRECT_URL, SHADOW_DATABASE_URL, SUPABASE creds, dll).
3. Setelah build pertama (atau saat ada schema baru), jalankan migrasi + seed terhadap database production:

```bash
npm run migrate:deploy
npm run db:seed
```

Dapat dijalankan dari lokal dengan koneksi DB prod atau via workflow CI.

## Struktur Direktori

```
app/            # App Router pages, server components, routes
components/     # Reusable components (pockets, transactions, settings, shared UI)
hooks/          # Reusable hooks (sync queue, use-i18n, dll)
lib/            # Helper (supabase client, analytics repo, i18n, validators)
prisma/         # schema.prisma, migrations, seed.cjs
public/         # assets (logo, icons, manifest, sw)
tests/          # Vitest tests
```

## Kontribusi & Tips

- Gunakan `npm run lint` sebelum commit.
- Kalau update schema Prisma: jalankan `npx prisma migrate dev`, commit migration, update seed bila perlu.
- Untuk menambah terjemahan, gunakan helper `t("key", "fallback")` di komponen dan tambahkan string di `lib/i18n.ts`.
- Logo baru disimpan di `public/logo-g.svg` & `public/icons/icon.svg`.

Selamat menggunakan G-Finance! Bila menemukan issue/fitur baru, tinggal lanjutkan 🚀
