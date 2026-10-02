// Logic halaman detail event + form pendaftaran (dengan custom field dinamis).

let currentEvent = null;
let currentFormFields = [];

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function renderCustomFieldInput(field) {
  const req = field.is_required ? "required" : "";
  const label = `<label class="block text-sm font-medium text-gray-700 mb-1">${field.label}${field.is_required ? " *" : ""}</label>`;
  const baseInputClass = "w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C8102E]/40 focus:border-[#C8102E]";

  if (field.field_type === "textarea") {
    return `<div>${label}<textarea data-custom-field="${field.id}" ${req} rows="3" class="${baseInputClass}"></textarea></div>`;
  }
  if (field.field_type === "dropdown") {
    const options = (field.options || []).map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div>${label}<select data-custom-field="${field.id}" ${req} class="${baseInputClass}"><option value="">-- Pilih --</option>${options}</select></div>`;
  }
  if (field.field_type === "radio") {
    const options = (field.options || [])
      .map(
        (o, i) => `<label class="flex items-center gap-2 text-sm text-gray-700">
        <input type="radio" name="custom-radio-${field.id}" data-custom-field="${field.id}" value="${o}" ${req} class="text-[#C8102E] focus:ring-[#C8102E]" /> ${o}
      </label>`
      )
      .join("");
    return `<div>${label}<div class="space-y-1.5">${options}</div></div>`;
  }
  if (field.field_type === "checkbox") {
    const options = (field.options || [])
      .map(
        (o) => `<label class="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" data-custom-field="${field.id}" value="${o}" class="text-[#C8102E] rounded focus:ring-[#C8102E]" /> ${o}
      </label>`
      )
      .join("");
    return `<div>${label}<div class="space-y-1.5">${options}</div></div>`;
  }
  const inputType = field.field_type === "number" ? "number" : field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : "text";
  return `<div>${label}<input type="${inputType}" data-custom-field="${field.id}" ${req} class="${baseInputClass}" /></div>`;
}

function renderCustomFields(fields) {
  const wrap = document.getElementById("custom-fields-wrap");
  wrap.innerHTML = fields.map(renderCustomFieldInput).join("");
}

function collectCustomAnswers() {
  const answers = {};
  for (const field of currentFormFields) {
    if (field.field_type === "checkbox") {
      const checked = Array.from(
        document.querySelectorAll(`[data-custom-field="${field.id}"]:checked`)
      ).map((el) => el.value);
      if (checked.length > 0) answers[field.id] = checked;
    } else if (field.field_type === "radio") {
      const checked = document.querySelector(`[data-custom-field="${field.id}"]:checked`);
      if (checked) answers[field.id] = checked.value;
    } else {
      const el = document.querySelector(`[data-custom-field="${field.id}"]`);
      if (el && el.value) answers[field.id] = el.value;
    }
  }
  return answers;
}

function validateCustomFields() {
  for (const field of currentFormFields) {
    if (!field.is_required) continue;
    if (field.field_type === "checkbox") {
      const checked = document.querySelectorAll(`[data-custom-field="${field.id}"]:checked`);
      if (checked.length === 0) {
        showToast(`"${field.label}" wajib diisi`, "error");
        return false;
      }
    } else if (field.field_type === "radio") {
      const checked = document.querySelector(`[data-custom-field="${field.id}"]:checked`);
      if (!checked) {
        showToast(`"${field.label}" wajib diisi`, "error");
        return false;
      }
    }
  }
  return true;
}

function renderEventDetail(event) {
  currentEvent = event;

  document.getElementById("event-title").textContent = event.title;
  document.getElementById("event-date").textContent = formatDateTime(event.start_time);
  document.getElementById("event-description").textContent = event.description || "Tidak ada deskripsi.";

  const imageEl = document.getElementById("event-image");
  if (event.image_url) {
    imageEl.innerHTML = `<img src="${event.image_url}" alt="${event.title}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/800x400/C8102E/ffffff?text=Event';" />`;
  } else {
    imageEl.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C8102E] to-[#8a0b20] text-white text-4xl font-bold">${event.title.charAt(0)}</div>`;
  }

  const locationWrap = document.getElementById("event-location-wrap");
  if (event.location) {
    document.getElementById("event-location").textContent = event.location;
  } else {
    locationWrap.classList.add("hidden");
  }

  const categoryBadge = document.getElementById("event-category-badge");
  if (event.category) {
    categoryBadge.textContent = event.category;
    categoryBadge.classList.remove("hidden");
    categoryBadge.classList.add("bg-red-100", "text-[#C8102E]");
  }

  // Info kuota
  const quotaInfo = document.getElementById("quota-info");
  const isFull = event.quota && event.registered_count >= event.quota;
  const isPast = new Date(event.start_time) < new Date();

  const isClosed = !!event.is_closed;

  if (isPast) {
    quotaInfo.innerHTML = `<span class="text-gray-500">Pendaftaran telah ditutup</span>`;
  } else if (isClosed) {
    quotaInfo.innerHTML = `<span class="text-gray-500">Pendaftaran ditutup oleh penyelenggara</span>`;
  } else if (isFull) {
    quotaInfo.innerHTML = `<span class="text-red-600">Kuota sudah penuh (${event.registered_count}/${event.quota})</span>`;
  } else if (event.quota) {
    const spotsLeft = event.quota - event.registered_count;
    quotaInfo.innerHTML = `<span class="text-green-600">${spotsLeft} slot tersisa dari ${event.quota}</span>`;
  } else {
    quotaInfo.innerHTML = `<span class="text-green-600">Slot pendaftaran masih terbuka</span>`;
  }

  if (isPast || isClosed || isFull) {
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("register-closed").classList.remove("hidden");
    document.getElementById("register-closed-text").textContent = isPast
      ? "Event ini sudah berlalu"
      : isClosed
        ? "Pendaftaran event ini sudah ditutup"
        : "Kuota pendaftaran sudah penuh";
  }

  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("content").classList.remove("hidden");
}

