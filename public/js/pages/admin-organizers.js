// Kelola organizer (halaman About): tambah, edit, hapus, dan link profil dinamis.

let organizers = [];
let editingId = null;
let deleteId = null;
let links = [];
let linkSeq = 0;

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

function photoHtml(url, name) {
  if (url && /^data:image\/(jpeg|png|webp);base64,/i.test(url)) {
    return `<img src="${escapeHtml(url)}" alt="" class="w-full h-full object-cover" onerror="this.remove()" />`;
  }
  return `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C8102E] to-[#6e0819] text-white font-bold">${escapeHtml(initials(name))}</div>`;
}

// ---------- List ----------
function renderCard(org) {
  return `
  <div class="admin-card p-5 flex items-center gap-4">
    <div class="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">${photoHtml(org.photo_url, org.name)}</div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-gray-800 truncate">${escapeHtml(org.name)}</p>
      <p class="text-sm text-[#C8102E] truncate">${escapeHtml(org.role)}</p>
      <p class="text-xs text-gray-400 truncate">${escapeHtml(org.affiliation || "")}${(org.links || []).length ? ` • ${org.links.length} link` : ""}</p>
    </div>
    <div class="flex flex-col gap-2">
      <button type="button" data-edit="${org.id}" class="admin-btn-ghost">Edit</button>
      <button type="button" data-delete="${org.id}" class="text-xs font-semibold px-3 py-2 rounded-xl border border-red-200 text-[#C8102E] bg-red-50 hover:bg-[#C8102E] hover:text-white">Hapus</button>
    </div>
  </div>`;
}

async function loadOrganizers() {
  try {
    organizers = await fetchOrganizers();
  } catch (err) {
    showToast(err.message || "Gagal memuat organizer", "error");
    organizers = [];
  }
  document.getElementById("loading-state").classList.add("hidden");
  const empty = document.getElementById("empty-state");
  empty.classList.toggle("hidden", organizers.length > 0);
  empty.classList.toggle("flex", organizers.length === 0);

  const grid = document.getElementById("organizer-grid");
  grid.innerHTML = organizers.map(renderCard).join("");
  grid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.edit)));
  grid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => openDelete(b.dataset.delete)));
}

// ---------- Link dinamis ----------
function renderLinks() {
  const wrap = document.getElementById("org-links");
  if (links.length === 0) {
    wrap.innerHTML = `<p class="text-xs text-gray-400">Belum ada link. Tambahkan LinkedIn, Instagram, atau link lain.</p>`;
    return;
  }
  wrap.innerHTML = links
    .map(
      (l) => `
    <div class="flex gap-2" data-link="${l._key}">
      <input type="text" data-link-label value="${escapeHtml(l.label)}" placeholder="Nama link" aria-label="Nama link" class="admin-input !w-36" />
      <input type="url" data-link-url value="${escapeHtml(l.url)}" placeholder="https://..." aria-label="URL link" class="admin-input flex-1" />
      <button type="button" data-link-remove aria-label="Hapus link" class="text-gray-400 hover:text-[#C8102E] px-2">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>`
    )
    .join("");
  wrap.querySelectorAll("[data-link]").forEach((row) => {
    const link = links.find((l) => l._key === row.dataset.link);
    row.querySelector("[data-link-label]").addEventListener("input", (e) => (link.label = e.target.value));
    row.querySelector("[data-link-url]").addEventListener("input", (e) => (link.url = e.target.value));
    row.querySelector("[data-link-remove]").addEventListener("click", () => {
      links = links.filter((x) => x !== link);
      renderLinks();
    });
  });
}

function addLink(label) {
  links.push({ _key: `l${linkSeq++}`, label, url: "" });
  renderLinks();
  const urls = document.querySelectorAll("#org-links [data-link-url]");
  const target = label ? urls[urls.length - 1] : document.querySelectorAll("#org-links [data-link-label]")[urls.length - 1];
  target?.focus();
}

// ---------- Upload & crop foto ----------
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 400; // px, hasil crop persegi 400x400
let photoData = null; // data URL hasil crop yang akan disimpan
let sourceImageUrl = null; // gambar asli (object URL) untuk crop ulang
let cropper = null;
let flipped = false;

function updatePreview() {
  document.getElementById("org-photo-preview").innerHTML = photoHtml(photoData, document.getElementById("org-name").value);
  const hasPhoto = !!photoData;
  document.getElementById("org-photo-btn-text").textContent = hasPhoto ? "Ganti Foto" : "Upload Foto";
  document.getElementById("org-photo-remove").classList.toggle("hidden", !hasPhoto);
  document.getElementById("org-photo-recrop").classList.toggle("hidden", !sourceImageUrl);
}

function handleFileSelected(e) {
  const file = e.target.files[0];
  e.target.value = ""; // supaya file yang sama bisa dipilih ulang
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showToast("Format foto harus JPG, PNG, atau WEBP", "error");
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    showToast("Ukuran foto maksimal 10 MB", "error");
    return;
  }
  if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
  sourceImageUrl = URL.createObjectURL(file);
  openCropper();
}

function openCropper() {
  if (typeof Cropper === "undefined") {
    showToast("Library crop gagal dimuat, periksa koneksi internet", "error");
    return;
  }
  const img = document.getElementById("crop-image");
  document.getElementById("crop-modal").classList.remove("hidden");
  if (cropper) cropper.destroy();
  flipped = false;
  img.onload = () => {
    cropper = new Cropper(img, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.85,
      background: false,
      responsive: true,
      ready() {
        document.getElementById("crop-zoom").value = 0;
        cropper.baseRatio = cropper.getImageData().width / cropper.getImageData().naturalWidth;
      },
    });
  };
  img.src = sourceImageUrl;
}

