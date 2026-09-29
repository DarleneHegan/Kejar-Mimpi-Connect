// Logic halaman laporan peserta per event.

let selectedEventId = "";
let selectedEventTitle = "";
let currentRegistrations = [];
let reportSearchTimeout = null;

async function loadEventOptions() {
  const select = document.getElementById("event-select");
  try {
    const events = await fetchEventsAdmin();
    events.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    if (events.length === 0) {
      select.innerHTML = `<option value="">Belum ada event</option>`;
      return;
    }

    select.innerHTML =
      `<option value="">-- Pilih Event --</option>` +
      events
        .map((e) => `<option value="${e.id}" data-title="${e.title}">${e.title} (${formatDateOnly(e.start_time)})</option>`)
        .join("");
  } catch (err) {
    showToast(err.message || "Gagal memuat daftar event", "error");
  }
}

function renderStatsCards() {
  const total = currentRegistrations.length;
  const checkedIn = currentRegistrations.filter((r) => r.is_checked_in).length;
  const notCheckedIn = total - checkedIn;
  const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  const cards = [
    { label: "Total Pendaftar", value: total, color: "text-gray-800" },
    { label: "Sudah Hadir", value: checkedIn, color: "text-green-600" },
    { label: "Belum Hadir", value: notCheckedIn, color: "text-amber-600" },
    { label: "Tingkat Kehadiran", value: `${rate}%`, color: "text-[#C8102E]" },
  ];

  document.getElementById("stats-cards").innerHTML = cards
    .map(
      (c) => `
    <div class="bg-white rounded-2xl border border-gray-100 p-5">
      <p class="text-xs text-gray-400 mb-1">${c.label}</p>
      <p class="text-2xl font-extrabold ${c.color}">${c.value}</p>
    </div>`
    )
    .join("");
}

function renderReportRow(reg) {
  return `
  <tr>
    <td class="px-5 py-3.5 font-medium text-gray-800">${reg.full_name}</td>
    <td class="px-5 py-3.5 text-gray-600">${reg.email}</td>
    <td class="px-5 py-3.5 text-gray-600">${reg.phone || "-"}</td>
    <td class="px-5 py-3.5 text-gray-500">${formatDateTime(reg.created_at)}</td>
    <td class="px-5 py-3.5">
      ${
        reg.is_checked_in
          ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Hadir</span>`
          : `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Belum Hadir</span>`
      }
    </td>
    <td class="px-5 py-3.5 text-gray-500">${reg.checked_in_at ? formatDateTime(reg.checked_in_at) : "-"}</td>
  </tr>`;
}

async function loadReport() {
  const searchTerm = document.getElementById("search-input").value.trim();
  try {
    currentRegistrations = await fetchRegistrationsForEvent(selectedEventId, searchTerm);
  } catch (err) {
    showToast(err.message || "Gagal memuat laporan", "error");
    currentRegistrations = [];
  }

  document.getElementById("result-count").textContent = `${currentRegistrations.length} peserta ditemukan`;
  document.getElementById("report-table-body").innerHTML = currentRegistrations.map(renderReportRow).join("");
  renderStatsCards();
}

function exportToCsv() {
  if (currentRegistrations.length === 0) {
    showToast("Tidak ada data untuk diexport", "error");
    return;
  }

  const headers = ["Nama", "Email", "No. HP", "Waktu Daftar", "Status", "Waktu Check-in"];
  const rows = currentRegistrations.map((r) => [
    r.full_name,
    r.email,
    r.phone || "",
    formatDateTime(r.created_at),
    r.is_checked_in ? "Hadir" : "Belum Hadir",
    r.checked_in_at ? formatDateTime(r.checked_in_at) : "",
  ]);

  const escapeCsvField = (field) => `"${String(field).replace(/"/g, '""')}"`;
  const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-peserta-${selectedEventTitle.replace(/\s+/g, "-").toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function handleEventSelectChange() {
  const select = document.getElementById("event-select");
  selectedEventId = select.value;
  selectedEventTitle = select.selectedOptions[0]?.dataset.title || "";

  const wrap = document.getElementById("report-table-wrap");
  const noEventState = document.getElementById("no-event-state");
  const statsCards = document.getElementById("stats-cards");

  if (!selectedEventId) {
    wrap.classList.add("hidden");
    statsCards.classList.add("hidden");
    noEventState.classList.remove("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  statsCards.classList.remove("hidden");
  noEventState.classList.add("hidden");
  document.getElementById("search-input").value = "";
  loadReport();
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "reports" });
  loadEventOptions();

  document.getElementById("event-select").addEventListener("change", handleEventSelectChange);
  document.getElementById("search-input").addEventListener("input", () => {
    clearTimeout(reportSearchTimeout);
    reportSearchTimeout = setTimeout(() => {
      if (selectedEventId) loadReport();
    }, 300);
  });
  document.getElementById("export-csv-btn").addEventListener("click", exportToCsv);
});
