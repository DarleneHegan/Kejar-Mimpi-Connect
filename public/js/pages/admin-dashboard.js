// Logic halaman Kelola Event:
// - List event + aksi per event: Publikasikan/Tarik, Edit, Tutup/Buka, Hapus
// - Pop up buat/edit event dengan 2 tab (Info Event & Form Pendaftaran), urutan isi bebas
// - Event baru selalu tersimpan sebagai draft; form pendaftaran minimal 1 pertanyaan

let allAdminEvents = [];
let formBuilderFields = [];
let formFieldSeq = 0;
let activeModalTab = "info";
let pendingAction = null; // { type, eventId }

const FIELD_TYPE_LABELS = {
  text: "Teks Singkat",
  textarea: "Teks Panjang",
  number: "Angka",
  email: "Email",
  phone: "No. HP",
  dropdown: "Dropdown (pilih satu)",
  radio: "Pilihan Ganda (radio)",
  checkbox: "Checkbox (pilih banyak)",
};
const OPTION_FIELD_TYPES = ["dropdown", "radio", "checkbox"];
const REQUIRED_INFO_IDS = ["title", "start_time"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toLocalDatetimeInputValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ---------- Tabel event ----------
function statusBadge(event) {
  const isPast = new Date(event.start_time) < new Date();
  const badge = (cls, text) => `<span class="text-xs font-semibold px-2.5 py-1 rounded-full ${cls}">${text}</span>`;
  if (!event.is_published) return badge("bg-gray-100 text-gray-600", "Draft");
  if (isPast) return badge("bg-gray-100 text-gray-500", "Selesai");
  if (event.is_closed) return badge("bg-amber-100 text-amber-700", "Ditutup");
  return badge("bg-green-100 text-green-700", "Dipublikasikan");
}

function actionButton(attr, id, label, extraClass = "") {
  return `<button type="button" ${attr}="${id}" class="admin-btn-ghost ${extraClass}">${label}</button>`;
}

function renderEventRow(event) {
  const publishBtn = event.is_published
    ? actionButton("data-unpublish", event.id, "Tarik ke Draft")
    : `<button type="button" data-publish="${event.id}" class="text-xs font-semibold px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white">Publikasikan</button>`;
  const closeBtn = event.is_closed
    ? actionButton("data-reopen", event.id, "Buka Lagi")
    : actionButton("data-close", event.id, "Tutup", "hover:!border-amber-500 hover:!text-amber-600");

  return `
  <tr>
    <td class="px-5 py-4">
      <p class="font-semibold text-gray-800">${escapeHtml(event.title)}</p>
      <p class="text-xs text-gray-400 mt-0.5">${escapeHtml(event.category || "Tanpa kategori")}${event.requires_approval ? " • Butuh approval" : ""}</p>
    </td>
    <td class="px-5 py-4 text-gray-600">${formatDateTime(event.start_time)}</td>
    <td class="px-5 py-4">${statusBadge(event)}</td>
    <td class="px-5 py-4 text-gray-600">
      ${event.registered_count}${event.quota ? `/${event.quota}` : ""}
      <span class="text-xs text-gray-400">(${event.checked_in_count} hadir)</span>
      ${event.requires_approval && event.pending_count > 0
        ? `<a href="/admin/approvals.html?event_id=${event.id}" class="block text-xs font-semibold text-amber-600 hover:underline mt-0.5">${event.pending_count} menunggu approval</a>`
        : ""}
    </td>
    <td class="px-5 py-4">
      <div class="flex items-center justify-end gap-2 flex-wrap">
        ${publishBtn}
        ${actionButton("data-edit", event.id, "Edit")}
        ${closeBtn}
        <button type="button" data-delete="${event.id}" class="text-xs font-semibold px-3.5 py-2 rounded-xl border border-red-200 text-[#C8102E] bg-red-50 hover:bg-[#C8102E] hover:text-white transition-colors">Hapus</button>
      </div>
    </td>
  </tr>`;
}

function renderEventTable() {
  const tbody = document.getElementById("event-table-body");
  const wrap = document.getElementById("event-table-wrap");
  const emptyState = document.getElementById("empty-state");

  if (allAdminEvents.length === 0) {
    wrap.classList.add("hidden");
    emptyState.classList.remove("hidden");
    emptyState.classList.add("flex");
    return;
  }

  wrap.classList.remove("hidden");
  emptyState.classList.add("hidden");
  emptyState.classList.remove("flex");
  tbody.innerHTML = allAdminEvents.map(renderEventRow).join("");

  const bind = (attr, handler) =>
    tbody.querySelectorAll(`[${attr}]`).forEach((btn) => btn.addEventListener("click", () => handler(btn.getAttribute(attr))));
  bind("data-edit", openEditModal);
  bind("data-publish", (id) => openActionModal("publish", id));
  bind("data-unpublish", (id) => openActionModal("unpublish", id));
  bind("data-close", (id) => openActionModal("close", id));
  bind("data-reopen", (id) => openActionModal("reopen", id));
  bind("data-delete", (id) => openActionModal("delete", id));
}

async function loadAdminEvents() {
  const loadingState = document.getElementById("loading-state");
  loadingState.classList.remove("hidden");
  try {
    allAdminEvents = await fetchEventsAdmin();
    allAdminEvents.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  } catch (err) {
    showToast(err.message || "Gagal memuat data event", "error");
    allAdminEvents = [];
  } finally {
    loadingState.classList.add("hidden");
  }
  renderEventTable();
}

// ---------- Aksi per event (publikasi / tutup / hapus) ----------
const ACTIONS = {
  publish: {
    title: "Publikasikan event?",
    text: "Event akan tampil di daftar event publik dan peserta bisa mulai mendaftar.",
    ok: "Ya, publikasikan",
    okClass: "bg-green-600 hover:bg-green-700",
    iconClass: "bg-green-100 text-green-600",
    icon: "M5 13l4 4L19 7",
    run: (id) => updateEvent(id, { is_published: true }),
    success: "Event berhasil dipublikasikan",
  },
  unpublish: {
    title: "Tarik event ke draft?",
    text: "Event tidak akan tampil lagi di daftar publik sampai dipublikasikan ulang. Data pendaftar tetap aman.",
    ok: "Ya, jadikan draft",
    okClass: "bg-gray-900 hover:bg-black",
    iconClass: "bg-gray-100 text-gray-600",
    icon: "M9 12h6m-3-9a9 9 0 100 18 9 9 0 000-18z",
    run: (id) => updateEvent(id, { is_published: false }),
    success: "Event dikembalikan ke draft",
  },
  close: {
    title: "Tutup pendaftaran?",
    text: "Event tetap tampil di daftar publik dengan label \"Pendaftaran Ditutup\", tapi peserta tidak bisa mendaftar lagi. Bisa dibuka kembali kapan saja.",
    ok: "Ya, tutup",
    okClass: "bg-amber-500 hover:bg-amber-600",
    iconClass: "bg-amber-100 text-amber-600",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    run: (id) => updateEvent(id, { is_closed: true }),
    success: "Pendaftaran event ditutup",
  },
  reopen: {
    title: "Buka pendaftaran lagi?",
    text: "Peserta bisa kembali mendaftar ke event ini.",
    ok: "Ya, buka",
    okClass: "bg-green-600 hover:bg-green-700",
    iconClass: "bg-green-100 text-green-600",
    icon: "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z",
    run: (id) => updateEvent(id, { is_closed: false }),
    success: "Pendaftaran event dibuka kembali",
  },
  delete: {
    title: "Hapus event permanen?",
    text: "Event, form pendaftaran, dan seluruh data pendaftar akan dihapus dan hilang dari tampilan peserta. Tindakan ini tidak bisa dibatalkan. Jika hanya ingin menghentikan pendaftaran, gunakan \"Tutup\".",
    ok: "Ya, hapus permanen",
    okClass: "bg-[#C8102E] hover:bg-[#a10d25]",
    iconClass: "bg-red-100 text-[#C8102E]",
    icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    run: (id) => deleteEvent(id),
    success: "Event berhasil dihapus",
  },
};

function openActionModal(type, eventId) {
  const cfg = ACTIONS[type];
  const event = allAdminEvents.find((e) => e.id === eventId);
  pendingAction = { type, eventId };

  document.getElementById("action-modal-icon").className = `w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${cfg.iconClass}`;
  document.getElementById("action-modal-icon").innerHTML =
    `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${cfg.icon}" /></svg>`;
  document.getElementById("action-modal-title").textContent = cfg.title;
  document.getElementById("action-modal-text").textContent = event ? `"${event.title}" — ${cfg.text}` : cfg.text;
  const okBtn = document.getElementById("action-modal-ok");
  okBtn.className = `flex-1 text-white font-semibold py-2.5 rounded-xl ${cfg.okClass}`;
  okBtn.textContent = cfg.ok;
  okBtn.disabled = false;
  document.getElementById("action-modal").classList.remove("hidden");
}

function closeActionModal() {
  pendingAction = null;
  document.getElementById("action-modal").classList.add("hidden");
}

async function handleActionConfirm() {
  if (!pendingAction) return;
  const cfg = ACTIONS[pendingAction.type];
  const okBtn = document.getElementById("action-modal-ok");
  okBtn.disabled = true;
  try {
    await cfg.run(pendingAction.eventId);
    showToast(cfg.success);
    closeActionModal();
    loadAdminEvents();
  } catch (err) {
    showToast(err.message || "Gagal memproses aksi", "error");
    okBtn.disabled = false;
  }
}

// ---------- Tab di pop up event ----------
function switchModalTab(tab) {
  activeModalTab = tab;
  document.querySelectorAll("[data-modal-tab]").forEach((btn) => {
    btn.setAttribute("aria-selected", btn.dataset.modalTab === tab ? "true" : "false");
  });
  document.querySelectorAll("[data-modal-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.modalPanel !== tab);
  });
  document.getElementById("event-modal-body").scrollTop = 0;
}

