/* ==========================================================================
   PaliaAPK HUB — Admin Panel Logic
   Firebase Authentication (gatekeeper) + Supabase (data + storage)
   --------------------------------------------------------------------------
   SETUP CHECKLIST (do this before going live):

   1. Fill in FIREBASE_CONFIG and SUPABASE_CONFIG below with your real keys.

   2. Create admin users in Firebase Console → Authentication → Users
      (Email/Password provider). Only emails in ADMIN_EMAILS (or ANY
      authenticated Firebase user, if you leave ADMIN_EMAILS empty) can
      reach admindash.html.

   3. Create this table in Supabase (SQL editor):

        create table apps (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          package_name text not null,
          category text,
          short_description text,
          description text,
          version text,
          version_code integer,
          size_mb numeric,
          icon_url text,
          banner_url text,
          screenshots text[] default '{}',
          apk_url text,
          featured boolean default false,
          trending boolean default false,
          status text not null default 'draft' check (status in ('draft','published')),
          downloads bigint default 0,
          rating numeric default 0,
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        );

   4. Create a PUBLIC storage bucket named "app-assets" (Supabase →
      Storage → New bucket → Public bucket = ON). This code uploads into
      icons/, banners/, screenshots/ and apks/ folders inside it.

   5. Lock down writes with RLS policies restricting insert/update/delete
      on `apps` (and storage writes) to your admin — Firebase Auth on the
      client is only a UI gate, not a database security rule.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCn7GUkOaFO4l0x1zM5mwW4hFkW2ISxR10",
  authDomain: "shanpalia-apk-hub.firebaseapp.com",
  projectId: "shanpalia-apk-hub",
  storageBucket: "shanpalia-apk-hub.firebasestorage.app",
  messagingSenderId: "270953807883",
  appId: "1:270953807883:web:c900f4409938f16477870e",
  measurementId: "G-7BMQEGPY8C"
};

const SUPABASE_CONFIG = {
  url: "https://ralinnuegsbuvlhwpzln.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhbGlubnVlZ3NidXZsaHdwemxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTU2NDIsImV4cCI6MjA5NTg3MTY0Mn0.hIec6UxRx5gzSMTi5oJ3_xXw3d1QKCmKsPF-stBwIFE

};

// Leave empty [] to allow any authenticated Firebase user through.
const ADMIN_EMAILS = [];

const TABLE = "apps";
const BUCKET = "app-assets";

/* -------------------------------------------------------------------------
   Init SDKs (Firebase compat + Supabase JS, loaded via CDN <script> tags)
   ------------------------------------------------------------------------- */

let fbApp, fbAuth, sb;

function initSDKs() {
  if (window.firebase && !fbApp) {
    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
  }
  if (window.supabase && !sb) {
    sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
}

/* -------------------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------------------- */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function fmtNumber(n) {
  n = Number(n || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function initials(str) {
  if (!str) return "A";
  return str.trim().charAt(0).toUpperCase();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function showToast(message, type = "success") {
  const stack = $("#toastStack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icon = type === "error"
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
  el.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .2s";
    setTimeout(() => el.remove(), 200);
  }, 3200);
}

/* ==========================================================================
   LOGIN PAGE
   ========================================================================== */

function initLoginPage() {
  initSDKs();

  const form = $("#loginForm");
  if (!form) return;

  const errorBox = $("#loginError");
  const errorText = $("#loginErrorText");
  const submitBtn = $("#loginSubmit");
  const spinner = $("#loginSpinner");
  const submitLabel = $("#loginSubmitLabel");
  const pwInput = $("#loginPassword");
  const pwToggle = $("#togglePw");

  if (pwToggle) {
    pwToggle.addEventListener("click", () => {
      const isPw = pwInput.type === "password";
      pwInput.type = isPw ? "text" : "password";
      pwToggle.textContent = isPw ? "Hide" : "Show";
    });
  }

  // If already logged in, skip straight to dashboard.
  if (fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
      if (user) window.location.replace("admindash.html");
    });
  }

  function setBusy(isBusy) {
    submitBtn.disabled = isBusy;
    spinner.classList.toggle("show", isBusy);
    submitLabel.textContent = isBusy ? "Signing in…" : "Sign in";
  }

  function fail(message) {
    errorText.textContent = message;
    errorBox.classList.add("show");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");

    const email = $("#loginEmail").value.trim();
    const password = pwInput.value;

    if (!email || !password) {
      fail("Enter both your email and password.");
      return;
    }
    if (!fbAuth) {
      fail("Firebase isn't configured yet. Add your keys in admin.js.");
      return;
    }

    setBusy(true);
    try {
      const cred = await fbAuth.signInWithEmailAndPassword(email, password);
      const userEmail = (cred.user.email || "").toLowerCase();

      if (ADMIN_EMAILS.length && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(userEmail)) {
        await fbAuth.signOut();
        fail("This account isn't authorized for admin access.");
        setBusy(false);
        return;
      }

      window.location.href = "admindash.html";
    } catch (err) {
      setBusy(false);
      const map = {
        "auth/invalid-email": "That email address looks invalid.",
        "auth/user-disabled": "This account has been disabled.",
        "auth/user-not-found": "No account found with that email.",
        "auth/wrong-password": "Incorrect password. Try again.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts. Try again in a bit."
      };
      fail(map[err.code] || "Couldn't sign in. Check your details and try again.");
    }
  });
}

