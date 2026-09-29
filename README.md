# EventHub - Sistem Pendaftaran Event & Absensi Komunitas

Aplikasi web untuk publikasi event komunitas, pendaftaran peserta (menggantikan Google Form), dan absensi hari-H via QR code (menggantikan pencatatan manual).

**Stack:**
- Backend: FastAPI (Python) + SQLAlchemy + PostgreSQL (Supabase)
- Frontend: HTML + CSS (Tailwind via CDN) + JavaScript (vanilla, tanpa framework)
- Deploy: Vercel (serverless function untuk backend via Mangum adapter, static hosting untuk frontend)
- Tema warna: merah CIMB Niaga (`#C8102E`)

---

## Fitur

**Publik (tanpa akun):**
- Melihat daftar event komunitas dengan pencarian & filter kategori
- Melihat detail event
- Mendaftar event via form sederhana (nama, email, no HP)
- Mendapat QR code tiket sebagai bukti pendaftaran (bisa di-download)

**Admin (butuh login):**
- Kelola event (buat, edit, hapus, publish/draft)
- Absensi hari-H: scan QR code peserta via kamera, input manual kode tiket, atau cari nama peserta
- Laporan peserta per event: daftar peserta, status hadir/belum, export CSV

---

## Struktur Project

```
Vibecoding/
├── api/                        # Backend FastAPI
│   ├── main.py                 # Entry point + Mangum handler untuk Vercel
│   ├── database.py             # Koneksi SQLAlchemy (Postgres/Supabase, fallback SQLite lokal)
│   ├── models.py                # Model: Admin, Event, Registration
│   ├── schemas.py               # Pydantic schemas request/response
│   ├── auth.py                  # JWT + bcrypt untuk admin
│   ├── utils.py                  # Generator QR code base64
│   ├── seed_admin.py             # Script buat tabel + akun admin pertama
│   └── routers/
│       ├── auth_router.py        # POST /api/auth/login
│       ├── events_router.py      # CRUD event
│       ├── registrations_router.py  # Pendaftaran peserta + laporan
│       └── checkin_router.py     # Absensi check-in
├── public/                     # Frontend static
│   ├── index.html               # Halaman utama (daftar event)
│   ├── event-detail.html        # Detail event + form daftar
│   ├── confirmation.html        # Konfirmasi + QR code
│   ├── admin-login.html         # Login admin
│   ├── admin/
│   │   ├── dashboard.html       # Kelola event
│   │   ├── checkin.html         # Absensi hari-H
│   │   └── reports.html         # Laporan peserta
│   ├── css/styles.css
│   └── js/
│       ├── config.js             # Konfigurasi API base URL
│       ├── api.js                 # Wrapper fetch API
│       ├── components.js          # Navbar, sidebar admin, toast, helper format
│       └── pages/                 # Logic tiap halaman
├── requirements.txt
├── vercel.json                  # Konfigurasi routing Vercel
└── .env.example                 # Contoh environment variables
```

---

## Setup Lokal

### 1. Buat virtual environment & install dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Konfigurasi environment variables

Copy `.env.example` menjadi `.env`, lalu isi:

```
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:5432/postgres
JWT_SECRET_KEY=ganti-dengan-string-random-panjang
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=password-yang-aman
```

Untuk development cepat tanpa Supabase dulu, `DATABASE_URL` boleh dikosongkan/dihapus dari `.env` — sistem otomatis fallback ke SQLite lokal (`local_dev.db`).

### 3. Setup Supabase (database gratis)

