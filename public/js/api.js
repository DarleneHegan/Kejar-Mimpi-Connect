// Helper untuk memanggil API backend FastAPI.

const AUTH_TOKEN_KEY = "admin_access_token";
const AUTH_NAME_KEY = "admin_name";

function getAdminToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAdminSession(token, name) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_NAME_KEY, name);
}

function clearAdminSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_NAME_KEY);
}

function getAdminName() {
  return localStorage.getItem(AUTH_NAME_KEY) || "Admin";
}

function isAdminLoggedIn() {
  return !!getAdminToken();
}

/**
 * Wrapper fetch ke API backend.
 * @param {string} path - path relatif contoh: "/api/events"
 * @param {object} options - fetch options (method, body, dst). body otomatis di-JSON.stringify jika object.
 * @param {boolean} withAuth - true jika perlu Authorization header (admin only endpoint)
 */
async function apiFetch(path, options = {}, withAuth = false) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };

  if (withAuth) {
    const token = getAdminToken();
    if (!token) {
      window.location.href = "/admin-login.html";
      throw new Error("Belum login");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body === "object" ? JSON.stringify(options.body) : options.body,
  });

  if (response.status === 401 && withAuth) {
    clearAdminSession();
    window.location.href = "/admin-login.html";
    throw new Error("Sesi login berakhir, silakan login kembali");
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || "Terjadi kesalahan pada server";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

// ---------- Auth ----------
async function loginAdmin(email, password) {
  return apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
}

// ---------- Events ----------
async function fetchEvents({ search, category } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/events${query}`);
}

async function fetchEventsAdmin() {
  return apiFetch("/api/events/admin", {}, true);
}

async function fetchEventDetail(eventId) {
  return apiFetch(`/api/events/${eventId}`);
}

async function createEvent(payload) {
  return apiFetch("/api/events", { method: "POST", body: payload }, true);
}

async function updateEvent(eventId, payload) {
  return apiFetch(`/api/events/${eventId}`, { method: "PUT", body: payload }, true);
}

async function deleteEvent(eventId) {
  return apiFetch(`/api/events/${eventId}`, { method: "DELETE" }, true);
}

// ---------- Form Fields (Form Builder) ----------
async function fetchEventFormFields(eventId) {
  return apiFetch(`/api/events/${eventId}/form-fields`);
}

async function saveEventFormFields(eventId, fields) {
  return apiFetch(`/api/events/${eventId}/form-fields`, { method: "PUT", body: { fields } }, true);
}

// ---------- Registrations ----------
async function registerForEvent(eventId, payload) {
  return apiFetch(`/api/events/${eventId}/register`, { method: "POST", body: payload });
}

async function fetchRegistrationByToken(ticketToken) {
  return apiFetch(`/api/registrations/${ticketToken}`);
}

async function fetchRegistrationsForEvent(eventId, search, status) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/events/${eventId}/registrations${query}`, {}, true);
}

async function approveRegistration(registrationId) {
  return apiFetch(`/api/registrations/${registrationId}/approve`, { method: "PATCH" }, true);
}

async function rejectRegistration(registrationId, remarks) {
  return apiFetch(`/api/registrations/${registrationId}/reject`, { method: "PATCH", body: { remarks } }, true);
}

async function bulkDecideRegistrations(registrationIds, action, remarks = null) {
  return apiFetch(
    "/api/registrations/bulk-decision",
    { method: "POST", body: { registration_ids: registrationIds, action, remarks } },
    true
  );
}

// ---------- Check-in ----------
async function checkInByToken(ticketToken) {
  return apiFetch("/api/checkin", { method: "POST", body: { ticket_token: ticketToken } }, true);
}

async function checkInManualById(registrationId) {
  return apiFetch(`/api/checkin/${registrationId}/manual`, { method: "POST" }, true);
}

// ---------- Organizers ----------
async function fetchOrganizers() {
  return apiFetch("/api/organizers");
}

async function createOrganizer(payload) {
  return apiFetch("/api/organizers", { method: "POST", body: payload }, true);
}

async function updateOrganizer(id, payload) {
  return apiFetch(`/api/organizers/${id}`, { method: "PUT", body: payload }, true);
}

async function deleteOrganizer(id) {
  return apiFetch(`/api/organizers/${id}`, { method: "DELETE" }, true);
}
