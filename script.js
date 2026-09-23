/* Sanjeev Kumar site interactions: mobile nav, FAQ accordion, contact form. */

(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  const mq = window.matchMedia("(max-width: 1023px)");

  function closeNav() {
    if (!header || !toggle) return;
    header.classList.remove("nav-open");
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }

  function openNav() {
    if (!header || !toggle) return;
    header.classList.add("nav-open");
    document.body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }

  if (header && toggle && nav) {
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
  }

  /* FAQ: one panel open at a time */
  const triggers = Array.from(document.querySelectorAll(".accordion-trigger"));

  triggers.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(btn.getAttribute("aria-controls"));

      triggers.forEach(function (other) {
        other.setAttribute("aria-expanded", "false");
        const icon = other.querySelector(".accordion-icon");
        if (icon) icon.textContent = "+";
        const otherPanel = document.getElementById(other.getAttribute("aria-controls"));
        if (otherPanel) otherPanel.hidden = true;
      });

      if (!expanded && panel) {
        btn.setAttribute("aria-expanded", "true");
        const icon = btn.querySelector(".accordion-icon");
        if (icon) icon.textContent = "−";
        panel.hidden = false;
      }
    });
  });

  /* Contact form - Formspree POST, then local success state */
  const form = document.getElementById("contact-form");
  const success = document.getElementById("form-success");
  const errorBox = document.getElementById("form-error");

  if (form && success && errorBox) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      errorBox.hidden = true;

      const endpoint = form.getAttribute("action");
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

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
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  const marqueeItems = [];
  let tickerOn = false;
  let tickerLast = 0;

  function startMarqueeTicker() {
    if (tickerOn) return;
    tickerOn = true;
    tickerLast = 0;
    requestAnimationFrame(runMarquees);
  }

  function runMarquees(now) {
    const delta = tickerLast ? Math.min((now - tickerLast) / 1000, 0.05) : 0;
    tickerLast = now;
    let moving = false;
    marqueeItems.forEach(function (item) {
      if (item.step(delta)) moving = true;
    });
    if (moving) {
      requestAnimationFrame(runMarquees);
    } else {
      tickerOn = false;
    }
  }

  function bindMarquee(slider, options) {
    options = options || {};
    const track = slider.querySelector(options.trackSelector);
    const listSelector = options.listSelector;
    if (!track) return null;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPEED = options.speed != null ? options.speed : 16;
    const DIR = options.direction != null ? options.direction : 1;
    const RESUME_DELAY = 2000;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let offset = 0;
    let paused = reduceMotion;
    let dragging = false;
    let axis = null;
    let startX = 0;
    let startY = 0;
    let startOffset = 0;
    let resumeTimer = null;
    let active = false;
    let suppressClick = false;
    let holdPause = false;
    let cachedHalf = 0;
    let visible = true;

    if (options.duplicate && !reduceMotion) {
      const original = track.querySelector(listSelector);
      if (original && track.querySelectorAll(listSelector).length < 2) {
        const clone = original.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("[tabindex]").forEach(function (el) {
          el.removeAttribute("tabindex");
        });
        clone.querySelectorAll('[role="button"]').forEach(function (el) {
          el.removeAttribute("role");
          el.removeAttribute("aria-expanded");
        });
        track.appendChild(clone);
      }
    }

    function measure() {
      const list = track.querySelector(listSelector);
      if (!list) {
        cachedHalf = 0;
        return;
      }
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      cachedHalf = list.offsetWidth + gap;
    }

    function wrapOffset() {
      if (!cachedHalf) return;
      while (offset >= cachedHalf) {
        offset -= cachedHalf;
        startOffset -= cachedHalf;
      }
      while (offset < 0) {
        offset += cachedHalf;
        startOffset += cachedHalf;
      }
    }

    function apply() {
      if (reduceMotion) return;
      wrapOffset();
      track.style.transform = "translate3d(" + -offset + "px, 0, 0)";
    }

    function setMovingClass() {
      const moving = !reduceMotion && visible && !paused && !active && !holdPause;
      track.classList.toggle("is-moving", moving);
    }

    function pauseAuto() {
      paused = true;
      setMovingClass();
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    }

    function scheduleResume() {
      if (reduceMotion || holdPause) return;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        if (holdPause) return;
        paused = false;
        setMovingClass();
        startMarqueeTicker();
      }, RESUME_DELAY);
    }

    function beginGesture(clientX, clientY) {
      if (active) return;
      pauseAuto();
      active = true;
      dragging = false;
      axis = null;
      startX = clientX;
      startY = clientY;
      startOffset = offset;
      setMovingClass();
    }

    function moveGesture(clientX, clientY, event) {
      if (!active) return;

      const dx = clientX - startX;
      const dy = clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        if (axis === "x") {
          dragging = true;
          slider.classList.add("is-dragging");
          if (typeof options.onDragStart === "function") options.onDragStart();
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
      setMovingClass();
      scheduleResume();
    }

    function finishGesture() {
      if (dragging) suppressClick = true;
      endGesture();
    }

    function step(delta) {
      if (reduceMotion || !visible || paused || active || holdPause) {
        setMovingClass();
        return false;
      }
      if (delta) {
        offset += DIR * SPEED * delta;
        apply();
      }
      setMovingClass();
      return true;
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

    slider.addEventListener("pointerup", finishGesture);
    slider.addEventListener("pointercancel", finishGesture);
    slider.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "mouse" && active) finishGesture();
    });

    slider.addEventListener(
      "touchstart",
      function (event) {
        const touch = event.touches[0];
        if (!touch || active) return;
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

    slider.addEventListener("touchend", finishGesture);
    slider.addEventListener("touchcancel", finishGesture);

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

    if (options.pauseOnHover && canHover) {
      slider.addEventListener("mouseenter", pauseAuto);
      slider.addEventListener("mouseleave", function () {
        if (!holdPause) scheduleResume();
      });
    }

    window.addEventListener("resize", function () {
      measure();
      apply();
    });

    window.addEventListener("load", function () {
      measure();
      apply();
    });

    if ("IntersectionObserver" in window && !reduceMotion) {
      const vis = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visible = entry.isIntersecting;
            setMovingClass();
            if (visible) startMarqueeTicker();
          });
        },
        { rootMargin: "80px 0px" }
      );
      vis.observe(slider);
    }

    measure();
    apply();
    requestAnimationFrame(function () {
      measure();
      apply();
    });
    marqueeItems.push({ step: step });
    if (!reduceMotion) startMarqueeTicker();

    return {
      consumeClick: function () {
        if (suppressClick) {
          suppressClick = false;
          return true;
        }
        return false;
      },
      setHoldPause: function (value) {
        holdPause = value;
        if (value) {
          pauseAuto();
        } else {
          scheduleResume();
        }
      },
      pauseAuto: pauseAuto,
      canHover: canHover,
      reduceMotion: reduceMotion,
    };
  }

  /* Slow auto-sliding certificate row; drag/swipe is 1:1 with the pointer. */
  const slider = document.querySelector(".cert-slider");
  if (slider) {
    const certCtrl = bindMarquee(slider, {
      trackSelector: ".cert-track",
      listSelector: ".cert-list",
      speed: 16,
      direction: 1,
      pauseOnHover: true,
    });

    function closeCertCards() {
      slider.querySelectorAll(".cert-card.is-open").forEach(function (card) {
        card.classList.remove("is-open");
        if (card.hasAttribute("aria-expanded")) {
          card.setAttribute("aria-expanded", "false");
        }
      });
    }

    function toggleCertCard(card) {
      if (!card) return;
      const willOpen = !card.classList.contains("is-open");
      closeCertCards();
      if (willOpen) {
        card.classList.add("is-open");
        if (card.hasAttribute("aria-expanded")) {
          card.setAttribute("aria-expanded", "true");
        }
      }
    }

    slider.addEventListener("click", function (event) {
      if (certCtrl && certCtrl.consumeClick()) return;
      const card = event.target.closest(".cert-card");
      if (!card || !slider.contains(card)) return;
      toggleCertCard(card);
    });

    slider.addEventListener("keydown", function (event) {
      const card = event.target.closest(".cert-card");
      if (!card || card.closest("[aria-hidden='true']")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCertCard(card);
      }
    });
  }

  /* Origin story timeline: fill the line and reveal entries on scroll. */
  const timelineBox = document.querySelector(".origin-timeline-box");
  const timeline = document.querySelector(".origin-timeline");
  const timelineFill = document.querySelector(".origin-track-fill");
  if (timelineBox && timeline && timelineFill) {
    const items = Array.from(timeline.querySelectorAll(".origin-item"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function setProgress(value) {
      const progress = Math.max(0, Math.min(1, value));
      timelineFill.style.transform = "scaleY(" + progress + ")";
    }

    function updateLineFill() {
      const rect = timelineBox.getBoundingClientRect();
      const anchor = window.innerHeight * 0.42;
      const progress = (anchor - rect.top) / Math.max(rect.height, 1);
      setProgress(progress);
    }

    if (reduceMotion) {
      items.forEach(function (item) {
        item.classList.add("is-inview");
      });
      setProgress(1);
    } else {
      const itemObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-inview");
            itemObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.28, rootMargin: "0px 0px -8% 0px" }
      );

      items.forEach(function (item) {
        itemObserver.observe(item);
      });

      let ticking = false;
      function onScrollOrResize() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          updateLineFill();
          ticking = false;
        });
      }

      window.addEventListener("scroll", onScrollOrResize, { passive: true });
      window.addEventListener("resize", onScrollOrResize);

      requestAnimationFrame(function () {
        items.forEach(function (item) {
          const rect = item.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.78 && rect.bottom > 0) {
            item.classList.add("is-inview");
            itemObserver.unobserve(item);
          }
        });
        timeline.classList.add("is-ready");
        updateLineFill();
      });
    }
  }

  /* Wall of Love: click arrows advance a block. Nothing changes on a timer. */
  document.querySelectorAll(".love-block").forEach(function (block) {
    const cards = Array.from(block.querySelectorAll(".love-card"));
    const dots = Array.from(block.querySelectorAll(".love-dot"));
    const prev = block.querySelector(".love-prev");
    const next = block.querySelector(".love-next");
    if (cards.length < 2 || !prev || !next) return;

    let current = Math.max(0, cards.findIndex(function (card) {
      return card.classList.contains("is-active");
    }));

    function show(index) {
      const nextIndex = (index + cards.length) % cards.length;
      if (nextIndex === current) return;
      cards[current].classList.remove("is-active");
      cards[current].setAttribute("aria-hidden", "true");
      cards[nextIndex].classList.add("is-active");
      cards[nextIndex].removeAttribute("aria-hidden");
      dots.forEach(function (dot, dotIndex) {
        const on = dotIndex === nextIndex;
        dot.classList.toggle("is-on", on);
        if (on) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
      current = nextIndex;
    }

    prev.addEventListener("click", function () {
      show(current - 1);
    });
    next.addEventListener("click", function () {
      show(current + 1);
    });
    dots.forEach(function (dot, dotIndex) {
      dot.addEventListener("click", function () {
        show(dotIndex);
      });
    });
  });

  const praise = document.querySelector(".love-marquee");
  if (praise) {
    bindMarquee(praise, {
      trackSelector: ".love-marquee-track",
      listSelector: ".love-marquee-set",
      speed: 18,
      direction: 1,
      duplicate: true,
      pauseOnHover: true,
    });
  }


  /* Highlight the in-page section currently in view. */
  const spyLinks = Array.from(document.querySelectorAll("[data-page-nav] a"));
  const spySections = [];
  const spySeen = {};
  spyLinks.forEach(function (link) {
    const href = link.getAttribute("href") || "";
    if (href.charAt(0) !== "#") return;
    const id = href.slice(1);
    if (!id || spySeen[id]) return;
    const section = document.getElementById(id);
    if (!section) return;
    spySeen[id] = true;
    spySections.push(section);
  });

  function setSpyActive(id) {
    spyLinks.forEach(function (link) {
      link.classList.toggle("is-active", (link.getAttribute("href") || "") === "#" + id);
    });
  }

  if (spySections.length) {
    function updateSpyFromPosition() {
      const line = (header ? header.getBoundingClientRect().bottom : 80) + 8;
      let current = spySections[0].id;
      spySections.forEach(function (section) {
        if (section.getBoundingClientRect().top <= line) current = section.id;
      });
      setSpyActive(current);
    }

    updateSpyFromPosition();
    window.addEventListener("scroll", updateSpyFromPosition, { passive: true });
    window.addEventListener("resize", updateSpyFromPosition);

    if ("IntersectionObserver" in window) {
      const spyObserver = new IntersectionObserver(function () {
        updateSpyFromPosition();
      }, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 1] });
      spySections.forEach(function (section) {
        spyObserver.observe(section);
      });
    }

    spyLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        const href = link.getAttribute("href") || "";
        if (href.charAt(0) === "#") setSpyActive(href.slice(1));
      });
    });
  }

  /* Hero: one-strip vertical carousel for Longevity / Mobility / Endurance */
  const heroCycle = document.querySelector(".hero-cycle");
  if (heroCycle) {
    const sizer = heroCycle.querySelector(".hero-cycle-sizer");
    const strip = heroCycle.querySelector(".hero-cycle-strip");
    const LAST_INDEX = 3;
    const HOLD_MS = 1800;
    const SLIDE_MS = 500;
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let index = 0;
    let holdTimer = null;
    let slideTimer = null;
    let sliding = false;

    function clearHeroTimers() {
      if (holdTimer) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (slideTimer) {
        window.clearTimeout(slideTimer);
        slideTimer = null;
      }
    }

    function lineHeight() {
      return sizer ? sizer.offsetHeight : 0;
    }

    function applyOffset(animate) {
      const h = lineHeight();
      heroCycle.style.setProperty("--hero-cycle-line", h + "px");
      if (animate) {
        heroCycle.classList.remove("is-instant");
      } else {
        heroCycle.classList.add("is-instant");
      }
      strip.style.transform = "translateY(" + -(index * h) + "px)";
      if (!animate) {
        void strip.offsetHeight;
        heroCycle.classList.remove("is-instant");
      }
    }

    function finishSlide() {
      sliding = false;
      if (index >= LAST_INDEX) {
        index = 0;
        applyOffset(false);
      }
      scheduleHold();
    }

    function startSlide() {
      if (sliding || motionMq.matches) return;
      sliding = true;
      index += 1;
      applyOffset(true);
      slideTimer = window.setTimeout(finishSlide, SLIDE_MS);
    }

    function scheduleHold() {
      holdTimer = window.setTimeout(startSlide, HOLD_MS);
    }

    function startHeroCycle() {
      clearHeroTimers();
      sliding = false;
      index = 0;
      applyOffset(false);
      if (motionMq.matches) return;
      scheduleHold();
    }

    startHeroCycle();

    let resizeTick = 0;
    window.addEventListener("resize", function () {
      window.cancelAnimationFrame(resizeTick);
      resizeTick = window.requestAnimationFrame(function () {
        applyOffset(false);
      });
    });

    if (motionMq.addEventListener) {
      motionMq.addEventListener("change", startHeroCycle);
    } else if (motionMq.addListener) {
      motionMq.addListener(startHeroCycle);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearHeroTimers();
        sliding = false;
        if (index >= LAST_INDEX) index = 0;
        applyOffset(false);
      } else {
        startHeroCycle();
      }
    });
  }
})();