function closeCropper() {
  document.getElementById("crop-modal").classList.add("hidden");
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
}

function handleCropControl(action) {
  if (!cropper) return;
  if (action === "rotate-left") cropper.rotate(-90);
  if (action === "rotate-right") cropper.rotate(90);
  if (action === "flip") {
    flipped = !flipped;
    cropper.scaleX(flipped ? -1 : 1);
  }
  if (action === "reset") {
    cropper.reset();
    flipped = false;
    document.getElementById("crop-zoom").value = 0;
  }
}

function handleZoomSlider(e) {
  if (!cropper || !cropper.baseRatio) return;
  // Slider 0-100 -> zoom 1x sampai 4x dari ukuran awal
  cropper.zoomTo(cropper.baseRatio * (1 + (Number(e.target.value) / 100) * 3));
}

function applyCrop() {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    fillColor: "#fff",
    imageSmoothingQuality: "high",
  });
  photoData = canvas.toDataURL("image/jpeg", 0.85);
  closeCropper();
  updatePreview();
}

function removePhoto() {
  photoData = null;
  if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
  sourceImageUrl = null;
  updatePreview();
}

// ---------- Modal ----------

function openModal(id = null) {
  editingId = id;
  const org = organizers.find((o) => o.id === id);
  document.getElementById("org-form").reset();
  document.getElementById("org-modal-title").textContent = org ? "Edit Anggota" : "Tambah Anggota";
  document.getElementById("org-name").value = org?.name || "";
  document.getElementById("org-role").value = org?.role || "";
  document.getElementById("org-affiliation").value = org?.affiliation || "";
  photoData = org?.photo_url && org.photo_url.startsWith("data:image/") ? org.photo_url : null;
  if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
  sourceImageUrl = null;
  document.getElementById("org-bio").value = org?.bio || "";
  document.getElementById("org-order").value = org ? org.order : organizers.length;
  links = (org?.links || []).map((l) => ({ ...l, _key: `l${linkSeq++}` }));
  renderLinks();
  updatePreview();
  document.getElementById("org-modal").classList.remove("hidden");
  document.getElementById("org-name").focus();
}

function closeModal() {
  document.getElementById("org-modal").classList.add("hidden");
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;

  const cleanLinks = links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => l.label || l.url);
  const badLink = cleanLinks.find((l) => !l.label || !/^https?:\/\/\S+$/i.test(l.url));
  if (badLink) {
    showToast("Setiap link harus punya nama dan URL yang diawali http:// atau https://", "error");
    return;
  }

  const payload = {
    name: document.getElementById("org-name").value.trim(),
    role: document.getElementById("org-role").value.trim(),
    affiliation: document.getElementById("org-affiliation").value.trim() || null,
    photo_url: photoData,
    bio: document.getElementById("org-bio").value.trim() || null,
    order: parseInt(document.getElementById("org-order").value, 10) || 0,
    links: cleanLinks,
  };

  const saveBtn = document.getElementById("org-save");
  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";
  try {
    if (editingId) await updateOrganizer(editingId, payload);
    else await createOrganizer(payload);
    showToast(editingId ? "Profil anggota diperbarui" : "Anggota berhasil ditambahkan");
    closeModal();
    loadOrganizers();
  } catch (err) {
    showToast(err.message || "Gagal menyimpan anggota", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan";
  }
}

function openDelete(id) {
  deleteId = id;
  const org = organizers.find((o) => o.id === id);
  document.getElementById("del-text").textContent = `"${org?.name}" akan dihapus dari halaman About.`;
  document.getElementById("del-modal").classList.remove("hidden");
}

function closeDelete() {
  deleteId = null;
  document.getElementById("del-modal").classList.add("hidden");
}

async function confirmDelete() {
  if (!deleteId) return;
  try {
    await deleteOrganizer(deleteId);
    showToast("Anggota dihapus");
    closeDelete();
    loadOrganizers();
  } catch (err) {
    showToast(err.message || "Gagal menghapus anggota", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountAdminLayout({ activePage: "organizers" });
  loadOrganizers();

  document.getElementById("add-btn").addEventListener("click", () => openModal());
  document.getElementById("org-close").addEventListener("click", closeModal);
  document.getElementById("org-cancel").addEventListener("click", closeModal);
  document.getElementById("org-form").addEventListener("submit", handleSubmit);
  document.getElementById("org-name").addEventListener("input", updatePreview);
  document.getElementById("org-photo-file").addEventListener("change", handleFileSelected);
  document.getElementById("org-photo-recrop").addEventListener("click", openCropper);
  document.getElementById("org-photo-remove").addEventListener("click", removePhoto);
  document.getElementById("crop-cancel").addEventListener("click", closeCropper);
  document.getElementById("crop-apply").addEventListener("click", applyCrop);
  document.getElementById("crop-zoom").addEventListener("input", handleZoomSlider);
  document.querySelectorAll("[data-crop]").forEach((b) => b.addEventListener("click", () => handleCropControl(b.dataset.crop)));
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => addLink(b.dataset.preset)));

  document.getElementById("del-cancel").addEventListener("click", closeDelete);
  document.getElementById("del-ok").addEventListener("click", confirmDelete);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Tutup lapisan paling atas dulu (crop di atas modal anggota)
      if (!document.getElementById("crop-modal").classList.contains("hidden")) return closeCropper();
      closeModal();
      closeDelete();
    }
  });
});