/* ==========================================================================
   DASHBOARD PAGE
   ========================================================================== */

let appsCache = [];
let editingId = null;
let pendingDeleteId = null;

// Files staged in the Add/Edit modal before upload
let stagedFiles = { icon: null, banner: null, apk: null, screenshots: [] };
// Existing URLs kept when editing (so we don't lose them if user doesn't re-upload)
let existingUrls = { icon: "", banner: "", apk: "", screenshots: [] };

function initDashboardPage() {
  initSDKs();
  if (!$("#dashboardShell")) return;

  guardAuth(async (user) => {
    renderAdminChip(user);
    wireSidebar();
    wireTopbar();
    wireModal();
    wireConfirmDialog();
    wireSearch();
    await loadApps();
  });
}

function guardAuth(onReady) {
  if (!fbAuth) {
    showToast("Firebase isn't configured yet. Add your keys in admin.js.", "error");
    return;
  }
  fbAuth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.replace("admin-login.html");
      return;
    }
    const email = (user.email || "").toLowerCase();
    if (ADMIN_EMAILS.length && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
      fbAuth.signOut().then(() => window.location.replace("admin-login.html"));
      return;
    }
    onReady(user);
  });
}

function renderAdminChip(user) {
  const name = (user.displayName || user.email || "Admin").split("@")[0];
  $("#adminAvatar").textContent = initials(name);
  $("#adminName").textContent = name;
  $("#adminEmail").textContent = user.email || "";
}

/* --- Sidebar / topbar / navigation ------------------------------------- */

function wireSidebar() {
  $$(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  const hamburger = $("#hamburger");
  const sidebar = $("#sidebar");
  const scrim = $("#sidebarScrim");
  if (hamburger) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.add("open");
      scrim.classList.add("show");
    });
  }
  if (scrim) {
    scrim.addEventListener("click", () => {
      sidebar.classList.remove("open");
      scrim.classList.remove("show");
    });
  }
}

function switchView(view) {
  $$(".nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  $("#sidebar")?.classList.remove("open");
  $("#sidebarScrim")?.classList.remove("show");
  const titles = {
    dashboard: ["Dashboard", "Overview of your app catalog"],
    apps: ["Manage Apps", "Edit, publish or remove listings"],
  };
  if (titles[view]) {
    $("#topbarTitle").textContent = titles[view][0];
    $("#topbarSubtitle").textContent = titles[view][1];
  }
}

function wireTopbar() {
  $("#btnLogout")?.addEventListener("click", async () => {
    await fbAuth.signOut();
    window.location.replace("admin-login.html");
  });
  $("#btnAddApp")?.addEventListener("click", () => openModal());
  $("#btnAddAppEmpty")?.addEventListener("click", () => openModal());
}

function wireSearch() {
  $("#appSearch")?.addEventListener("input", (e) => {
    renderAppsTable(e.target.value.trim().toLowerCase());
  });
}

/* --- Data loading -------------------------------------------------------- */

async function loadApps() {
  if (!sb) {
    showToast("Supabase isn't configured yet. Add your keys in admin.js.", "error");
    return;
  }
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    appsCache = data || [];
    renderStats();
    renderRecentTable();
    renderAppsTable();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't load apps from Supabase.", "error");
  }
}

function renderStats() {
  const total = appsCache.length;
  const published = appsCache.filter(a => a.status === "published").length;
  const drafts = appsCache.filter(a => a.status === "draft").length;
  const featured = appsCache.filter(a => a.featured).length;
  const trending = appsCache.filter(a => a.trending).length;
  const downloads = appsCache.reduce((sum, a) => sum + Number(a.downloads || 0), 0);

  $("#statTotal").textContent = total;
  $("#statPublished").textContent = published;
  $("#statDrafts").textContent = drafts;
  $("#statFeatured").textContent = featured;
  $("#statTrending").textContent = trending;
  $("#statDownloads").textContent = fmtNumber(downloads);

  $("#navAppsCount").textContent = total;
}