function isInfoComplete() {
  return REQUIRED_INFO_IDS.every((id) => document.getElementById(id).checkValidity());
}

function isFormComplete() {
  return formBuilderFields.length > 0 && getFormFieldsError() === null;
}

// Indikator di tab: angka (belum), centang hijau (lengkap)
function updateTabIndicators() {
  const setStep = (key, done, number) => {
    const el = document.querySelector(`[data-tab-status="${key}"]`);
    el.classList.toggle("is-done", done);
    el.innerHTML = done
      ? `<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>`
      : number;
  };
  const infoDone = isInfoComplete();
  const formDone = isFormComplete();
  setStep("info", infoDone, "1");
  setStep("form", formDone, "2");
  document.getElementById("form-field-count").textContent = formBuilderFields.length;

  const progress = document.getElementById("modal-progress");
  if (infoDone && formDone) progress.textContent = "Semua bagian lengkap, siap disimpan.";
  else if (!infoDone && !formDone) progress.textContent = "Lengkapi Info Event dan Form Pendaftaran.";
  else if (!infoDone) progress.textContent = "Info Event belum lengkap.";
  else progress.textContent = "Form Pendaftaran belum lengkap.";
}

// ---------- Pop up buat/edit event ----------
function resetForm() {
  document.getElementById("event-id").value = "";
  document.getElementById("event-form").reset();
  document.getElementById("requires_approval").checked = false;
  formBuilderFields = [];
  renderFormFieldsList();
}

