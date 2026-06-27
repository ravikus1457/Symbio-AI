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

  /* Donation methods. Fill these with the temple's REAL handles to activate each
     option, then set setupNotice:false to hide the on-screen setup reminder.
     - zelle:  the temple's Zelle email OR phone number
     - venmo:  Venmo username WITHOUT the @ (e.g. "EastBayHinduTemple")
     - paypal: a PayPal.me link ("https://paypal.me/yourtemple") or a hosted
               donate URL ("https://www.paypal.com/donate/?hosted_button_id=...")
     Leave a value as "REPLACE" (or empty) to show it as "coming soon". */
  var DONATION = {
    setupNotice: true,
    presets: [51, 101, 251, 501, 1100],
    zelle: "REPLACE",
    zelleName: "East Bay Hindu Temple",
    venmo: "EastBayHinduTemple",
    paypal: "REPLACE",
    mailingAddress: "East Bay Hindu Temple, 595 School Street, Pittsburg, CA 94565",
  };

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
    // Read the festival name BEFORE injecting the badge — the badge lives inside
    // .festival__name, so reading after would fold "Next celebration" into the name.
    var nameEl = card ? card.querySelector(".festival__name") : null;
    var name = nameEl ? nameEl.textContent.trim() : "our next festival";

    if (card) {
      card.classList.add("festival--next");
      var badgeHost = card.querySelector("[data-festival-badge]");
      if (badgeHost) badgeHost.innerHTML = '<span class="festival__badge">Next celebration</span>';
    }

    var out = document.querySelector("[data-festival-countdown]");
    if (out) {
      var ms = next.date - today;
      var days = Math.round(ms / 86400000);
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

  /* ---- 7. Donation modal ---------------------------------------------- */
  function initDonation() {
    var modal = document.getElementById("donate-modal");
    if (!modal) return;

    var openers = document.querySelectorAll("[data-donate-open]");
    var amountRow = modal.querySelector("[data-amount-row]");
    var methodsEl = modal.querySelector("[data-give-methods]");
    var setupEl = modal.querySelector("[data-donate-setup]");
    var lastFocus = null;
    var amount = null;

    function isSet(v) {
      return v && v !== "REPLACE" && String(v).trim() !== "";
    }

    if (
      DONATION.setupNotice &&
      setupEl &&
      (!isSet(DONATION.venmo) || !isSet(DONATION.paypal) || !isSet(DONATION.zelle))
    ) {
      setupEl.hidden = false;
    }

    function venmoUrl() {
      var p = "txn=pay&note=" + encodeURIComponent("Temple Donation — " + DONATION.zelleName);
      if (amount) p += "&amount=" + amount;
      return "https://venmo.com/u/" + encodeURIComponent(DONATION.venmo) + "?" + p;
    }

    function paypalUrl() {
      var base = DONATION.paypal;
      if (/paypal\.me\//i.test(base)) return base.replace(/\/+$/, "") + (amount ? "/" + amount : "");
      return base;
    }

    function fallbackCopy(text) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {
        /* clipboard unavailable; the value is shown on screen to copy by hand */
      }
    }

    function copyText(text, btn) {
      var original = btn.textContent;
      var done = function () {
        btn.textContent = "Copied!";
        window.setTimeout(function () {
          btn.textContent = original;
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          fallbackCopy(text);
          done();
        });
      } else {
        fallbackCopy(text);
        done();
      }
    }

    function buildMethod(o) {
      var row = document.createElement("div");
      row.className = "give-method";

      var icon = document.createElement("span");
      icon.className = "give-method__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML =
        o.iconSvg ||
        '<strong style="font-family:var(--font-display);font-size:1.25rem">' + o.iconText + "</strong>";

      var main = document.createElement("div");
      main.className = "give-method__main";
      var nm = document.createElement("div");
      nm.className = "give-method__name";
      nm.textContent = o.name;
      var dt = document.createElement("div");
      dt.className = "give-method__detail";
      dt.textContent = o.detail;
      main.appendChild(nm);
      main.appendChild(dt);

      var act = document.createElement("div");
      act.className = "give-method__action";
      if (o.action.type === "link") {
        var a = document.createElement("a");
        a.className = "btn btn--primary";
        a.href = o.action.href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = o.action.label;
        act.appendChild(a);
      } else if (o.action.type === "copy") {
        var cb = document.createElement("button");
        cb.type = "button";
        cb.className = "btn btn--ghost";
        cb.textContent = o.action.label;
        cb.addEventListener("click", function () {
          copyText(o.action.value, cb);
        });
        act.appendChild(cb);
      } else {
        var span = document.createElement("span");
        span.className = "give-method__disabled";
        span.textContent = o.action.label;
        act.appendChild(span);
      }

      row.appendChild(icon);
      row.appendChild(main);
      row.appendChild(act);
      return row;
    }

    function renderMethods() {
      if (!methodsEl) return;
      methodsEl.textContent = "";

      methodsEl.appendChild(
        buildMethod({
          name: "Venmo",
          iconText: "V",
          detail: isSet(DONATION.venmo) ? "@" + DONATION.venmo : "Coming soon — ask the temple",
          action: isSet(DONATION.venmo)
            ? { type: "link", href: venmoUrl(), label: "Open Venmo" }
            : { type: "disabled", label: "Setup" },
        })
      );

      methodsEl.appendChild(
        buildMethod({
          name: "PayPal",
          iconText: "P",
          detail: isSet(DONATION.paypal) ? "Secure online giving" : "Coming soon — ask the temple",
          action: isSet(DONATION.paypal)
            ? { type: "link", href: paypalUrl(), label: "Give with PayPal" }
            : { type: "disabled", label: "Setup" },
        })
      );

      methodsEl.appendChild(
        buildMethod({
          name: "Zelle",
          iconText: "Z",
          detail: isSet(DONATION.zelle)
            ? DONATION.zelle + " · " + DONATION.zelleName
            : "Coming soon — ask the temple",
          action: isSet(DONATION.zelle)
            ? { type: "copy", value: DONATION.zelle, label: "Copy" }
            : { type: "disabled", label: "Setup" },
        })
      );

      methodsEl.appendChild(
        buildMethod({
          name: "Mail a check",
          iconSvg:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg>',
          detail: DONATION.mailingAddress,
          action: { type: "copy", value: DONATION.mailingAddress, label: "Copy" },
        })
      );
    }

    if (amountRow) {
      var makeChip = function (label, value) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "amount-chip";
        b.textContent = label;
        b.addEventListener("click", function () {
          amount = value;
          amountRow.querySelectorAll(".amount-chip").forEach(function (c) {
            c.classList.remove("is-active");
          });
          b.classList.add("is-active");
          renderMethods();
        });
        return b;
      };
      DONATION.presets.forEach(function (amt) {
        amountRow.appendChild(makeChip("$" + amt, amt));
      });
      amountRow.appendChild(makeChip("Other", null));
    }

    renderMethods();

    function openModal() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      var c = modal.querySelector(".modal__close");
      if (c) c.focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    openers.forEach(function (o) {
      o.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    });
    modal.querySelectorAll("[data-donate-close]").forEach(function (c) {
      c.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  /* ---- 8. Back-to-top -------------------------------------------------- */
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
    initDonation();
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
