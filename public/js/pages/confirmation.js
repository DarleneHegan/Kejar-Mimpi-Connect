// Logic halaman konfirmasi pendaftaran: tampilkan QR code + data tiket.

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

async function loadConfirmation() {
  const token = getTokenFromUrl();
  if (!token) {
    showNotFound();
    return;
  }

  try {
    const data = await fetchRegistrationByToken(token);

    document.getElementById("loading-state").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");

    if (data.status === "pending") {
      document.getElementById("pending-event-title").textContent = data.event_title;
      document.getElementById("pending-view").classList.remove("hidden");
      return;
    }

    if (data.status === "rejected") {
      document.getElementById("rejected-view").classList.remove("hidden");
      return;
    }

    document.getElementById("conf-event-title").textContent = data.event_title;
    document.getElementById("conf-name").textContent = data.full_name;
    document.getElementById("conf-email").textContent = data.email;
    document.getElementById("conf-token").textContent = data.ticket_token;
    document.getElementById("qr-image").src = data.qr_code_base64;
    document.getElementById("confirmed-view").classList.remove("hidden");

    document.getElementById("download-btn").addEventListener("click", () => {
      const link = document.createElement("a");
      link.href = data.qr_code_base64;
      link.download = `tiket-${data.event_title.replace(/\s+/g, "-").toLowerCase()}-${data.full_name.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  } catch (err) {
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("not-found").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  mountLayout();
  loadConfirmation();
});