function renderRecentTable() {
  const tbody = $("#recentTableBody");
  const empty = $("#recentEmpty");
  if (!tbody) return;

  const recent = appsCache.slice(0, 6);
  tbody.innerHTML = "";

  if (!recent.length) {
    empty.style.display = "block";
    $("#recentTableWrap").style.display = "none";
    return;
  }
  empty.style.display = "none";
  $("#recentTableWrap").style.display = "block";

  recent.forEach((app) => {
    tbody.appendChild(buildAppRow(app, { compact: true }));
  });
}

function renderAppsTable(filter = "") {
  const tbody = $("#appsTableBody");
  const empty = $("#appsEmpty");
  const wrap = $("#appsTableWrap");
  if (!tbody) return;

  let list = appsCache;
  if (filter) {
    list = list.filter(a =>
      (a.name || "").toLowerCase().includes(filter) ||
      (a.package_name || "").toLowerCase().includes(filter) ||
      (a.category || "").toLowerCase().includes(filter)
    );
  }

  tbody.innerHTML = "";
  if (!list.length) {
    empty.style.display = "block";
    wrap.style.display = "none";
    return;
  }
  empty.style.display = "none";
  wrap.style.display = "block";

  list.forEach((app) => tbody.appendChild(buildAppRow(app, { compact: false })));
}