1. Buat akun di [supabase.com](https://supabase.com) dan buat project baru (gratis)
2. Masuk ke **Project Settings > Database > Connection string**, pilih mode **Session** (bukan Transaction), copy connection string URI
3. Ganti `[YOUR-PASSWORD]` dengan password database yang kamu set saat buat project
4. Paste ke `DATABASE_URL` di file `.env`

### 4. Buat tabel & akun admin pertama

```powershell
python -m api.seed_admin
```

Script ini akan membuat semua tabel (jika belum ada) dan satu akun admin dari `ADMIN_EMAIL` / `ADMIN_PASSWORD` di `.env`.

### 5. Jalankan backend

```powershell
uvicorn api.main:app --reload --port 8000
```

Backend akan berjalan di `http://127.0.0.1:8000`. Cek `http://127.0.0.1:8000/docs` untuk dokumentasi API interaktif (Swagger UI).

### 6. Jalankan frontend

Frontend adalah file static biasa. Buka folder `public/` dengan live server, contoh pakai Python:

```powershell
python -m http.server 3000 --directory public
```

Lalu buka `http://localhost:3000` di browser. File `public/js/config.js` otomatis mengarahkan API call ke `http://127.0.0.1:8000` saat diakses dari localhost.

---

## Deploy ke Vercel

1. Push project ini ke repository Git (GitHub/GitLab/Bitbucket)
2. Buat akun di [vercel.com](https://vercel.com) (gratis) dan import repository tersebut
3. Di halaman **Environment Variables** saat setup project, tambahkan:
   - `DATABASE_URL` — connection string Supabase (wajib, karena Vercel serverless tidak punya filesystem persisten untuk SQLite)
   - `JWT_SECRET_KEY` — string random yang panjang dan rahasia
   - `JWT_ALGORITHM` — `HS256`
   - `JWT_EXPIRE_MINUTES` — `720` (atau sesuai kebutuhan)
4. Deploy. Vercel otomatis mendeteksi `vercel.json` untuk routing `/api/*` ke FastAPI (via Mangum) dan sisanya ke file static di `public/`
5. Setelah deploy pertama berhasil, jalankan seed admin **sekali** dari lokal dengan `DATABASE_URL` yang sama (arahkan ke Supabase production), supaya tabel dan akun admin pertama terbuat di database production:

   ```powershell
   $env:DATABASE_URL="postgresql://..."; python -m api.seed_admin
   ```

6. Akses domain Vercel yang diberikan (misal `https://eventhub-komunitas.vercel.app`)

**Catatan keamanan:** ganti `ADMIN_PASSWORD` default segera setelah deploy pertama, dan jangan commit file `.env` ke repository (sudah ada di `.gitignore`).

---

## Alur Penggunaan

**Peserta:**
1. Buka halaman utama, cari/pilih event
2. Klik event, isi form pendaftaran (nama, email, no HP)
3. Setelah submit, langsung diarahkan ke halaman konfirmasi berisi QR code tiket
4. Download/screenshot QR code tersebut

**Panitia (hari-H):**
1. Login di `/admin-login.html`
2. Buka menu **Absensi Hari-H**, pilih event yang sedang berlangsung
3. Scan QR code peserta pakai kamera, atau ketik kode tiket manual, atau cari nama peserta dari daftar
4. Sistem otomatis menandai hadir dan mencegah double check-in

**Admin (kelola event):**
1. Login, buka menu **Kelola Event**
2. Buat event baru (judul, deskripsi, lokasi, tanggal, kuota, URL gambar, kategori)
3. Publish event agar tampil di halaman publik
4. Lihat laporan peserta & tingkat kehadiran di menu **Laporan Peserta**, bisa export ke CSV

---

## Catatan Teknis

- **QR code**: berisi `ticket_token` (UUID unik per pendaftaran), digenerate sebagai gambar PNG base64 langsung di response API, tidak disimpan sebagai file (cocok untuk environment serverless Vercel yang read-only filesystem)
- **Gambar event**: menggunakan URL eksternal (bukan upload file), karena Vercel serverless tidak punya storage persisten. Untuk kebutuhan upload file di masa depan, bisa ditambahkan integrasi Supabase Storage
- **Autentikasi**: JWT dengan expiry (default 720 menit / 12 jam), password admin di-hash dengan bcrypt
- **Database connection pooling**: dikonfigurasi kecil (`pool_size=1`) khusus untuk kondisi serverless supaya tidak membuka terlalu banyak koneksi ke Supabase
