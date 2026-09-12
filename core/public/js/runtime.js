(() => {
  "use strict";

  const { applyTheme, weddingTimestamp, downloadIcs, api } = window.InviteLib;

  window.InviteRuntime = {
    mount(root, invitation, options = {}) {
      cleanup(root);
      const content = invitation.content || {};
      const language = "en";
      applyTheme(root, content.theme && content.theme.colors);
      root.classList.toggle("is-embedded", Boolean(options.embedded));
      root.classList.toggle("is-urdu", language === "ur");
      root.lang = language === "ur" ? "ur" : "en";
      root.dir = language === "ur" ? "rtl" : "ltr";
      root.dataset.typeScale = root.dataset.typeScale || "md";

      window.InvitationTemplates.render(root, invitation, { ...options, language });

      const abort = new AbortController();
      root._inviteAbort = abort;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (options.embedded) {
        root.querySelector("#hero")?.classList.add("is-awake");
        root.classList.add("is-unlocked");
      } else {
        initGatefold(root, reduced, abort.signal);
      }

      initCountdown(root, content.weddingDateTime);
      initScratch(root, abort.signal);
      initMusic(root, options, abort.signal);
      initReveals(root, reduced);
      initControls(root, invitation, options, abort.signal);
      initScrollCue(root, options, abort.signal);
      initCalendar(root, invitation, abort.signal);
      initRsvp(root, invitation, options, abort.signal);
    },
  };

  function cleanup(root) {
    if (root._inviteAbort) root._inviteAbort.abort();
    if (root._countdownTimer) window.clearInterval(root._countdownTimer);
    if (root._revealObserver) root._revealObserver.disconnect();
    root.querySelectorAll("audio").forEach((music) => {
      music.pause();
      music.removeAttribute("src");
      music.load();
    });
  }

  function cacheBustMediaUrl(url) {
    const text = String(url || "").trim();
    if (!text) return "";
    const base = text.split("#")[0].split("?")[0];
    return `${base}?v=${Date.now()}`;
  }

  function initGatefold(root, reduced, signal) {
    const gateStage = root.querySelector("#gateStage");
    const gatefold = root.querySelector("#gatefold");
    const openBtn = root.querySelector("#openInvite");
    if (!gatefold || !openBtn) return;

    const pageRoot = root.closest("html") ? document.documentElement : document.documentElement;
    pageRoot.classList.remove("is-unlocked");

    let opening = false;
    const open = () => {
      if (opening) return;
      opening = true;
      openBtn.disabled = true;
      gatefold.setAttribute("aria-hidden", "true");
      startMusic(root);

      const hide = () => {
        gateStage?.classList.add("is-gone");
        gatefold.classList.add("is-gone");
      };
      const openDoors = () => {
        gatefold.classList.add("is-open");
        gateStage?.classList.add("is-open");
        pageRoot.classList.add("is-unlocked");
        root.classList.add("is-unlocked");
        awakeHero(root, reduced);
      };

      if (reduced) {
        openDoors();
        hide();
        return;
      }

      openDoors();
      window.setTimeout(() => {
        gateStage?.classList.add("is-fading");
        window.setTimeout(hide, 1000);
      }, 4400);
    };

    openBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
    }, { signal });
    gatefold.addEventListener("click", open, { signal });

    const params = new URLSearchParams(window.location.search);
    if (params.has("open") || params.get("view")) open();
  }

  function awakeHero(root, reduced) {
    const hero = root.querySelector("#hero");
    if (!hero) return;
    if (reduced) hero.classList.add("is-awake");
    else window.setTimeout(() => hero.classList.add("is-awake"), 900);
  }

  function initCountdown(root, wedding) {
    const daysEl = root.querySelector('[data-count="days"]');
    const hoursEl = root.querySelector('[data-count="hours"]');
    const minsEl = root.querySelector('[data-count="mins"]');
    if (!daysEl) return;
    const target = weddingTimestamp(wedding);
    const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
    const tick = () => {
      const diff = target ? Math.max(0, target - Date.now()) : 0;
      const minsTotal = Math.floor(diff / 60000);
      daysEl.textContent = pad(Math.floor(minsTotal / (60 * 24)));
      hoursEl.textContent = pad(Math.floor((minsTotal % (60 * 24)) / 60));
      minsEl.textContent = pad(minsTotal % 60);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    root._countdownTimer && window.clearInterval(root._countdownTimer);
    root._countdownTimer = timer;
  }

  function initScratch(root, signal) {
    const canvases = Array.from(root.querySelectorAll(".seal-canvas"));
    const badge = root.querySelector("#marriedBadge");
    if (!canvases.length) return;
    const CLEAR_RATIO = 0.6;
    const states = canvases.map((canvas) => setupSeal(canvas));
    let celebrated = false;

    const maybeCelebrate = () => {
      if (celebrated) return;
      if (!states.every((state) => state.cleared >= CLEAR_RATIO)) return;
      celebrated = true;
      if (badge) badge.hidden = false;
      burstConfetti(root);
    };

    canvases.forEach((canvas, index) => {
      const brush = Math.max(9, Math.round(states[index].size * 0.2));
      bindScratch(canvas, states[index], maybeCelebrate, brush, signal);
    });
  }

  function setupSeal(canvas) {
    const parent = canvas.parentElement;
    const measured = parent.getBoundingClientRect().width || parent.clientWidth;
    const size = Math.max(1, Math.round(measured) || 64);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFoil(ctx, size, canvas.dataset.hidden || "SCRATCH", canvas);
    return { ctx, size, dpr, cleared: 0, lastCheck: 0 };
  }

  function scratchPalette(canvas) {
    const root = canvas.closest(".invite-root");
    const style = getComputedStyle(root || document.documentElement);
    const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    return {
      c0: read("--scratch-foil-light", "#f6e7a8"),
      c1: read("--scratch-foil", "#d4af37"),
      c2: read("--scratch-foil-mid", "#fff3c0"),
      c3: read("--scratch-foil-deep", "#c5a028"),
      c4: read("--scratch-foil-dark", "#8a7018"),
      speckleLight: read("--scratch-foil-speckle-light", "#fff8d4"),
      speckleDark: read("--scratch-foil-speckle-dark", "#7a6414"),
      text: read("--scratch-foil-text", "rgba(80, 60, 10, 0.38)"),
    };
  }

  function paintFoil(ctx, size, hiddenText, canvas) {
    const radius = size / 2;
    const palette = scratchPalette(canvas);
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, palette.c0);
    gradient.addColorStop(0.28, palette.c1);
    gradient.addColorStop(0.5, palette.c2);
    gradient.addColorStop(0.72, palette.c3);
    gradient.addColorStop(1, palette.c4);
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = i % 2 ? palette.speckleLight : palette.speckleDark;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4);
    }
    ctx.restore();
    const label = String(hiddenText || "SCRATCH").split(" ").pop() || "SCRATCH";
    ctx.fillStyle = palette.text;
    ctx.font = `500 ${Math.max(11, size * 0.13)}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.length > 8 ? "SCRATCH" : label, radius, radius);
  }

  function bindScratch(canvas, state, onProgress, brush, signal) {
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      const source = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]) || event;
      return {
        x: ((source.clientX - rect.left) / (rect.width || state.size)) * state.size,
        y: ((source.clientY - rect.top) / (rect.height || state.size)) * state.size,
      };
    };
    const erase = (event) => {
      if (!drawing) return;
      const { x, y } = point(event);
      const ctx = state.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brush, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const now = performance.now();
      if (now - state.lastCheck > 120) {
        state.lastCheck = now;
        state.cleared = sampleClear(canvas);
        onProgress();
      }
    };
    const start = (event) => {
      drawing = true;
      erase(event);
    };
    const end = () => {
      if (!drawing) return;
      drawing = false;
      state.cleared = sampleClear(canvas);
      onProgress();
    };
    const revealAll = () => {
      state.ctx.clearRect(0, 0, state.size, state.size);
      state.cleared = 1;
      onProgress();
    };

    canvas.addEventListener("mousedown", start, { signal });
    canvas.addEventListener("mousemove", erase, { signal });
    window.addEventListener("mouseup", end, { signal });
    canvas.addEventListener("touchstart", (event) => { event.preventDefault(); start(event); }, { passive: false, signal });
    canvas.addEventListener("touchmove", (event) => { event.preventDefault(); erase(event); }, { passive: false, signal });
    canvas.addEventListener("touchend", end, { signal });
    canvas.addEventListener("touchcancel", end, { signal });
    canvas.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        revealAll();
      }
    }, { signal });
  }

  function sampleClear(canvas) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const radiusSq = (width / 2) * (width / 2);
    let inside = 0;
    let transparent = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radiusSq) continue;
        inside += 1;
        if (data[(y * width + x) * 4 + 3] < 40) transparent += 1;
      }
    }
    return inside ? transparent / inside : 0;
  }

  function burstConfetti(root) {
    if (typeof confetti !== "function") return;
    const seals = root.querySelector("#seals");
    const rect = seals ? seals.getBoundingClientRect() : null;
    confetti({
      particleCount: 80,
      spread: 68,
      startVelocity: 28,
      gravity: 0.85,
      scalar: 0.85,
      origin: {
        x: rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5,
        y: rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.45,
      },
      colors: ["#d4af37", "#f7f5f0", "#5a6b5c", "#e8d48b", "#8ba3b5"],
    });
  }

  function startMusic(root) {
    const music = root.querySelector("#bgMusic") || document.getElementById("bgMusic");
    const toggle = root.querySelector("#musicToggle") || document.getElementById("musicToggle");
    if (!music) return;
    music.volume = 0.45;
    music.muted = false;
    const play = music.play();
    if (play && typeof play.catch === "function") play.catch(() => syncMusic(music, toggle));
    if (toggle) toggle.hidden = false;
    syncMusic(music, toggle);
  }

  function syncMusic(music, toggle) {
    if (!music || !toggle) return;
    toggle.classList.toggle("is-paused", music.paused);
    toggle.setAttribute("aria-label", music.paused ? "Play music" : "Pause music");
  }

  function initMusic(root, options, signal) {
    const music = root.querySelector("#bgMusic");
    const toggle = root.querySelector("#musicToggle");
    if (!music || !toggle) return;
    const src = music.getAttribute("src");
    if (src) {
      music.src = cacheBustMediaUrl(src);
      music.load();
    }
    music.addEventListener("play", () => syncMusic(music, toggle), { signal });
    music.addEventListener("pause", () => syncMusic(music, toggle), { signal });
    toggle.addEventListener("click", () => {
      if (music.paused) startMusic(root);
      else music.pause();
    }, { signal });
    if (options.embedded) toggle.hidden = false;

    const shouldAutoplay = Boolean(options.embedded) || !root.querySelector("#gateStage");
    if (shouldAutoplay && src) {
      const begin = () => startMusic(root);
      music.addEventListener("canplay", begin, { once: true, signal });
      if (music.readyState >= 2) begin();
      else begin();
    }
  }

  function initReveals(root, reduced) {
    const nodes = Array.from(root.querySelectorAll(".reveal"));
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18, root: optionsRoot(root), rootMargin: "0px 0px -8% 0px" });
    root._revealObserver = observer;
    nodes.forEach((node) => observer.observe(node));
  }

  function optionsRoot(root) {
    return root.classList.contains("is-embedded") ? root.parentElement : null;
  }

  function initScrollCue(root, options, signal) {
    const btn = root.querySelector("#scrollCue");
    if (!btn) return;
    const sections = Array.from(root.querySelectorAll("#hero, main > section[id]"));
    const frame = optionsRoot(root);
    const page = root.querySelector(".page") || root;

    const frameRect = () => (frame || page).getBoundingClientRect();

    const nextSection = (port) => {
      const threshold = Math.max(80, port.height * 0.38);
      for (const section of sections) {
        if (section.getBoundingClientRect().top - port.top > threshold) return section;
      }
      return null;
    };

    const pin = () => {
      const unlocked = Boolean(options.embedded) ||
        root.classList.contains("is-unlocked") ||
        document.documentElement.classList.contains("is-unlocked");
      const port = frameRect();
      const clipTop = Math.max(port.top, 0);
      const clipBottom = Math.min(port.bottom, window.innerHeight);
      const next = nextSection(port);
      const visible = unlocked && next && clipBottom - clipTop > 120;
      btn.classList.toggle("is-away", !visible);
      if (!visible) return;
      btn.setAttribute("href", `#${next.id}`);
      const inset = 22;
      btn.style.position = "fixed";
      btn.style.left = `${port.left + port.width / 2}px`;
      btn.style.top = `${clipBottom - inset - btn.offsetHeight}px`;
      btn.style.bottom = "auto";
      btn.style.transform = "translateX(-50%)";
    };

    btn.addEventListener("click", (event) => {
      const id = (btn.getAttribute("href") || "").replace("#", "");
      const target = id ? root.querySelector(`#${id}`) : null;
      if (!target) return;
      event.preventDefault();
      if (!frame) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const delta = target.getBoundingClientRect().top - frame.getBoundingClientRect().top;
      frame.scrollTo({ top: frame.scrollTop + delta, behavior: "smooth" });
    }, { signal });

    const scroller = frame || window;
    scroller.addEventListener("scroll", pin, { signal, passive: true });
    window.addEventListener("resize", pin, { signal, passive: true });
    if (frame && typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => pin());
      resizeObserver.observe(frame);
      if (frame.parentElement) resizeObserver.observe(frame.parentElement);
      signal.addEventListener("abort", () => resizeObserver.disconnect());
    }
    const observer = new MutationObserver(pin);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    signal.addEventListener("abort", () => observer.disconnect());
    pin();
    window.requestAnimationFrame(pin);
  }

  function initControls(root, invitation, options, signal) {
    const controls = root.querySelector("#inviteControls");
    if (!controls) return;
    controls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-control]");
      if (!button) return;
      const kind = button.dataset.control;
      if (kind === "contrast") {
        root.classList.toggle("is-contrast");
        button.classList.toggle("is-on", root.classList.contains("is-contrast"));
      }
      if (kind === "type") {
        const order = ["sm", "md", "lg"];
        const next = order[(order.indexOf(root.dataset.typeScale || "md") + 1) % order.length];
        root.dataset.typeScale = next;
        root.classList.remove("type-sm", "type-md", "type-lg");
        root.classList.add(`type-${next}`);
      }
    }, { signal });
    root.classList.add(`type-${root.dataset.typeScale || "md"}`);
  }

  function initCalendar(root, invitation, signal) {
    root.querySelectorAll(".calendar-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const event = (invitation.content.events || []).find((item) => item.id === button.dataset.eventId);
        if (event) downloadIcs(event, invitation);
      }, { signal });
    });
  }

  function initRsvp(root, invitation, options, signal) {
    const form = root.querySelector("#rsvpForm");
    if (!form) return;
    const error = root.querySelector("#rsvpError");
    const thanks = root.querySelector("#rsvpThanks");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (options.embedded || options.disableRsvp) {
        if (error) {
          error.hidden = false;
          error.textContent = "RSVP is sent from the published invitation link.";
        }
        return;
      }
      const data = new FormData(form);
      try {
        if (error) error.hidden = true;
        await api.submitRsvp(invitation.publicId, {
          guestName: data.get("guestName"),
          attending: data.get("attending"),
          message: data.get("message"),
        });
        form.hidden = true;
        if (thanks) thanks.hidden = false;
      } catch (err) {
        if (error) {
          error.hidden = false;
          error.textContent = err.message || "Could not send your reply.";
        }
      }
    }, { signal });
  }
})();
