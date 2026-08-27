/* Sanjeev Kumar site interactions: mobile nav, FAQ accordion, contact form. */

(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  const mq = window.matchMedia("(max-width: 1023px)");

  function closeNav() {
    header.classList.remove("nav-open");
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }

  function openNav() {
    header.classList.add("nav-open");
    document.body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }

  toggle.addEventListener("click", function () {
    if (header.classList.contains("nav-open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      if (mq.matches) closeNav();
    });
  });

  mq.addEventListener("change", function (event) {
    if (!event.matches) closeNav();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeNav();
  });

  /* FAQ: one panel open at a time */
  const triggers = Array.from(document.querySelectorAll(".accordion-trigger"));

  triggers.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(btn.getAttribute("aria-controls"));

      triggers.forEach(function (other) {
        other.setAttribute("aria-expanded", "false");
        other.querySelector(".accordion-icon").textContent = "+";
        document.getElementById(other.getAttribute("aria-controls")).hidden = true;
      });

      if (!expanded) {
        btn.setAttribute("aria-expanded", "true");
        btn.querySelector(".accordion-icon").textContent = "−";
        panel.hidden = false;
      }
    });
  });

  /* Contact form - Formspree POST, then local success state */
  const form = document.getElementById("contact-form");
  const success = document.getElementById("form-success");
  const errorBox = document.getElementById("form-error");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorBox.hidden = true;

    const endpoint = form.getAttribute("action");
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    fetch(endpoint, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Formspree request failed");
        }
        form.classList.add("is-sent");
        success.hidden = false;
        form.reset();
      })
      .catch(function () {
        errorBox.hidden = false;
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });

  /* Slow auto-sliding certificate row; drag/swipe is 1:1 with the pointer. */
  const slider = document.querySelector(".cert-slider");
  if (slider) {
    const track = slider.querySelector(".cert-track");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPEED = 16;
    const RESUME_DELAY = 2000;
    let offset = 0;
    let paused = reduceMotion;
    let dragging = false;
    let axis = null;
    let startX = 0;
    let startY = 0;
    let startOffset = 0;
    let lastTime = 0;
    let resumeTimer = null;
    let active = false;

    function loopWidth() {
      const list = slider.querySelector(".cert-list");
      if (!list) return 0;
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      return list.offsetWidth + gap;
    }

    function wrapOffset() {
      const half = loopWidth();
      if (!half) return;
      while (offset >= half) {
        offset -= half;
        startOffset -= half;
      }
      while (offset < 0) {
        offset += half;
        startOffset += half;
      }
    }

    function apply() {
      wrapOffset();
      track.style.transform = "translate3d(" + -offset + "px, 0, 0)";
    }

    function pauseAuto() {
      paused = true;
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    }

    function scheduleResume() {
      if (reduceMotion) return;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        paused = false;
        lastTime = 0;
      }, RESUME_DELAY);
    }

    function beginGesture(clientX, clientY) {
      pauseAuto();
      active = true;
      dragging = false;
      axis = null;
      startX = clientX;
      startY = clientY;
      startOffset = offset;
    }

    function moveGesture(clientX, clientY, event) {
      if (!active) return;

      const dx = clientX - startX;
      const dy = clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "x") {
          dragging = true;
          slider.classList.add("is-dragging");
          if (event && event.pointerType === "mouse" && event.pointerId != null) {
            try {
              slider.setPointerCapture(event.pointerId);
            } catch (err) {
              /* ignore */
            }
          }
        }
      }

      if (axis === "x") {
        if (event && event.cancelable) event.preventDefault();
        offset = startOffset - dx;
        apply();
      }
    }

    function endGesture() {
      if (!active) return;
      active = false;
      slider.classList.remove("is-dragging");
      dragging = false;
      axis = null;
      scheduleResume();
    }

    function tick(now) {
      if (!paused && !active) {
        if (lastTime) {
          const delta = Math.min((now - lastTime) / 1000, 0.05);
          offset += SPEED * delta;
          apply();
        }
      }
      lastTime = now;
      requestAnimationFrame(tick);
    }

    slider.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      beginGesture(event.clientX, event.clientY);
    });

    slider.addEventListener(
      "pointermove",
      function (event) {
        moveGesture(event.clientX, event.clientY, event);
      },
      { passive: false }
    );

    slider.addEventListener("pointerup", endGesture);
    slider.addEventListener("pointercancel", endGesture);
    slider.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "mouse" && active) endGesture();
    });

    /* iOS often withholds pointermove during a touch pan unless touchmove is non-passive
       and preventDefault runs after we lock to the horizontal axis. */
    slider.addEventListener(
      "touchstart",
      function (event) {
        const touch = event.touches[0];
        if (!touch) return;
        beginGesture(touch.clientX, touch.clientY);
      },
      { passive: true }
    );

    slider.addEventListener(
      "touchmove",
      function (event) {
        const touch = event.touches[0];
        if (!touch) return;
        moveGesture(touch.clientX, touch.clientY, event);
      },
      { passive: false }
    );

    slider.addEventListener("touchend", endGesture);
    slider.addEventListener("touchcancel", endGesture);

    slider.addEventListener(
      "wheel",
      function (event) {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          pauseAuto();
          offset += event.deltaX;
          apply();
          scheduleResume();
        }
      },
      { passive: true }
    );

    apply();

    if (!reduceMotion) {
      requestAnimationFrame(tick);
    }
  }
})();
