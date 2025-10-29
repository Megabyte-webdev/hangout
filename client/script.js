const BASE_URL = window.location.origin;

// Redirect to login if not authenticated
async function checkAuth() {
  const app = document.getElementById("app");
  const loadingScreen = document.getElementById("loadingScreen");

  try {
    const res = await fetch(`${BASE_URL}/admin/session`, {
      credentials: "include",
    });
    const data = await res.json();

    if (!data.loggedIn) {
      window.location.replace("login.html");
      return;
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.replace("login.html");
    return;
  } finally {
    // Fade out loader & show app
    loadingScreen.classList.add("fade-out");
    setTimeout(() => {
      loadingScreen.remove();
      app.style.display = "block";
    }, 300);
  }
}

// Helper function for authenticated fetch requests
async function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";

  return fetch(url, {
    ...options,
    headers,
    credentials: "include", // 🔥 crucial for cookie-based sessions
  });
}

// DOM Elements
const submissionsTableBody = document.getElementById("submissionsTableBody");
const tableLoader = document.getElementById("tableLoader");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const verificationModal = document.getElementById("verificationModal");
const closeModal = document.getElementById("closeModal");
const cancelVerification = document.getElementById("cancelVerification");
const confirmVerification = document.getElementById("confirmVerification");
const submissionDetails = document.getElementById("submissionDetails");
const screenshotPreview = document.getElementById("screenshotPreview");
const toast = document.getElementById("toast");
const totalCount = document.getElementById("totalCount");
const verifiedCount = document.getElementById("verifiedCount");
const pendingCount = document.getElementById("pendingCount");

// State
let submissions = [];
let currentSubmissionId = null;

