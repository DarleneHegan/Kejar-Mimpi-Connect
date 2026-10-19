// Logic halaman utama: list & filter event publik.

let allEvents = [];
let activeCategory = "";
let searchTimeout = null;

// Palet warna kategori (badge di kartu + titik di chip filter). Kategori lain dapat warna otomatis.
const CATEGORY_PALETTE = [
  { badge: "bg-rose-100 text-rose-700", dot: "#e11d48" },
  { badge: "bg-amber-100 text-amber-700", dot: "#d97706" },
  { badge: "bg-sky-100 text-sky-700", dot: "#0284c7" },
  { badge: "bg-violet-100 text-violet-700", dot: "#7c3aed" },
  { badge: "bg-emerald-100 text-emerald-700", dot: "#059669" },
  { badge: "bg-orange-100 text-orange-700", dot: "#ea580c" },
];
const CATEGORY_FIXED = { Workshop: 0, Seminar: 3, Webinar: 2, Lomba: 1, Sosial: 4 };

function categoryStyle(category) {
  if (category in CATEGORY_FIXED) return CATEGORY_PALETTE[CATEGORY_FIXED[category]];
  let hash = 0;
  for (const ch of String(category)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRegistrationOpen(event) {
  const isFull = event.quota && event.registered_count >= event.quota;
  const isPast = new Date(event.start_time) < new Date();
  return !event.is_closed && !isFull && !isPast;
}

function renderEventCard(event, index) {
  const isFull = event.quota && event.registered_count >= event.quota;
  const spotsLeft = event.quota ? Math.max(event.quota - event.registered_count, 0) : null;
  const date = new Date(event.start_time);
  const day = date.toLocaleDateString("id-ID", { day: "2-digit" });
  const month = date.toLocaleDateString("id-ID", { month: "short" });
  const pct = event.quota ? Math.min(100, Math.round((event.registered_count / event.quota) * 100)) : 0;
  const barClass = pct >= 100 ? "is-full" : pct >= 75 ? "is-warn" : "";
  const title = escapeHtml(event.title);

  const statusText = event.is_closed
    ? "Pendaftaran ditutup"
    : event.quota ? (isFull ? "Kuota penuh" : `${spotsLeft} slot tersisa`) : "Slot tidak terbatas";
  const statusColor = isFull || event.is_closed ? "text-gray-400" : "text-emerald-600";

  return `
  <a href="/event-detail.html?id=${encodeURIComponent(event.id)}" class="event-card group reveal" style="--reveal-delay:${(index % 3) * 80}ms">
    <div class="event-card-media">
      ${event.image_url
        ? `<img src="${escapeHtml(event.image_url)}" alt="${title}" loading="lazy" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/400x240/C8102E/ffffff?text=Event';" />`
        : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C8102E] via-[#e8384f] to-[#8a0b20] text-white text-4xl font-extrabold">${escapeHtml(event.title.charAt(0))}</div>`
      }
      ${event.category ? `<span class="absolute top-3 left-3 z-[1] text-xs font-bold px-2.5 py-1 rounded-full ${categoryStyle(event.category).badge}">${escapeHtml(event.category)}</span>` : ""}
      ${event.is_closed
        ? `<span class="absolute top-3 right-3 z-[1] text-xs font-bold px-2.5 py-1 rounded-full bg-gray-900/80 text-white backdrop-blur">Pendaftaran Ditutup</span>`
        : isFull ? `<span class="absolute top-3 right-3 z-[1] text-xs font-bold px-2.5 py-1 rounded-full bg-gray-900/80 text-white backdrop-blur">Kuota Penuh</span>` : ""}
      <span class="date-badge"><span class="date-badge-day">${day}</span><span class="date-badge-month">${month}</span></span>
    </div>
    <div class="p-5 flex flex-col flex-1">
      <h3 class="font-bold text-gray-800 text-lg leading-snug mb-2 line-clamp-2 group-hover:text-[#C8102E] transition-colors">${title}</h3>
      <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-500 mb-3">
        <span class="inline-flex items-center gap-1.5">
          <svg class="w-4 h-4 text-[#C8102E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ${formatDateOnly(event.start_time)}
        </span>
        ${event.location ? `
        <span class="inline-flex items-center gap-1.5 min-w-0">
          <svg class="w-4 h-4 text-[#C8102E] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span class="line-clamp-1">${escapeHtml(event.location)}</span>
        </span>` : ""}
      </div>
      <p class="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">${escapeHtml(event.description || "")}</p>
      ${event.quota ? `<div class="quota-bar mb-3" aria-hidden="true"><span class="${barClass}" style="width:${pct}%"></span></div>` : ""}
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold ${statusColor}">${statusText}</span>
        <span class="event-card-arrow" aria-hidden="true">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </span>
        <span class="sr-only">Lihat Detail</span>
      </div>
    </div>
  </a>`;
}

function renderCategoryFilters() {
  const categories = [...new Set(allEvents.map((e) => e.category).filter(Boolean))];
  const container = document.getElementById("category-filters");

  const chips = ["Semua", ...categories];
  container.innerHTML = chips
    .map((cat) => {
      const isActive = (cat === "Semua" && !activeCategory) || cat === activeCategory;
      const value = cat === "Semua" ? "" : cat;
      const count = cat === "Semua" ? allEvents.length : allEvents.filter((e) => e.category === cat).length;
      const dot = cat === "Semua"
        ? ""
        : `<span class="cat-chip-dot" style="background:${isActive ? "#fff" : categoryStyle(cat).dot}"></span>`;
      return `<button type="button" data-category="${escapeHtml(value)}" aria-pressed="${isActive}" class="cat-chip ${isActive ? "is-active" : ""}">
        ${dot}${escapeHtml(cat)}<span class="text-xs ${isActive ? "text-white/80" : "text-gray-400"}">${count}</span>
      </button>`;
    })
    .join("");

  container.querySelectorAll(".cat-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderCategoryFilters();
      applyFilters();
    });
  });
}

