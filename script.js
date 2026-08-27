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

  /* Slow auto-sliding certificate row, paused while the user drags */
  const slider = document.querySelector(".cert-slider");
  if (slider) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPEED = 16;
    const RESUME_DELAY = 2000;
    let paused = reduceMotion;
    let dragging = false;
    let axis = null;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let lastTime = 0;
    let resumeTimer = null;
    let pointerId = null;

    function loopWidth() {
      return slider.scrollWidth / 2;
    }

    function wrapScroll() {
      const half = loopWidth();
      if (!half) return;
      if (slider.scrollLeft >= half) {
        slider.scrollLeft -= half;
      } else if (slider.scrollLeft < 0) {
        slider.scrollLeft += half;
      }
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

    function tick(now) {
      if (!paused && !dragging) {
        if (lastTime) {
          const delta = Math.min((now - lastTime) / 1000, 0.05);
          slider.scrollLeft += SPEED * delta;
          wrapScroll();
        }
      }
      lastTime = now;
      requestAnimationFrame(tick);
    }

    slider.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pauseAuto();
      dragging = false;
      axis = null;
      startX = event.clientX;
      startY = event.clientY;
      startScroll = slider.scrollLeft;
      pointerId = event.pointerId;
    });

    slider.addEventListener("pointermove", function (event) {
      if (pointerId !== event.pointerId) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "x") {
          dragging = true;
          slider.classList.add("is-dragging");
          slider.setPointerCapture(event.pointerId);
        }
      }

      if (axis === "x") {
        event.preventDefault();
        slider.scrollLeft = startScroll - dx;
        wrapScroll();
      }
    }, { passive: false });

    function endDrag(event) {
      if (pointerId !== null && event && event.pointerId !== pointerId) return;
      if (dragging) {
        slider.classList.remove("is-dragging");
      }
      dragging = false;
      axis = null;
      pointerId = null;
      scheduleResume();
    }

    slider.addEventListener("pointerup", endDrag);
    slider.addEventListener("pointercancel", endDrag);
    slider.addEventListener("lostpointercapture", function () {
      if (dragging) {
        slider.classList.remove("is-dragging");
        dragging = false;
        axis = null;
        pointerId = null;
        scheduleResume();
      }
    });

    slider.addEventListener(
      "wheel",
      function (event) {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          pauseAuto();
          scheduleResume();
        }
      },
      { passive: true }
    );

    if (!reduceMotion) {
      requestAnimationFrame(tick);
    }
  }
})();
