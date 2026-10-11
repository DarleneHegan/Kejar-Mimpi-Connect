// User management admin: list, invite (tambah manual), hapus.

let admins = [];
let deleteId = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currentAdminName() {
  return getAdminName();
}

function renderRow(a) {
  // Admin tidak boleh menghapus akunnya sendiri (dicocokkan via nama yang tersimpan saat login).
  const isSelf = a.name === currentAdminName();
  const deleteBtn = isSelf
    ? ""
    : `<button type="button" data-delete="${a.id}" class="text-xs font-semibold px-3.5 py-2 rounded-xl border border-red-200 text-[#C8102E] bg-red-50 hover:bg-[#C8102E] hover:text-white transition-colors">Hapus</button>`;
  return `
  <tr>
    <td class="px-5 py-4 font-medium text-gray-800">${escapeHtml(a.name)}${isSelf ? ` <span class="text-xs font-normal text-gray-400">(Anda)</span>` : ""}</td>
    <td class="px-5 py-4 text-gray-600">${escapeHtml(a.email)}</td>
    <td class="px-5 py-4 text-gray-500">${formatDateTime(a.created_at)}</td>
    <td class="px-5 py-4 text-right">
      <div class="flex items-center justify-end gap-2">
        <button type="button" data-edit="${a.id}" class="admin-btn-ghost">Edit</button>
        ${deleteBtn}
      </div>
    </td>
  </tr>`;
}

async function loadAdmins() {
  try {
    admins = await fetchAdmins();
  } catch (err) {
    showToast(err.message || "Gagal memuat daftar admin", "error");
    admins = [];
  }
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("table-wrap").classList.remove("hidden");

  const body = document.getElementById("admin-table-body");
  body.innerHTML = admins.map(renderRow).join("");
  body.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => openDelete(b.dataset.delete)));
  body.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.edit)));
}

// ---------- Tambah / edit admin ----------
let editingId = null;

function openModal(id = null) {
  // Pastikan id berupa string id admin; jika dipanggil langsung dari event, abaikan.
  if (typeof id !== "string") id = null;
  editingId = id;
  const a = id ? admins.find((x) => x.id === id) : null;

  document.getElementById("admin-form").reset();
  document.getElementById("admin-modal-title").textContent = a ? "Edit Admin" : "Tambah Admin";
  document.getElementById("admin-save").textContent = a ? "Simpan Perubahan" : "Tambah Admin";
  document.getElementById("a-name").value = a?.name || "";
  document.getElementById("a-email").value = a?.email || "";

  const pw = document.getElementById("a-password");
  pw.value = "";
  pw.type = "password";
  pw.required = !a; // password wajib hanya saat tambah
  document.getElementById("a-toggle-pw").textContent = "Lihat";
  document.getElementById("a-password-label").textContent = a ? "Password Baru" : "Password";
  document.getElementById("a-password-req").classList.toggle("hidden", !!a);
  document.getElementById("a-password-hint").textContent = a
    ? "Kosongkan jika tidak ingin mengubah password."
    : "Minimal 6 karakter. Beritahukan ke admin baru untuk login pertama kali.";

  document.getElementById("admin-modal").classList.remove("hidden");
  document.getElementById("a-name").focus();
}

function closeModal() {
  document.getElementById("admin-modal").classList.add("hidden");
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;

  const payload = {
    name: document.getElementById("a-name").value.trim(),
    email: document.getElementById("a-email").value.trim(),
  };
  const pw = document.getElementById("a-password").value;

  const saveBtn = document.getElementById("admin-save");
  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";
  try {
    if (editingId) {
      // Password hanya dikirim jika diisi (biarkan tetap jika kosong)
      if (pw) payload.password = pw;
      await updateAdmin(editingId, payload);
      showToast(`Admin "${payload.name}" berhasil diperbarui`);
    } else {
      payload.password = pw;
      await inviteAdmin(payload);
      showToast(`Admin "${payload.name}" berhasil ditambahkan`);
    }
    closeModal();
    loadAdmins();
  } catch (err) {
    showToast(err.message || "Gagal menyimpan admin", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingId ? "Simpan Perubahan" : "Tambah Admin";
  }
}

// ---------- Hapus ----------
function openDelete(id) {
  deleteId = id;
  const a = admins.find((x) => x.id === id);
  document.getElementById("del-text").textContent = `"${a?.name}" tidak akan bisa login lagi. Tindakan ini tidak bisa dibatalkan.`;
  document.getElementById("del-modal").classList.remove("hidden");
}

function closeDelete() {
  deleteId = null;
  document.getElementById("del-modal").classList.add("hidden");
}

async function confirmDelete() {
  if (!deleteId) return;
  try {
    await deleteAdmin(deleteId);
    showToast("Admin dihapus");
    closeDelete();
    loadAdmins();
  } catch (err) {
    showToast(err.message || "Gagal menghapus admin", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "users" });
  loadAdmins();

  document.getElementById("add-btn").addEventListener("click", () => openModal());
  document.getElementById("admin-close").addEventListener("click", closeModal);
  document.getElementById("admin-cancel").addEventListener("click", closeModal);
  document.getElementById("admin-form").addEventListener("submit", handleSubmit);
  document.getElementById("a-toggle-pw").addEventListener("click", () => {
    const input = document.getElementById("a-password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    document.getElementById("a-toggle-pw").textContent = show ? "Sembunyikan" : "Lihat";
  });

  document.getElementById("del-cancel").addEventListener("click", closeDelete);
  document.getElementById("del-ok").addEventListener("click", confirmDelete);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeDelete();
    }
  });
});
