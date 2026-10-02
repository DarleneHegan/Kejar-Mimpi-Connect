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
  const confirmed = currentRegistrations.filter((r) => r.status === "confirmed");
  const checkedIn = confirmed.filter((r) => r.is_checked_in).length;
  const notCheckedIn = confirmed.length - checkedIn;
  const rate = confirmed.length > 0 ? Math.round((checkedIn / confirmed.length) * 100) : 0;

  const icons = {
    users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    check: "M5 13l4 4L19 7",
    clock: "M12 8v4l2 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z",
    chart: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  };
  const cards = [
    { label: "Total Pendaftar", value: total, badge: "bg-gray-100 text-gray-600", icon: icons.users },
    { label: "Sudah Hadir", value: checkedIn, badge: "bg-green-100 text-green-600", icon: icons.check },
    { label: "Belum Hadir", value: notCheckedIn, badge: "bg-amber-100 text-amber-600", icon: icons.clock },
    { label: "Tingkat Kehadiran", value: `${rate}%`, badge: "bg-red-50 text-[#C8102E]", icon: icons.chart },
  ];

  document.getElementById("stats-cards").innerHTML = cards
    .map(
      (c) => `
    <div class="admin-card p-5">
      <div class="flex items-center gap-3">
        <div class="admin-icon-badge ${c.badge}">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${c.icon}" /></svg>
        </div>
        <div>
          <p class="text-xs text-gray-400">${c.label}</p>
          <p class="text-2xl font-extrabold text-gray-800">${c.value}</p>
        </div>
      </div>
    </div>`
    )
    .join("");
}

function registrationStatusBadge(reg) {
  if (reg.status === "pending") {
    return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Menunggu Approval</span>`;
  }
  if (reg.status === "rejected") {
    return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">Ditolak</span>`;
  }
  return reg.is_checked_in
    ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Hadir</span>`
    : `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Belum Hadir</span>`;
}

function renderReportRow(reg) {
  return `
  <tr>
    <td class="px-5 py-3.5 font-medium text-gray-800">${reg.full_name}</td>
    <td class="px-5 py-3.5 text-gray-600">${reg.email}</td>
    <td class="px-5 py-3.5 text-gray-600">${reg.phone || "-"}</td>
    <td class="px-5 py-3.5 text-gray-500">${formatDateTime(reg.created_at)}</td>
    <td class="px-5 py-3.5">${registrationStatusBadge(reg)}</td>
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
