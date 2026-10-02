// Logic halaman absensi Hari-H: scan QR code + cari nama manual.

let selectedEventId = "";
let html5QrCode = null;
let isScanning = false;
let searchTimeout = null;

async function loadEventOptions() {
  const select = document.getElementById("event-select");
  try {
    const events = await fetchEventsAdmin();
    events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    if (events.length === 0) {
      select.innerHTML = `<option value="">Belum ada event</option>`;
      return;
    }

    select.innerHTML =
      `<option value="">-- Pilih Event --</option>` +
      events
        .map((e) => `<option value="${e.id}">${e.title} (${formatDateOnly(e.start_time)})</option>`)
        .join("");
  } catch (err) {
    showToast(err.message || "Gagal memuat daftar event", "error");
  }
}

function showResultModal({ success, title, message }) {
  const icon = document.getElementById("result-icon");
  const titleEl = document.getElementById("result-title");
  const messageEl = document.getElementById("result-message");

  icon.className = `w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
    success ? "bg-green-100" : "bg-red-100"
  }`;
  icon.innerHTML = success
    ? `<svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`
    : `<svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;

  titleEl.textContent = title;
  messageEl.textContent = message;
  document.getElementById("result-modal").classList.remove("hidden");
}

function closeResultModal() {
  document.getElementById("result-modal").classList.add("hidden");
}

async function processCheckIn(ticketToken) {
  try {
    const result = await checkInByToken(ticketToken);
    showResultModal({
      success: result.success,
      title: result.success ? "Check-in Berhasil" : "Sudah Check-in",
      message: result.message,
    });
    if (result.success) {
      refreshSearchResults();
    }
  } catch (err) {
    showResultModal({
      success: false,
      title: "Gagal Check-in",
      message: err.message || "Terjadi kesalahan",
    });
  }
}

// ---------- Scan QR ----------
function startScanning() {
  const qrRegionId = "qr-reader";
  html5QrCode = new Html5Qrcode(qrRegionId);

  html5QrCode
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        await stopScanning();
        processCheckIn(decodedText);
      },
      () => {} // ignore scan failure per-frame
    )
    .then(() => {
      isScanning = true;
      document.getElementById("toggle-scan-btn").textContent = "Hentikan Scan";
    })
    .catch((err) => {
      showToast("Gagal mengakses kamera: " + (err.message || err), "error");
    });
}

async function stopScanning() {
  if (html5QrCode && isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {
      // ignore
    }
  }
  isScanning = false;
  document.getElementById("toggle-scan-btn").textContent = "Mulai Scan";
}

async function toggleScanning() {
  if (isScanning) {
    await stopScanning();
  } else {
    startScanning();
  }
}

// ---------- Daftar peserta (tab + search) ----------
let allConfirmed = [];
let activeTab = "absent";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

const AVATAR_COLORS = [
  "from-rose-500 to-red-600",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-pink-400 to-fuchsia-500",
];
function avatarColor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function renderSearchResultItem(reg) {
  const meta = reg.is_checked_in && reg.checked_in_at
    ? `Hadir ${formatDateTime(reg.checked_in_at)}`
    : escapeHtml(reg.email);
  return `
  <div class="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
    <div class="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br ${avatarColor(reg.full_name)} text-white text-sm font-bold flex items-center justify-center shadow-sm">
      ${escapeHtml(initials(reg.full_name))}
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-gray-800 truncate">${escapeHtml(reg.full_name)}</p>
      <p class="text-xs text-gray-400 mt-0.5 truncate">${meta}</p>
    </div>
    ${
      reg.is_checked_in
        ? `<span class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-100 text-green-700">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
            Hadir
          </span>`
        : `<button data-checkin-id="${reg.id}" class="flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-xl bg-[#C8102E] hover:bg-[#a10d25] text-white">Tandai Hadir</button>`
    }
  </div>`;
}

function renderStats() {
  const total = allConfirmed.length;
  const present = allConfirmed.filter((r) => r.is_checked_in).length;
  const rate = total ? Math.round((present / total) * 100) : 0;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-present").textContent = present;
  document.getElementById("stat-rate-text").textContent = `${rate}%`;
  document.getElementById("stat-rate-bar").style.width = `${rate}%`;
  document.getElementById("stat-rate-hint").textContent = total
    ? `${total - present} peserta belum hadir`
    : "Belum ada peserta terkonfirmasi";
}

function renderTabs(lists) {
  document.querySelectorAll(".status-tab").forEach((tab) => {
    tab.setAttribute("aria-selected", tab.dataset.tab === activeTab ? "true" : "false");
  });
  document.querySelector('[data-tab-count="absent"]').textContent = lists.absent.length;
  document.querySelector('[data-tab-count="present"]').textContent = lists.present.length;
}

function renderList() {
  const term = document.getElementById("search-name-input").value.trim().toLowerCase();
  const matched = term
    ? allConfirmed.filter((r) => r.full_name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term))
    : allConfirmed;
  const lists = {
    absent: matched.filter((r) => !r.is_checked_in),
    present: matched.filter((r) => r.is_checked_in),
  };
  renderTabs(lists);
  renderStats();

  const rows = lists[activeTab];
  const resultsContainer = document.getElementById("search-results");
  document.getElementById("result-count").textContent = `${rows.length} peserta`;

  if (rows.length === 0) {
    const text = term
      ? `Tidak ada peserta dengan nama "${escapeHtml(term)}"`
      : activeTab === "absent" ? "Semua peserta sudah hadir" : "Belum ada peserta yang check-in";
    resultsContainer.innerHTML = `<p class="text-sm text-gray-400 text-center py-12">${text}</p>`;
    return;
  }
  resultsContainer.innerHTML = rows.map(renderSearchResultItem).join("");

  resultsContainer.querySelectorAll("[data-checkin-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "...";
      try {
        const result = await checkInManualById(btn.dataset.checkinId);
        showToast(result.message, result.success ? "success" : "error");
        refreshSearchResults();
      } catch (err) {
        showToast(err.message || "Gagal check-in", "error");
        btn.disabled = false;
        btn.textContent = "Tandai Hadir";
      }
    });
  });
}

async function refreshSearchResults() {
  if (!selectedEventId) return;
  try {
    allConfirmed = await fetchRegistrationsForEvent(selectedEventId, "", "confirmed");
    renderList();
  } catch (err) {
    showToast(err.message || "Gagal memuat data peserta", "error");
  }
}

async function handleEventSelectChange() {
  selectedEventId = document.getElementById("event-select").value;
  const panels = document.getElementById("checkin-panels");
  const stats = document.getElementById("stats-cards");
  const noEventState = document.getElementById("no-event-state");

  await stopScanning();

  if (!selectedEventId) {
    panels.classList.add("hidden");
    stats.classList.add("hidden");
    noEventState.classList.remove("hidden");
    return;
  }

  activeTab = "absent";
  allConfirmed = [];
  panels.classList.remove("hidden");
  stats.classList.remove("hidden");
  noEventState.classList.add("hidden");
  document.getElementById("search-name-input").value = "";
  refreshSearchResults();
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "checkin" });
  loadEventOptions();

  document.getElementById("event-select").addEventListener("change", handleEventSelectChange);
  document.getElementById("toggle-scan-btn").addEventListener("click", toggleScanning);

  document.getElementById("manual-token-submit").addEventListener("click", () => {
    const input = document.getElementById("manual-token-input");
    const token = input.value.trim();
    if (!token) return;
    processCheckIn(token);
    input.value = "";
  });

  document.getElementById("manual-token-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("manual-token-submit").click();
    }
  });

  document.getElementById("search-name-input").addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderList, 150);
  });

  document.querySelectorAll(".status-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      renderList();
    });
  });

  document.getElementById("result-close-btn").addEventListener("click", closeResultModal);

  window.addEventListener("beforeunload", () => {
    if (isScanning) stopScanning();
  });
});
