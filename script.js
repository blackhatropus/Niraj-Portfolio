// =========================================================
// STAR FIELD — canvas stars with cursor repulsion
// Stars drift slowly upward. When the cursor gets within
// REPEL_RADIUS px they smoothly scatter away, then spring
// back to their natural drift path via lerp.
// =========================================================
(function initStarField() {
  const canvas = document.getElementById('star-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const STAR_COUNT    = 180;
  const REPEL_RADIUS  = 110;   // px — how close cursor must be to repel
  const REPEL_FORCE   = 55;    // strength of push
  const RETURN_LERP   = 0.06;  // how fast stars spring back (lower = slower)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, stars = [];
  let mouseX = -9999, mouseY = -9999;

  // Track cursor globally for repulsion
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

  function createStar(randomY = true) {
    const depth  = Math.random();
    const size   = 0.3 + depth * 1.6;          // 0.3 – 1.9 px
    const base   = 0.06 + depth * 0.42;         // base opacity (dimmer than before)
    const speed  = 0.04 + depth * 0.18;
    const angle  = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    const ox     = Math.random() * W;
    const oy     = randomY ? Math.random() * H : H + size * 4;

    return {
      // current rendered position
      x: ox, y: oy,
      // "home" position that drifts naturally
      ox, oy,
      size, base,
      // drift velocity
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      // displacement from repulsion
      rx: 0, ry: 0,
      // twinkle
      twinkleSpeed: 0.006 + Math.random() * 0.01,
      twinklePhase: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    stars = Array.from({ length: STAR_COUNT }, () => createStar(true));
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    frame++;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      if (!reducedMotion) {
        // ── Advance the home (drift) position ──────────────
        s.ox += s.dx;
        s.oy += s.dy;
        // Wrap home position
        if (s.oy < -s.size * 4)    { s.oy = H + s.size * 4; s.ox = Math.random() * W; }
        if (s.ox < -s.size * 4)    s.ox = W + s.size * 4;
        if (s.ox > W + s.size * 4) s.ox = -s.size * 4;

        // ── Cursor repulsion ────────────────────────────────
        const cdx  = s.ox - mouseX;
        const cdy  = s.oy - mouseY;
        const dist = Math.hypot(cdx, cdy);

        if (dist < REPEL_RADIUS && dist > 0) {
          // Push away, stronger when closer
          const strength = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
          s.rx += (cdx / dist) * strength * 0.3;
          s.ry += (cdy / dist) * strength * 0.3;
        }

        // Spring displacement back to zero
        s.rx *= 0.88;
        s.ry *= 0.88;

        // Clamp max displacement so stars don't fly off-screen
        const maxDisp = 60;
        s.rx = Math.max(-maxDisp, Math.min(maxDisp, s.rx));
        s.ry = Math.max(-maxDisp, Math.min(maxDisp, s.ry));

        // Actual rendered position = home + displacement
        s.x = s.ox + s.rx;
        s.y = s.oy + s.ry;
      }

      // ── Twinkle ──────────────────────────────────────────
      const twinkle = reducedMotion ? 0 : Math.sin(frame * s.twinkleSpeed + s.twinklePhase) * 0.12;
      const alpha   = Math.max(0, Math.min(1, s.base + twinkle));

      // ── Draw ─────────────────────────────────────────────
      const r   = s.size * 2.2;
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      grd.addColorStop(0,   `rgba(255, 255, 255, ${alpha})`);
      grd.addColorStop(0.45,`rgba(210, 205, 255, ${alpha * 0.35})`);
      grd.addColorStop(1,   `rgba(174, 168, 254, 0)`);

      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  draw();
})();

// =========================================================
// CURSOR BLUE LIGHT TRAIL
// Stores the last N cursor positions and draws them as a
// smooth fading comet — bright electric-blue glow at the
// head, fading to nothing at the tail. Matches the exact
// feel of the reference site's cursor trail.
// =========================================================
(function initCursorTrail() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('trail-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const TRAIL_LEN = 28;
  const points = [];
  let mouseX = 0;
  let mouseY = 0;
  let hasMoved = false;
  let active = false;
  let trailOpacity = 0;
  let idleTimeout;

  // Initialize points array
  for (let i = 0; i < TRAIL_LEN; i++) {
    points.push({ x: 0, y: 0 });
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    active = true;

    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      active = false;
    }, 600);

    if (!hasMoved) {
      hasMoved = true;
      for (let i = 0; i < TRAIL_LEN; i++) {
        points[i].x = mouseX;
        points[i].y = mouseY;
      }
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    active = false;
    clearTimeout(idleTimeout);
  });

  function drawTrailLayer(maxWidth, colorFunc) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = TRAIL_LEN - 1; i > 0; i--) {
      const p0 = points[i];
      const p1 = points[i - 1];

      // Calculate t (0 at tail, 1 at head)
      const t = (TRAIL_LEN - 1 - i) / (TRAIL_LEN - 1);
      ctx.lineWidth = 1 + t * (maxWidth - 1);
      ctx.strokeStyle = colorFunc(t);

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Fade trailOpacity in/out smoothly
    if (active && hasMoved) {
      trailOpacity += (1 - trailOpacity) * 0.08;
    } else {
      trailOpacity += (0 - trailOpacity) * 0.08;
    }

    if (hasMoved && trailOpacity > 0.001) {
      // Physics-based lag: head (points[0]) follows cursor, and each subsequent point follows the one before it
      points[0].x += (mouseX - points[0].x) * 0.85;
      points[0].y += (mouseY - points[0].y) * 0.85;

      for (let i = 1; i < TRAIL_LEN; i++) {
        points[i].x += (points[i - 1].x - points[i].x) * 0.38;
        points[i].y += (points[i - 1].y - points[i].y) * 0.38;
      }

      // Draw multi-layered blue neon trail
      // 1. Wide outer soft glow
      drawTrailLayer(70, (t) => `rgba(30, 80, 220, ${t * t * 0.11 * trailOpacity})`);
      // 2. Medium inner vibrant blue
      drawTrailLayer(36, (t) => `rgba(0, 150, 255, ${t * t * 0.28 * trailOpacity})`);
      // 3. Crisp white-blue core
      drawTrailLayer(12, (t) => `rgba(224, 242, 255, ${t * t * 0.72 * trailOpacity})`);
    }

    requestAnimationFrame(draw);
  }
  draw();
})();

