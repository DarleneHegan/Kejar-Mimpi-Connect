// Logic halaman detail event + form pendaftaran.

let currentEvent = null;

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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

  if (isPast) {
    quotaInfo.innerHTML = `<span class="text-gray-500">Pendaftaran telah ditutup</span>`;
  } else if (isFull) {
    quotaInfo.innerHTML = `<span class="text-red-600">Kuota sudah penuh (${event.registered_count}/${event.quota})</span>`;
  } else if (event.quota) {
    const spotsLeft = event.quota - event.registered_count;
    quotaInfo.innerHTML = `<span class="text-green-600">${spotsLeft} slot tersisa dari ${event.quota}</span>`;
  } else {
    quotaInfo.innerHTML = `<span class="text-green-600">Slot pendaftaran masih terbuka</span>`;
  }

  if (isPast || isFull) {
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("register-closed").classList.remove("hidden");
    document.getElementById("register-closed-text").textContent = isPast
      ? "Event ini sudah berlalu"
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
  const submitBtn = document.getElementById("submit-btn");
  const submitBtnText = document.getElementById("submit-btn-text");
  const submitSpinner = document.getElementById("submit-spinner");

  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim() || null,
  };

  submitBtn.disabled = true;
  submitBtnText.textContent = "Memproses...";
  submitSpinner.classList.remove("hidden");

  try {
    const result = await registerForEvent(currentEvent.id, payload);
    // Simpan sementara untuk halaman konfirmasi (opsional, karena halaman konfirmasi juga fetch ulang by token)
    window.location.href = `/confirmation.html?token=${result.ticket_token}`;
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