function buildAppRow(app, { compact }) {
  const tr = document.createElement("tr");
  const icon = app.icon_url || "";

  tr.innerHTML = `
    <td>
      <div class="app-cell">
        ${icon ? `<img src="${escapeHtml(icon)}" alt="">` : `<div class="app-cell img" style="width:40px;height:40px;border-radius:10px;background:var(--mint-50);color:var(--mint-700);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${escapeHtml(initials(app.name))}</div>`}
        <div>
          <div class="name">${escapeHtml(app.name || "Untitled")}</div>
          <div class="pkg">${escapeHtml(app.package_name || "—")}</div>
        </div>
      </div>
    </td>
    <td>${escapeHtml(app.category || "—")}</td>
    <td><span class="badge ${app.status === "published" ? "published" : "draft"}">${app.status === "published" ? "Published" : "Draft"}</span></td>
    ${compact ? "" : `<td>
        <label class="switch" title="Featured">
          <input type="checkbox" data-toggle="featured" data-id="${app.id}" ${app.featured ? "checked" : ""}>
          <span class="track"></span>
        </label>
      </td>
      <td>
        <label class="switch" title="Trending">
          <input type="checkbox" data-toggle="trending" data-id="${app.id}" ${app.trending ? "checked" : ""}>
          <span class="track"></span>
        </label>
      </td>`}
    <td>${fmtNumber(app.downloads)}</td>
    <td>${fmtDate(app.created_at)}</td>
    <td>
      <div class="row-actions">
        <button class="icon-btn" data-edit="${app.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" data-delete="${app.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </td>
  `;

  tr.querySelector("[data-edit]")?.addEventListener("click", () => openModal(app));
  tr.querySelector("[data-delete]")?.addEventListener("click", () => confirmDelete(app.id, app.name));
  tr.querySelector('[data-toggle="featured"]')?.addEventListener("change", (e) => toggleField(app.id, "featured", e.target.checked));
  tr.querySelector('[data-toggle="trending"]')?.addEventListener("change", (e) => toggleField(app.id, "trending", e.target.checked));

  return tr;
}

async function toggleField(id, field, value) {
  try {
    const { error } = await sb.from(TABLE).update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    const app = appsCache.find(a => a.id === id);
    if (app) app[field] = value;
    renderStats();
    showToast(`${field === "featured" ? "Featured" : "Trending"} ${value ? "enabled" : "disabled"}.`);
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't update app.", "error");
    await loadApps();
  }
}

/* --- Delete confirm dialog ------------------------------------------------ */

function wireConfirmDialog() {
  $("#confirmCancel")?.addEventListener("click", closeConfirm);
  $("#confirmOverlay")?.addEventListener("click", (e) => { if (e.target.id === "confirmOverlay") closeConfirm(); });
  $("#confirmDeleteBtn")?.addEventListener("click", performDelete);
}

function confirmDelete(id, name) {
  pendingDeleteId = id;
  $("#confirmAppName").textContent = name || "this app";
  $("#confirmOverlay").classList.add("open");
}

function closeConfirm() {
  $("#confirmOverlay").classList.remove("open");
  pendingDeleteId = null;
}

async function performDelete() {
  if (!pendingDeleteId) return;
  const btn = $("#confirmDeleteBtn");
  btn.disabled = true;
  btn.textContent = "Deleting…";
  try {
    const { error } = await sb.from(TABLE).delete().eq("id", pendingDeleteId);
    if (error) throw error;
    appsCache = appsCache.filter(a => a.id !== pendingDeleteId);
    renderStats();
    renderRecentTable();
    renderAppsTable($("#appSearch")?.value.trim().toLowerCase() || "");
    showToast("App deleted.");
    closeConfirm();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't delete app.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Delete app";
  }
}

/* --- Add / Edit modal ----------------------------------------------------- */

function wireModal() {
  $("#modalClose")?.addEventListener("click", closeModal);
  $("#modalCancel")?.addEventListener("click", closeModal);
  $("#modalOverlay")?.addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });

  $("#btnSaveDraft")?.addEventListener("click", () => submitApp("draft"));
  $("#btnPublish")?.addEventListener("click", () => submitApp("published"));

  wireUploader("icon", "iconInput", "iconPreview", false);
  wireUploader("banner", "bannerInput", "bannerPreview", false);
  wireUploader("apk", "apkInput", "apkPreview", false);
  wireUploader("screenshots", "screenshotsInput", "screenshotsPreview", true);
}

function wireUploader(key, inputId, previewId, multiple) {
  const input = $("#" + inputId);
  if (!input) return;
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (multiple) {
      stagedFiles.screenshots.push(...files);
    } else {
      stagedFiles[key] = files[0];
    }
    renderPreview(key, previewId, multiple);
    input.value = "";
  });
}

function renderPreview(key, previewId, multiple) {
  const wrap = $("#" + previewId);
  if (!wrap) return;
  wrap.innerHTML = "";

  const addChip = (label, url, onRemove, isImage) => {
    const chip = document.createElement("div");
    chip.className = "preview-chip";
    chip.innerHTML = isImage
      ? `<img src="${escapeHtml(url)}" alt="">`
      : `<div class="file-icon">${escapeHtml(label)}</div>`;
    const rm = document.createElement("button");
    rm.className = "rm";
    rm.type = "button";
    rm.textContent = "×";
    rm.addEventListener("click", onRemove);
    chip.appendChild(rm);
    wrap.appendChild(chip);
  };

  if (multiple) {
    existingUrls.screenshots.forEach((url, i) => {
      addChip("IMG", url, () => {
        existingUrls.screenshots.splice(i, 1);
        renderPreview(key, previewId, multiple);
      }, true);
    });
    stagedFiles.screenshots.forEach((file, i) => {
      addChip("NEW", URL.createObjectURL(file), () => {
        stagedFiles.screenshots.splice(i, 1);
        renderPreview(key, previewId, multiple);
      }, true);
    });
  } else {
    const file = stagedFiles[key];
    const existing = existingUrls[key];
    if (file) {
      const isImg = file.type.startsWith("image/");
      addChip(file.name.slice(0, 3).toUpperCase(), isImg ? URL.createObjectURL(file) : "", () => {
        stagedFiles[key] = null;
        renderPreview(key, previewId, multiple);
      }, isImg);
    } else if (existing) {
      const isImg = key !== "apk";
      addChip("FILE", existing, () => {
        existingUrls[key] = "";
        renderPreview(key, previewId, multiple);
      }, isImg);
    }
  }
}

function resetModalForm() {
  $("#appForm").reset();
  stagedFiles = { icon: null, banner: null, apk: null, screenshots: [] };
  existingUrls = { icon: "", banner: "", apk: "", screenshots: [] };
  ["iconPreview", "bannerPreview", "apkPreview", "screenshotsPreview"].forEach(id => { $("#" + id).innerHTML = ""; });
  $("#featuredToggle").checked = false;
  $("#trendingToggle").checked = false;
  $("#uploadProgress").classList.remove("show");
  $("#uploadProgress .fill").style.width = "0%";
}

function openModal(app = null) {
  resetModalForm();
  editingId = app ? app.id : null;

  $("#modalTitle").textContent = app ? "Edit App" : "Add New App";
  $("#modalSubtitle").textContent = app ? "Update listing details, media or status." : "Fill in the details to list a new app.";

  if (app) {
    $("#f_name").value = app.name || "";
    $("#f_package").value = app.package_name || "";
    $("#f_category").value = app.category || "";
    $("#f_version").value = app.version || "";
    $("#f_version_code").value = app.version_code ?? "";
    $("#f_size").value = app.size_mb ?? "";
    $("#f_short_desc").value = app.short_description || "";
    $("#f_description").value = app.description || "";
    $("#featuredToggle").checked = !!app.featured;
    $("#trendingToggle").checked = !!app.trending;

    existingUrls.icon = app.icon_url || "";
    existingUrls.banner = app.banner_url || "";
    existingUrls.apk = app.apk_url || "";
    existingUrls.screenshots = Array.isArray(app.screenshots) ? [...app.screenshots] : [];

    renderPreview("icon", "iconPreview", false);
    renderPreview("banner", "bannerPreview", false);
    renderPreview("apk", "apkPreview", false);
    renderPreview("screenshots", "screenshotsPreview", true);

    $("#modalFoot .status-hint").textContent = `Current status: ${app.status === "published" ? "Published" : "Draft"}`;
  } else {
    $("#modalFoot .status-hint").textContent = "New apps start as a draft until you publish them.";
  }

  $("#modalOverlay").classList.add("open");
}

function closeModal() {
  $("#modalOverlay").classList.remove("open");
  editingId = null;
}

function setProgress(pct) {
  const bar = $("#uploadProgress");
  bar.classList.add("show");
  $("#uploadProgress .fill").style.width = pct + "%";
}

async function uploadOne(file, folder) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${folder}/${Date.now()}_${safeName}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function submitApp(status) {
  const name = $("#f_name").value.trim();
  const pkg = $("#f_package").value.trim();

  if (!name || !pkg) {
    showToast("App name and package name are required.", "error");
    return;
  }

  const draftBtn = $("#btnSaveDraft");
  const pubBtn = $("#btnPublish");
  draftBtn.disabled = true;
  pubBtn.disabled = true;
  const activeBtn = status === "published" ? pubBtn : draftBtn;
  activeBtn.innerHTML = status === "published" ? "Publishing…" : "Saving…";

  try {
    setProgress(15);

    const totalUploads = (stagedFiles.icon ? 1 : 0) + (stagedFiles.banner ? 1 : 0) + (stagedFiles.apk ? 1 : 0) + stagedFiles.screenshots.length;
    let done = 0;
    const bump = () => { done++; if (totalUploads) setProgress(15 + Math.round((done / totalUploads) * 70)); };

    let iconUrl = existingUrls.icon;
    if (stagedFiles.icon) { iconUrl = await uploadOne(stagedFiles.icon, "icons"); bump(); }

    let bannerUrl = existingUrls.banner;
    if (stagedFiles.banner) { bannerUrl = await uploadOne(stagedFiles.banner, "banners"); bump(); }

    let apkUrl = existingUrls.apk;
    if (stagedFiles.apk) { apkUrl = await uploadOne(stagedFiles.apk, "apks"); bump(); }

    let screenshotUrls = [...existingUrls.screenshots];
    for (const file of stagedFiles.screenshots) {
      screenshotUrls.push(await uploadOne(file, "screenshots"));
      bump();
    }

    if (!totalUploads) setProgress(85);

    const payload = {
      name,
      package_name: pkg,
      category: $("#f_category").value.trim(),
      short_description: $("#f_short_desc").value.trim(),
      description: $("#f_description").value.trim(),
      version: $("#f_version").value.trim(),
      version_code: $("#f_version_code").value ? Number($("#f_version_code").value) : null,
      size_mb: $("#f_size").value ? Number($("#f_size").value) : null,
      icon_url: iconUrl,
      banner_url: bannerUrl,
      apk_url: apkUrl,
      screenshots: screenshotUrls,
      featured: $("#featuredToggle").checked,
      trending: $("#trendingToggle").checked,
      status,
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      const { error } = await sb.from(TABLE).update(payload).eq("id", editingId);
      if (error) throw error;
      showToast("App updated.");
    } else {
      payload.downloads = 0;
      payload.rating = 0;
      const { error } = await sb.from(TABLE).insert(payload);
      if (error) throw error;
      showToast(status === "published" ? "App published." : "App saved as draft.");
    }

    setProgress(100);
    setTimeout(() => closeModal(), 250);
    await loadApps();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't save app.", "error");
  } finally {
    draftBtn.disabled = false;
    pubBtn.disabled = false;
    draftBtn.innerHTML = "Save as Draft";
    pubBtn.innerHTML = "Publish";
  }
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initLoginPage();
  initDashboardPage();
});
