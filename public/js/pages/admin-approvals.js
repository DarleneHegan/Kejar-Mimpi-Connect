// Logic halaman approval peserta:
// - Tab status: Menunggu / Disetujui / Ditolak
// - Search nama, review detail (popup), approve/reject satuan maupun massal (checklist)
// - Penolakan wajib menyertakan remarks (catatan internal admin)

let allAdminEventsApproval = [];
let selectedEventIdApproval = "";
let selectedEventApproval = null;
let selectedEventFieldsApproval = [];
let allRegistrations = [];
let activeTab = "pending";
let selectedIds = new Set();
let approvalSearchTimeout = null;
let reviewRegistrationId = null;
let pendingBulkAction = null;

const EMPTY_TEXT = {
  pending: "Tidak ada pendaftar yang menunggu approval",
  confirmed: "Belum ada pendaftar yang disetujui",
  rejected: "Belum ada pendaftar yang ditolak",
};

function getEventIdFromQuery() {
  return new URLSearchParams(window.location.search).get("event_id");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
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

function registrationsInTab(tab = activeTab) {
  return allRegistrations.filter((r) => r.status === tab);
}

// ---------- Event & statistik ----------
async function loadEventOptionsApproval() {
  const select = document.getElementById("event-select");
  try {
    allAdminEventsApproval = await fetchEventsAdmin();
    allAdminEventsApproval.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    if (allAdminEventsApproval.length === 0) {
      select.innerHTML = `<option value="">Belum ada event</option>`;
      return;
    }

    select.innerHTML =
      `<option value="">-- Pilih Event --</option>` +
      allAdminEventsApproval
        .map(
          (e) =>
            `<option value="${e.id}">${escapeHtml(e.title)} (${formatDateOnly(e.start_time)})${
              e.requires_approval ? (e.pending_count ? ` • ${e.pending_count} menunggu` : "") : " - tanpa approval"
            }</option>`
        )
        .join("");

    const preselect = getEventIdFromQuery();
    if (preselect && allAdminEventsApproval.some((e) => e.id === preselect)) {
      select.value = preselect;
      await handleEventSelectChangeApproval();
    }
  } catch (err) {
    showToast(err.message || "Gagal memuat daftar event", "error");
  }
}

function renderStats() {
  const ev = selectedEventApproval;
  if (!ev) return;
  document.getElementById("stat-pending").textContent = ev.pending_count;
  document.getElementById("stat-confirmed").textContent = ev.registered_count;

  const bar = document.getElementById("stat-quota-bar");
  const text = document.getElementById("stat-quota-text");
  const hint = document.getElementById("stat-quota-hint");

  if (ev.quota) {
    const pct = Math.min(100, Math.round((ev.registered_count / ev.quota) * 100));
    const remaining = Math.max(0, ev.quota - ev.registered_count);
    bar.style.width = `${pct}%`;
    bar.className = `h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
      pct >= 100 ? "from-red-500 to-[#C8102E]" : pct >= 80 ? "from-amber-400 to-orange-500" : "from-green-500 to-emerald-400"
    }`;
    text.textContent = `${ev.registered_count}/${ev.quota}`;
    hint.textContent = remaining > 0
      ? `Sisa ${remaining} slot. ${ev.pending_count <= remaining && ev.pending_count > 0 ? "Semua pendaftar pending masih muat." : ""}`
      : "Slot sudah penuh.";
  } else {
    bar.style.width = "100%";
    bar.className = "h-full rounded-full bg-gradient-to-r from-gray-300 to-gray-200";
    text.textContent = "Tanpa batas";
    hint.textContent = "Event ini tidak membatasi jumlah peserta.";
  }
}

async function refreshSelectedEvent() {
  try {
    selectedEventApproval = await fetchEventDetail(selectedEventIdApproval);
    renderStats();
  } catch (e) {
    // abaikan, statistik saja
  }
}

// ---------- Tabs ----------
function renderTabs() {
  document.querySelectorAll(".status-tab").forEach((tab) => {
    const isActive = tab.dataset.tab === activeTab;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  ["pending", "confirmed", "rejected"].forEach((status) => {
    document.querySelector(`[data-tab-count="${status}"]`).textContent = registrationsInTab(status).length;
  });
  // Checklist massal hanya relevan untuk tab Menunggu
  document.getElementById("select-all-wrap").classList.toggle("hidden", activeTab !== "pending");
}

function switchTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;
  selectedIds.clear();
  renderPendingList();
}

// ---------- List ----------
function renderRow(reg) {
  const isPending = reg.status === "pending";
  const checked = selectedIds.has(reg.id);

  let meta = `Daftar pada ${formatDateTime(reg.created_at)}`;
  if (reg.status === "confirmed" && reg.reviewed_at) meta += ` • Disetujui ${formatDateTime(reg.reviewed_at)}`;
  if (reg.status === "rejected" && reg.reviewed_at) meta += ` • Ditolak ${formatDateTime(reg.reviewed_at)}`;

  const remarksHtml =
    reg.status === "rejected"
      ? `<div class="mt-2 flex items-start gap-1.5 text-xs bg-red-50 border border-red-100 text-red-800 rounded-lg px-2.5 py-1.5">
          <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H11l-4 4z" /></svg>
          <span class="line-clamp-2"><span class="font-semibold">Remarks:</span> ${escapeHtml(reg.rejection_remarks || "-")}</span>
        </div>`
      : "";

  return `
  <div class="group flex items-center gap-4 px-5 py-3.5 transition-colors ${checked ? "bg-red-50/60" : "hover:bg-gray-50"}">
    ${
      isPending
        ? `<input type="checkbox" data-select="${reg.id}" ${checked ? "checked" : ""}
            class="w-5 h-5 rounded-md border-gray-300 text-[#C8102E] focus:ring-[#C8102E] cursor-pointer" aria-label="Pilih ${escapeHtml(reg.full_name)}" />`
        : ""
    }
    <div class="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br ${avatarColor(reg.full_name)} text-white text-sm font-bold flex items-center justify-center shadow-sm">
      ${escapeHtml(initials(reg.full_name))}
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-gray-800 truncate">${escapeHtml(reg.full_name)}</p>
      <p class="text-xs text-gray-400 mt-0.5">${meta}</p>
      ${remarksHtml}
    </div>
    <button data-review="${reg.id}" class="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 group-hover:border-[#C8102E] group-hover:text-[#C8102E] transition-colors">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      Review
    </button>
  </div>`;
}

function renderPendingList() {
  renderTabs();

  const body = document.getElementById("pending-list-body");
  const emptyState = document.getElementById("empty-pending-state");
  const searchTerm = document.getElementById("search-input").value.trim();
  const rows = registrationsInTab();

  document.getElementById("result-count").textContent = `${rows.length} pendaftar`;

  if (rows.length === 0) {
    body.innerHTML = "";
    document.getElementById("empty-pending-text").textContent = searchTerm
      ? `Tidak ada pendaftar dengan nama "${searchTerm}"`
      : EMPTY_TEXT[activeTab];
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    body.innerHTML = rows.map(renderRow).join("");

    body.querySelectorAll("[data-review]").forEach((btn) => {
      btn.addEventListener("click", () => openReviewModal(btn.dataset.review));
    });
    body.querySelectorAll("[data-select]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) selectedIds.add(cb.dataset.select);
        else selectedIds.delete(cb.dataset.select);
        renderPendingList();
      });
    });
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const selectAll = document.getElementById("select-all");
  const visibleIds = activeTab === "pending" ? registrationsInTab("pending").map((r) => r.id) : [];
  const selectedVisible = visibleIds.filter((id) => selectedIds.has(id)).length;

  selectAll.disabled = visibleIds.length === 0;
  selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
  selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;

  const bar = document.getElementById("bulk-bar");
  document.getElementById("bulk-count").textContent = selectedIds.size;
  const show = selectedIds.size > 0 && activeTab === "pending";
  bar.classList.toggle("translate-y-32", !show);
  bar.classList.toggle("opacity-0", !show);
  bar.classList.toggle("pointer-events-none", !show);
}

