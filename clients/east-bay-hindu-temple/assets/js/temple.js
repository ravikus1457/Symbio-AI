/* =========================================================================
   East Bay Hindu Temple — site behaviour
   Plain, dependency-free JavaScript. Every feature is guarded by element
   checks, so the file is safe even as sections are added or removed.

   Sections:
     1. Helpers
     2. Mobile menu
     3. Sticky-header shadow
     4. Reveal-on-scroll
     5. "Open now" status from the real opening hours
     6. Next festival + live countdown
     7. Back-to-top button
   The opening hours and festival list below are the single source of truth
   for the live bits of the page — edit these and the UI follows.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- 1. Helpers ------------------------------------------------------ */
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* Opening hours keyed by JS day index (0 = Sunday … 6 = Saturday).
     null = closed. Times are 24h [openHour, closeHour]. Source: temple's
     published hours — update here if they change. */
  var HOURS = {
    0: [10, 16], // Sunday
    1: [10, 16], // Monday
    2: [10, 20], // Tuesday
    3: null, // Wednesday — closed
    4: null, // Thursday — closed
    5: [10, 16], // Friday
    6: [10, 16], // Saturday
  };

  /* Upcoming festivals. Dates are [year, monthIndex(0-11), day]. Keep this
     list in date order; the script highlights the next one automatically.
     Always confirm exact dates with the temple — they can shift by a day. */
  var FESTIVALS = [
    { id: "shivaratri", date: [2026, 1, 15] },
    { id: "holi", date: [2026, 2, 3] },
    { id: "ramnavami", date: [2026, 2, 26] },
    { id: "hanuman", date: [2026, 3, 2] },
    { id: "janmashtami", date: [2026, 8, 4] },
    { id: "ganesh", date: [2026, 8, 14] },
    { id: "navratri", date: [2026, 9, 11] },
    { id: "diwali", date: [2026, 10, 8] },
  ];

  function fmtTime(hour24) {
    var period = hour24 >= 12 ? "PM" : "AM";
    var h = hour24 % 12;
    if (h === 0) h = 12;
    return h + " " + period;
  }

  /* ---- 2. Mobile menu -------------------------------------------------- */
  function initMenu() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var menu = document.querySelector("[data-nav-menu]");
    if (!toggle || !menu) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("is-open", open);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    document.addEventListener("click", function (event) {
      if (
        toggle.getAttribute("aria-expanded") === "true" &&
        !event.target.closest("[data-nav-menu]") &&
        !event.target.closest("[data-nav-toggle]")
      ) {
        setOpen(false);
      }
    });

    window.matchMedia("(min-width: 901px)").addEventListener("change", function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* ---- 3. Sticky-header shadow ---------------------------------------- */
  function initHeaderShadow() {
    var header = document.querySelector("[data-header]");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- 4. Reveal-on-scroll -------------------------------------------- */
  function initReveals() {
    var els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;

    if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
      els.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );

    els.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---- 5. "Open now" status ------------------------------------------- */
  function initOpenStatus() {
    var els = document.querySelectorAll("[data-open-status]");
    if (!els.length) return;

    var now = new Date();
    var day = now.getDay();
    var hour = now.getHours() + now.getMinutes() / 60;
    var today = HOURS[day];
    var isOpen = today && hour >= today[0] && hour < today[1];

    var label;
    if (isOpen) {
      label = "Open now · until " + fmtTime(today[1]);
    } else if (today && hour < today[0]) {
      label = "Opens today at " + fmtTime(today[0]);
    } else {
      // Find the next day that has hours.
      var nextLabel = "Closed now";
      for (var i = 1; i <= 7; i += 1) {
        var d = (day + i) % 7;
        if (HOURS[d]) {
          var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          nextLabel = "Closed now · opens " + names[d] + " " + fmtTime(HOURS[d][0]);
          break;
        }
      }
      label = nextLabel;
    }

    els.forEach(function (el) {
      el.textContent = label;
      el.classList.toggle("is-open", Boolean(isOpen));
      el.classList.toggle("is-closed", !isOpen);
    });

    // Highlight today's row in any timetable.
    var todayRow = document.querySelector('[data-day="' + day + '"]');
    if (todayRow) todayRow.classList.add("is-today");
  }

  /* ---- 6. Next festival + countdown ----------------------------------- */
  function initFestivals() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var next = null;
    for (var i = 0; i < FESTIVALS.length; i += 1) {
      var f = FESTIVALS[i];
      var d = new Date(f.date[0], f.date[1], f.date[2]);
      if (d >= today) {
        next = { id: f.id, date: d };
        break;
      }
    }
    if (!next) return;

    var card = document.querySelector('[data-festival="' + next.id + '"]');
    if (card) {
      card.classList.add("festival--next");
      var badgeHost = card.querySelector("[data-festival-badge]");
      if (badgeHost) badgeHost.innerHTML = '<span class="festival__badge">Next celebration</span>';
    }

    var out = document.querySelector("[data-festival-countdown]");
    if (out) {
      var ms = next.date - today;
      var days = Math.round(ms / 86400000);
      var nameEl = card ? card.querySelector(".festival__name") : null;
      var name = nameEl ? nameEl.textContent.trim() : "our next festival";
      out.textContent =
        days === 0
          ? name + " is being celebrated today — everyone is welcome."
          : days +
            (days === 1 ? " day" : " days") +
            " until " +
            name +
            ". Join us for darshan and prasad.";
    }
  }

  /* ---- 7. Back-to-top -------------------------------------------------- */
  function initBackToTop() {
    var btn = document.querySelector("[data-back-to-top]");
    if (!btn) return;

    var onScroll = function () {
      btn.classList.toggle("is-shown", window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  }

  /* ---- Init ------------------------------------------------------------ */
  function init() {
    initMenu();
    initHeaderShadow();
    initReveals();
    initOpenStatus();
    initFestivals();
    initBackToTop();
    document.getElementById("year") &&
      (document.getElementById("year").textContent = String(new Date().getFullYear()));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
