// Halaman About: daftar organizer + popup profil.

let organizers = [];

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

function photoHtml(org, textSize) {
  if (org.photo_url) {
    return `<img src="${escapeHtml(org.photo_url)}" alt="Foto ${escapeHtml(org.name)}" class="w-full h-full object-cover" loading="lazy" />`;
  }
  return `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C8102E] to-[#6e0819] text-white font-bold ${textSize}">${escapeHtml(initials(org.name))}</div>`;
}

function renderOrganizerCard(org) {
  return `
  <div class="organizer-card flex flex-col items-center text-center">
    <div class="organizer-photo w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-gray-200 shadow-md mb-4">${photoHtml(org, "text-3xl")}</div>
    <p class="font-bold text-gray-800 leading-tight">${escapeHtml(org.name)}</p>
    <p class="text-sm text-gray-600">${escapeHtml(org.role)}</p>
    ${org.affiliation ? `<p class="text-xs text-gray-500">${escapeHtml(org.affiliation)}</p>` : ""}
    <button type="button" data-profile="${org.id}" class="mt-3 text-sm font-semibold text-blue-600 hover:underline">View profile</button>
  </div>`;
}

function openProfile(id) {
  const org = organizers.find((o) => o.id === id);
  if (!org) return;
  document.getElementById("profile-photo").innerHTML = photoHtml(org, "text-3xl");
  document.getElementById("profile-name").textContent = org.name;
  document.getElementById("profile-role").textContent = org.role;
  document.getElementById("profile-affiliation").textContent = org.affiliation || "";
  document.getElementById("profile-bio").textContent = org.bio || "";
  document.getElementById("profile-links").innerHTML = (org.links || [])
    .map(
      (l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"
        class="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-[#C8102E] hover:text-[#C8102E]">${escapeHtml(l.label)}</a>`
    )
    .join("");
  document.getElementById("profile-modal").classList.remove("hidden");
}

function closeProfile() {
  document.getElementById("profile-modal").classList.add("hidden");
}

async function loadOrganizers() {
  try {
    organizers = await fetchOrganizers();
  } catch (err) {
    organizers = [];
  }
  document.getElementById("organizers-loading").classList.add("hidden");
  if (organizers.length === 0) {
    document.getElementById("organizers-empty").classList.remove("hidden");
    return;
  }
  const grid = document.getElementById("organizers-grid");
  grid.innerHTML = organizers.map(renderOrganizerCard).join("");
  grid.querySelectorAll("[data-profile]").forEach((btn) => btn.addEventListener("click", () => openProfile(btn.dataset.profile)));
}

document.addEventListener("DOMContentLoaded", () => {
  mountLayout({ activePage: "about" });
  loadOrganizers();
  document.getElementById("profile-close").addEventListener("click", closeProfile);
  document.getElementById("profile-modal").addEventListener("click", (e) => {
    if (e.target.id === "profile-modal") closeProfile();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProfile();
  });
});