function openCreateModal() {
  resetForm();
  document.getElementById("modal-title").textContent = "Buat Event Baru";
  document.getElementById("save-btn-text").textContent = "Simpan sebagai Draft";
  switchModalTab("info");
  updateTabIndicators();
  document.getElementById("event-modal").classList.remove("hidden");
  document.getElementById("title").focus();
}

async function loadFormFieldsIntoBuilder(eventId) {
  document.getElementById("form-fields-list").innerHTML = `<div class="flex justify-center py-6"><div class="spinner"></div></div>`;
  try {
    const fields = await fetchEventFormFields(eventId);
    formBuilderFields = fields
      .sort((a, b) => a.order - b.order)
      .map((f) => ({
        _key: f.id,
        label: f.label,
        field_type: f.field_type,
        options: (f.options || []).join(", "),
        is_required: f.is_required,
      }));
  } catch (err) {
    showToast(err.message || "Gagal memuat form pendaftaran", "error");
    formBuilderFields = [];
  }
  renderFormFieldsList();
}

async function openEditModal(eventId) {
  const event = allAdminEvents.find((e) => e.id === eventId);
  if (!event) return;

  resetForm();
  document.getElementById("modal-title").textContent = "Edit Event";
  document.getElementById("save-btn-text").textContent = "Simpan Perubahan";
  document.getElementById("event-id").value = event.id;
  document.getElementById("title").value = event.title;
  document.getElementById("category").value = event.category || "";
  document.getElementById("quota").value = event.quota || "";
  document.getElementById("start_time").value = toLocalDatetimeInputValue(event.start_time);
  document.getElementById("end_time").value = toLocalDatetimeInputValue(event.end_time);
  document.getElementById("location").value = event.location || "";
  document.getElementById("image_url").value = event.image_url || "";
  document.getElementById("description").value = event.description || "";
  document.getElementById("requires_approval").checked = event.requires_approval;

  switchModalTab("info");
  document.getElementById("event-modal").classList.remove("hidden");
  await loadFormFieldsIntoBuilder(event.id);
}

