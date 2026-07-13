/* =========================================================================
   Bay Area Auto Customz — interactive site logic
   - Starlight designer: preview kit sizes (300–4,000 fibers) on a real
     headliner shape in three layout patterns AND plot your own stars, in
     purple / white / blue / RGB, with shooting stars.
   - Shop-video reel switcher, gallery lightbox, booking (no backend — opens
     text/email prefilled), DIY-kit + service shortcuts, and an assistant
     that remembers your vehicle and can prefill the quote form.
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

  // Sergio's real kit sizes — 300-star minimum, up to 4,000.
  const KIT_SIZES = [300, 400, 500, 650, 750, 860, 1100, 1500, 2000, 2500, 3000, 3500, 4000];
  const fmt = (n) => n.toLocaleString("en-US");
  const COLORS = {
    purple: "#c08bff",
    white: "#f6fbff",
    blue: "#7bdcff",
  };
  // A small palette for "RGB mix" — fiber-optic style multi-color stars.
  const RGB_PALETTE = ["#ff5b6e", "#ffd36a", "#5bff9e", "#5bd0ff", "#c08bff", "#ff9d5b", "#f6fbff"];

  /* ---------------------------------------------------------- footer year */
  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------ web fonts */
  // The font stylesheet ships with media="print" so it never blocks first
  // paint; flip it to "all" here (an inline onload= would violate the CSP).
  $$("link[data-font-link]").forEach((l) => {
    l.media = "all";
  });

  /* ------------------------------------------------- sticky-header offset */
  // The sticky header wraps to 1-3 rows depending on width, so anchor jumps
  // need a matching scroll offset. CSS carries a generous fallback; this pins
  // it to the exact measured height.
  const headerEl = $("[data-header]");
  function syncScrollPadding() {
    if (!headerEl) return;
    const h = Math.ceil(headerEl.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.scrollPaddingTop = `${h + 12}px`;
  }
  syncScrollPadding();
  window.addEventListener("resize", syncScrollPadding);

  /* ============================ STARLIGHT STUDIO ======================== */
  const canvas = $("#headliner");
  if (canvas) initStudio(canvas);

  function initStudio(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    // Headliner silhouette (placement + clip region) — a rounded roof panel
    // with a sunroof cut-out, shaped like the real thing instead of an oval.
    const PANEL = { x: W * 0.12, y: H * 0.115, w: W * 0.76, h: H * 0.64 };
    PANEL.r = Math.min(Math.min(PANEL.w, PANEL.h) * 0.07, 48);
    PANEL.cx = PANEL.x + PANEL.w / 2;
    PANEL.cy = PANEL.y + PANEL.h / 2;
    // Orientation: the car runs left-to-right — REAR on the left, FRONT on the
    // right (matching Sergio's diagram). So the windshield hardware lives on the
    // right edge and the grab handles sit on the top/bottom (the door sides).
    // Sunroof glass panel toward the front (right) — no stars land here.
    const SUNROOF = { w: PANEL.w * 0.24, h: PANEL.h * 0.46 };
    SUNROOF.x = PANEL.x + PANEL.w * 0.38;
    SUNROOF.y = PANEL.cy - SUNROOF.h / 2;
    SUNROOF.r = Math.min(SUNROOF.w, SUNROOF.h) * 0.12;

    // The rest of a real headliner's hardware — two sun visors + the overhead
    // map-light console at the front (right edge), grab handles on the door
    // sides (top & bottom). Stars avoid all of these, like a real install.
    const featRect = (fx, fy, fw, fh, rr) => {
      const R = { x: PANEL.x + PANEL.w * fx, y: PANEL.y + PANEL.h * fy, w: PANEL.w * fw, h: PANEL.h * fh };
      R.r = Math.min(R.w, R.h) * (rr == null ? 0.32 : rr);
      return R;
    };
    const VISOR_TR = featRect(0.885, 0.1, 0.065, 0.24, 0.26); // front driver/passenger visors
    const VISOR_BR = featRect(0.885, 0.66, 0.065, 0.24, 0.26);
    const CONSOLE = featRect(0.885, 0.455, 0.055, 0.09, 0.3); // overhead map light (front-center)
    const HANDLE_TOP = featRect(0.27, 0.02, 0.085, 0.03, 0.5); // grab handles above the doors
    const HANDLE_BOT = featRect(0.27, 0.93, 0.085, 0.03, 0.5);
    // Always-present hardware (the sunroof is optional — see state.sunroof).
    const HARDWARE = [VISOR_TR, VISOR_BR, CONSOLE, HANDLE_TOP, HANDLE_BOT];

    // Draw hundreds–thousands of stars smoothly by baking the static field to
    // an offscreen canvas and only animating a small twinkle subset on top.
    const CACHE_ABOVE = 700;
    const field = document.createElement("canvas");
    field.width = W;
    field.height = H;
    const fctx = field.getContext("2d");
    let fieldDirty = true;

    // The background + headliner panel never change, so bake them once instead
    // of rebuilding two gradients and 44 perforation strokes every frame.
    const base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    const bctx = base.getContext("2d");
    let baseReady = false;

    function roundRectPath(c, R) {
      const rr = Math.min(R.r, R.w / 2, R.h / 2);
      c.beginPath();
      c.moveTo(R.x + rr, R.y);
      c.arcTo(R.x + R.w, R.y, R.x + R.w, R.y + R.h, rr);
      c.arcTo(R.x + R.w, R.y + R.h, R.x, R.y + R.h, rr);
      c.arcTo(R.x, R.y + R.h, R.x, R.y, rr);
      c.arcTo(R.x, R.y, R.x + R.w, R.y, rr);
      c.closePath();
    }

    function inRoundRect(p, R) {
      const rr = Math.min(R.r, R.w / 2, R.h / 2);
      if (p.x < R.x || p.x > R.x + R.w || p.y < R.y || p.y > R.y + R.h) return false;
      const dx = Math.min(p.x - R.x, R.x + R.w - p.x);
      const dy = Math.min(p.y - R.y, R.y + R.h - p.y);
      if (dx >= rr || dy >= rr) return true; // outside the rounded corners
      return (rr - dx) ** 2 + (rr - dy) ** 2 <= rr * rr;
    }

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
      sunroof: $("[data-sunroof]"),
      designTools: $("[data-design-tools]"),
    };

    const state = {
      stars: [],
      twinkleStars: [],
      lines: [],
      trails: [],
      mode: "kit", // "kit" | "design"
      tool: "star", // "star" | "paint" | "erase"
      pattern: "scatter", // "scatter" | "galaxy" | "edge"
      lastKitCount: 0,
      color: "purple",
      sizeStep: Number(els.size ? els.size.value : 2),
      twinkle: Number(els.twinkle ? els.twinkle.value : 55),
      sizeScale: 1, // shrinks stars as density rises so they read as pinpoints
      alphaScale: 1, // eases brightness at high density so it doesn't blow out
      sunroof: els.sunroof ? els.sunroof.checked : true, // toggle the sunroof cut-out
      kbCursor: null, // keyboard-placement cursor (design mode)
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
      // Tight bright core + quick falloff reads like a real fiber point,
      // not a soft cloud (so dense kits stay crisp instead of washing out).
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.16, hex);
      grad.addColorStop(0.42, hex + "4d");
      grad.addColorStop(0.72, hex + "12");
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
      return COLORS[state.color] || COLORS.purple;
    }

    function pointFromEvent(ev) {
      const rect = canvas.getBoundingClientRect();
      const src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      return {
        x: ((src.clientX - rect.left) / rect.width) * W,
        y: ((src.clientY - rect.top) / rect.height) * H,
      };
    }

    function insidePanel(p) {
      if (!inRoundRect(p, PANEL)) return false;
      if (state.sunroof && inRoundRect(p, SUNROOF)) return false;
      for (const R of HARDWARE) if (inRoundRect(p, R)) return false;
      return true;
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
        baseA: random(0.62, 1),
      };
    }

    function addStar(p, opts = {}) {
      if (!insidePanel(p)) return false;
      const star = makeStar(p, opts);
      state.stars.push(star);
      if (state.tool === "paint" && state.lastPoint && !opts.skipLine) {
        state.lines.push({ x1: state.lastPoint.x, y1: state.lastPoint.y, x2: star.x, y2: star.y, color: star.color });
      }
      state.lastPoint = { x: star.x, y: star.y };
      // When the big-kit cache is active and clean, paint just the new star into
      // it instead of flagging a full rebake — dragging Paint over a 4,000-star
      // field would otherwise redraw every star per placed star.
      if (state.stars.length > CACHE_ABOVE && !fieldDirty) {
        fctx.globalCompositeOperation = "lighter";
        drawStar(fctx, star, (0.4 + star.baseA * 0.55) * state.alphaScale);
        fctx.globalCompositeOperation = "source-over";
        fctx.globalAlpha = 1;
      } else {
        fieldDirty = true;
      }
      return true;
    }

    function eraseAt(p) {
      state.stars = state.stars.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) > 38);
      state.lines = state.lines.filter(
        (l) => Math.hypot(l.x1 - p.x, l.y1 - p.y) > 42 && Math.hypot(l.x2 - p.x, l.y2 - p.y) > 42
      );
      fieldDirty = true;
    }

    // Pick a star position inside the headliner (never on the sunroof) for the
    // chosen pattern, using rejection sampling so the shape is respected.
    function randomPanelPoint(pattern, i, n) {
      const hw = PANEL.w / 2;
      const hh = PANEL.h / 2;
      for (let tries = 0; tries < 48; tries += 1) {
        let p;
        if (pattern === "galaxy") {
          // start the spiral outside the sunroof so inner stars don't all reject
          const t = 0.14 + 0.86 * ((i + 1) / n);
          const ang = t * Math.PI * 6 + random(-0.3, 0.3);
          p = {
            x: PANEL.cx + Math.cos(ang) * hw * t * random(0.82, 1.02),
            y: PANEL.cy + Math.sin(ang) * hh * t * random(0.82, 1.02),
          };
        } else if (pattern === "edge") {
          const ang = random(0, Math.PI * 2);
          const rad = Math.sqrt(random(0.42, 1));
          p = { x: PANEL.cx + Math.cos(ang) * hw * rad * 1.02, y: PANEL.cy + Math.sin(ang) * hh * rad * 1.02 };
        } else {
          p = { x: random(PANEL.x, PANEL.x + PANEL.w), y: random(PANEL.y, PANEL.y + PANEL.h) };
        }
        if (insidePanel(p)) return p;
      }
      // Scatter fallback — never stack rejected stars on one pixel over the sunroof.
      for (let s = 0; s < 48; s += 1) {
        const p = { x: random(PANEL.x, PANEL.x + PANEL.w), y: random(PANEL.y, PANEL.y + PANEL.h) };
        if (insidePanel(p)) return p;
      }
      return { x: PANEL.x + PANEL.w * 0.12, y: PANEL.cy };
    }

    function fillKit(n, pattern = state.pattern) {
      clearStars(true);
      state.lastKitCount = n;
      for (let i = 0; i < n; i += 1) {
        addStar(randomPanelPoint(pattern, i, n), { skipLine: true });
      }
      const label = `${fmt(n)}-star starlight`;
      if (els.pkg) els.pkg.textContent = label;
      update();
    }

    function addShootingStars(count = 3) {
      state.trails = [];
      for (let i = 0; i < count; i += 1) {
        // meteors streak toward the front (left→right, slight tilt) and repeat
        // after a gap; store the path + timing so render() animates it from `time`.
        const angle = random(-0.16, 0.12);
        const travel = random(PANEL.w * 0.42, PANEL.w * 0.6);
        state.trails.push({
          x0: random(PANEL.x + PANEL.w * 0.04, PANEL.x + PANEL.w * 0.28),
          y0: random(PANEL.y + PANEL.h * 0.12, PANEL.y + PANEL.h * 0.88),
          dx: Math.cos(angle) * travel,
          dy: Math.sin(angle) * travel,
          tail: random(95, 155),
          cycle: random(2600, 4600), // ms for one streak + gap
          offset: random(0, 4600), // stagger so they don't fire in unison
          color: state.color === "rgb" ? "#f6fbff" : resolveColor(),
        });
      }
    }

    function clearStars(keepLabel) {
      state.stars = [];
      state.lines = [];
      state.trails = [];
      state.lastPoint = null;
      fieldDirty = true;
      // A real Clear also forgets the last kit, so a view-only toggle (like the
      // sunroof checkbox) can never resurrect a canvas the user just emptied.
      if (!keepLabel) state.lastKitCount = 0;
      if (!keepLabel && els.pkg) els.pkg.textContent = "Custom starlight layout";
      update();
    }

    function closestKit(n) {
      return KIT_SIZES.reduce((best, k) => (Math.abs(k - n) < Math.abs(best - n) ? k : best), KIT_SIZES[0]);
    }

    function update() {
      const n = state.stars.length;
      // Denser kits = smaller, slightly dimmer points, like real fiber stars.
      state.sizeScale = clamp(1.05 - (n / 4000) * 0.55, 0.5, 1.05);
      state.alphaScale = clamp(1.02 - (n / 4000) * 0.32, 0.64, 1);
      if (els.count) els.count.textContent = n === 0 ? "Blank headliner · 0 stars" : `${fmt(n)} star${n === 1 ? "" : "s"} placed`;
      if (els.summaryCount) els.summaryCount.textContent = `${fmt(n)} star${n === 1 ? "" : "s"}`;

      if (els.summaryNote) {
        if (n === 0) {
          els.summaryNote.textContent = "Closest kit: pick a size or place stars to estimate.";
        } else {
          const ck = closestKit(n);
          const extra = state.trails.length ? " + shooting stars" : "";
          els.summaryNote.textContent = `Closest kit: ${fmt(ck)} stars${extra}. Final quote depends on vehicle & roof.`;
        }
      }
      if (els.kitReadout) {
        els.kitReadout.textContent = n === 0
          ? "Choose a kit size to begin."
          : `Previewing ${fmt(n)} stars — about a ${fmt(closestKit(n))}-star install.`;
      }
      if (els.hint) els.hint.hidden = n > 0;
      requestRender();
    }

    /* ----------------------------------------------------------- drawing */
    function drawBackground(c) {
      c.clearRect(0, 0, W, H);
      // base + faint warm center
      const bg = c.createRadialGradient(W * 0.5, H * 0.05, 30, W * 0.5, H * 0.5, W * 0.62);
      bg.addColorStop(0, "rgba(60, 48, 26, 0.45)");
      bg.addColorStop(0.45, "rgba(10, 9, 7, 0.98)");
      bg.addColorStop(1, "#030303");
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
    }

    function drawHeadlinerPanel(c) {
      c.save();
      roundRectPath(c, PANEL);
      c.clip();
      // suede base
      const roof = c.createLinearGradient(0, PANEL.y, 0, PANEL.y + PANEL.h);
      roof.addColorStop(0, "#18120a");
      roof.addColorStop(0.55, "#0b0a08");
      roof.addColorStop(1, "#040404");
      c.fillStyle = roof;
      c.fillRect(0, 0, W, H);
      // faint suede perforation lines
      c.globalAlpha = 0.045;
      c.strokeStyle = "#d7a84f";
      c.lineWidth = 0.75;
      for (let x = -H; x < W; x += 66) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + H * 0.5, H);
        c.stroke();
      }
      c.globalAlpha = 1;
      // soft depth — the fabric darkens toward the edges so it reads as a
      // gently curved roof panel rather than a flat rectangle
      const depth = c.createRadialGradient(
        PANEL.cx, PANEL.cy, Math.min(PANEL.w, PANEL.h) * 0.12,
        PANEL.cx, PANEL.cy, Math.max(PANEL.w, PANEL.h) * 0.62
      );
      depth.addColorStop(0, "rgba(0, 0, 0, 0)");
      depth.addColorStop(0.62, "rgba(0, 0, 0, 0)");
      depth.addColorStop(1, "rgba(0, 0, 0, 0.32)");
      c.fillStyle = depth;
      c.fillRect(0, 0, W, H);
      // sunroof glass panel (optional; kept star-free, like a real headliner)
      if (state.sunroof) {
        roundRectPath(c, SUNROOF);
        const glass = c.createLinearGradient(SUNROOF.x, SUNROOF.y, SUNROOF.x, SUNROOF.y + SUNROOF.h);
        glass.addColorStop(0, "#080b12");
        glass.addColorStop(1, "#03040a");
        c.fillStyle = glass;
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = "rgba(150, 180, 220, 0.16)";
        c.stroke();
      }
      // visors + overhead console (raised suede panels) and grab handles (slots)
      drawMolding(c, VISOR_TR, "raised");
      drawMolding(c, VISOR_BR, "raised");
      drawMolding(c, CONSOLE, "raised");
      // a single recessed overhead map-light lens (one calm dot, not two "eyes")
      c.beginPath();
      c.arc(CONSOLE.x + CONSOLE.w * 0.5, CONSOLE.y + CONSOLE.h * 0.5, Math.min(CONSOLE.w, CONSOLE.h) * 0.2, 0, Math.PI * 2);
      c.fillStyle = "rgba(255, 222, 150, 0.5)";
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = "rgba(255, 222, 150, 0.25)";
      c.stroke();
      drawMolding(c, HANDLE_TOP, "slot");
      drawMolding(c, HANDLE_BOT, "slot");
      c.restore();
    }

    // Recessed / raised headliner hardware: a soft molded fill + a faint gold
    // seam, plus a top highlight on raised panels so they catch light.
    function drawMolding(c, R, kind) {
      roundRectPath(c, R);
      if (kind === "raised") {
        const g = c.createLinearGradient(0, R.y, 0, R.y + R.h);
        g.addColorStop(0, "rgba(58, 48, 32, 0.5)");
        g.addColorStop(1, "rgba(16, 13, 8, 0.5)");
        c.fillStyle = g;
      } else {
        c.fillStyle = "rgba(0, 0, 0, 0.4)"; // recessed slot (grab handle)
      }
      c.fill();
      c.lineWidth = 1.4;
      c.strokeStyle = "rgba(255, 221, 138, 0.16)";
      c.stroke();
    }

    function bakeBase() {
      drawBackground(bctx);
      drawHeadlinerPanel(bctx);
      baseReady = true;
    }

    function drawHeadlinerRim() {
      roundRectPath(ctx, PANEL);
      ctx.strokeStyle = "rgba(255, 221, 138, 0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function drawStar(c, st, alpha) {
      const draw = (3 + st.r * 2.6) * state.sizeScale;
      c.globalAlpha = alpha;
      c.drawImage(sprite(st.color), st.x - draw, st.y - draw, draw * 2, draw * 2);
    }

    // Bake the whole static star field once; refresh only when stars change.
    function renderField() {
      fctx.clearRect(0, 0, W, H);
      fctx.globalCompositeOperation = "lighter";
      for (const st of state.stars) drawStar(fctx, st, (0.4 + st.baseA * 0.55) * state.alphaScale);
      fctx.globalCompositeOperation = "source-over";
      fctx.globalAlpha = 1;
      const cap = 160;
      const step = Math.max(1, Math.floor(state.stars.length / cap));
      state.twinkleStars = state.stars.filter((_, idx) => idx % step === 0).slice(0, cap);
      fieldDirty = false;
    }

    function render(time, staticTrails) {
      if (!baseReady) bakeBase();
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0);

      ctx.save();
      roundRectPath(ctx, PANEL);
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

      // shooting-star trails — a bright head + fading tail that travels along
      // its path and repeats, so they actually streak instead of sitting still.
      // staticTrails forces the mid-path pose (used by the PNG snapshot so the
      // meteors the customer added can never be caught mid-gap and missing).
      for (const tr of state.trails) {
        let head, alpha;
        if (reduceMotion || staticTrails) {
          head = 0.6;
          alpha = 0.9; // fixed streak pose
        } else {
          const ph = ((time + tr.offset) % tr.cycle) / tr.cycle;
          const active = 0.5; // half the cycle is the streak, half is the gap
          if (ph > active) continue; // in the gap — nothing on screen
          head = ph / active; // 0..1 progress along the path
          alpha = Math.min(1, head / 0.12, (1 - head) / 0.18); // fade in/out
        }
        const len = Math.hypot(tr.dx, tr.dy) || 1;
        const ux = tr.dx / len;
        const uy = tr.dy / len;
        const hx = tr.x0 + tr.dx * head;
        const hy = tr.y0 + tr.dy * head;
        const tx = hx - ux * tr.tail;
        const ty = hy - uy * tr.tail;
        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.7, tr.color);
        grad.addColorStop(1, "#ffffff");
        ctx.save();
        // two-pass stroke instead of shadowBlur — the same glow for a fraction
        // of the per-frame cost on mid-range phones
        ctx.strokeStyle = grad;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.globalAlpha = clamp(alpha, 0, 1) * 0.35;
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = "#ffffff"; // bright head
        ctx.beginPath();
        ctx.arc(hx, hy, 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // stars — cached field + animated twinkle subset for big kits, or fully
      // animated for small/hand-placed layouts.
      const speed = 0.0004 + state.twinkle / 60000;
      ctx.globalCompositeOperation = "lighter";
      if (state.stars.length > CACHE_ABOVE) {
        if (fieldDirty) renderField();
        ctx.globalAlpha = 1;
        ctx.drawImage(field, 0, 0);
        if (!reduceMotion && state.twinkle > 0 && state.twinkleStars) {
          for (const st of state.twinkleStars) {
            const a = clamp(0.12 + Math.sin(time * speed + st.phase) * 0.5, 0, 0.8);
            drawStar(ctx, st, a);
          }
        }
      } else {
        for (const st of state.stars) {
          let a = 0.92;
          if (!reduceMotion && state.twinkle > 0) {
            a = clamp(0.55 + Math.sin(time * speed + st.phase) * st.pulse, 0.18, 1);
          }
          drawStar(ctx, st, a);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.restore();

      drawHeadlinerRim();

      // keyboard cursor (design mode, canvas focused): gold ring + crosshair
      if (state.mode === "design" && state.kbCursor && document.activeElement === canvas) {
        const k = state.kbCursor;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 221, 138, 0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(k.x, k.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(k.x - 17, k.y);
        ctx.lineTo(k.x - 6, k.y);
        ctx.moveTo(k.x + 6, k.y);
        ctx.lineTo(k.x + 17, k.y);
        ctx.moveTo(k.x, k.y - 17);
        ctx.lineTo(k.x, k.y - 6);
        ctx.moveTo(k.x, k.y + 6);
        ctx.lineTo(k.x, k.y + 17);
        ctx.stroke();
        ctx.restore();
      }

      // rear / front orientation labels (car runs left→right) + watermark —
      // scaled up when the canvas is displayed small (phones)
      const wmScale = clamp(labelScale, 1, 1.6);
      ctx.fillStyle = "rgba(245, 241, 232, 0.7)";
      ctx.font = `700 ${Math.round(13 * labelScale)}px Inter, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText("REAR", PANEL.x - 0.018 * W, PANEL.cy);
      ctx.textAlign = "left";
      ctx.fillText("FRONT", PANEL.x + PANEL.w + 0.018 * W, PANEL.cy);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 221, 138, 0.5)";
      ctx.font = `700 ${Math.round(18 * wmScale)}px Inter, sans-serif`;
      ctx.fillText("BAY AREA AUTO CUSTOMZ · STARLIGHT PREVIEW", W * 0.5, H * 0.965);
      ctx.textAlign = "left";
    }

    let rafId = 0;
    let needsRender = true;
    let onScreen = true;

    // Canvas CSS size → backing-store scale, cached so render() never reads
    // layout per frame. Drives the FRONT/REAR label sizing on small screens.
    let labelScale = 1;
    function syncLabelScale() {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0) labelScale = clamp(W / r.width, 1, 3.2);
      requestRender();
    }
    syncLabelScale();
    window.addEventListener("resize", syncLabelScale);

    function requestRender() {
      needsRender = true;
    }
    function loop(t) {
      // Skip the full redraw when nothing on screen animates — a static scene
      // (no trails, twinkle at 0 or empty roof) costs one no-op check per frame.
      const animating = state.trails.length > 0 || (state.twinkle > 0 && state.stars.length > 0);
      if (needsRender || animating) {
        render(t);
        needsRender = false;
      }
      rafId = requestAnimationFrame(loop);
    }
    function startLoop() {
      if (rafId) return;
      rafId = requestAnimationFrame(loop);
    }
    function stopLoop() {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
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
      startLoop();
      // Pause the 60fps loop while the canvas is scrolled off-screen — no sense
      // burning battery animating stars nobody can see (matters on phones).
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(
          (entries) => {
            onScreen = entries[0].isIntersecting;
            if (onScreen) startLoop();
            else stopLoop();
          },
          { threshold: 0 }
        );
        io.observe(canvas);
      }
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

    // Keyboard star placement (design mode): arrows move a visible cursor,
    // Enter/Space places (or erases, with the Erase tool). Keeps the designer
    // usable without a pointer — the canvas is tabbable via tabindex in HTML.
    const KB_MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    canvas.addEventListener("keydown", (ev) => {
      if (state.mode !== "design") return;
      if (KB_MOVES[ev.key]) {
        ev.preventDefault();
        const step = ev.shiftKey ? 56 : 14;
        const c = state.kbCursor || { x: PANEL.cx, y: PANEL.y + PANEL.h * 0.75 };
        c.x = clamp(c.x + KB_MOVES[ev.key][0] * step, PANEL.x, PANEL.x + PANEL.w);
        c.y = clamp(c.y + KB_MOVES[ev.key][1] * step, PANEL.y, PANEL.y + PANEL.h);
        state.kbCursor = c;
        requestRender();
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (!state.kbCursor) state.kbCursor = { x: PANEL.cx, y: PANEL.y + PANEL.h * 0.75 };
        state.lastPoint = null; // keyboard placement never draws paint lines
        if (state.tool === "erase") {
          eraseAt(state.kbCursor);
          update();
        } else if (addStar(state.kbCursor, { skipLine: true })) {
          update();
        }
      }
    });
    canvas.addEventListener("blur", () => {
      state.kbCursor = null;
      requestRender();
    });

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

    $$("[data-pattern]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-pattern]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.pattern = btn.dataset.pattern;
        // re-lay the current kit in the new pattern
        if (state.lastKitCount && state.stars.length) {
          fillKit(state.lastKitCount);
          if (els.shooting && els.shooting.checked) addShootingStars();
          update(); // refresh the "+ shooting stars" note after the re-lay
        }
      });
    });

    $$("[data-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-color]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.color = btn.dataset.color;
        // recolor existing stars — and shooting-star trails — to match
        state.stars.forEach((s) => {
          s.color = resolveColor();
        });
        state.trails.forEach((tr) => {
          tr.color = state.color === "rgb" ? "#f6fbff" : resolveColor();
        });
        fieldDirty = true;
        requestRender();
      });
    });

    if (els.size) {
      els.size.addEventListener("input", () => {
        // Re-scale the stars already on the canvas too — otherwise the slider
        // looks dead in the normal kit flow (it only affected future stars).
        const prev = state.sizeStep;
        state.sizeStep = Number(els.size.value);
        const delta = state.sizeStep - prev;
        if (delta && state.stars.length) {
          state.stars.forEach((s) => {
            s.r = Math.max(0.6, s.r + delta);
          });
          fieldDirty = true;
          requestRender();
        }
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
    if (els.sunroof) {
      els.sunroof.addEventListener("change", () => {
        state.sunroof = els.sunroof.checked;
        baseReady = false; // re-bake the panel with / without the sunroof
        // drop any stars — and their constellation lines — now under the sunroof
        state.stars = state.stars.filter((s) => insidePanel(s));
        state.lines = state.lines.filter((l) => insidePanel({ x: l.x1, y: l.y1 }) && insidePanel({ x: l.x2, y: l.y2 }));
        // Only re-lay a kit that's actually on the canvas (same guard as the
        // pattern buttons) — otherwise toggling the sunroof would resurrect a
        // cleared kit or wipe hand-placed additions.
        if (state.mode === "kit" && state.lastKitCount && state.stars.length) {
          fillKit(state.lastKitCount);
          if (els.shooting && els.shooting.checked) addShootingStars();
          update(); // refresh the "+ shooting stars" note after the re-lay
        } else {
          fieldDirty = true;
          update();
        }
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
        // Always keep the hint copy in sync with the mode — update() handles
        // visibility, so a later Clear can't reveal the wrong mode's text.
        if (els.hint) {
          els.hint.textContent = design
            ? "Click to place stars · drag with Paint to draw a trail · Erase to remove."
            : "Pick a kit size to preview the density.";
        }
      });
    });

    // footer / studio actions
    const saveBtn = $("[data-save]");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        // staticTrails: snapshot with every shooting star posed mid-streak, so
        // the PNG can't catch them mid-gap and invisible
        render(performance.now(), true);
        const link = document.createElement("a");
        link.download = "bay-area-auto-customz-starlight.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        requestRender(); // next frame returns to live animation
      });
    }
    const clearBtn = $("[data-clear]");
    if (clearBtn) clearBtn.addEventListener("click", () => clearStars(false));

    const randomBtn = $("[data-random]");
    if (randomBtn) {
      randomBtn.addEventListener("click", () => {
        const patterns = ["scatter", "galaxy", "edge"];
        const colors = ["purple", "white", "blue", "rgb"];
        const pick = (arr) => arr[Math.floor(random(0, arr.length))];
        state.color = pick(colors);
        $$("[data-color]").forEach((b) => b.classList.toggle("is-active", b.dataset.color === state.color));
        state.pattern = pick(patterns);
        $$("[data-pattern]").forEach((b) => b.classList.toggle("is-active", b.dataset.pattern === state.pattern));
        const n = pick(KIT_SIZES);
        fillKit(n);
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

    // Mirror the visual "is-active" selection to assistive tech as aria-pressed,
    // so screen-reader users know which kit / pattern / color is chosen. One
    // observer per control keeps it in sync no matter which handler flips it.
    $$("[data-mode],[data-kit-count],[data-tool],[data-pattern],[data-color]").forEach((btn) => {
      const sync = () => btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
      sync();
      new MutationObserver(sync).observe(btn, { attributes: true, attributeFilter: ["class"] });
    });

    update();
  }

  /* ============================ SEE IT IN MOTION ======================== */
  // Reel cards play in place; starting one pauses the others. The playing
  // state follows the real media events so the UI never lies about playback.
  const reels = $$("[data-reel]");

  // Load each reel's poster JPEG only as it nears the viewport, so all 11 don't
  // download on first paint (the video bytes are already deferred via preload="none").
  const posterObs =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const v = $(".reel__video", entry.target);
              if (v && v.dataset.poster) {
                v.poster = v.dataset.poster;
                v.removeAttribute("data-poster");
              }
              obs.unobserve(entry.target);
            });
          },
          { rootMargin: "300px" }
        )
      : null;

  reels.forEach((reel) => {
    const video = $(".reel__video", reel);
    const toggle = $("[data-reel-toggle]", reel);
    if (!video || !toggle) return;

    if (posterObs) posterObs.observe(reel);
    else if (video.dataset.poster) video.poster = video.dataset.poster;

    video.addEventListener("play", () => {
      reel.classList.add("is-playing");
      toggle.setAttribute("aria-pressed", "true");
      reels.forEach((other) => {
        if (other === reel) return;
        const v = $(".reel__video", other);
        if (v && !v.paused) v.pause();
      });
    });
    video.addEventListener("pause", () => {
      reel.classList.remove("is-playing");
      toggle.setAttribute("aria-pressed", "false");
    });

    // Clicking a reel opens it full screen and plays it with sound (Sergio's
    // request). Falls back to in-place muted play if fullscreen is unavailable.
    toggle.addEventListener("click", () => openVideoFullscreen(video));

    // When the viewer leaves fullscreen, stop the clip and re-mute so the
    // in-place poster/loop behaviour is clean again.
    const onFsExit = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fsEl) {
        video.pause();
        video.controls = false;
        video.muted = true;
        video.currentTime = 0;
      }
    };
    document.addEventListener("fullscreenchange", onFsExit);
    document.addEventListener("webkitfullscreenchange", onFsExit);
    video.addEventListener("webkitendfullscreen", onFsExit); // iOS
  });

  function openVideoFullscreen(video) {
    video.muted = false;
    video.controls = true;
    video.loop = false;
    // Start playback FIRST, synchronously in the click handler, so the tap's
    // user-activation is spent on play() — not on a fullscreen request that an
    // embedded/iframed page (or a locked-down in-app browser) may block. If we
    // requested fullscreen first and it was denied, the activation would be
    // gone and the clip would never play. Fullscreen is a best-effort bonus.
    const pr = video.play();
    if (pr && pr.catch) {
      pr.catch(() => {
        video.muted = true; // unmuted play blocked → at least play it muted
        video.play().catch(() => {});
      });
    }
    const req =
      video.requestFullscreen ||
      video.webkitRequestFullscreen ||
      video.webkitEnterFullscreen; // iOS Safari (on the <video> itself)
    if (req) {
      try {
        const r = req.call(video);
        if (r && r.catch) r.catch(() => {}); // denied → keep playing inline
      } catch (_) {
        /* no fullscreen here — the clip is already playing inline */
      }
    }
  }

  /* ===================== LIVE SOCIAL FEED (IG / TikTok) ================= */
  // Auto-updating feed. When [data-feed-url] points at a JSON feed (e.g. a free
  // Behold Instagram feed, or any service returning a compatible feed), the
  // newest posts render here on load and stay current as Sergio posts — no code
  // changes needed. With no URL set, the curated fallback cards in the HTML stay
  // put, so the section is never empty or broken.
  const feedRoot = $("[data-social-feed]");
  if (feedRoot) initSocialFeed(feedRoot);

  function initSocialFeed(root) {
    const url = (root.dataset.feedUrl || "").trim();
    if (!url) return; // keep the built-in fallback cards
    const grid = $("[data-feed-grid]", root);
    const status = $("[data-feed-status]", root);
    const max = Number(root.dataset.feedMax) || 8;
    if (!grid) return;

    root.classList.add("is-loading");
    fetch(url, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const posts = normalizePosts(data).slice(0, max);
        if (!posts.length) throw new Error("empty feed");
        grid.innerHTML = "";
        posts.forEach((p) => grid.appendChild(buildFeedCard(p)));
        if (status) status.hidden = true;
        // Now that posts are genuinely live, the copy can promise it.
        const title = $("[data-feed-title]");
        const sub = $("[data-feed-sub]");
        if (title) title.textContent = "Our latest work, updated automatically.";
        if (sub) {
          sub.textContent =
            "Pulled live from our Instagram and TikTok — new builds land here the moment we post. Tap any post to open it.";
        }
      })
      .catch(() => {
        // Leave the fallback cards untouched — never show a broken section.
        if (status) {
          status.hidden = false;
          status.textContent = "Showing recent highlights — follow us for the very latest.";
        }
      })
      .finally(() => root.classList.remove("is-loading"));
  }

  // Tolerate the common feed shapes (Behold, EmbedSocial, raw arrays, etc.).
  // Feed URLs come from third-party JSON — only ever link to real web pages.
  function safeHttpUrl(u) {
    return typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
  }

  function normalizePosts(data) {
    const raw = Array.isArray(data)
      ? data
      : (data && (data.posts || data.data || data.media || data.items)) || [];
    return raw
      .filter((p) => p && typeof p === "object")
      .map((p) => {
        const permalink = safeHttpUrl(p.permalink || p.link || p.url || p.postUrl);
        const type = String(p.mediaType || p.media_type || p.type || "").toUpperCase();
        const isVideo = type.includes("VIDEO") || type.includes("REEL");
        const sizes = p.sizes || {};
        const thumb = safeHttpUrl(
          p.thumbnailUrl ||
            p.thumbnail_url ||
            p.thumbnail ||
            (sizes.small && sizes.small.mediaUrl) ||
            (sizes.medium && sizes.medium.mediaUrl) ||
            p.mediaUrl ||
            p.media_url ||
            p.displayUrl ||
            p.image
        );
        const caption = (p.caption || p.title || "").toString();
        const source = /tiktok/i.test(permalink || "") ? "TikTok" : "Instagram";
        return permalink && thumb ? { permalink, thumb, isVideo, caption, source } : null;
      })
      .filter(Boolean);
  }

  function buildFeedCard(p) {
    const a = document.createElement("a");
    a.className = "feed__card";
    a.href = p.permalink;
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.className = "feed__media";
    img.src = p.thumb;
    img.loading = "lazy";
    const short = p.caption.replace(/\s+/g, " ").trim().slice(0, 80);
    img.alt = short || `${p.source} post from Bay Area Auto Customz`;
    a.appendChild(img);

    if (p.isVideo) {
      const t = document.createElement("span");
      t.className = "feed__type";
      t.setAttribute("aria-hidden", "true");
      t.innerHTML = "&#9654;";
      a.appendChild(t);
    }

    const meta = document.createElement("span");
    meta.className = "feed__meta";
    const src = document.createElement("span");
    src.className = "feed__src";
    src.textContent = p.source;
    meta.appendChild(src);
    meta.appendChild(document.createTextNode(short || "View post"));
    a.appendChild(meta);
    return a;
  }

  /* ===================== LIVE GOOGLE REVIEWS ============================ */
  // Google blocks scraping, so real reviews load from a reviews feed instead.
  // Point [data-reviews-url] at a free Featurable Google-reviews JSON feed (or
  // a Google Places API response, or any JSON with author/rating/text) and the
  // real reviews + live 4.9/69 render and stay current. No URL → fallback cards.
  const reviewsRoot = $("[data-reviews-feed]");
  if (reviewsRoot) initReviews(reviewsRoot);

  function initReviews(root) {
    const url = (root.dataset.reviewsUrl || "").trim();
    if (!url) return; // keep the representative fallback cards
    const grid = $("[data-reviews-grid]", root);
    const max = Number(root.dataset.reviewsMax) || 6;
    if (!grid) return;

    fetch(url, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const { reviews, score, count } = normalizeReviews(data);
        const good = reviews.filter((rv) => rv.rating >= 4).slice(0, max);
        if (!good.length) throw new Error("no reviews");
        grid.innerHTML = "";
        good.forEach((rv) => grid.appendChild(buildReviewCard(rv)));
        if (score) $$("[data-review-score]").forEach((el) => (el.textContent = (Math.round(score * 10) / 10).toFixed(1)));
        if (count) {
          const c = $("[data-review-count]");
          if (c) c.textContent = String(count);
        }
        const src = $("[data-reviews-source]");
        if (src) {
          src.hidden = false;
          src.textContent = "Pulled live from our Google reviews.";
        }
      })
      .catch(() => {}); // leave the fallback cards in place — never break the section
  }

  // Accept Featurable, Google Places (new + legacy), and plain arrays.
  function normalizeReviews(data) {
    const root = data || {};
    const arr = Array.isArray(root)
      ? root
      : root.reviews || (root.result && root.result.reviews) || root.data || [];
    const words = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    const reviews = (Array.isArray(arr) ? arr : [])
      .filter((r) => r && typeof r === "object")
      .map((r) => {
        let rating = r.rating != null ? r.rating : r.starRating != null ? r.starRating : r.stars;
        if (typeof rating === "string") rating = words[rating.toUpperCase()] || Number(rating) || 5;
        // r.text is a string in legacy Places / a {text} object in the new API —
        // never let a bare object fall through and render "[object Object]"
        const rawText = r.text && typeof r.text === "object" ? r.text.text : r.text;
        const text = (typeof rawText === "string" && rawText) || r.comment || r.reviewText || r.review || "";
        const author =
          r.author_name ||
          (r.reviewer && r.reviewer.displayName) ||
          (r.authorAttribution && r.authorAttribution.displayName) ||
          r.author ||
          r.name ||
          "Google reviewer";
        const when =
          r.relative_time_description || r.relativePublishTimeDescription || r.date || r.createTime || "";
        return {
          rating: clamp(Math.round(Number(rating) || 5), 1, 5),
          text: String(text).replace(/\s+/g, " ").trim(),
          author: String(author).trim(),
          when: String(when).trim(),
        };
      })
      .filter((r) => r.text);
    const score =
      root.averageRating || root.rating || (root.result && root.result.rating) || null;
    const count =
      root.totalReviewCount ||
      root.reviewCount ||
      root.user_ratings_total ||
      root.userRatingCount ||
      (root.result && root.result.user_ratings_total) ||
      null;
    return { reviews, score: score ? Number(score) : null, count: count ? Number(count) : null };
  }

  function buildReviewCard(rv) {
    const art = document.createElement("article");
    art.className = "review";
    const stars = document.createElement("span");
    stars.className = "review__stars";
    stars.setAttribute("aria-hidden", "true");
    stars.textContent = "★".repeat(rv.rating) + "☆".repeat(5 - rv.rating);
    const p = document.createElement("p");
    p.textContent = rv.text.length > 240 ? `${rv.text.slice(0, 237).trimEnd()}…` : rv.text;
    const small = document.createElement("small");
    small.textContent = [`— ${rv.author}`, rv.when, "Google"].filter(Boolean).join(" · ");
    art.append(stars, p, small);
    return art;
  }

  /* ============================ SERVICES ↔ STUDIO ======================= */
  // The clickable cards carry .service--link with a real <button> in the h3;
  // clicks anywhere on the card (and native Enter/Space on the button) bubble
  // to this one handler.
  $$(".service--link").forEach((card) => {
    card.addEventListener("click", () => {
      const kind = card.dataset.service;
      if (window.__bacStudio) window.__bacStudio.preset(kind);
      const studio = $("#studio");
      if (studio) studio.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  /* ============================ BOOKING ================================= */
  const bookingForm = $("[data-booking]");
  const bookingOut = $("[data-booking-out]");
  const serviceSelect = bookingForm ? bookingForm.querySelector('[name="service"]') : null;
  const detailsField = bookingForm ? bookingForm.querySelector('[name="details"]') : null;

  const vehicleField = bookingForm ? bookingForm.querySelector('[name="vehicle"]') : null;

  function prefillBooking({ service, details, vehicle, scroll, focus } = {}) {
    if (service && serviceSelect) {
      const opt = $$("option", serviceSelect).find((o) => o.value === service || o.textContent === service);
      if (opt) serviceSelect.value = opt.value;
    }
    if (vehicle && vehicleField) {
      vehicleField.value = vehicle;
    }
    if (details && detailsField) {
      detailsField.value = detailsField.value ? `${detailsField.value}\n${details}` : details;
    }
    if (scroll) {
      const book = $("#book");
      if (book) book.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
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

      // Flag the exact missing fields for assistive tech (and clear old flags).
      bookingForm.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
      if (!name || !contact || !vehicle) {
        [
          ["name", name],
          ["contact", contact],
          ["vehicle", vehicle],
        ].forEach(([field, val]) => {
          if (!val) {
            const el = bookingForm.querySelector(`[name="${field}"]`);
            if (el) el.setAttribute("aria-invalid", "true");
          }
        });
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

      // Alert Sergio automatically: POST to Netlify Forms so he gets an email /
      // text on every submission, even if the visitor never taps a send button.
      // Best-effort — off Netlify (e.g. a preview host) this fails silently and
      // the instant text/call/DM options below still work.
      try {
        const body = new URLSearchParams();
        body.set("form-name", bookingForm.getAttribute("name") || "quote");
        new FormData(bookingForm).forEach((v, k) => body.set(k, v));
        fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }).catch(() => {});
      } catch (_) {
        /* no-op */
      }

      bookingOut.style.borderColor = "rgba(63,208,137,0.4)";
      bookingOut.style.background = "rgba(63,208,137,0.08)";
      bookingOut.innerHTML =
        `Thanks, ${escapeHtml(name)} — your request is ready to send. Pick how you'd like to reach us:` +
        `<span class="booking__send">` +
        `<a class="btn btn--gold btn--sm" href="${smsHref}">Send as text</a>` +
        `<a class="btn btn--ghost btn--sm" href="tel:${BUSINESS.tel}">Call now</a>` +
        `<a class="btn btn--ghost btn--sm" href="${BUSINESS.instagram}" target="_blank" rel="noopener">DM Instagram</a>` +
        `<button class="btn btn--ghost btn--sm" type="button" data-copy-msg>Copy message</button>` +
        `</span>`;
      // sms:/tel: links go nowhere on most desktops — give those visitors a
      // clipboard fallback so the quote text is never trapped in the form.
      const copyBtn = bookingOut.querySelector("[data-copy-msg]");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const done = () => {
            copyBtn.textContent = "Copied — paste it in a text or DM";
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(message).then(done, done);
          } else {
            done();
          }
        });
      }
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

  /* ============================ LIGHTBOX ================================ */
  // Every .media-zoom button (gallery tiles, shop shots, ambient photos)
  // opens its photo full-screen, with prev/next + keyboard navigation.
  const zoomButtons = $$(".media-zoom");
  if (zoomButtons.length) initLightbox(zoomButtons);

  function initLightbox(buttons) {
    const items = buttons
      .map((btn) => {
        const img = btn.querySelector("img");
        return img ? { btn, src: img.currentSrc || img.src, alt: img.alt || "" } : null;
      })
      .filter(Boolean);
    if (!items.length) return;

    const box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo viewer");
    box.hidden = true;
    box.innerHTML =
      '<img class="lightbox__img" src="" alt="" />' +
      '<p class="lightbox__caption"></p>' +
      '<span class="lightbox__count"></span>' +
      '<button class="lightbox__close" type="button" aria-label="Close photo viewer">×</button>' +
      '<button class="lightbox__prev" type="button" aria-label="Previous photo">‹</button>' +
      '<button class="lightbox__next" type="button" aria-label="Next photo">›</button>';
    document.body.appendChild(box);

    const imgEl = $(".lightbox__img", box);
    const captionEl = $(".lightbox__caption", box);
    const countEl = $(".lightbox__count", box);
    const closeBtn = $(".lightbox__close", box);
    const prevBtn = $(".lightbox__prev", box);
    const nextBtn = $(".lightbox__next", box);
    let index = 0;
    let lastTrigger = null;

    function show(i) {
      index = (i + items.length) % items.length;
      const item = items[index];
      imgEl.src = item.src;
      imgEl.alt = item.alt;
      captionEl.textContent = item.alt;
      countEl.textContent = `${index + 1} / ${items.length}`;
    }

    function open(i, trigger) {
      lastTrigger = trigger || null;
      show(i);
      box.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }

    function close() {
      box.hidden = true;
      imgEl.src = "";
      document.body.style.overflow = "";
      if (lastTrigger) lastTrigger.focus();
    }

    items.forEach((item, i) => {
      item.btn.addEventListener("click", () => open(i, item.btn));
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => show(index - 1));
    nextBtn.addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (ev) => {
      if (ev.target === box) close();
    });
    document.addEventListener("keydown", (ev) => {
      if (box.hidden) return;
      if (ev.key === "Escape") {
        close();
      } else if (ev.key === "Tab") {
        // aria-modal promises inertness — keep Tab cycling inside the dialog.
        const focusables = [closeBtn, prevBtn, nextBtn];
        const at = focusables.indexOf(document.activeElement);
        ev.preventDefault();
        const step = ev.shiftKey ? -1 : 1;
        focusables[(at + step + focusables.length) % focusables.length].focus();
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        show(index - 1);
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        show(index + 1);
      }
    });
  }

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
  const chatLaunch = $("[data-chat-launch]");
  const chatClose = chatbot ? $(".chatbot__close", chatbot) : null;

  // One place to open/close so aria-expanded and focus stay honest: focus moves
  // into the panel on open and back to the launcher on close.
  function setChatOpen(open) {
    if (!chatbot) return;
    chatbot.hidden = !open;
    if (chatLaunch) chatLaunch.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      greetOnce();
      if (chatClose) setTimeout(() => chatClose.focus(), 0);
    } else if (chatLaunch) {
      chatLaunch.focus();
    }
  }
  function openChat() {
    setChatOpen(true);
  }
  function toggleChat() {
    setChatOpen(chatbot ? chatbot.hidden : true);
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
      `Most work is custom-quoted by vehicle and the look you want — a starlight headliner depends on the star count (we start at a 300-star kit and go up to 4,000; try the designer above to preview any size), and lighting or butterfly doors are quoted per build. Send your vehicle and the look and we'll get you an exact number. Call or text ${BUSINESS.phone}.`,
    starlight:
      "Starlight headliners are our specialty — individual fiber-optic stars in purple, ice white, blue, or an RGB mix, with custom density and patterns. Kits start at 300 stars and go up to 4,000. Use the designer above to preview a size on a real headliner shape, or plot your own constellation, then hit \"Use this design for my quote.\"",
    shooting:
      "Shooting stars add animated meteor streaks across the headliner for that high-end look. Toggle \"Add shooting stars\" in the designer to see it, and we'll quote it as an add-on to your starlight install.",
    interior:
      "Interior / ambient lighting covers doors, dash, footwells, and accent zones — 16M colors, 200+ modes, music sync, and wireless app + remote control, with clean hidden wiring. Check the Ambient lighting kits section on this page (there's video of it in motion above), then tell us the zones you want lit.",
    exterior:
      "We do exterior lighting too — underglow and accent lighting tuned to your build. Send the vehicle and what you're going for and we'll quote it.",
    headliner:
      "Beyond stars, we replace and wrap headliners in suede / Alcantara and do custom trim accents. Great paired with a starlight install.",
    doors:
      "Yes — we do butterfly (vertical) door conversions, installed clean and reliable. Send your vehicle and we'll let you know fitment and pricing.",
    kits:
      "We sell DIY kits too: a fiber-optic starlight kit, an RGB ambient lighting kit (16M colors, 200+ modes, music sync, app + remote), and a shooting-star add-on — each with the LED engine, fibers/strips, remote, and a setup guide. See the Ambient lighting kits and DIY kits sections, or tell me your vehicle and I'll point you to the right one.",
    booking:
      `Booking is easy: use the quote form on this page, or call/text ${BUSINESS.phone}. You can also DM us on Instagram (@bayareaautocustomz). Tell us your vehicle, the look you want, and timing, and we'll confirm a quote and an install date.`,
    location:
      "We're in the Bay Area — Walnut Creek and the greater East Bay. Reach out and we'll sort out scheduling.",
    hours:
      `We open at 9:30 AM. The fastest way to reach us is call or text ${BUSINESS.phone}, or DM @bayareaautocustomz.`,
    // Read the rating + count from the page at answer time so the assistant can
    // never contradict the site (initReviews updates those spans when the live
    // Google-reviews feed is connected).
    get reviews() {
      const score = ($("[data-review-score]") || {}).textContent || "4.9";
      const count = ($("[data-review-count]") || {}).textContent || "69";
      return `We're rated ${score.trim()} stars on Google across ${count.trim()} reviews — see the Reviews section, and there's a link to read them all on Google.`;
    },
    visualizer:
      "Scroll up to the designer: pick a kit size (300–4,000 stars) to preview the density on a real headliner shape, switch to \"Design your own\" to place stars one by one, pick a color, add shooting stars, then save the preview PNG and attach it when you text or DM us.",
    default:
      `Happy to help. For the most accurate answer, tell me your vehicle and the look you want, or call/text ${BUSINESS.phone}. You can also try the starlight designer above to preview your headliner.`,
  };

  /* ---- language helpers: tolerate plurals & word forms ----------------- */
  function normalizeText(raw) {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // crude singularizer so "starlights", "kits", "doors" hit the same intents.
  // The [^s] guard leaves "ss" words ("address", "glass") intact so intents
  // that match on them (e.g. location/address) still fire.
  function singularize(t) {
    return t.replace(/\b([a-z]{2,}[^s])s\b/g, "$1");
  }

  /* ---- vehicle extraction ---------------------------------------------- */
  const MAKES = [
    "acura", "audi", "bmw", "benz", "mercedes", "lexus", "toyota", "supra", "tacoma", "tundra",
    "honda", "civic", "accord", "infiniti", "nissan", "altima", "maxima", "tesla", "ford",
    "mustang", "chevy", "chevrolet", "camaro", "corvette", "silverado", "tahoe", "dodge",
    "charger", "challenger", "jeep", "ram", "gmc", "cadillac", "escalade", "kia", "hyundai",
    "genesis", "subaru", "wrx", "mazda", "miata", "vw", "volkswagen", "porsche", "lamborghini",
    "ferrari", "maserati", "rivian", "lucid", "hellcat", "scat",
  ];
  const VEHICLE_STOP = new Set([
    "and", "want", "wants", "wanting", "need", "needs", "with", "for", "looking", "that",
    "the", "a", "an", "to", "in", "on", "my", "i", "have", "has", "had", "get", "got",
    "like", "would", "love", "do", "you", "can", "please", "is", "it",
  ]);

  function extractVehicle(raw) {
    const tokens = normalizeText(raw).split(" ");
    const isYear = (w) => /^(19[89]\d|20[0-4]\d)$/.test(w);
    const isMake = (w) => MAKES.includes(w);
    // e92, m3, 540i, w205, gt3rs — letter+digit mixes only (never bare numbers)
    const isModelish = (w) => /^[a-z]{1,3}\d{1,4}[a-z]{0,3}$/.test(w) || /^\d{2,4}[a-z]{1,3}$/.test(w);
    let start = -1;
    let end = -1;
    let strong = false;
    tokens.forEach((w, i) => {
      if (isYear(w) || isMake(w) || isModelish(w)) {
        if (start < 0) start = i;
        end = i;
        if (isMake(w) || isModelish(w)) strong = true;
      }
    });
    if (start < 0 || !strong) return null; // a bare year is not a vehicle
    const parts = [];
    for (let i = start; i <= Math.min(end, start + 5) && parts.length < 4; i += 1) {
      if (!VEHICLE_STOP.has(tokens[i])) parts.push(tokens[i]);
    }
    const v = parts.join(" ").trim();
    return v.length >= 2 ? v : null;
  }

  const VEHICLE_ALLCAPS = new Set(["bmw", "gmc", "vw", "amg", "srt", "wrx"]);
  function prettyVehicle(v) {
    return v
      .split(" ")
      .map((w) => {
        if (VEHICLE_ALLCAPS.has(w) || /^[a-z]{1,3}\d/.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  /* ---- intent engine ---------------------------------------------------- */
  const SERVICE_LABELS = {
    starlight: "Starlight headliner",
    shooting: "Starlight + shooting stars",
    interior: "Interior / ambient lighting",
    exterior: "Exterior lighting",
    headliner: "Custom / Alcantara headliner",
    doors: "Butterfly doors",
    kits: "DIY kit",
  };

  function classify(textRaw) {
    const t = ` ${singularize(normalizeText(textRaw))} `;
    const has = (re) => re.test(t);
    if (has(/\b(price|pricing|cost|quote|how much|expensive|deposit|pay)\b/)) return "pricing";
    if (has(/\b(book|booking|appointment|schedule|reserve|install date|contact|call|text)\b/)) return "booking";
    if (has(/\b(kit|diy|ship|shipping|buy|purchase|order)\b/)) return "kits";
    if (has(/\b(butterfly|lambo|vertical|suicide) ?door\b|\bbutterfly\b/)) return "doors";
    if (has(/\b(shoot\w* star|meteor|falling star)\b/)) return "shooting";
    if (has(/\b(exterior|underglow|under glow|outside)\b/)) return "exterior";
    if (has(/\b(alcantara|suede|reupholster|re upholster|trim wrap)\b/)) return "headliner";
    if (has(/\b(interior|ambient|footwell|door light\w*|dash light\w*|rgb|led strip)\b/)) return "interior";
    if (has(/\b(star|starlight|starlit|fiber|fibre|headliner|twinkle|ceiling|night sky|roof light\w*)\b/)) return "starlight";
    if (has(/\b(design\w*|visualizer|preview|demo|simulate|try it)\b/)) return "visualizer";
    if (has(/\b(where|location|address|located|walnut creek|bay area|east bay)\b/)) return "location";
    if (has(/\b(hour|open|close|today|when)\b/)) return "hours";
    if (has(/\b(review|rating|google|trust)\b/)) return "reviews";
    if (has(/\b(hi|hey|hello|yo|sup|whats up)\b/)) return "greeting";
    return "default";
  }

  // a service can ride along with another intent ("how much is ambient for my civic")
  function detectService(textRaw) {
    const t = ` ${singularize(normalizeText(textRaw))} `;
    const has = (re) => re.test(t);
    if (has(/\b(butterfly|lambo|vertical|suicide) ?door\b|\bbutterfly\b/)) return "doors";
    if (has(/\b(shoot\w* star|meteor|falling star)\b/)) return "shooting";
    if (has(/\b(exterior|underglow|under glow)\b/)) return "exterior";
    if (has(/\b(alcantara|suede|reupholster|re upholster)\b/)) return "headliner";
    if (has(/\b(interior|ambient|footwell|door light\w*|dash light\w*|led strip)\b/)) return "interior";
    if (has(/\b(star|starlight|starlit|fiber|fibre|headliner|twinkle|ceiling|night sky)\b/)) return "starlight";
    if (has(/\b(kit|diy)\b/)) return "kits";
    return null;
  }

  /* ---- conversation memory + reply composition -------------------------- */
  const chatMemory = { vehicle: null, service: null };

  function offerQuoteAction() {
    if (!chatLog || !chatMemory.vehicle || !chatMemory.service) return;
    const old = $(".chat-action", chatLog);
    if (old) old.remove();
    const vehicle = prettyVehicle(chatMemory.vehicle);
    const label = SERVICE_LABELS[chatMemory.service];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-action";
    btn.textContent = `Fill the quote form — ${vehicle} · ${label}`;
    btn.addEventListener("click", () => {
      prefillBooking({
        service: label,
        vehicle,
        details: `From the assistant: interested in ${label.toLowerCase()}.`,
        scroll: true,
        focus: true,
      });
      btn.remove();
      addMessage("bot", "Done — the quote form below is filled in. Add your name and contact, then hit send.");
    });
    chatLog.appendChild(btn);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function respond(rawText) {
    const found = extractVehicle(rawText);
    if (found) chatMemory.vehicle = found;
    const topic = classify(rawText);
    const service = detectService(rawText);
    if (service) chatMemory.service = service;

    const v = chatMemory.vehicle ? prettyVehicle(chatMemory.vehicle) : null;
    let reply = ANSWERS[topic] || ANSWERS.default;

    if (topic === "default" && v) {
      reply = chatMemory.service
        ? `Got it — ${SERVICE_LABELS[chatMemory.service].toLowerCase()} for the ${v}. Use the button below to start your quote, or call/text ${BUSINESS.phone}.`
        : `Nice — a ${v}. What look are you going for: starlight headliner, ambient interior lighting, exterior lighting, or butterfly doors?`;
    } else if (v && SERVICE_LABELS[topic]) {
      reply = `${v} — great canvas for that. ${reply}`;
    } else if (v && topic === "pricing" && chatMemory.service) {
      reply = `For the ${v}, ${SERVICE_LABELS[chatMemory.service].toLowerCase()} is quoted by build — send the details and we'll reply with an exact number. ${reply}`;
    }

    setTimeout(() => {
      addMessage("bot", reply);
      offerQuoteAction();
    }, 280);
  }

  $$("[data-chat-toggle]").forEach((b) => b.addEventListener("click", toggleChat));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && chatbot && !chatbot.hidden) setChatOpen(false);
  });
  $$("[data-q]").forEach((b) => {
    b.addEventListener("click", () => {
      openChat();
      addMessage("user", b.textContent);
      respond(b.textContent);
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
      respond(text);
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
        `My starlight design: ${fmt(s.stars)} stars (~${fmt(s.kit)}-star kit), ${colorLabel} color` +
        (s.shooting ? ", with shooting stars." : ".") +
        " I can text or DM the saved preview PNG.";
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