function handleSelectAll(e) {
  registrationsInTab("pending").forEach((r) => {
    if (e.target.checked) selectedIds.add(r.id);
    else selectedIds.delete(r.id);
  });
  renderPendingList();
}

function clearSelection() {
  selectedIds.clear();
  renderPendingList();
}

async function loadRegistrations() {
  const searchTerm = document.getElementById("search-input").value.trim();
  try {
    allRegistrations = await fetchRegistrationsForEvent(selectedEventIdApproval, searchTerm);
  } catch (err) {
    showToast(err.message || "Gagal memuat data pendaftar", "error");
    allRegistrations = [];
  }
  // Buang id terpilih yang sudah tidak pending lagi. Pilihan yang tersembunyi
  // karena filter search tetap dipertahankan.
  if (!searchTerm) {
    const validIds = new Set(registrationsInTab("pending").map((r) => r.id));
    selectedIds = new Set([...selectedIds].filter((id) => validIds.has(id)));
  }
  renderPendingList();
}

async function reloadAll() {
  await Promise.all([loadRegistrations(), refreshSelectedEvent()]);
}

// ---------- Bulk approve/reject ----------
function openBulkConfirm(action) {
  if (selectedIds.size === 0) return;
  pendingBulkAction = action;
  const n = selectedIds.size;
  const isApprove = action === "approve";

  const icon = document.getElementById("bulk-confirm-icon");
  icon.className = `w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${isApprove ? "bg-green-100 text-green-600" : "bg-red-100 text-[#C8102E]"}`;
  icon.innerHTML = isApprove
    ? `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`
    : `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;

  document.getElementById("bulk-confirm-title").textContent = isApprove ? `Setujui ${n} pendaftar?` : `Tolak ${n} pendaftar?`;
  document.getElementById("bulk-confirm-text").textContent = isApprove
    ? "Peserta yang disetujui akan langsung mendapatkan tiket QR."
    : "Peserta yang ditolak tidak bisa check-in. Remarks yang sama akan dicatat untuk semua pendaftar terpilih.";

  const warning = document.getElementById("bulk-confirm-warning");
  const ev = selectedEventApproval;
  if (isApprove && ev && ev.quota && ev.registered_count + n > ev.quota) {
    warning.textContent = `Perhatian: jumlah ini melebihi sisa slot (${Math.max(0, ev.quota - ev.registered_count)} slot tersisa dari kuota ${ev.quota}).`;
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
  }

  const remarksWrap = document.getElementById("bulk-remarks-wrap");
  remarksWrap.classList.toggle("hidden", isApprove);
  document.getElementById("bulk-remarks").value = "";

  const okBtn = document.getElementById("bulk-confirm-ok");
  okBtn.className = `flex-1 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 ${
    isApprove ? "bg-green-600 hover:bg-green-700" : "bg-[#C8102E] hover:bg-[#a10d25]"
  }`;
  okBtn.disabled = false;
  document.getElementById("bulk-confirm-ok-text").textContent = isApprove ? "Ya, setujui" : "Ya, tolak";
  document.getElementById("bulk-confirm-spinner").classList.add("hidden");
  document.getElementById("bulk-confirm-modal").classList.remove("hidden");
  if (!isApprove) document.getElementById("bulk-remarks").focus();
}

function closeBulkConfirm() {
  pendingBulkAction = null;
  document.getElementById("bulk-confirm-modal").classList.add("hidden");
}

async function executeBulkAction() {
  if (!pendingBulkAction) return;
  let remarks = null;
  if (pendingBulkAction === "reject") {
    remarks = document.getElementById("bulk-remarks").value.trim();
    if (remarks.length < 3) {
      showToast("Remarks alasan penolakan wajib diisi (minimal 3 karakter)", "error");
      document.getElementById("bulk-remarks").focus();
      return;
    }
  }

  const okBtn = document.getElementById("bulk-confirm-ok");
  okBtn.disabled = true;
  document.getElementById("bulk-confirm-spinner").classList.remove("hidden");

  try {
    const result = await bulkDecideRegistrations([...selectedIds], pendingBulkAction, remarks);
    showToast(result.message);
    selectedIds.clear();
    closeBulkConfirm();
    await reloadAll();
  } catch (err) {
    showToast(err.message || "Gagal memproses pendaftar", "error");
    okBtn.disabled = false;
    document.getElementById("bulk-confirm-spinner").classList.add("hidden");
  }
}

// ---------- Review popup ----------
function renderReviewItem(label, value) {
  const isEmpty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  const text = isEmpty ? "" : Array.isArray(value) ? value.join(", ") : String(value);
  const isUrl = /^https?:\/\/\S+$/i.test(text.trim());
  const valueHtml = isEmpty
    ? `<span class="text-gray-400 italic">Tidak diisi</span>`
    : isUrl
      ? `<a href="${escapeHtml(text.trim())}" target="_blank" rel="noopener noreferrer" class="text-[#C8102E] hover:underline break-all">${escapeHtml(text)}</a>`
      : `<span class="whitespace-pre-wrap break-words">${escapeHtml(text)}</span>`;

  return `
  <div>
    <p class="text-xs font-semibold text-gray-500 mb-1">${escapeHtml(label)}</p>
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800 select-text">${valueHtml}</div>
      ${isEmpty ? "" : `<button type="button" data-copy="${escapeHtml(text)}" class="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-[#C8102E] hover:text-[#C8102E]">Copy</button>`}
    </div>
  </div>`;
}

function renderStatusBanner(reg) {
  if (reg.status === "confirmed") {
    return `<div class="flex items-center gap-2 text-sm font-medium text-green-800 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
      <span class="w-2 h-2 rounded-full bg-green-500"></span> Disetujui${reg.reviewed_at ? ` pada ${formatDateTime(reg.reviewed_at)}` : ""}
    </div>`;
  }
  if (reg.status === "rejected") {
    return `<div class="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
      <p class="text-xs font-semibold text-[#C8102E] mb-1">Ditolak${reg.reviewed_at ? ` pada ${formatDateTime(reg.reviewed_at)}` : ""}</p>
      <p class="text-xs font-semibold text-gray-600">Remarks alasan penolakan</p>
      <p class="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">${escapeHtml(reg.rejection_remarks || "-")}</p>
    </div>`;
  }
  return "";
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const original = btn.textContent;
  btn.textContent = "Tersalin";
  setTimeout(() => (btn.textContent = original), 1200);
}

function showRejectForm(show) {
  document.getElementById("review-remarks-wrap").classList.toggle("hidden", !show);
  document.getElementById("review-reject-actions").classList.toggle("hidden", !show);
  document.getElementById("review-reject-actions").classList.toggle("flex", show);
  document.getElementById("review-actions").classList.toggle("hidden", show);
  document.getElementById("review-remarks-error").classList.add("hidden");
  if (show) document.getElementById("review-remarks").focus();
}

function openReviewModal(registrationId) {
  const reg = allRegistrations.find((r) => r.id === registrationId);
  if (!reg) return;
  reviewRegistrationId = registrationId;

  document.getElementById("review-name").textContent = reg.full_name;
  document.getElementById("review-time").textContent = `Daftar pada ${formatDateTime(reg.created_at)}`;

  const answers = reg.custom_answers || {};
  const items = [
    renderStatusBanner(reg),
    renderReviewItem("Nama Lengkap", reg.full_name),
    renderReviewItem("Email", reg.email),
    renderReviewItem("No. HP", reg.phone),
    ...selectedEventFieldsApproval.map((f) => renderReviewItem(f.label, answers[f.id])),
  ];
  const body = document.getElementById("review-body");
  body.innerHTML = items.join("");
  body.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.dataset.copy, btn));
  });

  // Atur tombol aksi sesuai status:
  // - pending: Tolak + Setujui
  // - rejected: hanya Setujui (review ulang, misal admin berubah keputusan)
  // - confirmed: hanya lihat data
  document.getElementById("review-remarks").value = "";
  showRejectForm(false);
  const actions = document.getElementById("review-actions");
  const rejectBtn = document.getElementById("review-reject-btn");
  const approveBtn = document.getElementById("review-approve-btn");
  actions.classList.toggle("hidden", reg.status === "confirmed");
  rejectBtn.classList.toggle("hidden", reg.status !== "pending");
  approveBtn.textContent = reg.status === "rejected" ? "Setujui Ulang" : "Setujui";

  setReviewButtonsDisabled(false);
  document.getElementById("review-modal").classList.remove("hidden");
}

function closeReviewModal() {
  reviewRegistrationId = null;
  document.getElementById("review-modal").classList.add("hidden");
}

function setReviewButtonsDisabled(disabled) {
  ["review-approve-btn", "review-reject-btn", "review-reject-confirm", "review-reject-cancel"].forEach((id) => {
    document.getElementById(id).disabled = disabled;
  });
}

async function handleReviewApprove() {
  if (!reviewRegistrationId) return;
  const id = reviewRegistrationId;
  setReviewButtonsDisabled(true);
  try {
    await approveRegistration(id);
    showToast("Pendaftar berhasil disetujui");
    selectedIds.delete(id);
    closeReviewModal();
    await reloadAll();
  } catch (err) {
    showToast(err.message || "Gagal menyetujui pendaftar", "error");
    setReviewButtonsDisabled(false);
  }
}

async function handleReviewRejectConfirm() {
  if (!reviewRegistrationId) return;
  const remarks = document.getElementById("review-remarks").value.trim();
  if (remarks.length < 3) {
    document.getElementById("review-remarks-error").classList.remove("hidden");
    document.getElementById("review-remarks").focus();
    return;
  }
  const id = reviewRegistrationId;
  setReviewButtonsDisabled(true);
  try {
    await rejectRegistration(id, remarks);
    showToast("Pendaftar ditolak");
    selectedIds.delete(id);
    closeReviewModal();
    await reloadAll();
  } catch (err) {
    showToast(err.message || "Gagal menolak pendaftar", "error");
    setReviewButtonsDisabled(false);
  }
}

// ---------- Pilih event ----------
async function handleEventSelectChangeApproval() {
  selectedEventIdApproval = document.getElementById("event-select").value;
  selectedIds.clear();
  activeTab = "pending";

  const wrap = document.getElementById("pending-list-wrap");
  const stats = document.getElementById("stats-cards");
  const noEventState = document.getElementById("no-event-state");
  const noApprovalNeeded = document.getElementById("no-approval-needed");

  wrap.classList.add("hidden");
  stats.classList.add("hidden");
  noApprovalNeeded.classList.add("hidden");
  noApprovalNeeded.classList.remove("flex");
  updateSelectionUI();

  if (!selectedEventIdApproval) {
    noEventState.classList.remove("hidden");
    return;
  }
  noEventState.classList.add("hidden");

  selectedEventApproval = allAdminEventsApproval.find((e) => e.id === selectedEventIdApproval) || null;
  if (selectedEventApproval && !selectedEventApproval.requires_approval) {
    noApprovalNeeded.classList.remove("hidden");
    noApprovalNeeded.classList.add("flex");
    return;
  }

  try {
    selectedEventFieldsApproval = await fetchEventFormFields(selectedEventIdApproval);
  } catch (err) {
    selectedEventFieldsApproval = [];
  }

  stats.classList.remove("hidden");
  wrap.classList.remove("hidden");
  renderStats();
  document.getElementById("search-input").value = "";
  loadRegistrations();
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "approvals" });
  loadEventOptionsApproval();

  document.getElementById("event-select").addEventListener("change", handleEventSelectChangeApproval);
  document.getElementById("select-all").addEventListener("change", handleSelectAll);
  document.querySelectorAll(".status-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
  document.getElementById("search-input").addEventListener("input", () => {
    clearTimeout(approvalSearchTimeout);
    approvalSearchTimeout = setTimeout(() => {
      if (selectedEventIdApproval) loadRegistrations();
    }, 300);
  });

  document.getElementById("bulk-clear-btn").addEventListener("click", clearSelection);
  document.getElementById("bulk-approve-btn").addEventListener("click", () => openBulkConfirm("approve"));
  document.getElementById("bulk-reject-btn").addEventListener("click", () => openBulkConfirm("reject"));
  document.getElementById("bulk-confirm-cancel").addEventListener("click", closeBulkConfirm);
  document.getElementById("bulk-confirm-ok").addEventListener("click", executeBulkAction);

  document.getElementById("close-review-btn").addEventListener("click", closeReviewModal);
  document.getElementById("review-approve-btn").addEventListener("click", handleReviewApprove);
  document.getElementById("review-reject-btn").addEventListener("click", () => showRejectForm(true));
  document.getElementById("review-reject-cancel").addEventListener("click", () => showRejectForm(false));
  document.getElementById("review-reject-confirm").addEventListener("click", handleReviewRejectConfirm);

  ["review-modal", "bulk-confirm-modal"].forEach((id) => {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) id === "review-modal" ? closeReviewModal() : closeBulkConfirm();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeReviewModal();
      closeBulkConfirm();
    }
  });
});
