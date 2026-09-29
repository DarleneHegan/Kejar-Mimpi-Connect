// Logic halaman utama: list & filter event publik.

let allEvents = [];
let activeCategory = "";
let searchTimeout = null;

const CATEGORY_COLORS = {
  Workshop: "bg-blue-100 text-blue-700",
  Seminar: "bg-purple-100 text-purple-700",
  Webinar: "bg-teal-100 text-teal-700",
  Lomba: "bg-amber-100 text-amber-700",
  Sosial: "bg-green-100 text-green-700",
};

function categoryBadgeClass(category) {
  return CATEGORY_COLORS[category] || "bg-gray-100 text-gray-700";
}

function renderEventCard(event) {
  const isFull = event.quota && event.registered_count >= event.quota;
  const spotsLeft = event.quota ? Math.max(event.quota - event.registered_count, 0) : null;

  return `
  <a href="/event-detail.html?id=${event.id}" class="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col">
    <div class="relative h-44 bg-gray-100 overflow-hidden">
      ${event.image_url
        ? `<img src="${event.image_url}" alt="${event.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null;this.src='https://placehold.co/400x240/C8102E/ffffff?text=Event';" />`
        : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C8102E] to-[#8a0b20] text-white text-2xl font-bold">${event.title.charAt(0)}</div>`
      }
      ${event.category ? `<span class="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full ${categoryBadgeClass(event.category)}">${event.category}</span>` : ""}
      ${isFull ? `<span class="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 text-white">Kuota Penuh</span>` : ""}
    </div>
    <div class="p-5 flex flex-col flex-1">
      <h3 class="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-[#C8102E] transition-colors">${event.title}</h3>
      <div class="text-sm text-gray-500 flex items-center gap-1.5 mb-1.5">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span>${formatDateOnly(event.start_time)}</span>
      </div>
      ${event.location ? `
      <div class="text-sm text-gray-500 flex items-center gap-1.5 mb-3">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <span class="line-clamp-1">${event.location}</span>
      </div>` : '<div class="mb-3"></div>'}
      <p class="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">${event.description || ""}</p>
      <div class="flex items-center justify-between pt-3 border-t border-gray-100">
        <span class="text-xs font-medium ${isFull ? 'text-gray-400' : 'text-green-600'}">
          ${event.quota ? (isFull ? 'Kuota penuh' : `${spotsLeft} slot tersisa`) : 'Slot tidak terbatas'}
        </span>
        <span class="text-sm font-semibold text-[#C8102E] group-hover:underline">Lihat Detail &rarr;</span>
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
      return `<button data-category="${value}" class="category-chip px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
        isActive
          ? "bg-[#C8102E] text-white border-[#C8102E]"
          : "bg-white text-gray-600 border-gray-200 hover:border-[#C8102E] hover:text-[#C8102E]"
      }">${cat}</button>`;
    })
    .join("");

  container.querySelectorAll(".category-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderCategoryFilters();
      applyFilters();
    });
  });
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
