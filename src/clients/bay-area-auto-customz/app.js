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

  /* ============================ STARLIGHT STUDIO ======================== */
  const canvas = $("#headliner");
  if (canvas) initStudio(canvas);

  function initStudio(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    // Headliner silhouette (placement + clip region) — a rounded roof panel
    // with a sunroof cut-out, shaped like the real thing instead of an oval.
    const PANEL = { x: W * 0.12, y: H * 0.135, w: W * 0.76, h: H * 0.6 };
    PANEL.r = Math.min(PANEL.w, PANEL.h) * 0.3;
    PANEL.cx = PANEL.x + PANEL.w / 2;
    PANEL.cy = PANEL.y + PANEL.h / 2;
    // Sunroof glass panel toward the front — no stars land here.
    const SUNROOF = { w: PANEL.w * 0.36, h: PANEL.h * 0.46 };
    SUNROOF.x = PANEL.cx - SUNROOF.w / 2;
    SUNROOF.y = PANEL.y + PANEL.h * 0.13;
    SUNROOF.r = Math.min(SUNROOF.w, SUNROOF.h) * 0.14;

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
      return inRoundRect(p, PANEL) && !inRoundRect(p, SUNROOF);
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
      fieldDirty = true;
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
        state.trails.push({
          x: random(PANEL.cx - PANEL.w * 0.32, PANEL.cx + PANEL.w * 0.34),
          y: random(PANEL.y + PANEL.h * 0.08, PANEL.cy),
          angle: random(-0.55, -0.18),
          length: random(110, 200),
          color: state.color === "rgb" ? "#f6fbff" : resolveColor(),
          phase: random(0, Math.PI * 2),
        });
      }
    }

    function clearStars(keepLabel) {
      state.stars = [];
      state.lines = [];
      state.trails = [];
      state.lastPoint = null;
      fieldDirty = true;
      if (!keepLabel && els.pkg) els.pkg.textContent = "Custom starlight layout";
      update();
    }

    function closestKit(n) {
      return KIT_SIZES.reduce((best, k) => (Math.abs(k - n) < Math.abs(best - n) ? k : best), KIT_SIZES[0]);
    }

    function update() {
      const n = state.stars.length;
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
      c.globalAlpha = 0.1;
      c.strokeStyle = "#d7a84f";
      c.lineWidth = 1;
      for (let x = -H; x < W; x += 44) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + H * 0.5, H);
        c.stroke();
      }
      c.globalAlpha = 1;
      // sunroof glass panel (kept star-free, like a real headliner)
      roundRectPath(c, SUNROOF);
      const glass = c.createLinearGradient(SUNROOF.x, SUNROOF.y, SUNROOF.x, SUNROOF.y + SUNROOF.h);
      glass.addColorStop(0, "#080b12");
      glass.addColorStop(1, "#03040a");
      c.fillStyle = glass;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = "rgba(150, 180, 220, 0.16)";
      c.stroke();
      c.restore();
    }

    function bakeBase() {
      drawBackground(bctx);
      drawHeadlinerPanel(bctx);
      baseReady = true;
    }

    function drawHeadlinerRim() {
      roundRectPath(ctx, PANEL);
      ctx.strokeStyle = "rgba(255, 221, 138, 0.3)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function drawStar(c, st, alpha) {
      const draw = 3 + st.r * 2.6;
      c.globalAlpha = alpha;
      c.drawImage(sprite(st.color), st.x - draw, st.y - draw, draw * 2, draw * 2);
    }

    // Bake the whole static star field once; refresh only when stars change.
    function renderField() {
      fctx.clearRect(0, 0, W, H);
      fctx.globalCompositeOperation = "lighter";
      for (const st of state.stars) drawStar(fctx, st, 0.4 + st.baseA * 0.55);
      fctx.globalCompositeOperation = "source-over";
      fctx.globalAlpha = 1;
      const cap = 160;
      const step = Math.max(1, Math.floor(state.stars.length / cap));
      state.twinkleStars = state.stars.filter((_, idx) => idx % step === 0).slice(0, cap);
      fieldDirty = false;
    }

    function render(time) {
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

      // front / rear orientation labels + watermark
      ctx.fillStyle = "rgba(245, 241, 232, 0.34)";
      ctx.font = "700 13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FRONT", PANEL.cx, PANEL.y - 9);
      ctx.fillText("REAR", PANEL.cx, PANEL.y + PANEL.h + 20);
      ctx.fillStyle = "rgba(255, 221, 138, 0.5)";
      ctx.font = "700 18px Inter, sans-serif";
      ctx.fillText("BAY AREA AUTO CUSTOMZ · STARLIGHT PREVIEW", W * 0.5, H * 0.965);
      ctx.textAlign = "left";
    }

    let rafId = 0;
    let needsRender = true;
    let onScreen = true;
    function requestRender() {
      needsRender = true;
    }
    function loop(t) {
      render(t);
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
        }
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
        fieldDirty = true;
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

    toggle.addEventListener("click", () => {
      if (video.paused) {
        video.muted = true;
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        video.pause();
      }
    });
  });

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
  function normalizePosts(data) {
    const raw = Array.isArray(data)
      ? data
      : (data && (data.posts || data.data || data.media || data.items)) || [];
    return raw
      .map((p) => {
        const permalink = p.permalink || p.link || p.url || p.postUrl;
        const type = String(p.mediaType || p.media_type || p.type || "").toUpperCase();
        const isVideo = type.includes("VIDEO") || type.includes("REEL");
        const sizes = p.sizes || {};
        const thumb =
          p.thumbnailUrl ||
          p.thumbnail_url ||
          p.thumbnail ||
          (sizes.small && sizes.small.mediaUrl) ||
          (sizes.medium && sizes.medium.mediaUrl) ||
          p.mediaUrl ||
          p.media_url ||
          p.displayUrl ||
          p.image;
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

      bookingOut.hidden = false;
      bookingOut.style.borderColor = "rgba(63,208,137,0.4)";
      bookingOut.style.background = "rgba(63,208,137,0.08)";
      bookingOut.innerHTML =
        `Thanks, ${escapeHtml(name)} — your request is ready to send. Pick how you'd like to reach us:` +
        `<span class="booking__send">` +
        `<a class="btn btn--gold btn--sm" href="${smsHref}">Send as text</a>` +
        `<a class="btn btn--ghost btn--sm" href="tel:${BUSINESS.tel}">Call now</a>` +
        `<a class="btn btn--ghost btn--sm" href="${BUSINESS.instagram}" target="_blank" rel="noopener">DM Instagram</a>` +
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
    reviews:
      "We're rated 4.9 stars on Google across 66 reviews — see the Reviews section, and there's a link to read them all on Google.",
    visualizer:
      "Scroll up to the designer: pick a kit size (300–4,000 stars) to preview the density on a real headliner shape, switch to \"Design your own\" to place stars one by one, pick a color, add shooting stars, then save the preview or send it with your quote.",
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
