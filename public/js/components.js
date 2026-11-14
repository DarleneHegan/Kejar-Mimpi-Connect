// Komponen navbar & footer yang dipakai berulang di semua halaman publik.

function renderPublicNavbar(activePage = "") {
  const link = (href, label, key) =>
    `<a href="${href}" class="nav-link ${activePage === key ? "is-active" : ""}"${activePage === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const mobileLink = (href, label, key) =>
    `<a href="${href}" class="px-3 py-2.5 rounded-xl text-sm font-semibold ${activePage === key ? "bg-red-50 text-[#C8102E]" : "text-gray-700 hover:bg-gray-50"}">${label}</a>`;
  return `
  <nav id="site-nav" class="site-nav border-b border-gray-100 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <a href="/events.html" class="flex items-center gap-2.5 group">
          <img src="/images/logo-kejar-mimpi.jpg" alt="Kejar Mimpi Jakarta" class="w-9 h-9 rounded-xl object-cover shadow-sm ring-2 ring-red-100 group-hover:ring-[#C8102E]/40 transition" />
          <span class="font-extrabold text-lg text-gray-800 tracking-tight">Kejar <span class="text-[#C8102E]">Mimpi</span> <span class="text-gray-400 font-semibold">Jakarta</span></span>
        </a>
        <div class="hidden md:flex items-center gap-7">
          ${link("/events.html", "Event", "home")}
          ${link("/about.html", "About", "about")}
        </div>
        <button id="mobile-menu-btn" class="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100" aria-label="Buka menu" aria-expanded="false" aria-controls="mobile-menu">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <div id="mobile-menu" class="hidden md:hidden pb-4 flex flex-col gap-1">
        ${mobileLink("/events.html", "Event", "home")}
        ${mobileLink("/about.html", "About", "about")}
      </div>
    </div>
  </nav>`;
}

function renderFooter() {
  return `
  <footer class="site-footer text-gray-300 mt-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid md:grid-cols-3 gap-8 items-start">
        <div>
          <div class="flex items-center gap-2.5 mb-3">
            <img src="/images/logo-kejar-mimpi.jpg" alt="Kejar Mimpi Jakarta" class="w-10 h-10 rounded-xl object-cover" />
            <span class="font-extrabold text-white text-lg">Kejar Mimpi Jakarta</span>
          </div>
          <p class="text-sm text-gray-400 max-w-xs">Komunitas anak muda Jakarta untuk belajar, terhubung, dan berdampak bersama.</p>
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Jelajahi</p>
          <div class="flex flex-col gap-2 text-sm">
            <a href="/events.html" class="hover:text-white transition-colors">Semua Event</a>
            <a href="/about.html" class="hover:text-white transition-colors">Tentang Komunitas</a>
            <a href="/about.html#organizers" class="hover:text-white transition-colors">Tim Organizer</a>
          </div>
        </div>
        <div class="md:text-right">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Ikut Bergerak</p>
          <a href="/events.html" class="inline-flex items-center gap-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-colors">
            Cari event untukmu
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </a>
        </div>
      </div>
      <div class="border-t border-white/10 mt-10 pt-6 text-sm text-gray-500 text-center md:text-left">
        &copy; ${new Date().getFullYear()} Kejar Mimpi Jakarta. Semua hak cipta dilindungi.
      </div>
    </div>
  </footer>`;
}

// Animasi muncul saat elemen masuk layar. Bisa dipanggil ulang setelah render dinamis.
let revealObserver = null;
function observeReveal(root = document) {
  const items = root.querySelectorAll(".reveal:not(.is-visible)");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }
  items.forEach((el) => revealObserver.observe(el));
}

function mountLayout({ activePage = "" } = {}) {
  const navEl = document.getElementById("navbar-slot");
  const footerEl = document.getElementById("footer-slot");
  if (navEl) navEl.innerHTML = renderPublicNavbar(activePage);
  if (footerEl) footerEl.innerHTML = renderFooter();

  const menuBtn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => {
      const open = menu.classList.toggle("hidden") === false;
      menuBtn.setAttribute("aria-expanded", String(open));
    });
  }

  // Bayangan navbar saat halaman di-scroll
  const nav = document.getElementById("site-nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  document.documentElement.classList.add("js-reveal");
  observeReveal();
}

function showToast(message, type = "success") {
  const container =
    document.getElementById("toast-container") ||
    (() => {
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
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ---------- Layout Admin ----------

function renderAdminSidebar(activePage = "") {
  const menuItem = (href, icon, label, key) => `
    <a href="${href}" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      activePage === key
        ? "bg-[#C8102E] text-white"
        : "text-gray-600 hover:bg-gray-100"
    }">
      ${icon}
      <span>${label}</span>
    </a>`;

  return `
  <div class="h-full flex flex-col">
    <div class="flex items-center gap-2 px-4 py-5 border-b border-gray-100">
      <img src="/images/logo-kejar-mimpi.jpg" alt="Kejar Mimpi Jakarta" class="w-9 h-9 rounded-lg object-cover" />
      <span class="font-bold text-gray-800">Kejar Mimpi Jakarta <span class="text-[#C8102E]">Admin</span></span>
    </div>
    <nav class="flex-1 px-3 py-4 space-y-1">
      ${menuItem("/admin/dashboard.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>', "Kelola Event", "dashboard")}
      ${menuItem("/admin/approvals.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>', "Approval Peserta", "approvals")}
      ${menuItem("/admin/checkin.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>', "Absensi Hari-H", "checkin")}
      ${menuItem("/admin/reports.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>', "Laporan Peserta", "reports")}
      ${menuItem("/admin/organizers.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>', "Kelola Organizer", "organizers")}
      ${menuItem("/admin/users.html", '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>', "User Management", "users")}
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
    window.location.replace("/");
    return;
  }

  const sidebarEl = document.getElementById("admin-sidebar-slot");
  if (sidebarEl) sidebarEl.innerHTML = renderAdminSidebar(activePage);

  const nameLabel = document.getElementById("admin-name-label");
  if (nameLabel) nameLabel.textContent = getAdminName();

  // Verifikasi token ke server sebelum menampilkan halaman admin
  verifyAdminSession()
    .then((me) => {
      if (me?.name && nameLabel) nameLabel.textContent = me.name;
      document.documentElement.style.visibility = "";
    })
    .catch(() => {
      clearAdminSession();
      window.location.replace("/");
    });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAdminSession();
      window.location.replace("/");
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