function closeModal() {
  document.getElementById("event-modal").classList.add("hidden");
}

// Pesan error validasi form builder, atau null jika valid (tidak mengecek jumlah minimal).
function getFormFieldsError() {
  for (const field of formBuilderFields) {
    if (!field.label || !field.label.trim()) return "Semua pertanyaan harus punya judul";
    if (OPTION_FIELD_TYPES.includes(field.field_type)) {
      const opts = (field.options || "").split(",").map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) return `Pertanyaan "${field.label}" butuh minimal 1 pilihan jawaban`;
    }
  }
  return null;
}

function buildFormFieldsPayload() {
  return formBuilderFields.map((field, idx) => ({
    label: field.label.trim(),
    field_type: field.field_type,
    options: OPTION_FIELD_TYPES.includes(field.field_type)
      ? (field.options || "").split(",").map((o) => o.trim()).filter(Boolean)
      : null,
    is_required: field.is_required,
    order: idx,
  }));
}

// Validasi kedua tab. Jika ada yang kurang, pindah ke tab tersebut dan tunjukkan errornya.
function validateBeforeSubmit() {
  const invalidInfo = REQUIRED_INFO_IDS.map((id) => document.getElementById(id)).find((el) => !el.checkValidity())
    || ["quota", "image_url", "end_time"].map((id) => document.getElementById(id)).find((el) => !el.checkValidity());
  if (invalidInfo) {
    switchModalTab("info");
    showToast("Info Event belum lengkap atau ada isian yang tidak valid", "error");
    invalidInfo.reportValidity();
    invalidInfo.focus();
    return false;
  }
  const endVal = document.getElementById("end_time").value;
  if (endVal && new Date(endVal) < new Date(document.getElementById("start_time").value)) {
    switchModalTab("info");
    showToast("Waktu selesai tidak boleh sebelum waktu mulai", "error");
    document.getElementById("end_time").focus();
    return false;
  }
  if (formBuilderFields.length === 0) {
    switchModalTab("form");
    showToast("Form pendaftaran wajib punya minimal 1 pertanyaan", "error");
    return false;
  }
  const fieldError = getFormFieldsError();
  if (fieldError) {
    switchModalTab("form");
    showToast(fieldError, "error");
    return false;
  }
  return true;
}

