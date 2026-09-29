// Konfigurasi global frontend
// Saat deploy ke Vercel, backend FastAPI ada di path /api pada domain yang sama,
// jadi API_BASE_URL dikosongkan (relative path). Untuk development lokal dengan
// backend berjalan di port berbeda, ubah sesuai kebutuhan.
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:8000"
  : "";
