// Logic dashboard admin: list, create, edit, delete event.

let allAdminEvents = [];
let deleteTargetId = null;

function toLocalDatetimeInputValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusBadge(event) {
  const isPast = new Date(event.start_time) < new Date();
  if (!event.is_published) {
    return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Draft</span>`;
  }
  if (isPast) {
    return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Selesai</span>`;
  }
  return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Aktif</span>`;
}

function renderEventRow(event) {
  return `
  <tr>
    <td class="px-5 py-4">
      <p class="font-semibold text-gray-800">${event.title}</p>
      <p class="text-xs text-gray-400 mt-0.5">${event.category || "Tanpa kategori"}</p>
    </td>
    <td class="px-5 py-4 text-gray-600">${formatDateTime(event.start_time)}</td>
    <td class="px-5 py-4">${statusBadge(event)}</td>
    <td class="px-5 py-4 text-gray-600">
      ${event.registered_count}${event.quota ? `/${event.quota}` : ""}
      <span class="text-xs text-gray-400">(${event.checked_in_count} hadir)</span>
    </td>
    <td class="px-5 py-4 text-right">
      <div class="flex items-center justify-end gap-2">
        <button data-edit="${event.id}" class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#C8102E] hover:text-[#C8102E]">Edit</button>
        <button data-delete="${event.id}" class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#C8102E] hover:text-[#C8102E]">Hapus</button>
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

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit));
  });
  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete));
  });
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

function resetForm() {
  document.getElementById("event-id").value = "";
  document.getElementById("event-form").reset();
  document.getElementById("is_published").checked = true;
}

function openCreateModal() {
  resetForm();
  document.getElementById("modal-title").textContent = "Buat Event Baru";
  document.getElementById("event-modal").classList.remove("hidden");
}

function openEditModal(eventId) {
  const event = allAdminEvents.find((e) => e.id === eventId);
  if (!event) return;

  resetForm();
  document.getElementById("modal-title").textContent = "Edit Event";
  document.getElementById("event-id").value = event.id;
  document.getElementById("title").value = event.title;
  document.getElementById("category").value = event.category || "";
  document.getElementById("quota").value = event.quota || "";
  document.getElementById("start_time").value = toLocalDatetimeInputValue(event.start_time);
  document.getElementById("end_time").value = toLocalDatetimeInputValue(event.end_time);
  document.getElementById("location").value = event.location || "";
  document.getElementById("image_url").value = event.image_url || "";
  document.getElementById("description").value = event.description || "";
  document.getElementById("is_published").checked = event.is_published;

  document.getElementById("event-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("event-modal").classList.add("hidden");
}

function openDeleteModal(eventId) {
  deleteTargetId = eventId;
  document.getElementById("delete-modal").classList.remove("hidden");
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById("delete-modal").classList.add("hidden");
}

async function handleEventFormSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  const saveBtnText = document.getElementById("save-btn-text");
  const saveSpinner = document.getElementById("save-spinner");

  const eventId = document.getElementById("event-id").value;
  const quotaValue = document.getElementById("quota").value;
  const endTimeValue = document.getElementById("end_time").value;

  const payload = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value.trim() || null,
    quota: quotaValue ? parseInt(quotaValue, 10) : null,
    start_time: new Date(document.getElementById("start_time").value).toISOString(),
    end_time: endTimeValue ? new Date(endTimeValue).toISOString() : null,
    location: document.getElementById("location").value.trim() || null,
    image_url: document.getElementById("image_url").value.trim() || null,
    description: document.getElementById("description").value.trim() || null,
    is_published: document.getElementById("is_published").checked,
  };

  saveBtn.disabled = true;
  saveBtnText.textContent = "Menyimpan...";
  saveSpinner.classList.remove("hidden");

  try {
    if (eventId) {
      await updateEvent(eventId, payload);
      showToast("Event berhasil diperbarui");
    } else {
      await createEvent(payload);
      showToast("Event berhasil dibuat");
    }
    closeModal();
    loadAdminEvents();
  } catch (err) {
    showToast(err.message || "Gagal menyimpan event", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtnText.textContent = "Simpan Event";
    saveSpinner.classList.add("hidden");
  }
}

async function handleConfirmDelete() {
  if (!deleteTargetId) return;
  try {
    await deleteEvent(deleteTargetId);
    showToast("Event berhasil dihapus");
    closeDeleteModal();
    loadAdminEvents();
  } catch (err) {
    showToast(err.message || "Gagal menghapus event", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "dashboard" });
  loadAdminEvents();

  document.getElementById("open-create-modal-btn").addEventListener("click", openCreateModal);
  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  document.getElementById("cancel-modal-btn").addEventListener("click", closeModal);
  document.getElementById("event-form").addEventListener("submit", handleEventFormSubmit);

  document.getElementById("cancel-delete-btn").addEventListener("click", closeDeleteModal);
  document.getElementById("confirm-delete-btn").addEventListener("click", handleConfirmDelete);
});
