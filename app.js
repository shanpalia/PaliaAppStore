(() => {
  "use strict";

  /* =====================================================================
     0. DOM CACHE
     ===================================================================== */
  const loadingOverlay = document.getElementById("loadingOverlay");
  let toastEl = document.getElementById("toast");

  const backBtn = document.getElementById("backBtn");
  const headerSearchBtn = document.getElementById("headerSearchBtn");
  const shareBtn = document.getElementById("shareBtn");
  const favoriteBtn = document.getElementById("favoriteBtn");

  const installBtn = document.getElementById("installBtn");
  const wishlistBtn = document.getElementById("wishlistBtn");
  const shareActionBtn = document.getElementById("shareActionBtn");

  const screenshotsScroll = document.getElementById("screenshotsScroll");

  const readMoreBtn = document.getElementById("readMoreBtn");
  const descriptionText = document.getElementById("descriptionText");

  const similarApps = document.getElementById("similarApps");
  const reviewCards = document.getElementById("reviewCards");
  const ratingBars = document.getElementById("ratingBars");
  const safetyList = document.getElementById("safetyList");

  const currentYearEl = document.getElementById("currentYear");

  // Derive the current app id from the query string (?id=...), default fallback.
  const urlParams = new URLSearchParams(window.location.search);
  const currentAppId = urlParams.get("id") || "app-1";

  // localStorage keys
  const WISHLIST_KEY = "webistepaliaapk_wishlist";
  const FAVORITES_KEY = "webistepaliaapk_favorites";

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

  /** Lazily create the toast element if the page markup doesn't include one. */
  const ensureToastEl = () => {
    if (toastEl) return toastEl;
    toastEl = document.createElement("div");
    toastEl.id = "toast";
    toastEl.setAttribute("role", "alert");
    toastEl.setAttribute("aria-live", "assertive");
    document.body.appendChild(toastEl);
    return toastEl;
  };

  /** Reusable toast notification. Auto-hides after 3 seconds. */
  let toastTimerId = null;
  const showToast = (message) => {
    const el = ensureToastEl();
    el.textContent = message;
    el.classList.add("show");

    if (toastTimerId) clearTimeout(toastTimerId);
    toastTimerId = setTimeout(() => {
      el.classList.remove("show");
      toastTimerId = null;
    }, 3000);
  };

  /** Safe localStorage read (returns fallback on error / unavailable storage). */
  const readStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  /** Safe localStorage write (no-op on error). */
  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Storage unavailable — fail silently, feature degrades gracefully. */
    }
  };

  /* =====================================================================
     2. LOADING OVERLAY — INITIAL PAGE LOAD
     ===================================================================== */
  const initLoadingOverlay = () => {
    showLoading();
    window.addEventListener(
      "load",
      () => {
        setTimeout(hideLoading, 300);
      },
      { once: true }
    );
  };

  /* =====================================================================
     3. HEADER ACTIONS — BACK / SEARCH / SHARE / FAVORITE
     ===================================================================== */
  const initBackButton = () => {
    if (!backBtn) return;
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "index.html";
      }
    });
  };

  const initHeaderSearch = () => {
    if (!headerSearchBtn) return;
    headerSearchBtn.addEventListener("click", () => {
      window.location.href = "index.html#mainContent";
    });
  };

  /** Shares the current page via Web Share API, falling back to clipboard copy. */
  const shareCurrentPage = async () => {
    const shareData = {
      title: document.title,
      text: "Check out this app on WebsitePaliaAPK",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled the share sheet — not an error worth surfacing.
        if (err && err.name !== "AbortError") {
          showToast("Unable to share right now");
        }
      }
      return;
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard");
    } catch {
      showToast("Unable to copy link");
    }
  };

  const initShareButtons = () => {
    if (shareBtn) shareBtn.addEventListener("click", shareCurrentPage);
    if (shareActionBtn) shareActionBtn.addEventListener("click", shareCurrentPage);
  };

  const initFavoriteButton = () => {
    if (!favoriteBtn) return;

    const favorites = readStorage(FAVORITES_KEY, []);
    const isFavorited = favorites.includes(currentAppId);
    favoriteBtn.setAttribute("aria-pressed", String(isFavorited));
    favoriteBtn.classList.toggle("is-active", isFavorited);

    favoriteBtn.addEventListener("click", () => {
      const list = readStorage(FAVORITES_KEY, []);
      const index = list.indexOf(currentAppId);
      const nowFavorited = index === -1;

      if (nowFavorited) {
        list.push(currentAppId);
      } else {
        list.splice(index, 1);
      }

      writeStorage(FAVORITES_KEY, list);
      favoriteBtn.setAttribute("aria-pressed", String(nowFavorited));
      favoriteBtn.classList.toggle("is-active", nowFavorited);
      showToast(nowFavorited ? "Added to favorites" : "Removed from favorites");
    });
  };

  /* =====================================================================
     4. INSTALL / WISHLIST
     ===================================================================== */

  /**
   * Future: trigger a real APK download flow (Supabase storage / CDN link).
   * Currently a placeholder that simulates the "preparing" state.
   */
  const downloadAPK = (appId) => {
    // TODO: replace with a real download request, e.g.
    // const { data } = await supabase.storage.from("apks").download(appId);
    showToast("Preparing download...");
    incrementDownloadCounter(appId);
  };

  /**
   * Future: increment a persisted download counter via Supabase.
   * Currently a no-op placeholder.
   */
  const incrementDownloadCounter = (appId) => {
    // TODO: replace with a real increment call, e.g.
    // await supabase.rpc("increment_downloads", { app_id: appId });
  };

  const initInstallButton = () => {
    if (!installBtn) return;
    installBtn.addEventListener("click", () => downloadAPK(currentAppId));
  };

  const initWishlistButton = () => {
    if (!wishlistBtn) return;

    const wishlist = readStorage(WISHLIST_KEY, []);
    const isWishlisted = wishlist.includes(currentAppId);
    wishlistBtn.setAttribute("aria-pressed", String(isWishlisted));
    wishlistBtn.classList.toggle("is-active", isWishlisted);

    wishlistBtn.addEventListener("click", () => {
      const list = readStorage(WISHLIST_KEY, []);
      const index = list.indexOf(currentAppId);
      const nowWishlisted = index === -1;

      if (nowWishlisted) {
        list.push(currentAppId);
      } else {
        list.splice(index, 1);
      }

      writeStorage(WISHLIST_KEY, list);
      wishlistBtn.setAttribute("aria-pressed", String(nowWishlisted));
      wishlistBtn.classList.toggle("is-active", nowWishlisted);
      showToast(nowWishlisted ? "Added to wishlist" : "Removed from wishlist");
    });
  };

  /* =====================================================================
     5. SCREENSHOT GALLERY — SWIPE / KEYBOARD / SCROLL
     ===================================================================== */
  const initScreenshotGallery = () => {
    if (!screenshotsScroll) return;

    const getItemWidth = () => {
      const first = screenshotsScroll.querySelector(".screenshot-item");
      if (!first) return 200;
      const style = window.getComputedStyle(screenshotsScroll);
      const gap = parseFloat(style.columnGap || style.gap || "12") || 12;
      return first.getBoundingClientRect().width + gap;
    };

    const scrollByAmount = (amount) => {
      screenshotsScroll.scrollBy({ left: amount, behavior: "smooth" });
    };

    const nextScreenshot = () => scrollByAmount(getItemWidth());
    const prevScreenshot = () => scrollByAmount(-getItemWidth());

    // Keyboard navigation when the gallery (or a child) is focused.
    screenshotsScroll.setAttribute("tabindex", "0");
    screenshotsScroll.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextScreenshot();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevScreenshot();
      }
    });

    // Touch swipe support
    let touchStartX = 0;
    const SWIPE_THRESHOLD = 40;

    screenshotsScroll.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );

    screenshotsScroll.addEventListener(
      "touchend",
      (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const delta = touchEndX - touchStartX;
        if (Math.abs(delta) > SWIPE_THRESHOLD) {
          if (delta < 0) nextScreenshot();
          else prevScreenshot();
        }
      },
      { passive: true }
    );
  };

  /* =====================================================================
     6. READ MORE / READ LESS
     ===================================================================== */
  const initReadMore = () => {
    if (!readMoreBtn || !descriptionText) return;

    readMoreBtn.addEventListener("click", () => {
      const isExpanded = descriptionText.classList.toggle("expanded");
      readMoreBtn.textContent = isExpanded ? "Read Less" : "Read More";
      readMoreBtn.setAttribute("aria-expanded", String(isExpanded));
    });
  };

  /* =====================================================================
     7. SIMILAR APPS — CLICK NAVIGATION (EVENT DELEGATION)
     ===================================================================== */
  const initSimilarApps = () => {
    if (!similarApps) return;

    similarApps.addEventListener("click", (e) => {
      // Install button inside a similar-app card: show toast, don't navigate.
      const installSmall = e.target.closest(".btn-install-small");
      if (installSmall) {
        e.stopPropagation();
        showToast("Preparing download...");
        return;
      }

      const card = e.target.closest(".similar-app-card");
      if (!card) return;

      const name = card.querySelector(".similar-app-name")?.textContent.trim() || "";
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      window.location.href = `app.html?id=${encodeURIComponent(slug)}`;
    });
  };

  /* =====================================================================
     8. FOOTER — CURRENT YEAR
     ===================================================================== */
  const initFooterYear = () => {
    if (!currentYearEl) return;
    currentYearEl.textContent = String(new Date().getFullYear());
  };

  /* =====================================================================
     9. LAZY LOADING IMAGES
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
     10. GLOBAL KEYBOARD ACCESSIBILITY
     ===================================================================== */
  const initGlobalKeyboardHandlers = () => {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      // Escape closes any open "modal-like" UI (e.g. an expanded description
      // or a future dialog). Currently collapses the description if open.
      if (descriptionText && descriptionText.classList.contains("expanded")) {
        descriptionText.classList.remove("expanded");
        if (readMoreBtn) {
          readMoreBtn.textContent = "Read More";
          readMoreBtn.setAttribute("aria-expanded", "false");
        }
      }
    });
  };

  /* =====================================================================
     11. SCROLL PERFORMANCE (THROTTLED, PASSIVE)
     ===================================================================== */
  const initScrollPerformance = () => {
    const handleScroll = throttle(() => {
      // Reserved for future scroll-linked UI (e.g. sticky install bar).
    }, 200);

    window.addEventListener("scroll", handleScroll, { passive: true });
  };

  /* =====================================================================
     12. FUTURE-READY DATA LAYER (SUPABASE PLACEHOLDER)
     ===================================================================== */

  /** Placeholder screenshot dataset — will be replaced by Supabase storage URLs. */
  const PLACEHOLDER_SCREENSHOTS = [
    "assets/images/screenshot-placeholder-1.jpg",
    "assets/images/screenshot-placeholder-2.jpg",
    "assets/images/screenshot-placeholder-3.jpg",
    "assets/images/screenshot-placeholder-4.jpg",
    "assets/images/screenshot-placeholder-5.jpg",
  ];

  /** Placeholder review dataset — will be replaced by a Supabase query. */
  const PLACEHOLDER_REVIEWS = [
    { author: "Reviewer One", stars: 5, text: "Placeholder review text describing a positive first impression of the app.", date: "2026-06-01" },
    { author: "Reviewer Two", stars: 4, text: "Placeholder review text mentioning a helpful feature and a minor suggestion.", date: "2026-05-22" },
    { author: "Reviewer Three", stars: 5, text: "Placeholder review text praising the app's speed and reliability.", date: "2026-05-10" },
  ];

  /** Placeholder similar-apps dataset — will be replaced by a Supabase query. */
  const PLACEHOLDER_SIMILAR_APPS = [
    { id: "app-2", name: "Placeholder App Two", rating: 4.2 },
    { id: "app-3", name: "Placeholder App Three", rating: 4.8 },
    { id: "app-4", name: "Placeholder App Four", rating: 4.6 },
    { id: "app-5", name: "Placeholder App Five", rating: 4.1 },
  ];

  /** Placeholder app record — will be replaced by a Supabase query keyed on id. */
  const PLACEHOLDER_APP = {
    id: "app-1",
    name: "Placeholder App One",
    developer: "Developer Name",
    rating: 4.5,
    downloads: "10K+",
    size: "25 MB",
    version: "1.0.0",
  };

  /**
   * Future: fetch a single app record from Supabase by id.
   * Currently resolves with a static placeholder object.
   * @returns {Promise<Object>}
   */
  const loadApp = async () => {
    // TODO: replace with Supabase client query, e.g.
    // const { data } = await supabase.from("apps").select("*").eq("id", currentAppId).single();
    return Promise.resolve(PLACEHOLDER_APP);
  };

  /**
   * Future: fetch screenshot URLs for the current app from Supabase storage.
   * Currently resolves with a static placeholder array.
   * @returns {Promise<Array<string>>}
   */
  const loadScreenshots = async () => {
    // TODO: replace with Supabase storage list query.
    return Promise.resolve(PLACEHOLDER_SCREENSHOTS);
  };

  /**
   * Future: fetch reviews for the current app from Supabase.
   * Currently resolves with a static placeholder array.
   * @returns {Promise<Array>}
   */
  const loadReviews = async () => {
    // TODO: replace with Supabase client query, e.g.
    // const { data } = await supabase.from("reviews").select("*").eq("app_id", currentAppId);
    return Promise.resolve(PLACEHOLDER_REVIEWS);
  };

  /**
   * Future: fetch similar apps for the current app from Supabase.
   * Currently resolves with a static placeholder array.
   * @returns {Promise<Array>}
   */
  const loadSimilarApps = async () => {
    // TODO: replace with Supabase client query (e.g. same category, excluding current id).
    return Promise.resolve(PLACEHOLDER_SIMILAR_APPS);
  };

  /* =====================================================================
     13. INIT
     ===================================================================== */
  const init = () => {
    initLoadingOverlay();
    initBackButton();
    initHeaderSearch();
    initShareButtons();
    initFavoriteButton();
    initInstallButton();
    initWishlistButton();
    initScreenshotGallery();
    initReadMore();
    initSimilarApps();
    initFooterYear();
    initLazyImages();
    initGlobalKeyboardHandlers();
    initScrollPerformance();

    // Data layer is ready but inert until a real backend is connected.
    loadApp();
    loadScreenshots();
    loadReviews();
    loadSimilarApps();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
