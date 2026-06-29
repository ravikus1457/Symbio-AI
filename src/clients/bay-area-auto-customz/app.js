/* =========================================================================
   Bay Area Auto Customz — interactive site logic
   - Starlight designer: preview kit sizes (200–800 fibers) AND plot your own
     stars one by one, in gold / white / blue / RGB, with shooting stars.
   - Before/after slider, booking (no backend — opens text/email prefilled),
     DIY-kit + service shortcuts, and a tailored assistant.
   Built for Bay Area Auto Customz by Symbio AI.
   ========================================================================= */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = (min, max) => Math.random() * (max - min) + min;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const BUSINESS = {
    phone: "(925) 536-5086",
    tel: "+19255365086",
    instagram: "https://www.instagram.com/bayareaautocustomz/",
    tiktok: "https://www.tiktok.com/@bayareaautocustomz",
  };

  const KIT_SIZES = [200, 300, 400, 500, 600, 800];
  const COLORS = {
    gold: "#ffd36a",
    white: "#f6fbff",
    blue: "#7bdcff",
  };
  // A small palette for "RGB mix" — fiber-optic style multi-color stars.
  const RGB_PALETTE = ["#ff5b6e", "#ffd36a", "#5bff9e", "#5bd0ff", "#c08bff", "#ff9d5b", "#f6fbff"];

  /* ---------------------------------------------------------- footer year */
  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ============================ STARLIGHT STUDIO ======================== */
  const canvas = $("#headliner");
  if (canvas) initStudio(canvas);

  function initStudio(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    // Headliner ellipse (placement + clip region).
    const ROOF = { cx: W * 0.5, cy: H * 0.46, rx: W * 0.43, ry: H * 0.32 };

    const els = {
      count: $("[data-count]"),
      hint: $("[data-hint]"),
      kitReadout: $("[data-kit-readout]"),
      pkg: $("[data-package]"),
      summaryCount: $("[data-summary-count]"),
      summaryNote: $("[data-summary-note]"),
      size: $("[data-size]"),
      twinkle: $("[data-twinkle]"),
      shooting: $("[data-shooting]"),
      designTools: $("[data-design-tools]"),
    };

    const state = {
      stars: [],
      lines: [],
      trails: [],
      mode: "kit", // "kit" | "design"
      tool: "star", // "star" | "paint" | "erase"
      color: "gold",
      sizeStep: Number(els.size ? els.size.value : 2),
      twinkle: Number(els.twinkle ? els.twinkle.value : 55),
      painting: false,
      lastPoint: null,
      lastPaintAt: 0,
    };

    /* ---- glow sprite cache (fast for hundreds of stars) ---------------- */
    const spriteCache = new Map();
    function sprite(hex) {
      if (spriteCache.has(hex)) return spriteCache.get(hex);
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d");
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.28, hex);
      grad.addColorStop(0.6, hex + "55");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(32, 32, 32, 0, Math.PI * 2);
      g.fill();
      spriteCache.set(hex, s);
      return s;
    }

    function resolveColor() {
      if (state.color === "rgb") return RGB_PALETTE[Math.floor(random(0, RGB_PALETTE.length))];
      return COLORS[state.color] || COLORS.gold;
    }

    function pointFromEvent(ev) {
      const rect = canvas.getBoundingClientRect();
      const src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      return {
        x: ((src.clientX - rect.left) / rect.width) * W,
        y: ((src.clientY - rect.top) / rect.height) * H,
      };
    }

    function insideRoof(p) {
      const n = ((p.x - ROOF.cx) ** 2) / ROOF.rx ** 2 + ((p.y - ROOF.cy) ** 2) / ROOF.ry ** 2;
      return n <= 1;
    }

    function makeStar(p, opts = {}) {
      const base = state.sizeStep;
      return {
        x: p.x,
        y: p.y,
        r: opts.r != null ? opts.r : random(base, base + 1.2),
        color: opts.color || resolveColor(),
        phase: random(0, Math.PI * 2),
        pulse: random(0.3, 0.95),
      };
    }

    function addStar(p, opts = {}) {
      if (!insideRoof(p)) return false;
      const star = makeStar(p, opts);
      state.stars.push(star);
      if (state.tool === "paint" && state.lastPoint && !opts.skipLine) {
        state.lines.push({ x1: state.lastPoint.x, y1: state.lastPoint.y, x2: star.x, y2: star.y, color: star.color });
      }
      state.lastPoint = { x: star.x, y: star.y };
      return true;
    }

    function eraseAt(p) {
      state.stars = state.stars.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) > 38);
      state.lines = state.lines.filter(
        (l) => Math.hypot(l.x1 - p.x, l.y1 - p.y) > 42 && Math.hypot(l.x2 - p.x, l.y2 - p.y) > 42
      );
    }

    function randomRoofPoint(pattern, i, n) {
      if (pattern === "galaxy") {
        const t = i / n;
        const ang = t * Math.PI * 6 + random(-0.3, 0.3);
        const rad = t;
        return {
          x: ROOF.cx + Math.cos(ang) * ROOF.rx * rad * random(0.85, 1.05),
          y: ROOF.cy + Math.sin(ang) * ROOF.ry * rad * random(0.85, 1.05),
        };
      }
      if (pattern === "edge") {
        const ang = random(0, Math.PI * 2);
        const rad = Math.sqrt(random(0.35, 1));
        return { x: ROOF.cx + Math.cos(ang) * ROOF.rx * rad, y: ROOF.cy + Math.sin(ang) * ROOF.ry * rad };
      }
      // uniform scatter (area-correct)
      const ang = random(0, Math.PI * 2);
      const rad = Math.sqrt(random(0, 1));
      return { x: ROOF.cx + Math.cos(ang) * ROOF.rx * rad, y: ROOF.cy + Math.sin(ang) * ROOF.ry * rad };
    }

    function fillKit(n, pattern = "scatter") {
      clearStars(true);
      for (let i = 0; i < n; i += 1) {
        addStar(randomRoofPoint(pattern, i, n), { skipLine: true });
      }
      const label = `${n}-fiber starlight`;
      if (els.pkg) els.pkg.textContent = label;
      update();
    }

    function addShootingStars(count = 3) {
      state.trails = [];
      for (let i = 0; i < count; i += 1) {
        state.trails.push({
          x: random(ROOF.cx - ROOF.rx * 0.4, ROOF.cx + ROOF.rx * 0.5),
          y: random(ROOF.cy - ROOF.ry * 0.5, ROOF.cy + ROOF.ry * 0.2),
          angle: random(-0.55, -0.18),
          length: random(110, 200),
          color: state.color === "rgb" ? "#fff3c0" : resolveColor(),
          phase: random(0, Math.PI * 2),
        });
      }
    }

    function clearStars(keepLabel) {
      state.stars = [];
      state.lines = [];
      state.trails = [];
      state.lastPoint = null;
      if (!keepLabel && els.pkg) els.pkg.textContent = "Custom starlight layout";
      update();
    }

    function closestKit(n) {
      return KIT_SIZES.reduce((best, k) => (Math.abs(k - n) < Math.abs(best - n) ? k : best), KIT_SIZES[0]);
    }

    function update() {
      const n = state.stars.length;
      if (els.count) els.count.textContent = n === 0 ? "Blank headliner · 0 stars" : `${n} star${n === 1 ? "" : "s"} placed`;
      if (els.summaryCount) els.summaryCount.textContent = `${n} star${n === 1 ? "" : "s"}`;

      if (els.summaryNote) {
        if (n === 0) {
          els.summaryNote.textContent = "Closest kit: pick a size or place stars to estimate.";
        } else {
          const ck = closestKit(n);
          const extra = state.trails.length ? " + shooting stars" : "";
          els.summaryNote.textContent = `Closest kit: ${ck}-fiber${extra}. Final quote depends on vehicle & roof.`;
        }
      }
      if (els.kitReadout) {
        els.kitReadout.textContent = n === 0
          ? "Choose a kit size to begin."
          : `Previewing ${n} fibers — about a ${closestKit(n)}-fiber install.`;
      }
      if (els.hint) els.hint.hidden = n > 0;
      requestRender();
    }

    /* ----------------------------------------------------------- drawing */
    function drawBackground() {
      ctx.clearRect(0, 0, W, H);
      // base + faint warm center
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.05, 30, W * 0.5, H * 0.5, W * 0.62);
      bg.addColorStop(0, "rgba(60, 48, 26, 0.45)");
      bg.addColorStop(0.45, "rgba(10, 9, 7, 0.98)");
      bg.addColorStop(1, "#030303");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    function drawRoofPanel() {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ROOF.cx, ROOF.cy, ROOF.rx, ROOF.ry, 0, 0, Math.PI * 2);
      ctx.clip();
      const roof = ctx.createLinearGradient(0, 0, 0, H);
      roof.addColorStop(0, "#16110a");
      roof.addColorStop(0.6, "#070707");
      roof.addColorStop(1, "#020202");
      ctx.fillStyle = roof;
      ctx.fillRect(0, 0, W, H);
      // faint suede perforation lines
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#d7a84f";
      ctx.lineWidth = 1;
      for (let x = -H; x < W; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H * 0.5, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawRoofRim() {
      ctx.strokeStyle = "rgba(255, 221, 138, 0.32)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(ROOF.cx, ROOF.cy, ROOF.rx, ROOF.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    function render(time) {
      drawBackground();
      drawRoofPanel();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ROOF.cx, ROOF.cy, ROOF.rx, ROOF.ry, 0, 0, Math.PI * 2);
      ctx.clip();

      // constellation lines
      if (state.lines.length) {
        ctx.save();
        ctx.setLineDash([7, 9]);
        ctx.lineWidth = 1.4;
        for (const l of state.lines) {
          ctx.strokeStyle = l.color;
          ctx.globalAlpha = 0.32;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // shooting-star trails
      for (const tr of state.trails) {
        const pulse = reduceMotion ? 0.8 : 0.55 + Math.sin(time * 0.002 + tr.phase) * 0.35;
        ctx.save();
        ctx.translate(tr.x, tr.y);
        ctx.rotate(tr.angle);
        const grad = ctx.createLinearGradient(-tr.length, 0, tr.length * 0.2, 0);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.6, tr.color);
        grad.addColorStop(1, "#ffffff");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 + pulse * 2;
        ctx.shadowColor = tr.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(-tr.length, 0);
        ctx.lineTo(tr.length * 0.22, 0);
        ctx.stroke();
        ctx.restore();
      }

      // stars (sprite-based)
      const speed = 0.0004 + state.twinkle / 60000;
      ctx.globalCompositeOperation = "lighter";
      for (const st of state.stars) {
        let a = 0.92;
        if (!reduceMotion && state.twinkle > 0) {
          a = clamp(0.55 + Math.sin(time * speed + st.phase) * st.pulse, 0.18, 1);
        }
        const draw = 3 + st.r * 2.6;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite(st.color), st.x - draw, st.y - draw, draw * 2, draw * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.restore();

      drawRoofRim();

      // watermark label
      ctx.fillStyle = "rgba(255, 221, 138, 0.5)";
      ctx.font = "700 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BAY AREA AUTO CUSTOMZ · STARLIGHT PREVIEW", W * 0.5, H * 0.95);
      ctx.textAlign = "left";
    }

    let rafId = 0;
    let needsRender = true;
    function requestRender() {
      needsRender = true;
    }
    function loop(t) {
      render(t);
      rafId = requestAnimationFrame(loop);
    }
    if (reduceMotion) {
      // No continuous animation; re-render on demand.
      const tick = () => {
        if (needsRender) {
          render(0);
          needsRender = false;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = requestAnimationFrame(loop);
    }

    /* ------------------------------------------------------ canvas input */
    function handlePointer(ev) {
      const p = pointFromEvent(ev);
      if (state.tool === "erase") {
        eraseAt(p);
        update();
        return;
      }
      if (addStar(p)) update();
    }

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      state.painting = true;
      state.lastPoint = null;
      handlePointer(ev);
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!state.painting) return;
      const now = performance.now();
      const gap = state.tool === "star" ? 90 : 22;
      if (now - state.lastPaintAt < gap) return;
      state.lastPaintAt = now;
      handlePointer(ev);
    });
    const stop = () => {
      state.painting = false;
      state.lastPoint = null;
    };
    window.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);

    /* ----------------------------------------------------- control wiring */
    $$("[data-kit-count]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-kit-count]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        fillKit(Number(btn.dataset.kitCount));
        if (els.shooting && els.shooting.checked) addShootingStars();
        update();
      });
    });

    $$("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-tool]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.tool = btn.dataset.tool;
      });
    });

    $$("[data-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-color]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.color = btn.dataset.color;
        // recolor existing stars to match the new selection
        state.stars.forEach((s) => {
          s.color = resolveColor();
        });
        requestRender();
      });
    });

    if (els.size) {
      els.size.addEventListener("input", () => {
        state.sizeStep = Number(els.size.value);
      });
    }
    if (els.twinkle) {
      els.twinkle.addEventListener("input", () => {
        state.twinkle = Number(els.twinkle.value);
        requestRender();
      });
    }
    if (els.shooting) {
      els.shooting.addEventListener("change", () => {
        if (els.shooting.checked) addShootingStars();
        else state.trails = [];
        update();
      });
    }

    // mode toggle
    $$("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-mode]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.mode = btn.dataset.mode;
        const design = state.mode === "design";
        if (els.designTools) els.designTools.hidden = !design;
        if (!design) {
          state.tool = "star";
          $$("[data-tool]").forEach((b) => b.classList.toggle("is-active", b.dataset.tool === "star"));
        }
        if (els.hint && state.stars.length === 0) {
          els.hint.textContent = design
            ? "Click to place stars · drag with Paint to draw a trail · Erase to remove."
            : "Pick a kit size on the right to preview the density.";
        }
      });
    });

    // footer / studio actions
    const saveBtn = $("[data-save]");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        render(performance.now());
        const link = document.createElement("a");
        link.download = "bay-area-auto-customz-starlight.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
    }
    const clearBtn = $("[data-clear]");
    if (clearBtn) clearBtn.addEventListener("click", () => clearStars(false));

    const randomBtn = $("[data-random]");
    if (randomBtn) {
      randomBtn.addEventListener("click", () => {
        const patterns = ["scatter", "galaxy", "edge"];
        const colors = ["gold", "white", "blue", "rgb"];
        const pick = (arr) => arr[Math.floor(random(0, arr.length))];
        state.color = pick(colors);
        $$("[data-color]").forEach((b) => b.classList.toggle("is-active", b.dataset.color === state.color));
        const n = pick(KIT_SIZES);
        fillKit(n, pick(patterns));
        const wantShoot = Math.random() > 0.5;
        if (els.shooting) els.shooting.checked = wantShoot;
        if (wantShoot) addShootingStars();
        $$("[data-kit-count]").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.kitCount) === n));
        update();
      });
    }

    // expose a couple of helpers for the rest of the page
    window.__bacStudio = {
      summary() {
        const n = state.stars.length;
        if (!n) return null;
        return {
          stars: n,
          kit: closestKit(n),
          color: state.color,
          shooting: state.trails.length > 0,
        };
      },
      preset(kind) {
        if (kind === "shooting") {
          if (els.shooting) els.shooting.checked = true;
          if (state.stars.length === 0) fillKit(400);
          addShootingStars();
          $$("[data-kit-count]").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.kitCount) === 400));
        } else {
          if (state.stars.length === 0) {
            fillKit(400);
            $$("[data-kit-count]").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.kitCount) === 400));
          }
        }
        update();
      },
    };

    update();
  }

  /* ============================ BEFORE / AFTER ========================== */
  const compare = $("[data-compare]");
  const compareRange = $("[data-compare-range]");
  if (compare && compareRange) {
    const set = (v) => compare.style.setProperty("--after", `${v}%`);
    set(compareRange.value);
    compareRange.addEventListener("input", () => set(compareRange.value));
  }

  /* ============================ SERVICES ↔ STUDIO ======================= */
  $$('.service[role="button"]').forEach((card) => {
    const go = () => {
      const kind = card.dataset.service;
      if (window.__bacStudio) window.__bacStudio.preset(kind);
      const studio = $("#studio");
      if (studio) studio.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        go();
      }
    });
  });

  /* ============================ BOOKING ================================= */
  const bookingForm = $("[data-booking]");
  const bookingOut = $("[data-booking-out]");
  const serviceSelect = bookingForm ? bookingForm.querySelector('[name="service"]') : null;
  const detailsField = bookingForm ? bookingForm.querySelector('[name="details"]') : null;

  function prefillBooking({ service, details, scroll, focus } = {}) {
    if (service && serviceSelect) {
      const opt = $$("option", serviceSelect).find((o) => o.value === service || o.textContent === service);
      if (opt) serviceSelect.value = opt.value;
    }
    if (details && detailsField) {
      detailsField.value = detailsField.value ? `${detailsField.value}\n${details}` : details;
    }
    if (scroll) {
      const book = $("#book");
      if (book) book.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (focus && bookingForm) {
      const nameField = bookingForm.querySelector('[name="name"]');
      if (nameField) setTimeout(() => nameField.focus(), 400);
    }
  }

  if (bookingForm && bookingOut) {
    bookingForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const data = new FormData(bookingForm);
      const name = (data.get("name") || "").toString().trim();
      const contact = (data.get("contact") || "").toString().trim();
      const vehicle = (data.get("vehicle") || "").toString().trim();
      const service = (data.get("service") || "").toString();
      const details = (data.get("details") || "").toString().trim();

      if (!name || !contact || !vehicle) {
        bookingOut.hidden = false;
        bookingOut.style.borderColor = "rgba(255,111,72,0.5)";
        bookingOut.style.background = "rgba(255,111,72,0.08)";
        bookingOut.textContent = "Please add your name, a phone or email, and your vehicle so we can send a quote.";
        return;
      }

      const lines = [
        "Quote request — Bay Area Auto Customz",
        `Name: ${name}`,
        `Contact: ${contact}`,
        `Vehicle: ${vehicle}`,
        `Service: ${service}`,
      ];
      if (details) lines.push(`Details: ${details}`);
      const message = lines.join("\n");
      const enc = encodeURIComponent(message);
      const smsHref = `sms:${BUSINESS.tel}?&body=${enc}`;
      const mailHref = `mailto:?subject=${encodeURIComponent("Quote request — Bay Area Auto Customz")}&body=${enc}`;

      bookingOut.hidden = false;
      bookingOut.style.borderColor = "rgba(63,208,137,0.4)";
      bookingOut.style.background = "rgba(63,208,137,0.08)";
      bookingOut.innerHTML =
        `Thanks, ${escapeHtml(name)} — your request is ready to send. Pick how you'd like to reach us:` +
        `<span class="booking__send">` +
        `<a class="btn btn--gold btn--sm" href="${smsHref}">Send as text</a>` +
        `<a class="btn btn--ghost btn--sm" href="${mailHref}">Send as email</a>` +
        `<a class="btn btn--ghost btn--sm" href="tel:${BUSINESS.tel}">Call now</a>` +
        `</span>`;
    });
  }

  /* ============================ DIY KITS =============================== */
  $$("[data-kit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      prefillBooking({
        service: "DIY kit",
        details: `Interested in the ${btn.dataset.kit}.`,
        scroll: true,
        focus: true,
      });
    });
  });

  /* ============================ CHATBOT ================================= */
  const chatbot = $("[data-chatbot]");
  const chatLog = $("[data-chat-log]");
  const chatForm = $("[data-chat-form]");

  let greeted = false;
  function greetOnce() {
    if (greeted) return;
    greeted = true;
    addMessage("bot", ANSWERS.greeting);
  }
  function openChat() {
    if (!chatbot) return;
    chatbot.hidden = false;
    greetOnce();
  }
  function toggleChat() {
    if (!chatbot) return;
    chatbot.hidden = !chatbot.hidden;
    if (!chatbot.hidden) greetOnce();
  }
  function addMessage(role, text) {
    if (!chatLog) return;
    const bubble = document.createElement("div");
    bubble.className = `message message--${role === "user" ? "user" : "bot"}`;
    bubble.textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  const ANSWERS = {
    greeting:
      "Hey! I can help with starlight headliners, shooting stars, interior & exterior lighting, custom headliners, butterfly doors, and DIY kits — plus pricing and booking. What are you thinking about?",
    pricing:
      `Most work is custom-quoted by vehicle and the look you want — a starlight headliner depends on the fiber count (try the designer above to preview 200–800 stars), and lighting or butterfly doors are quoted per build. Send your vehicle and the look and we'll get you an exact number. Call or text ${BUSINESS.phone}.`,
    starlight:
      "Starlight headliners are our specialty — individual fiber-optic stars in gold, white, blue, or an RGB mix, with custom density and patterns. Use the designer above to preview a 300 or 500-fiber kit, or plot your own constellation, then hit \"Use this design for my quote.\"",
    shooting:
      "Shooting stars add animated meteor streaks across the headliner for that high-end look. Toggle \"Add shooting stars\" in the designer to see it, and we'll quote it as an add-on to your starlight install.",
    interior:
      "Interior / ambient lighting covers doors, dash, footwells, and accent zones with RGB color control and clean, hidden wiring. Tell us the vehicle and the zones you want lit.",
    exterior:
      "We do exterior lighting too — underglow and accent lighting tuned to your build. Send the vehicle and what you're going for and we'll quote it.",
    headliner:
      "Beyond stars, we replace and wrap headliners in suede / Alcantara and do custom trim accents. Great paired with a starlight install.",
    doors:
      "Yes — we do butterfly (vertical) door conversions, installed clean and reliable. Send your vehicle and we'll let you know fitment and pricing.",
    kits:
      "We sell DIY kits too: a fiber-optic starlight kit, an RGB ambient lighting kit, and a shooting-star add-on — each with the LED engine, fibers/strips, remote, and a setup guide. See the DIY kits section, or tell me your vehicle and I'll point you to the right one.",
    booking:
      `Booking is easy: use the quote form on this page, or call/text ${BUSINESS.phone}. You can also DM us on Instagram (@bayareaautocustomz). Tell us your vehicle, the look you want, and timing, and we'll confirm a quote and an install date.`,
    location:
      "We're in the Bay Area — Walnut Creek and the greater East Bay. Reach out and we'll sort out scheduling.",
    hours:
      `We open at 9:30 AM. The fastest way to reach us is call or text ${BUSINESS.phone}, or DM @bayareaautocustomz.`,
    reviews:
      "We're rated 4.9 stars on Google across 66 reviews — see the Reviews section, and there's a link to read them all on Google.",
    visualizer:
      "Scroll up to the designer: pick a kit size (200–800 fibers) to preview the density, switch to \"Design your own\" to place stars one by one, pick a color, add shooting stars, then save the preview or send it with your quote.",
    default:
      `Happy to help. For the most accurate answer, tell me your vehicle and the look you want, or call/text ${BUSINESS.phone}. You can also try the starlight designer above to preview your headliner.`,
  };

  function classify(textRaw) {
    const t = textRaw.toLowerCase();
    const has = (re) => re.test(t);
    if (has(/\b(price|pricing|cost|quote|how much|expensive|deposit|pay)\b/)) return "pricing";
    if (has(/\b(book|booking|appointment|schedule|reserve|install date|contact|call|text)\b/)) return "booking";
    if (has(/\b(kit|diy|ship|shipping|buy|purchase|order)\b/)) return "kits";
    if (has(/\b(butterfly|lambo|vertical door|doors)\b/)) return "doors";
    if (has(/\b(shoot|meteor|falling star)\b/)) return "shooting";
    if (has(/\b(exterior|underglow|under glow|outside)\b/)) return "exterior";
    if (has(/\b(alcantara|suede|headliner replace|reupholster|trim)\b/)) return "headliner";
    if (has(/\b(interior|ambient|footwell|door light|dash light|rgb)\b/)) return "interior";
    if (has(/\b(star|starlight|fiber|fibre|headliner|twinkle|ceiling|night sky)\b/)) return "starlight";
    if (has(/\b(design|visualizer|preview|demo|simulate|try)\b/)) return "visualizer";
    if (has(/\b(where|location|address|walnut creek|bay area|east bay)\b/)) return "location";
    if (has(/\b(hour|open|close|today|when)\b/)) return "hours";
    if (has(/\b(review|rating|google|stars rating|trust)\b/)) return "reviews";
    if (has(/\b(hi|hey|hello|yo|sup)\b/)) return "greeting";
    return "default";
  }

  function answer(topic) {
    setTimeout(() => addMessage("bot", ANSWERS[topic] || ANSWERS.default), 280);
  }

  $$("[data-chat-toggle]").forEach((b) => b.addEventListener("click", toggleChat));
  $$("[data-q]").forEach((b) => {
    b.addEventListener("click", () => {
      openChat();
      addMessage("user", b.textContent);
      answer(b.dataset.q);
    });
  });

  if (chatForm) {
    chatForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = chatForm.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      addMessage("user", text);
      input.value = "";
      answer(classify(text));
    });
  }

  // studio "use this design for my quote"
  const quoteBtn = $("[data-quote]");
  if (quoteBtn) {
    quoteBtn.addEventListener("click", () => {
      const s = window.__bacStudio && window.__bacStudio.summary();
      if (!s) {
        prefillBooking({ service: "Starlight headliner", scroll: true, focus: true });
        return;
      }
      const colorLabel = s.color === "rgb" ? "RGB mix" : s.color;
      const det =
        `My starlight design: ${s.stars} stars (~${s.kit}-fiber kit), ${colorLabel} color` +
        (s.shooting ? ", with shooting stars." : ".");
      prefillBooking({
        service: s.shooting ? "Starlight + shooting stars" : "Starlight headliner",
        details: det,
        scroll: true,
        focus: true,
      });
    });
  }

  /* ----------------------------------------------------------- utilities */
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
