(() => {
  "use strict";

  /* =====================================================================
     0. DOM CACHE
     ===================================================================== */
  const loadingOverlay = document.getElementById("loadingOverlay");
  const toastEl = document.getElementById("toast");

  const logoTrigger = document.getElementById("logoTrigger");

  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const searchSuggestions = document.getElementById("searchSuggestions");

  const notificationBtn = document.getElementById("notificationBtn");
  const profileBtn = document.getElementById("profileBtn");

  const heroSlider = document.getElementById("heroSlider");
  const sliderTrack = document.getElementById("sliderTrack");
  const sliderPrev = document.getElementById("sliderPrev");
  const sliderNext = document.getElementById("sliderNext");
  const sliderDotsWrap = document.getElementById("sliderDots");

  const categoriesList = document.getElementById("categoriesList");

  const viewAllButtons = Array.from(document.querySelectorAll(".view-all-btn"));

  const bottomNav = document.getElementById("bottomNav");
  const bottomNavLinks = bottomNav ? Array.from(bottomNav.querySelectorAll(".bottom-nav-link")) : [];
  const bottomSearchLink = document.getElementById("bottomSearchLink");
  const bottomProfileLink = document.getElementById("bottomProfileLink");

  const currentYearEl = document.getElementById("currentYear");

  // Data-driven grid targets — populated from Supabase, never hardcoded.
  const featuredAppsEl = document.getElementById("featuredApps");
  const trendingAppsEl = document.getElementById("trendingApps");
  const newAppsEl = document.getElementById("newApps");
  const topChartsEl = document.getElementById("topCharts");
  const recommendedAppsEl = document.getElementById("recommendedApps");

  const appSections = [
    "featuredApps",
    "trendingApps",
    "newApps",
    "topCharts",
    "recommendedApps",
  ];

  // Fallback icon used whenever an app has no icon_url (or the icon fails
  // to load). Points at the site's own logo asset, which already exists
  // and is referenced elsewhere in index.html (header/footer).
  const DEFAULT_APP_ICON = "assets/images/logo-placeholder.svg";

  /* =====================================================================
     1. HELPER FUNCTIONS
     ===================================================================== */

  /** Debounce: delay execution until calls stop for `wait` ms. */
  const debounce = (fn, wait = 300) => {
    let timerId = null;
    return (...args) => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => fn(...args), wait);
    };
  };

  /** Throttle: ensure fn runs at most once per `limit` ms. */
  const throttle = (fn, limit = 200) => {
    let inThrottle = false;
    return (...args) => {
      if (inThrottle) return;
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    };
  };

  /** Show the full-page loading overlay. */
  const showLoading = () => {
    if (!loadingOverlay) return;
    loadingOverlay.hidden = false;
  };

  /** Hide the full-page loading overlay. */
  const hideLoading = () => {
    if (!loadingOverlay) return;
    loadingOverlay.hidden = true;
  };

  /** Reusable toast notification. Auto-hides after 3 seconds. */
  let toastTimerId = null;
  const showToast = (message) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");

    if (toastTimerId) clearTimeout(toastTimerId);
    toastTimerId = setTimeout(() => {
      toastEl.classList.remove("show");
      toastTimerId = null;
    }, 3000);
  };

  /** Smoothly scroll to an element by id, accounting for sticky header. */
  const scrollToId = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const header = document.querySelector(".site-header");
    const offset = header ? header.offsetHeight + 12 : 0;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  /** Formats a raw download count the way Play Store-style listings do. */
  const formatDownloads = (count) => {
    const n = Number(count) || 0;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B+`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M+`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K+`;
    return `${n}+`;
  };

  /** Assigns an icon URL to an <img>, falling back to the default logo
   *  whenever the URL is empty OR the image fails to actually load. */
  const setIconWithFallback = (imgEl, url) => {
    const finalUrl = url && String(url).trim() ? String(url).trim() : DEFAULT_APP_ICON;
    imgEl.src = finalUrl;
    imgEl.addEventListener(
      "error",
      () => {
        if (!imgEl.src.endsWith(DEFAULT_APP_ICON)) {
          imgEl.src = DEFAULT_APP_ICON;
        }
      },
      { once: true }
    );
  };

  /* =====================================================================
     2. LOADING OVERLAY — INITIAL PAGE LOAD
     ===================================================================== */
  const initLoadingOverlay = () => {
    showLoading();
    window.addEventListener(
      "load",
      () => {
        // Small delay so the transition feels intentional, not abrupt.
        setTimeout(hideLoading, 300);
      },
      { once: true }
    );
  };

  /* =====================================================================
     3. HERO SLIDER
     ===================================================================== */

  /**
   * Builds hero slides from featured apps and injects them into the
   * existing #sliderTrack / #sliderDots containers. Apps without a
   * banner_url are skipped entirely (per spec: missing banner = hidden
   * slide). If nothing qualifies, the whole hero section is hidden.
   * @param {Array} featuredApps
   * @returns {{slides: HTMLElement[], dots: HTMLElement[]}}
   */
  const renderHeroSlider = (featuredApps) => {
    if (!sliderTrack || !sliderDotsWrap) return { slides: [], dots: [] };

    const slidesData = (featuredApps || []).filter(
      (app) => app && app.banner_url && String(app.banner_url).trim()
    );

    sliderTrack.innerHTML = "";
    sliderDotsWrap.innerHTML = "";

    if (!slidesData.length) {
      if (heroSlider) heroSlider.hidden = true;
      return { slides: [], dots: [] };
    }

    if (heroSlider) heroSlider.hidden = false;

    const slideEls = [];
    const dotEls = [];

    slidesData.forEach((app, i) => {
      appsById.set(String(app.id), app);
      const isActive = i === 0;

      const article = document.createElement("article");
      article.className = isActive ? "slide active" : "slide";
      article.setAttribute("aria-hidden", String(!isActive));
      article.dataset.appId = String(app.id);

      const bannerImg = document.createElement("img");
      bannerImg.className = "slide-banner";
      bannerImg.loading = "lazy";
      bannerImg.alt = `Promotional banner for ${app.name || "featured app"}`;
      bannerImg.src = app.banner_url;
      // If the banner itself is broken, don't leave a broken-image icon —
      // just hide it so the slider's own background gradient shows through.
      bannerImg.addEventListener("error", () => { bannerImg.style.display = "none"; }, { once: true });

      const content = document.createElement("div");
      content.className = "slide-content";

      const iconImg = document.createElement("img");
      iconImg.className = "slide-app-icon";
      iconImg.width = 72;
      iconImg.height = 72;
      iconImg.loading = "lazy";
      iconImg.alt = `${app.name || "App"} icon`;
      setIconWithFallback(iconImg, app.icon_url);

      const textWrap = document.createElement("div");
      textWrap.className = "slide-text";

      const title = document.createElement("h2");
      title.className = "slide-title";
      title.textContent = app.name || "Untitled app";

      const desc = document.createElement("p");
      desc.className = "slide-desc";
      desc.textContent = app.description || app.developer || "";

      const installBtn = document.createElement("button");
      installBtn.type = "button";
      installBtn.className = "btn btn-install";
      installBtn.setAttribute("aria-label", `Install ${app.name || "app"}`);
      installBtn.dataset.appId = String(app.id);
      installBtn.textContent = "Install";

      textWrap.append(title, desc, installBtn);
      content.append(iconImg, textWrap);
      article.append(bannerImg, content);
      sliderTrack.appendChild(article);
      slideEls.push(article);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = isActive ? "dot active" : "dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-selected", String(isActive));
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
      dot.dataset.slide = String(i);
      sliderDotsWrap.appendChild(dot);
      dotEls.push(dot);
    });

    return { slides: slideEls, dots: dotEls };
  };

  /**
   * Wires up navigation, autoplay, swipe and keyboard controls for a given
   * set of slide/dot elements. Called once, after the slider has been
   * populated with real data.
   * @param {HTMLElement[]} slideEls
   * @param {HTMLElement[]} dotEls
   */
  const initHeroSliderEngine = (slideEls, dotEls) => {
    if (!slideEls.length) return;

    let currentIndex = 0;
    let autoplayId = null;
    const AUTOPLAY_DELAY = 5000;

    const render = () => {
      slideEls.forEach((slide, i) => {
        const isActive = i === currentIndex;
        slide.classList.toggle("active", isActive);
        slide.setAttribute("aria-hidden", String(!isActive));
      });
      dotEls.forEach((dot, i) => {
        const isActive = i === currentIndex;
        dot.classList.toggle("active", isActive);
        dot.setAttribute("aria-selected", String(isActive));
      });
    };

    const goToSlide = (index) => {
      currentIndex = (index + slideEls.length) % slideEls.length; // infinite loop
      render();
    };

    const nextSlide = () => goToSlide(currentIndex + 1);
    const prevSlide = () => goToSlide(currentIndex - 1);

    const startAutoplay = () => {
      stopAutoplay();
      if (slideEls.length > 1) {
        autoplayId = setInterval(nextSlide, AUTOPLAY_DELAY);
      }
    };

    const stopAutoplay = () => {
      if (autoplayId) {
        clearInterval(autoplayId);
        autoplayId = null;
      }
    };

    // Controls
    if (sliderNext) sliderNext.addEventListener("click", () => { nextSlide(); startAutoplay(); });
    if (sliderPrev) sliderPrev.addEventListener("click", () => { prevSlide(); startAutoplay(); });

    if (sliderDotsWrap) {
      sliderDotsWrap.addEventListener("click", (e) => {
        const dot = e.target.closest(".dot");
        if (!dot) return;
        const index = Number(dot.dataset.slide);
        if (Number.isNaN(index)) return;
        goToSlide(index);
        startAutoplay();
      });
    }

    // Pause on hover, resume on leave
    if (heroSlider) {
      heroSlider.addEventListener("mouseenter", stopAutoplay);
      heroSlider.addEventListener("mouseleave", startAutoplay);
      heroSlider.addEventListener("focusin", stopAutoplay);
      heroSlider.addEventListener("focusout", startAutoplay);
    }

    // Touch swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    const SWIPE_THRESHOLD = 40;

    if (heroSlider) {
      heroSlider.addEventListener(
        "touchstart",
        (e) => {
          touchStartX = e.changedTouches[0].screenX;
          stopAutoplay();
        },
        { passive: true }
      );

      heroSlider.addEventListener(
        "touchend",
        (e) => {
          touchEndX = e.changedTouches[0].screenX;
          const delta = touchEndX - touchStartX;
          if (Math.abs(delta) > SWIPE_THRESHOLD) {
            if (delta < 0) nextSlide();
            else prevSlide();
          }
          startAutoplay();
        },
        { passive: true }
      );
    }

    // Keyboard support (Left / Right)
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        prevSlide();
        startAutoplay();
      } else if (e.key === "ArrowRight") {
        nextSlide();
        startAutoplay();
      }
    });

    render();
    startAutoplay();
  };

  /* =====================================================================
     4. SEARCH — QUERIES THE LOADED SUPABASE APP DATA
     ===================================================================== */

  // Populated once at startup from Supabase (see section 14). Search runs
  // against this in-memory list, so results are instant with no per-
  // keystroke network round trip, while the data itself is 100% Supabase.
  let allLoadedApps = [];
  const appsById = new Map();

  const MAX_SUGGESTIONS = 6;

  const renderSuggestions = (matches) => {
    if (!searchSuggestions) return;

    if (!matches.length) {
      searchSuggestions.innerHTML = "";
      searchSuggestions.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
      return;
    }

    searchSuggestions.innerHTML = "";
    matches.slice(0, MAX_SUGGESTIONS).forEach((app) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "suggestion-item";
      btn.setAttribute("role", "option");
      btn.dataset.appId = String(app.id);

      const nameEl = document.createElement("span");
      nameEl.className = "suggestion-name";
      nameEl.textContent = app.name || "Untitled app";

      const metaEl = document.createElement("span");
      metaEl.className = "suggestion-meta";
      metaEl.textContent = [app.developer, app.category].filter(Boolean).join(" · ");

      btn.append(nameEl, metaEl);
      searchSuggestions.appendChild(btn);
    });

    searchSuggestions.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  };

  const runSearch = (query) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      renderSuggestions([]);
      return;
    }

    const matches = allLoadedApps.filter((app) =>
      [app.name, app.developer, app.category, app.version]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(trimmed)
    );

    renderSuggestions(matches);
  };

  const initSearch = () => {
    if (!searchInput || !searchSuggestions || !searchForm) return;

    const debouncedSearch = debounce((value) => runSearch(value), 300);

    searchInput.addEventListener("input", (e) => {
      debouncedSearch(e.target.value);
    });

    // Event delegation for suggestion clicks
    searchSuggestions.addEventListener("click", (e) => {
      const item = e.target.closest(".suggestion-item");
      if (!item) return;
      const appId = item.dataset.appId;
      window.location.href = `app.html?id=${encodeURIComponent(appId)}`;
    });

    // Hide suggestions when clicking outside the search form
    document.addEventListener("click", (e) => {
      if (!searchForm.contains(e.target)) {
        renderSuggestions([]);
      }
    });

    // Prevent full page reload on submit; treat Enter as "search"
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runSearch(searchInput.value);
    });

    // Escape closes suggestions
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        renderSuggestions([]);
        searchInput.blur();
      }
    });
  };

  /* =====================================================================
     5. CATEGORIES — FILTER + ACTIVE STATE
     ===================================================================== */
  const filterApps = (category) => {
    scrollToId("featuredApps");
    showToast(`Showing "${category}" apps`);
  };

  const initCategories = () => {
    if (!categoriesList) return;

    categoriesList.addEventListener("click", (e) => {
      const chip = e.target.closest(".category-chip");
      if (!chip) return;
      e.preventDefault();

      categoriesList.querySelectorAll(".category-chip").forEach((el) => {
        el.classList.remove("active");
      });
      chip.classList.add("active");

      const category = chip.dataset.category || chip.textContent.trim();
      filterApps(category);
    });
  };

  /* =====================================================================
     6. APP CARDS — DYNAMIC RENDERING + INSTALL / NAVIGATION
     ===================================================================== */

  /**
   * Builds a single .app-card element (optionally ranked, for Top Charts)
   * from a Supabase `apps` row. Uses DOM APIs (not innerHTML) so app
   * content can never be interpreted as markup.
   * @param {Object} app
   * @param {{ranked?: boolean, rank?: number|null}} [opts]
   * @returns {HTMLElement}
   */
  const buildAppCard = (app, { ranked = false, rank = null } = {}) => {
    appsById.set(String(app.id), app);

    const card = document.createElement("article");
    card.className = ranked ? "app-card app-card-ranked" : "app-card";
    card.dataset.appId = String(app.id);

    if (ranked) {
      const badge = document.createElement("span");
      badge.className = "rank-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = String(rank);
      card.appendChild(badge);
    }

    const icon = document.createElement("img");
    icon.className = "app-icon";
    icon.width = 64;
    icon.height = 64;
    icon.loading = "lazy";
    icon.alt = `${app.name || "App"} icon`;
    setIconWithFallback(icon, app.icon_url);
    card.appendChild(icon);

    const info = document.createElement("div");
    info.className = "app-info";

    const name = document.createElement("h3");
    name.className = "app-name";
    name.textContent = app.name || "Untitled app";

    const dev = document.createElement("p");
    dev.className = "app-developer";
    dev.textContent = app.developer || "Unknown developer";

    const meta = document.createElement("div");
    meta.className = "app-meta";

    const ratingEl = document.createElement("span");
    ratingEl.className = "app-rating";
    const ratingVal = Number(app.rating);
    if (ratingVal > 0) {
      ratingEl.setAttribute("aria-label", `Rated ${ratingVal.toFixed(1)} out of 5 stars`);
      ratingEl.textContent = `★ ${ratingVal.toFixed(1)}`;
    } else {
      ratingEl.setAttribute("aria-label", "Not yet rated");
      ratingEl.textContent = "New";
    }

    const downloadsEl = document.createElement("span");
    downloadsEl.className = "app-downloads";
    downloadsEl.textContent = `${formatDownloads(app.downloads)} downloads`;

    const sizeEl = document.createElement("span");
    sizeEl.className = "app-size";
    sizeEl.textContent = app.size || "—";

    meta.append(ratingEl, downloadsEl, sizeEl);
    info.append(name, dev, meta);
    card.appendChild(info);

    const installBtn = document.createElement("button");
    installBtn.type = "button";
    installBtn.className = "btn btn-install-small";
    installBtn.setAttribute("aria-label", `Install ${app.name || "app"}`);
    installBtn.dataset.appId = String(app.id);
    installBtn.textContent = "Install";
    card.appendChild(installBtn);

    return card;
  };

  /**
   * Clears a grid container and repopulates it from real app rows.
   * Shows a plain empty message (no styling assumptions) when there's
   * nothing to display, rather than leaving stale placeholder markup.
   * @param {HTMLElement|null} container
   * @param {Array|null} apps
   * @param {{ranked?: boolean}} [opts]
   */
  const renderAppGrid = (container, apps, { ranked = false } = {}) => {
    if (!container) return;
    container.innerHTML = "";

    if (!apps || !apps.length) {
      const empty = document.createElement("p");
      empty.textContent = "No apps to show here yet — check back soon.";
      container.appendChild(empty);
      return;
    }

    apps.forEach((app, i) => {
      container.appendChild(buildAppCard(app, { ranked, rank: ranked ? i + 1 : null }));
    });
  };

  // Set by the data layer once database.js has been loaded.
  let incrementDownloadFn = null;

  const handleInstallClick = (app) => {
    if (!app) {
      showToast("This app isn't available right now.");
      return;
    }
    if (!app.apk_url) {
      showToast(`${app.name || "This app"} isn't ready for download yet.`);
      return;
    }

    showToast(`Preparing ${app.name || "download"}…`);
    window.location.href = app.apk_url;

    // Best-effort analytics — never blocks or breaks the download itself.
    if (typeof incrementDownloadFn === "function") {
      incrementDownloadFn(app.id).catch(() => {});
    }
  };

  /**
   * Single delegated handler covering install buttons and card/slide
   * navigation across the hero slider, every app grid, and search
   * suggestions-adjacent markup.
   */
  const handleAppInteractions = (e) => {
    const installBtn = e.target.closest(".btn-install, .btn-install-small");
    if (installBtn) {
      e.preventDefault();
      const appId = installBtn.dataset.appId;
      const app = appId ? appsById.get(appId) : null;
      handleInstallClick(app);
      return;
    }

    const card = e.target.closest(".app-card, .slide");
    if (card && card.dataset.appId) {
      window.location.href = `app.html?id=${encodeURIComponent(card.dataset.appId)}`;
    }
  };

  /* =====================================================================
     7. VIEW ALL BUTTONS
     ===================================================================== */
  const initViewAllButtons = () => {
    viewAllButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        if (targetId && appSections.includes(targetId)) {
          scrollToId(targetId);
        }
      });
    });
  };

  /* =====================================================================
     8. NOTIFICATION / PROFILE BUTTONS
     ===================================================================== */
  const initHeaderActions = () => {
    if (notificationBtn) {
      notificationBtn.addEventListener("click", () => {
        showToast("No new notifications");
      });
    }

    if (profileBtn) {
      profileBtn.addEventListener("click", () => {
        showToast("Profile feature coming soon");
      });
    }
  };

  /* =====================================================================
     9. BOTTOM NAVIGATION
     ===================================================================== */
  const updateBottomNav = (activeLink) => {
    bottomNavLinks.forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const initBottomNav = () => {
    if (!bottomNav) return;

    bottomNav.addEventListener("click", (e) => {
      const link = e.target.closest(".bottom-nav-link");
      if (!link) return;

      // Search shortcut: focus the search input instead of navigating.
      if (link === bottomSearchLink) {
        e.preventDefault();
        updateBottomNav(link);
        searchInput?.focus();
        return;
      }

      // Profile shortcut: reuse the profile toast.
      if (link === bottomProfileLink) {
        e.preventDefault();
        updateBottomNav(link);
        showToast("Profile feature coming soon");
        return;
      }

      const href = link.getAttribute("href") || "";
      if (href.startsWith("#")) {
        e.preventDefault();
        updateBottomNav(link);
        const id = href.slice(1);
        if (id) scrollToId(id);
      }
    });
  };

  /* =====================================================================
     10. HIDDEN ADMIN TRIGGER
     ===================================================================== */
  const initAdminTrigger = () => {
    if (!logoTrigger) return;

    let clickCount = 0;
    let resetTimerId = null;
    const CLICK_WINDOW_MS = 2000;
    const REQUIRED_CLICKS = 5;

    logoTrigger.addEventListener("click", () => {
      clickCount += 1;

      if (resetTimerId) clearTimeout(resetTimerId);
      resetTimerId = setTimeout(() => {
        clickCount = 0;
      }, CLICK_WINDOW_MS);

      if (clickCount >= REQUIRED_CLICKS) {
        clickCount = 0;
        clearTimeout(resetTimerId);
        window.location.href = "admin-login.html";
      }
    });
  };

  /* =====================================================================
     11. LAZY LOADING IMAGES (fade-in enhancement)
     ===================================================================== */
  const initLazyImages = () => {
    const images = Array.from(document.querySelectorAll("img[loading='lazy']"));
    if (!images.length) return;

    const fadeIn = (img) => {
      img.style.opacity = "0";
      img.style.transition = "opacity 300ms ease";
      requestAnimationFrame(() => {
        img.style.opacity = "1";
      });
    };

    if (!("IntersectionObserver" in window)) {
      images.forEach(fadeIn);
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;

          if (img.complete) {
            fadeIn(img);
          } else {
            img.addEventListener("load", () => fadeIn(img), { once: true });
          }

          obs.unobserve(img);
        });
      },
      { rootMargin: "100px 0px" }
    );

    images.forEach((img) => observer.observe(img));
  };

  /* =====================================================================
     12. SCROLL-BASED BOTTOM NAV SYNC (throttled)
     ===================================================================== */
  const initScrollSync = () => {
    if (!bottomNav) return;

    const homeLink = bottomNavLinks.find((link) => link.getAttribute("href") === "#mainContent");

    const handleScroll = throttle(() => {
      // Simple heuristic: near the top of the page = Home is active.
      if (window.scrollY < 80 && homeLink) {
        updateBottomNav(homeLink);
      }
    }, 200);

    window.addEventListener("scroll", handleScroll, { passive: true });
  };

  /* =====================================================================
     13. FOOTER — CURRENT YEAR
     ===================================================================== */
  const initFooterYear = () => {
    if (!currentYearEl) return;
    currentYearEl.textContent = String(new Date().getFullYear());
  };

  /* =====================================================================
     14. DATA LAYER — SUPABASE (via js/database.js → js/supabase.js)
     ===================================================================== */

  /**
   * Loads every homepage data set from Supabase and renders it into the
   * existing static containers. `database.js` is reached via a dynamic
   * import() so this file can stay a classic <script> (index.html isn't
   * being modified to add type="module") while still using the project's
   * one shared Supabase client under the hood.
   */
  const initHomeData = async () => {
    let db;
    try {
      db = await import("./js/database.js");
    } catch (err) {
      console.error("PaliaAPK HUB: failed to load the database module.", err);
      showToast("Couldn't connect to the app catalog. Please refresh.");
      if (heroSlider) heroSlider.hidden = true;
      renderAppGrid(featuredAppsEl, []);
      renderAppGrid(trendingAppsEl, []);
      renderAppGrid(newAppsEl, []);
      renderAppGrid(topChartsEl, [], { ranked: true });
      renderAppGrid(recommendedAppsEl, []);
      return;
    }

    incrementDownloadFn = db.incrementDownload;

    const [featuredRes, trendingRes, newRes, topRes, generalRes] = await Promise.all([
      db.loadFeaturedApps(10),
      db.loadTrendingApps(10),
      db.loadNewApps(10),
      db.loadTopCharts(10),
      db.loadApps({ page: 1, pageSize: 100 }),
    ]);

    const errors = [featuredRes, trendingRes, newRes, topRes, generalRes]
      .map((r) => r.error)
      .filter(Boolean);
    if (errors.length) {
      console.error("PaliaAPK HUB: one or more catalog queries failed.", errors);
      showToast("Some content couldn't be loaded. Showing what's available.");
    }

    const featured = featuredRes.data || [];
    const trending = trendingRes.data || [];
    const fresh = newRes.data || [];
    const top = topRes.data || [];
    const general = generalRes.data || [];

    // Build the search index / id lookup from everything fetched.
    const merged = new Map();
    [...general, ...featured, ...trending, ...fresh, ...top].forEach((app) => {
      if (app && app.id != null) merged.set(String(app.id), app);
    });
    allLoadedApps = Array.from(merged.values());
    allLoadedApps.forEach((app) => appsById.set(String(app.id), app));

    // Hero slider — featured apps with a banner image only.
    const { slides: heroSlideEls, dots: heroDotEls } = renderHeroSlider(featured);
    initHeroSliderEngine(heroSlideEls, heroDotEls);

    // Section grids.
    renderAppGrid(featuredAppsEl, featured);
    renderAppGrid(trendingAppsEl, trending);
    renderAppGrid(newAppsEl, fresh);
    renderAppGrid(topChartsEl, top, { ranked: true });

    // Recommended — general catalog apps not already shown above. The
    // schema has no dedicated "recommended" flag, so this section surfaces
    // the rest of the catalog rather than repeating apps already listed.
    const alreadyShown = new Set(
      [...featured, ...trending, ...fresh, ...top].map((a) => String(a.id))
    );
    const recommended = general.filter((a) => !alreadyShown.has(String(a.id))).slice(0, 8);
    renderAppGrid(recommendedAppsEl, recommended);

    initLazyImages();
  };

  /* =====================================================================
     15. INIT
     ===================================================================== */
  const init = () => {
    initLoadingOverlay();
    initSearch();
    initCategories();
    document.addEventListener("click", handleAppInteractions);
    initViewAllButtons();
    initHeaderActions();
    initBottomNav();
    initAdminTrigger();
    initScrollSync();
    initFooterYear();

    initHomeData();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