// Logout handler
document.querySelector(".logout").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await fetch(`${BASE_URL}/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Logout error:", err);
  }
  alert("You have been logged out.");
  window.location.href = "./login.html";
});

document.addEventListener("DOMContentLoaded", function () {
  checkAuth();
  fetchSubmissions();

  searchInput.addEventListener("input", filterSubmissions);
  statusFilter.addEventListener("change", filterSubmissions);
  closeModal.addEventListener("click", closeVerificationModal);
  cancelVerification.addEventListener("click", closeVerificationModal);
  confirmVerification.addEventListener("click", verifySubmission);
});

// Fetch submissions
async function fetchSubmissions() {
  showLoader();

  try {
    const res = await authFetch(`${BASE_URL}/submissions`);
    if (res.status === 401) return (window.location.href = "login.html");

    const data = await res.json();

    if (data.success) {
      submissions = data.data;
      renderSubmissions(submissions);
      updateStats(submissions);
    } else {
      showToast("Failed to fetch submissions", "error");
    }
  } catch (error) {
    console.error("Error fetching submissions:", error);
    showToast("Error fetching submissions", "error");
  } finally {
    hideLoader();
  }
}

// Render table
function renderSubmissions(data) {
  if (data.length === 0) {
    submissionsTableBody.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  data.sort((a, b) => {
    const nameA = (a.name || "").toLowerCase();
    const nameB = (b.name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  submissionsTableBody.innerHTML = data
    .map((sub) => {
      const status = sub.status || "pending";
      const isVerified = status === "verified";
      const isCheckedIn = status === "checked_in";

      const statusClass = isCheckedIn
        ? "success"
        : isVerified
        ? "verified"
        : "pending";

      const statusLabel = isCheckedIn
        ? "Checked In"
        : isVerified
        ? "Verified"
        : "Pending";

      let actionButtons = "";

      if (status === "pending") {
        actionButtons = `
          <button class="btn btn-primary verify-btn" data-id="${sub.id}">
            <i class="fas fa-check-circle"></i> Verify
          </button>`;
      } else if (status === "verified") {
        actionButtons = `
          <button class="btn btn-success checkin-btn" data-id="${sub.id}">
            <i class="fas fa-user-check"></i> Check In
          </button>`;
      } else if (status === "checked_in") {
        actionButtons = `
          <button class="btn btn-outline uncheck-btn" data-id="${sub.id}">
            <i class="fas fa-undo"></i> Uncheck
          </button>`;
      }

      return `
        <tr>
          <td>${sub.id}</td>
          <td>${sub.name}</td>
          <td>${sub.phone}</td>
          <td>
            <button class="btn btn-outline view-screenshot" data-src="${sub.screenshot}">
              <i class="fas fa-eye"></i> View
            </button>
          </td>
          <td><span class="status ${statusClass}">${statusLabel}</span></td>
          <td class="action-cell">${actionButtons}</td>
        </tr>
      `;
    })
    .join("");

  attachEventListeners();
}

// Attach dynamic handlers
function attachEventListeners() {
  document.querySelectorAll(".verify-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openVerificationModal(parseInt(btn.getAttribute("data-id")));
    });
  });

  document.querySelectorAll(".checkin-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      checkInUser(parseInt(btn.getAttribute("data-id")));
    });
  });

  document.querySelectorAll(".uncheck-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.getAttribute("data-id"));

      // Ask for confirmation
      const confirmed = confirm("Are you sure you want to uncheck this user?");

      if (confirmed) {
        uncheckUser(id); // Only call if confirmed
      }
    });
  });

  document.querySelectorAll(".view-screenshot").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.open(btn.getAttribute("data-src"), "_blank");
    });
  });
}

// Filtering
function filterSubmissions() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  let filtered = [...submissions];

  if (searchTerm) {
    filtered = filtered.filter(
      (sub) =>
        (sub.name && sub.name.toLowerCase().includes(searchTerm)) ||
        (sub.phone && sub.phone.toLowerCase().includes(searchTerm))
    );
  }

  if (status !== "all") {
    filtered = filtered.filter((sub) => sub.status === status);
  }

  renderSubmissions(filtered);
  updateStats(submissions);
}

// Update dashboard stats
function updateStats(allSubs) {
  const total = allSubs.length;
  const verified = allSubs.filter((s) => s.status === "verified").length;
  const pending = allSubs.filter((s) => s.status === "pending").length;
  const checkedIn = allSubs.filter((s) => s.status === "checked_in").length;

  totalCount.textContent = total;
  verifiedCount.textContent = verified;
  pendingCount.textContent = pending;

  if (typeof checkedInCount !== "undefined") {
    checkedInCount.textContent = checkedIn;
  }
}

// Modal
function openVerificationModal(id) {
  const submission = submissions.find((s) => s.id === id);
  if (!submission) return;

  currentSubmissionId = id;
  submissionDetails.innerHTML = `
    <p><strong>Name:</strong> ${submission.name}</p>
    <p><strong>Phone:</strong> ${submission.phone}</p>
  `;
  screenshotPreview.src = submission.screenshot;
  screenshotPreview.style.display = "block";
  verificationModal.style.display = "flex";
}

function closeVerificationModal() {
  verificationModal.style.display = "none";
  currentSubmissionId = null;
  screenshotPreview.style.display = "none";
}

// Verify
async function verifySubmission() {
  if (!currentSubmissionId) return;
  const btn = confirmVerification;
  setButtonLoading(btn, true, "Verifying...");

  try {
    const res = await authFetch(`${BASE_URL}/verify/${currentSubmissionId}`, {
      method: "POST",
    });
    const data = await res.json();

    if (data.success) {
      updateSubmissionStatus(currentSubmissionId, "verified");
      closeVerificationModal();
      showToast("Payment verified successfully", "success");
      filterSubmissions();
    } else {
      showToast(data.message || "Verification failed", "error");
    }
  } catch (error) {
    console.error("Verification error:", error);
    showToast("Error verifying payment", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// Check-in
async function checkInUser(id) {
  const btn = document.querySelector(`.checkin-btn[data-id="${id}"]`);
  setButtonLoading(btn, true, "Checking In...");

  try {
    const res = await authFetch(`${BASE_URL}/checkin/${id}`, {
      method: "POST",
    });
    const data = await res.json();

    if (data.success) {
      updateSubmissionStatus(id, "checked_in");
      showToast("User checked in successfully", "success");
      filterSubmissions();
    } else {
      showToast(data.message || "Failed to check in user", "error");
    }
  } catch (error) {
    console.error("Check-in error:", error);
    showToast("Error checking in user", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// Uncheck
async function uncheckUser(id) {
  const btn = document.querySelector(`.uncheck-btn[data-id="${id}"]`);
  setButtonLoading(btn, true, "Unchecking...");

  try {
    const res = await authFetch(`${BASE_URL}/uncheckin/${id}`, {
      method: "POST",
    });
    const data = await res.json();

    if (data.success) {
      updateSubmissionStatus(id, "verified");
      showToast("User unchecked successfully", "success");
      filterSubmissions();
    } else {
      showToast(data.message || "Failed to uncheck user", "error");
    }
  } catch (error) {
    console.error("Uncheck error:", error);
    showToast("Error unchecking user", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// Local updates
function updateSubmissionStatus(id, newStatus) {
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx !== -1) submissions[idx].status = newStatus;
  renderSubmissions(submissions);
  updateStats(submissions);
}

// UI Helpers
function setButtonLoading(btn, isLoading, text = null) {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${
      text || "Processing..."
    }`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText;
  }
}

function showLoader() {
  tableLoader.style.display = "block";
  submissionsTableBody.innerHTML = "";
  emptyState.style.display = "none";
}

function hideLoader() {
  tableLoader.style.display = "none";
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = "flex";
  setTimeout(() => (toast.style.display = "none"), 3000);
}