// =========================================================
// MOBILE NAV TOGGLE
// Opens/closes the nav links on small screens.
// =========================================================
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile menu when any link is clicked
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// =========================================================
// SCROLL-REVEAL ANIMATIONS
// Fades sections up as they enter the viewport.
// =========================================================
document
  .querySelectorAll(
    '.hero, .project-card, .skill-group, .achievement-card, .about__inner, .contact__inner'
  )
  .forEach((el) => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// =========================================================
// CUSTOM CURSOR + BACKGROUND SPOTLIGHT
// Only activates on true pointer devices (not touch).
// Uses linear interpolation (lerp) for smooth, physics-like motion.
// =========================================================
const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (isFinePointer) {
  const customCursor  = document.querySelector('.custom-cursor');
  const interactiveGlow = document.querySelector('.interactive-glow');

  // Start positions at viewport centre to avoid jump-in
  let mouseX = window.innerWidth  / 2;
  let mouseY = window.innerHeight / 2;

  let cursorX = mouseX;
  let cursorY = mouseY;
  const CURSOR_LERP = 0.18;   // Higher = faster snap

  let glowX = mouseX;
  let glowY = mouseY;
  const GLOW_LERP = 0.055;    // Lower = more trailing lag

  let cursorActive = false;
  let cursorOpacity = 0;
  let idleTimeout;

  // Track raw mouse position
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorActive = true;

    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      cursorActive = false;
    }, 600);
  });

  // Hide cursor dot when pointer leaves window
  document.addEventListener('mouseleave', () => {
    cursorActive = false;
    clearTimeout(idleTimeout);
  });
  document.addEventListener('mouseenter', () => {
    cursorActive = true;
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      cursorActive = false;
    }, 600);
  });

  // RAF loop — lerps both cursor and glow toward mouse
  function tick() {
    cursorX += (mouseX - cursorX) * CURSOR_LERP;
    cursorY += (mouseY - cursorY) * CURSOR_LERP;

    // Smoothly fade cursor opacity
    if (cursorActive) {
      cursorOpacity += (1 - cursorOpacity) * 0.08;
    } else {
      cursorOpacity += (0 - cursorOpacity) * 0.08;
    }

    if (customCursor) {
      customCursor.style.transform =
        `translate3d(calc(${cursorX}px - 50%), calc(${cursorY}px - 50%), 0)`;
      customCursor.style.opacity = cursorOpacity;
    }

    glowX += (mouseX - glowX) * GLOW_LERP;
    glowY += (mouseY - glowY) * GLOW_LERP;

    if (interactiveGlow) {
      interactiveGlow.style.transform =
        `translate3d(calc(${glowX}px - 50%), calc(${glowY}px - 50%), 0)`;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ── Hover state: expand cursor ring over interactive elements ──
  const hoverTargets = document.querySelectorAll(
    'a, button, input[type="submit"], .btn, .nav-cta, .nav-toggle, .project-card__inner'
  );

  hoverTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      customCursor?.classList.add('is-hovered');
    });
    el.addEventListener('mouseleave', () => {
      customCursor?.classList.remove('is-hovered');
    });
  });
}

// =========================================================
// MAGNETIC PULL EFFECT
// Gently attracts buttons and nav links toward the cursor
// within their bounding box.
// =========================================================
const magneticTargets = document.querySelectorAll('.btn, .nav-cta');

magneticTargets.forEach((el) => {
  el.addEventListener('mousemove', (e) => {
    const rect  = el.getBoundingClientRect();
    const centreX = rect.left + rect.width  / 2;
    const centreY = rect.top  + rect.height / 2;
    const dx = e.clientX - centreX;
    const dy = e.clientY - centreY;

    el.style.transform    = `translate(${dx * 0.22}px, ${dy * 0.22}px)`;
    el.style.transition   = 'transform 0.1s ease-out';
  });

  el.addEventListener('mouseleave', () => {
    el.style.transform  = 'translate(0, 0)';
    el.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
  });
});

// =========================================================
// PROJECT CARD SUBTLE TILT
// On hover, cards tilt very slightly toward the cursor
// for a premium 3-D depth feel.
// =========================================================
document.querySelectorAll('.project-card').forEach((card) => {
  const inner = card.querySelector('.project-card__inner');

  card.addEventListener('mousemove', (e) => {
    const rect  = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;   // -0.5 to 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5;

    const tiltX =  y * 6;   // degrees
    const tiltY = -x * 6;

    if (inner) {
      inner.style.transform  = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      inner.style.transition = 'transform 0.15s ease-out';
    }
  });

  card.addEventListener('mouseleave', () => {
    if (inner) {
      inner.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
      inner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    }
  });
});

// =========================================================
// NAVBAR — add scrolled shadow/border class
// =========================================================
const navbar = document.querySelector('.navbar');
if (navbar) {
  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('is-scrolled');
    } else {
      navbar.classList.remove('is-scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
}