function renderStats() {
  const categories = new Set(allEvents.map((e) => e.category).filter(Boolean));
  document.getElementById("stat-events").textContent = allEvents.length;
  document.getElementById("stat-open").textContent = allEvents.filter(isRegistrationOpen).length;
  document.getElementById("stat-categories").textContent = categories.size;
}

function applyFilters() {
  const searchTerm = document.getElementById("search-input").value.trim().toLowerCase();
  let filtered = allEvents;

  if (activeCategory) {
    filtered = filtered.filter((e) => e.category === activeCategory);
  }
  if (searchTerm) {
    filtered = filtered.filter((e) => e.title.toLowerCase().includes(searchTerm));
  }

  renderEventGrid(filtered);
}

function renderEventGrid(events) {
  const grid = document.getElementById("event-grid");
  const emptyState = document.getElementById("empty-state");
  const countLabel = document.getElementById("event-count");

  countLabel.textContent = `${events.length} event`;

  if (events.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.classList.add("flex");
    return;
  }

  emptyState.classList.add("hidden");
  emptyState.classList.remove("flex");
  grid.innerHTML = events.map(renderEventCard).join("");
  observeReveal(grid);
}

async function loadEvents() {
  const loadingState = document.getElementById("loading-state");
  try {
    allEvents = await fetchEvents();
    // Urutkan event yang belum lewat waktunya di depan.
    allEvents.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  } catch (err) {
    showToast(err.message || "Gagal memuat daftar event", "error");
    allEvents = [];
  } finally {
    loadingState.classList.add("hidden");
  }
  renderStats();
  renderCategoryFilters();
  applyFilters();
}

document.addEventListener("DOMContentLoaded", () => {
  mountLayout({ activePage: "home" });
  loadEvents();

  document.getElementById("search-input").addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 250);
  });
});
