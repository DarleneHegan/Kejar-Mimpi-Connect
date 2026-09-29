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

// ---------- Cari nama manual ----------
function renderSearchResultItem(reg) {
  return `
  <div class="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100">
    <div class="min-w-0">
      <p class="font-medium text-gray-800 text-sm truncate">${reg.full_name}</p>
      <p class="text-xs text-gray-400 truncate">${reg.email}</p>
    </div>
    ${
      reg.is_checked_in
        ? `<span class="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Sudah Hadir</span>`
        : `<button data-checkin-id="${reg.id}" class="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#C8102E] hover:bg-[#a10d25] text-white">Tandai Hadir</button>`
    }
  </div>`;
}

async function refreshSearchResults() {
  const searchTerm = document.getElementById("search-name-input").value.trim();
  const resultsContainer = document.getElementById("search-results");

  if (!selectedEventId) return;

  try {
    const registrations = await fetchRegistrationsForEvent(selectedEventId, searchTerm);
    if (registrations.length === 0) {
      resultsContainer.innerHTML = `<p class="text-sm text-gray-400 text-center py-6">Tidak ada peserta ditemukan</p>`;
      return;
    }
    resultsContainer.innerHTML = registrations.map(renderSearchResultItem).join("");

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
  } catch (err) {
    showToast(err.message || "Gagal memuat data peserta", "error");
  }
}

async function handleEventSelectChange() {
  selectedEventId = document.getElementById("event-select").value;
  const panels = document.getElementById("checkin-panels");
  const noEventState = document.getElementById("no-event-state");

  await stopScanning();

  if (!selectedEventId) {
    panels.classList.add("hidden");
    noEventState.classList.remove("hidden");
    return;
  }

  panels.classList.remove("hidden");
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
    searchTimeout = setTimeout(refreshSearchResults, 300);
  });

  document.getElementById("result-close-btn").addEventListener("click", closeResultModal);

  window.addEventListener("beforeunload", () => {
    if (isScanning) stopScanning();
  });
});