function resetSaveButton() {
  const isEdit = !!document.getElementById("event-id").value;
  document.getElementById("save-btn").disabled = false;
  document.getElementById("save-btn-text").textContent = isEdit ? "Simpan Perubahan" : "Simpan sebagai Draft";
  document.getElementById("save-spinner").classList.add("hidden");
}

async function handleEventFormSubmit(e) {
  e.preventDefault();
  if (!validateBeforeSubmit()) return;

  const eventId = document.getElementById("event-id").value;
  const quotaValue = document.getElementById("quota").value;
  const endTimeValue = document.getElementById("end_time").value;

  // is_published tidak dikirim: event baru otomatis draft, publikasi lewat tombol di tabel.
  const payload = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value.trim() || null,
    quota: quotaValue ? parseInt(quotaValue, 10) : null,
    start_time: new Date(document.getElementById("start_time").value).toISOString(),
    end_time: endTimeValue ? new Date(endTimeValue).toISOString() : null,
    location: document.getElementById("location").value.trim() || null,
    image_url: document.getElementById("image_url").value.trim() || null,
    description: document.getElementById("description").value.trim() || null,
    requires_approval: document.getElementById("requires_approval").checked,
  };
  const fieldsPayload = buildFormFieldsPayload();

  document.getElementById("save-btn").disabled = true;
  document.getElementById("save-btn-text").textContent = "Menyimpan...";
  document.getElementById("save-spinner").classList.remove("hidden");

  let savedEventId = eventId;
  try {
    if (eventId) {
      await updateEvent(eventId, payload);
    } else {
      const created = await createEvent(payload);
      savedEventId = created.id;
      // Jika simpan form gagal, submit ulang akan meng-update event ini, bukan membuat duplikat.
      document.getElementById("event-id").value = savedEventId;
    }
  } catch (err) {
    showToast(err.message || "Gagal menyimpan event", "error");
    resetSaveButton();
    return;
  }

  try {
    await saveEventFormFields(savedEventId, fieldsPayload);
  } catch (err) {
    showToast(`Event tersimpan, tapi form pendaftaran gagal disimpan: ${err.message || "coba lagi"}`, "error");
    document.getElementById("modal-title").textContent = "Edit Event";
    switchModalTab("form");
    resetSaveButton();
    loadAdminEvents();
    return;
  }

  showToast(eventId ? "Event berhasil diperbarui" : "Event tersimpan sebagai draft. Klik \"Publikasikan\" saat siap.");
  closeModal();
  resetSaveButton();
  loadAdminEvents();
}

// ---------- Form builder (tab Form Pendaftaran) ----------
function renderFormFieldRow(field, index) {
  const needsOptions = OPTION_FIELD_TYPES.includes(field.field_type);
  const typeOptions = Object.entries(FIELD_TYPE_LABELS)
    .map(([value, label]) => `<option value="${value}" ${field.field_type === value ? "selected" : ""}>${label}</option>`)
    .join("");

  return `
  <div class="border border-gray-100 bg-white rounded-xl p-4 border-l-4 border-l-[#C8102E] shadow-sm" data-field-row="${field._key}">
    <div class="flex items-start gap-3">
      <span class="w-6 h-6 mt-2 flex-shrink-0 rounded-full bg-red-50 text-[#C8102E] text-xs font-bold flex items-center justify-center">${index + 1}</span>
      <div class="flex-1 space-y-3">
        <input type="text" data-field-label value="${escapeHtml(field.label || "")}" placeholder="Tulis pertanyaan, misal: Link CV / Portofolio" aria-label="Judul pertanyaan ${index + 1}" class="admin-input font-medium" />
        <div class="flex flex-wrap items-center gap-3">
          <select data-field-type aria-label="Tipe jawaban" class="admin-input !w-auto">
            ${typeOptions}
          </select>
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" data-field-required ${field.is_required ? "checked" : ""} class="w-4 h-4 rounded border-gray-300 text-[#C8102E] focus:ring-[#C8102E]" />
            Wajib diisi
          </label>
        </div>
        <div class="${needsOptions ? "" : "hidden"}">
          <label class="block text-xs font-medium text-gray-500 mb-1">Pilihan jawaban (pisahkan dengan koma)</label>
          <input type="text" data-field-options value="${escapeHtml(field.options || "")}" placeholder="misal: S, M, L, XL" class="admin-input" />
        </div>
      </div>
      <button type="button" data-remove-field aria-label="Hapus pertanyaan" class="text-gray-400 hover:text-[#C8102E] p-1 mt-1.5">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  </div>`;
}

