(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const html = document.documentElement;

  /* ======================================================================
     Language (中 / EN)
     ====================================================================== */

  function setLang(lang) {
    html.setAttribute("data-lang", lang);
    html.setAttribute("lang", lang === "zh" ? "zh-Hans" : "en");
    try { localStorage.setItem("eon-lang", lang); } catch (e) {}
    document.title = lang === "zh" ? html.dataset.titleZh : html.dataset.titleEn;

    document.querySelectorAll(".lang button").forEach((b) => {
      const on = b.dataset.l === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });

    // Chinese visitors land straight in the China storefront; everyone else gets the
    // universal link, which Apple redirects to their own storefront.
    document.querySelectorAll("[data-href-en]").forEach((a) => {
      a.href = lang === "zh" ? a.dataset.hrefZh : a.dataset.hrefEn;
    });
  }

  document.querySelectorAll(".lang button").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.l));
  });
  setLang(html.getAttribute("data-lang") === "zh" ? "zh" : "en");

  /* ======================================================================
     Night sky + moon phases
     ======================================================================
     The moon walks new → full → new on a slow loop — a nod to billing cycles.
     Colours come from the EON icon: pale-gold light fading into moon blue.

     ?phase=0.5 freezes it at one phase (0 new · 0.25 first quarter · 0.5 full). */

  const canvas = document.querySelector(".sky");
  const ctx = canvas.getContext("2d");
  const mode = canvas.dataset.moon === "corner" ? "corner" : "hero";
  const CYCLE_MS = 36000;
  const GOLD = [242, 217, 160];
  const BLUE = [202, 216, 244];
  const CREAM = [246, 241, 230];
  const pinned = parseFloat(new URLSearchParams(location.search).get("phase"));
  const pinnedPhase = Number.isFinite(pinned) ? ((pinned % 1) + 1) % 1 : null;
  const canFilter = "filter" in ctx;

  let W = 0, H = 0, DPR = 1;
  let stars = [];
  let geo = { cx: 0, cy: 0, r: 1 };
  let tex = null, mask = null, lit = null;
  let lastPhase = -1;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let meteor = null, nextMeteorAt = 4000;

  // Tiny deterministic RNG so the moon's craters are the same on every visit.
  function rng(seed) {
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  function makeCanvas(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }

  function computeGeometry() {
    if (mode === "corner") {
      const r = Math.max(46, Math.min(W, H) * (W < 720 ? 0.2 : 0.15));
      geo = { cx: W - r * 1.25, cy: r * 1.55 + 40, r };
    } else {
      const r = Math.min(W, H) * (W < 720 ? 0.36 : 0.3);
      geo = { cx: W / 2, cy: H * 0.5, r };
    }
  }

  // The full, fully-lit moon surface. Built once per resize.
  function buildTexture() {
    const r = geo.r * DPR;
    const size = Math.ceil(r * 2) + 2;
    tex = makeCanvas(size);
    mask = makeCanvas(size);
    lit = makeCanvas(size);
    const t = tex.getContext("2d");
    const c = size / 2;

    t.save();
    t.beginPath();
    t.arc(c, c, r, 0, Math.PI * 2);
    t.clip();

    // Base: pale gold (bottom-left) → cream → moon blue (top-right), like the icon.
    const base = t.createLinearGradient(c - r, c + r, c + r, c - r);
    base.addColorStop(0, `rgb(${GOLD})`);
    base.addColorStop(0.5, `rgb(${CREAM})`);
    base.addColorStop(1, `rgb(${BLUE})`);
    t.fillStyle = base;
    t.fillRect(0, 0, size, size);

    // Maria — broad soft seas.
    const rand = rng(20260918);
    [[-0.3, -0.25, 0.34], [0.18, -0.05, 0.26], [-0.08, 0.32, 0.22], [0.38, 0.3, 0.16],
     [0.3, -0.42, 0.14], [-0.45, 0.12, 0.18], [0.02, -0.5, 0.12]].forEach(([x, y, s]) => {
      const g = t.createRadialGradient(c + x * r, c + y * r, 0, c + x * r, c + y * r, s * r);
      g.addColorStop(0, "rgba(96, 106, 146, 0.30)");
      g.addColorStop(0.7, "rgba(96, 106, 146, 0.12)");
      g.addColorStop(1, "rgba(96, 106, 146, 0)");
      t.fillStyle = g;
      t.fillRect(0, 0, size, size);
    });

    // Craters — dark bowl with a bright rim on the sunward edge.
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.9;
      const x = c + Math.cos(a) * d * r;
      const y = c + Math.sin(a) * d * r;
      const cr = (rand() * rand() * 0.07 + 0.012) * r;
      t.beginPath();
      t.arc(x, y, cr, 0, Math.PI * 2);
      t.fillStyle = "rgba(80, 88, 124, 0.22)";
      t.fill();
      t.beginPath();
      t.arc(x - cr * 0.18, y - cr * 0.18, cr, Math.PI * 0.85, Math.PI * 1.85);
      t.strokeStyle = "rgba(255, 252, 240, 0.35)";
      t.lineWidth = Math.max(0.6, cr * 0.18);
      t.stroke();
    }

    // Fine regolith speckle.
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      t.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(60,66,96,0.10)";
      t.fillRect(c + Math.cos(a) * d * r, c + Math.sin(a) * d * r, 1.2 * DPR, 1.2 * DPR);
    }

    // Limb darkening — makes it read as a sphere, not a disc.
    const limb = t.createRadialGradient(c - r * 0.15, c - r * 0.15, r * 0.2, c, c, r);
    limb.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    limb.addColorStop(0.75, "rgba(10, 12, 30, 0)");
    limb.addColorStop(1, "rgba(10, 12, 30, 0.38)");
    t.fillStyle = limb;
    t.fillRect(0, 0, size, size);
    t.restore();

    lastPhase = -1;
  }

  // Lit region for a waxing moon (lit on the right). Waning is drawn mirrored.
  // p in [0, 0.5]: 0 = new, 0.25 = first quarter, 0.5 = full.
  function litPath(g, r, p) {
    const rx = r * Math.cos(2 * Math.PI * p);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, Math.abs(rx), r, 0, Math.PI / 2, (3 * Math.PI) / 2, rx > 0);
    g.closePath();
  }

  // Re-composite the lit moon only when the phase has actually moved.
  function updateLit(phase) {
    if (Math.abs(phase - lastPhase) < 0.0008) return;
    lastPhase = phase;
    const size = tex.width;
    const r = geo.r * DPR;

    const m = mask.getContext("2d");
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, size, size);
    m.translate(size / 2, size / 2);
    const waxing = phase <= 0.5;
    if (!waxing) m.scale(-1, 1);
    // Soft terminator — the shadow line on a real moon isn't a hard edge.
    if (canFilter) m.filter = `blur(${Math.max(1, r * 0.035)}px)`;
    litPath(m, r, waxing ? phase : 1 - phase);
    m.fillStyle = "#fff";
    m.fill();
    if (canFilter) m.filter = "none";

    const l = lit.getContext("2d");
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, size, size);
    l.drawImage(tex, 0, 0);
    l.globalCompositeOperation = "destination-in";
    l.drawImage(mask, 0, 0);
    l.globalCompositeOperation = "source-over";
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const rand = rng(7);
    const count = Math.round((W * H) / 4200);
    stars = Array.from({ length: count }, () => ({
      x: rand() * W,
      y: rand() * H,
      r: rand() * rand() * 1.5 + 0.25,
      a: rand() * 0.6 + 0.15,
      tw: rand() * 0.0025 + 0.0005,
      off: rand() * Math.PI * 2,
      depth: rand() * 0.6 + 0.2,
      warm: rand() < 0.3,
    }));

    computeGeometry();
    buildTexture();
  }

  function drawStars(t, px, py) {
    for (const s of stars) {
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.off));
      ctx.fillStyle = s.warm ? `rgba(${GOLD}, ${a})` : `rgba(${BLUE}, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x + px * s.depth, s.y + py * s.depth, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // An occasional shooting star.
  function drawMeteor(t) {
    if (reduceMotion || pinnedPhase !== null) return;
    if (!meteor && t > nextMeteorAt) {
      const fromLeft = Math.random() < 0.5;
      meteor = {
        x: fromLeft ? Math.random() * W * 0.4 : W * (0.6 + Math.random() * 0.4),
        y: Math.random() * H * 0.35,
        vx: (fromLeft ? 1 : -1) * (0.55 + Math.random() * 0.3),
        vy: 0.28 + Math.random() * 0.18,
        born: t,
        life: 1100,
      };
    }
    if (!meteor) return;
    const age = (t - meteor.born) / meteor.life;
    if (age >= 1) {
      meteor = null;
      nextMeteorAt = t + 6000 + Math.random() * 9000;
      return;
    }
    const d = age * meteor.life;
    const x = meteor.x + meteor.vx * d;
    const y = meteor.y + meteor.vy * d;
    const n = Math.hypot(meteor.vx, meteor.vy);
    const tx = x - (meteor.vx / n) * 120;
    const ty = y - (meteor.vy / n) * 120;
    const fade = Math.sin(age * Math.PI);
    const g = ctx.createLinearGradient(tx, ty, x, y);
    g.addColorStop(0, "rgba(246, 241, 230, 0)");
    g.addColorStop(1, `rgba(246, 241, 230, ${0.75 * fade})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Eight small moons on a faint orbit — one full cycle, like a billing period.
  function drawOrbit(phase, ox, oy) {
    if (mode !== "hero" || W < 720) return;
    const { cx, cy, r } = geo;
    const R = r * 1.32;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, R, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${BLUE}, 0.10)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    const mr = Math.max(4, r * 0.032);
    for (let i = 0; i < 8; i++) {
      const p = i / 8;
      const ang = -Math.PI / 2 + p * Math.PI * 2;
      const x = cx + ox + Math.cos(ang) * R;
      const y = cy + oy + Math.sin(ang) * R;
      let dist = Math.abs(phase - p);
      dist = Math.min(dist, 1 - dist);
      const near = Math.max(0, 1 - dist * 8);

      if (near > 0) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, mr * 4);
        glow.addColorStop(0, `rgba(${GOLD}, ${0.35 * near})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - mr * 4, y - mr * 4, mr * 8, mr * 8);
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, mr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(26, 31, 56, 0.7)";
      ctx.fill();
      ctx.strokeStyle = `rgba(${BLUE}, ${0.25 + near * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (p !== 0) {
        const waxing = p <= 0.5;
        if (!waxing) ctx.scale(-1, 1);
        litPath(ctx, mr, waxing ? p : 1 - p);
        ctx.fillStyle = `rgba(${GOLD}, ${0.45 + near * 0.55})`;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawMoon(phase, ox, oy) {
    const { r } = geo;
    const cx = geo.cx + ox;
    const cy = geo.cy + oy;
    const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const glowBoost = mode === "hero" ? 1 : 1.25;

    // Halo — grows as the moon fills.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 2.8);
    halo.addColorStop(0, `rgba(${BLUE}, ${(0.08 + illum * 0.2) * glowBoost})`);
    halo.addColorStop(0.35, `rgba(${GOLD}, ${(0.03 + illum * 0.07) * glowBoost})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 2.8, cy - r * 2.8, r * 5.6, r * 5.6);

    const size = tex.width / DPR;
    const x = cx - size / 2;
    const y = cy - size / 2;

    // Earthshine: the dark side stays faintly visible.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20, 24, 44, 0.8)";
    ctx.fill();
    ctx.globalAlpha = 0.09;
    ctx.drawImage(tex, x, y, size, size);
    ctx.restore();

    // Lit side. Kept translucent on the home page so the headline stays readable.
    updateLit(phase);
    ctx.save();
    ctx.globalAlpha = mode === "hero" ? 0.52 : 0.85;
    ctx.drawImage(lit, x, y, size, size);
    ctx.restore();

    // Thin rim around the disc.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${BLUE}, ${0.08 + illum * 0.12})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function phaseAt(t) {
    // Start just past new moon so the first thing people see is a crescent growing.
    return pinnedPhase ?? ((t / CYCLE_MS) + 0.06) % 1;
  }

  function render(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const phase = phaseAt(t);

    ctx.clearRect(0, 0, W, H);
    drawStars(t, pointer.x * -10, pointer.y * -10);
    drawMeteor(t);
    drawOrbit(phase, pointer.x * 6, pointer.y * 6);
    drawMoon(phase, pointer.x * 14, pointer.y * 14);
  }

  function loop(t) {
    render(t);
    requestAnimationFrame(loop);
  }

  function renderStill() {
    // A still, waxing gibbous moon.
    const still = pinnedPhase ?? 0.36;
    ctx.clearRect(0, 0, W, H);
    drawStars(0, 0, 0);
    drawOrbit(still, 0, 0);
    drawMoon(still, 0, 0);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) renderStill();
  });

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      pointer.tx = e.clientX / W - 0.5;
      pointer.ty = e.clientY / H - 0.5;
    });
  }

  if (reduceMotion) renderStill();
  else requestAnimationFrame(loop);

  /* ======================================================================
     Stat count-up (home page)
     ====================================================================== */

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function format(value, decimals, suffix) {
    return value.toFixed(decimals) + suffix;
  }

  function countUp(el, index) {
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";

    if (reduceMotion) {
      el.textContent = format(target, decimals, suffix);
      return;
    }

    const duration = 1500 + index * 80;
    const delay = 480 + index * 90;

    setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        el.textContent = format(target * easeOutCubic(t), decimals, suffix);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  }

  const values = Array.from(document.querySelectorAll(".stat-value"));
  if (values.length) {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            countUp(entry.target, values.indexOf(entry.target));
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.25 }
      );
      values.forEach((el) => io.observe(el));
    } else {
      values.forEach(countUp);
    }
  }

  /* ======================================================================
     Copy buttons (Contact page)
     ====================================================================== */

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const original = btn.innerHTML;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = btn.dataset.copy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      btn.classList.add("is-copied");
      btn.innerHTML = '<span class="en">Copied</span><span class="zh">已复制</span> <i class="fa-solid fa-check" aria-hidden="true"></i>';
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.innerHTML = original;
      }, 1800);
    });
  });

  /* ======================================================================
     Mobile menu
     ====================================================================== */

  const burger = document.querySelector(".burger");
  const menu = document.getElementById("mobile-menu");
  const overlay = document.querySelector(".menu-overlay");

  function setMenu(open) {
    burger.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    overlay.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  }

  burger.addEventListener("click", () => {
    setMenu(burger.getAttribute("aria-expanded") !== "true");
  });

  overlay.addEventListener("click", () => setMenu(false));

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      burger.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720 && burger.getAttribute("aria-expanded") === "true") {
      setMenu(false);
    }
  });
})();
