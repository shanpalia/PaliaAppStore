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
  const slides = sliderTrack ? Array.from(sliderTrack.querySelectorAll(".slide")) : [];
  const sliderPrev = document.getElementById("sliderPrev");
  const sliderNext = document.getElementById("sliderNext");
  const sliderDotsWrap = document.getElementById("sliderDots");
  const sliderDots = sliderDotsWrap ? Array.from(sliderDotsWrap.querySelectorAll(".dot")) : [];

  const categoriesList = document.getElementById("categoriesList");

  const viewAllButtons = Array.from(document.querySelectorAll(".view-all-btn"));

  const bottomNav = document.getElementById("bottomNav");
  const bottomNavLinks = bottomNav ? Array.from(bottomNav.querySelectorAll(".bottom-nav-link")) : [];
  const bottomSearchLink = document.getElementById("bottomSearchLink");
  const bottomProfileLink = document.getElementById("bottomProfileLink");

  const currentYearEl = document.getElementById("currentYear");

  const appSections = [
    "featuredApps",
    "trendingApps",
    "newApps",
    "topCharts",
    "recommendedApps",
  ];

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
  const initHeroSlider = () => {
    if (!slides.length) return;

    let currentIndex = slides.findIndex((slide) => slide.classList.contains("active"));
    if (currentIndex < 0) currentIndex = 0;

    let autoplayId = null;
    const AUTOPLAY_DELAY = 5000;

    const render = () => {
      slides.forEach((slide, i) => {
        const isActive = i === currentIndex;
        slide.classList.toggle("active", isActive);
        slide.setAttribute("aria-hidden", String(!isActive));
      });
      sliderDots.forEach((dot, i) => {
        const isActive = i === currentIndex;
        dot.classList.toggle("active", isActive);
        dot.setAttribute("aria-selected", String(isActive));
      });
    };

    const goToSlide = (index) => {
      currentIndex = (index + slides.length) % slides.length; // infinite loop
      render();
    };

    const nextSlide = () => goToSlide(currentIndex + 1);
    const prevSlide = () => goToSlide(currentIndex - 1);

    const startAutoplay = () => {
      stopAutoplay();
      autoplayId = setInterval(nextSlide, AUTOPLAY_DELAY);
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
     4. SEARCH — LIVE SUGGESTIONS
     ===================================================================== */

  // Placeholder searchable dataset. Will be replaced by loadApps() results.
  const SEARCHABLE_APPS = [
    { id: "app-1", name: "Placeholder App One", developer: "Developer Name", category: "Tools", version: "1.0.0" },
    { id: "app-2", name: "Placeholder App Two", developer: "Developer Name", category: "Social", version: "2.3.1" },
    { id: "app-3", name: "Placeholder App Three", developer: "Developer Name", category: "Games", version: "4.1.0" },
    { id: "app-4", name: "Placeholder App Four", developer: "Developer Name", category: "AI", version: "1.2.0" },
    { id: "app-5", name: "Placeholder App Five", developer: "Developer Name", category: "Utilities", version: "3.0.2" },
    { id: "app-6", name: "Placeholder App Six", developer: "Developer Name", category: "Video", version: "5.5.5" },
    { id: "app-7", name: "Placeholder App Seven", developer: "Developer Name", category: "Music", version: "1.1.1" },
  ];

  const MAX_SUGGESTIONS = 6;

  const renderSuggestions = (matches) => {
    if (!searchSuggestions) return;

    if (!matches.length) {
      searchSuggestions.innerHTML = "";
      searchSuggestions.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
      return;
    }

    searchSuggestions.innerHTML = matches
      .slice(0, MAX_SUGGESTIONS)
      .map(
        (app) => `
          <button type="button" class="suggestion-item" role="option" data-app-id="${app.id}">
            <span class="suggestion-name">${app.name}</span>
            <span class="suggestion-meta">${app.developer} · ${app.category}</span>
          </button>
        `
      )
      .join("");

    searchSuggestions.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  };

  const runSearch = (query) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      renderSuggestions([]);
      return;
    }

    const matches = SEARCHABLE_APPS.filter((app) =>
      [app.name, app.developer, app.category, app.version]
        .join(" ")
        .toLowerCase()
        .includes(trimmed)
    );

    renderSuggestions(matches);
  };

  const initSearch = () => {
    if (!searchInput || !searchSuggestions) return;

    const debouncedSearch = debounce((value) => runSearch(value), 300);

    searchInput.addEventListener("input", (e) => {
      debouncedSearch(e.target.value);
    });

    // Event delegation for suggestion clicks
    searchSuggestions.addEventListener("click", (e) => {
      const item = e.target.closest(".suggestion-item");
      if (!item) return;
      const appId = item.dataset.appId;
      // Placeholder navigation — will route to a real app detail page.
      window.location.href = `app-details.html?id=${encodeURIComponent(appId)}`;
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

  /** Placeholder filter logic — will eventually re-query Supabase data. */
  const filterApps = (category) => {
    // Currently a no-op over placeholder markup; scrolls user to results.
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
     6. APP CARDS — INSTALL BUTTON (EVENT DELEGATION)
     ===================================================================== */
  const initAppCardActions = () => {
    document.addEventListener("click", (e) => {
      const installBtn = e.target.closest(".btn-install, .btn-install-small");
      if (!installBtn) return;

      // NOTE: Future integration point — will trigger a Supabase-backed
      // download/install flow. For now this is a visual placeholder only.
      showToast("Preparing download...");
    });
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
     11. LAZY LOADING IMAGES
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
     14. FUTURE-READY DATA LAYER (SUPABASE PLACEHOLDER)
     ===================================================================== */

  /**
   * Placeholder app dataset — will be replaced by a Supabase query.
   * No credentials or network calls are included here.
   */
  const PLACEHOLDER_APPS = SEARCHABLE_APPS;

  /**
   * Placeholder category dataset — will be replaced by a Supabase query.
   */
  const PLACEHOLDER_CATEGORIES = [
    "AI", "Social", "Games", "Tools", "Utilities",
    "Video", "Music", "Education", "Business", "Photography",
  ];

  /**
   * Future: fetch app records from Supabase.
   * Currently resolves with a static placeholder array.
   * @returns {Promise<Array>}
   */
  const loadApps = async () => {
    // TODO: replace with Supabase client query, e.g.
    // const { data, error } = await supabase.from("apps").select("*");
    return Promise.resolve(PLACEHOLDER_APPS);
  };

  /**
   * Future: render a list of app records into a target grid.
   * Currently a no-op stub — markup is static placeholder HTML for now.
   * @param {Array} apps
   * @param {HTMLElement} container
   */
  const renderApps = (apps, container) => {
    if (!container || !Array.isArray(apps)) return;
    // TODO: build and inject .app-card markup dynamically from `apps`.
  };

  /**
   * Future: fetch category records from Supabase.
   * Currently resolves with a static placeholder array.
   * @returns {Promise<Array>}
   */
  const loadCategories = async () => {
    // TODO: replace with Supabase client query, e.g.
    // const { data, error } = await supabase.from("categories").select("*");
    return Promise.resolve(PLACEHOLDER_CATEGORIES);
  };

  /* =====================================================================
     15. INIT
     ===================================================================== */
  const init = () => {
    initLoadingOverlay();
    initHeroSlider();
    initSearch();
    initCategories();
    initAppCardActions();
    initViewAllButtons();
    initHeaderActions();
    initBottomNav();
    initAdminTrigger();
    initLazyImages();
    initScrollSync();
    initFooterYear();

    // Data layer is ready but inert until a real backend is connected.
    loadApps();
    loadCategories();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