async function loadEventDetail() {
  const eventId = getEventIdFromUrl();
  if (!eventId) {
    showNotFound();
    return;
  }

  try {
    const event = await fetchEventDetail(eventId);
    renderEventDetail(event);
    try {
      currentFormFields = await fetchEventFormFields(eventId);
      renderCustomFields(currentFormFields);
    } catch (err) {
      currentFormFields = [];
    }
    if (event.requires_approval) {
      document.getElementById("register-footer-note").textContent =
        "Pendaftaranmu akan diperiksa admin terlebih dahulu. Tiket (QR code) baru terbit setelah disetujui.";
    }
  } catch (err) {
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("not-found").classList.remove("hidden");
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  if (!validateCustomFields()) return;

  const submitBtn = document.getElementById("submit-btn");
  const submitBtnText = document.getElementById("submit-btn-text");
  const submitSpinner = document.getElementById("submit-spinner");

  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim() || null,
    answers: collectCustomAnswers(),
  };

  submitBtn.disabled = true;
  submitBtnText.textContent = "Memproses...";
  submitSpinner.classList.remove("hidden");

  try {
    const result = await registerForEvent(currentEvent.id, payload);
    if (result.status === "pending") {
      // Butuh approval admin dulu - tampilkan notice, jangan redirect ke halaman QR.
      document.getElementById("register-form").classList.add("hidden");
      document.getElementById("register-pending-notice").classList.remove("hidden");
    } else {
      window.location.href = `/confirmation.html?token=${result.ticket_token}`;
    }
  } catch (err) {
    showToast(err.message || "Gagal mendaftar, coba lagi", "error");
    submitBtn.disabled = false;
    submitBtnText.textContent = "Daftar Event";
    submitSpinner.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountLayout();
  loadEventDetail();
  document.getElementById("register-form").addEventListener("submit", handleRegisterSubmit);
});