function renderFormFieldsList() {
  const list = document.getElementById("form-fields-list");
  if (formBuilderFields.length === 0) {
    list.innerHTML = `
      <div class="text-center py-8 rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
        <p class="text-sm font-semibold text-amber-700">Belum ada pertanyaan</p>
        <p class="text-xs text-amber-600 mt-1">Tambahkan minimal 1 pertanyaan untuk peserta.</p>
      </div>`;
    updateTabIndicators();
    return;
  }
  list.innerHTML = formBuilderFields.map((f, i) => renderFormFieldRow(f, i)).join("");

  list.querySelectorAll("[data-field-row]").forEach((row) => {
    const key = row.dataset.fieldRow;
    const field = formBuilderFields.find((f) => f._key === key);

    row.querySelector("[data-field-label]").addEventListener("input", (e) => {
      field.label = e.target.value;
      updateTabIndicators();
    });
    row.querySelector("[data-field-required]").addEventListener("change", (e) => {
      field.is_required = e.target.checked;
    });
    row.querySelector("[data-field-options]").addEventListener("input", (e) => {
      field.options = e.target.value;
      updateTabIndicators();
    });
    row.querySelector("[data-field-type]").addEventListener("change", (e) => {
      field.field_type = e.target.value;
      renderFormFieldsList();
    });
    row.querySelector("[data-remove-field]").addEventListener("click", () => {
      formBuilderFields = formBuilderFields.filter((f) => f._key !== key);
      renderFormFieldsList();
    });
  });
  updateTabIndicators();
}

function addFormField() {
  formBuilderFields.push({
    _key: `new-${formFieldSeq++}`,
    label: "",
    field_type: "text",
    options: "",
    is_required: false,
  });
  renderFormFieldsList();
  const inputs = document.querySelectorAll("#form-fields-list [data-field-label]");
  const last = inputs[inputs.length - 1];
  if (last) {
    last.scrollIntoView({ behavior: "smooth", block: "center" });
    last.focus({ preventScroll: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "dashboard" });
  loadAdminEvents();

  document.getElementById("open-create-modal-btn").addEventListener("click", openCreateModal);
  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  document.getElementById("cancel-modal-btn").addEventListener("click", closeModal);
  document.getElementById("event-form").addEventListener("submit", handleEventFormSubmit);
  document.getElementById("event-form").addEventListener("input", updateTabIndicators);

  document.querySelectorAll("[data-modal-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchModalTab(btn.dataset.modalTab));
  });

  document.getElementById("add-form-field-btn").addEventListener("click", addFormField);
  // Enter di input pertanyaan jangan sampai men-submit (menyimpan) event
  document.getElementById("form-fields-list").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
  });

  document.getElementById("action-modal-cancel").addEventListener("click", closeActionModal);
  document.getElementById("action-modal-ok").addEventListener("click", handleActionConfirm);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeActionModal();
    closeModal();
  });
});
