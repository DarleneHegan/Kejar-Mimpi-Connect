// Komponen navbar & footer yang dipakai berulang di semua halaman publik.

function renderPublicNavbar(activePage = "") {
  return `
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <a href="/index.html" class="flex items-center gap-2">
          <img src="/images/logo-kejar-mimpi.jpg" alt="Kejar Mimpi" class="w-9 h-9 rounded-lg object-cover" />
          <span class="font-bold text-lg text-gray-800">Kejar <span class="text-[#C8102E]">Mimpi</span></span>
        </a>
        <div class="hidden md:flex items-center gap-8">
          <a href="/index.html" class="text-sm font-medium ${activePage === 'home' ? 'text-[#C8102E]' : 'text-gray-600 hover:text-[#C8102E]'} transition-colors">Semua Event</a>
          <a href="/admin-login.html" class="text-sm font-medium text-gray-600 hover:text-[#C8102E] transition-colors">Login Admin</a>
        </div>
        <button id="mobile-menu-btn" class="md:hidden p-2 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <div id="mobile-menu" class="hidden md:hidden pb-4 flex flex-col gap-3">
        <a href="/index.html" class="text-sm font-medium text-gray-600">Semua Event</a>
        <a href="/admin-login.html" class="text-sm font-medium text-gray-600">Login Admin</a>
      </div>
    </div>
  </nav>`;
}

function renderFooter() {
  return `
  <footer class="bg-[#1a1a1a] text-gray-300 mt-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-2">
          <img src="/images/logo-kejar-mimpi.jpg" alt="Kejar Mimpi" class="w-8 h-8 rounded-lg object-cover" />
          <span class="font-semibold text-white">Kejar Mimpi Komunitas</span>
        </div>
        <p class="text-sm text-gray-400">&copy; ${new Date().getFullYear()} Kejar Mimpi. Semua hak cipta dilindungi.</p>
      </div>
    </div>
  </footer>`;
}

function mountLayout({ activePage = "" } = {}) {
  const navEl = document.getElementById("navbar-slot");
  const footerEl = document.getElementById("footer-slot");
  if (navEl) navEl.innerHTML = renderPublicNavbar(activePage);
  if (footerEl) footerEl.innerHTML = renderFooter();

  const menuBtn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => menu.classList.toggle("hidden"));
  }
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container") || (() => {
    const div = document.createElement("div");
    div.id = "toast-container";
    div.className = "fixed top-4 right-4 z-50 flex flex-col gap-2";
    document.body.appendChild(div);
    return div;
  })();

  const colors = {
    success: "bg-green-600",
    error: "bg-[#C8102E]",
    info: "bg-gray-800",
  };

  const toast = document.createElement("div");
  toast.className = `fade-in ${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDateTime(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}


// ---------- Layout Admin ----------

function renderAdminSidebar(activePage = "") {
  const menuItem = (href, icon, label, key) => `
    <a href="${href}" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      activePage === key ? "bg-[#C8102E] text-white" : "text-gray-600 hover:bg-gray-100"
    }">
      ${icon}
      <span>${label}</span>
    </a>`;

  return `
  <div class="h-full flex flex-col">
    <div class="flex items-center gap-2 px-4 py-5 border-b border-gray-100">
      <img src="/images/logo-kejar-mimpi.jpg" alt="Kejar Mimpi" class="w-9 h-9 rounded-lg object-cover" />
      <span class="font-bold text-gray-800">Kejar Mimpi <span class="text-[#C8102E]">Admin</span></span>
    </div>
    <nav class="flex-1 px-3 py-4 space-y-1">
      ${menuItem("/admin/dashboard.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>', "Kelola Event", "dashboard")}
      ${menuItem("/admin/checkin.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>', "Absensi Hari-H", "checkin")}
      ${menuItem("/admin/reports.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>', "Laporan Peserta", "reports")}
    </nav>
    <div class="px-4 py-4 border-t border-gray-100">
      <p class="text-xs text-gray-400 mb-2">Masuk sebagai</p>
      <p class="text-sm font-semibold text-gray-700 mb-3" id="admin-name-label"></p>
      <button id="logout-btn" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#C8102E] hover:bg-red-50 transition-colors">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        Keluar
      </button>
    </div>
  </div>`;
}

function mountAdminLayout({ activePage = "" } = {}) {
  if (!isAdminLoggedIn()) {
    window.location.href = "/admin-login.html";
    return;
  }

  const sidebarEl = document.getElementById("admin-sidebar-slot");
  if (sidebarEl) sidebarEl.innerHTML = renderAdminSidebar(activePage);

  const nameLabel = document.getElementById("admin-name-label");
  if (nameLabel) nameLabel.textContent = getAdminName();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAdminSession();
      window.location.href = "/admin-login.html";
    });
  }

  const mobileMenuBtn = document.getElementById("admin-mobile-menu-btn");
  const mobileSidebar = document.getElementById("admin-sidebar-slot");
  if (mobileMenuBtn && mobileSidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileSidebar.classList.toggle("hidden");
      mobileSidebar.classList.toggle("fixed");
      mobileSidebar.classList.toggle("inset-0");
      mobileSidebar.classList.toggle("z-50");
    });
  }
}
