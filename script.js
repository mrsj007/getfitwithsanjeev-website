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

  /* Tap a certification card to open its short summary. */
  const certList = document.querySelector(".cert-list");
  if (certList) {
    function closeCertCards() {
      certList.querySelectorAll(".cert-card.is-open").forEach(function (card) {
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

    certList.addEventListener("click", function (event) {
      const card = event.target.closest(".cert-card");
      if (!card || !certList.contains(card)) return;
      toggleCertCard(card);
    });

    certList.addEventListener("keydown", function (event) {
      const card = event.target.closest(".cert-card");
      if (!card || !certList.contains(card)) return;
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
      if (!sizer) return 0;
      const word = sizer.querySelector("span");
      const measured = word ? word.getBoundingClientRect().height : sizer.getBoundingClientRect().height;
      const dpr = window.devicePixelRatio || 1;
      return Math.round(measured * dpr) / dpr;
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

  /* Blog: reading progress, table of contents, category filters, card fade-in. */
  const reduceBlogMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const progress = document.getElementById("reading-progress");
  const progressArticle = document.querySelector(".post-article");
  if (progress && progressArticle && !reduceBlogMotion) {
    function updateProgress() {
      const start = progressArticle.offsetTop;
      const span = Math.max(progressArticle.offsetHeight - window.innerHeight, 1);
      const value = Math.min(1, Math.max(0, (window.scrollY - start) / span));
      progress.style.transform = "scaleX(" + value.toFixed(4) + ")";
    }
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
  }

  const toc = document.querySelector(".post-toc");
  if (toc) {
    const toggle = toc.querySelector(".post-toc-toggle");
    const wideMq = window.matchMedia("(min-width: 1024px)");
    const tocLinks = Array.from(toc.querySelectorAll(".post-toc-list a"));
    function syncToc() {
      if (!toggle) return;
      if (wideMq.matches) {
        toc.classList.remove("is-collapsed");
        toggle.setAttribute("aria-expanded", "true");
        toggle.tabIndex = -1;
      } else {
        toc.classList.add("is-collapsed");
        toggle.setAttribute("aria-expanded", "false");
        toggle.tabIndex = 0;
      }
    }
    syncToc();
    if (wideMq.addEventListener) wideMq.addEventListener("change", syncToc);
    else if (wideMq.addListener) wideMq.addListener(syncToc);
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (wideMq.matches) return;
        const open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", open ? "false" : "true");
        toc.classList.toggle("is-collapsed", open);
      });
    }
    if (tocLinks.length) {
      const tocIds = tocLinks.map(function (link) {
        return (link.getAttribute("href") || "").replace(/^#/, "");
      });
      function setActiveToc(id) {
        tocLinks.forEach(function (link) {
          const on = (link.getAttribute("href") || "") === "#" + id;
          if (on) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
      function updateActiveToc() {
        const bar = document.querySelector(".site-header");
        const header = bar ? bar.getBoundingClientRect().height : 84;
        const line = header + 12;
        let current = tocIds[0];
        tocIds.forEach(function (id) {
          const el = document.getElementById(id);
          if (!el) return;
          if (el.getBoundingClientRect().top <= line) current = id;
        });
        setActiveToc(current);
      }
      updateActiveToc();
      window.addEventListener("scroll", updateActiveToc, { passive: true });
      window.addEventListener("resize", updateActiveToc);
    }
  }

  const categorySelect = document.getElementById("blog-category");
  if (categorySelect) {
    const cards = Array.from(document.querySelectorAll("#blog-card-grid [data-blog-card]"));
    const grid = document.getElementById("blog-card-grid");
    const emptyNote = document.getElementById("blog-filter-empty");
    const emptyName = document.getElementById("blog-filter-empty-name");
    const countEl = document.querySelector(".blog-count");
    const statusEl = document.getElementById("blog-filter-status");
    const selectionEl = document.getElementById("blog-filter-selection");
    const clearEl = document.getElementById("blog-filter-clear");
    const seeAllEl = document.getElementById("blog-filter-see-all");
    const trigger = document.getElementById("blog-category-trigger");
    const panel = document.getElementById("blog-category-panel");
    const valueEl = document.getElementById("blog-category-value");
    const labelEl = document.getElementById("blog-category-label");
    const bar = categorySelect.closest(".blog-filter-bar");
    const wrap = categorySelect.closest(".blog-select-wrap");
    const known = Array.from(categorySelect.options).map(function (option) {
      return option.value;
    });
    const wideMq = window.matchMedia("(min-width: 768px)");
    let menuOpen = false;
    let typeBuffer = "";
    let typeTimer = 0;
    let fadeTimer = 0;
    let fadeJob = null;

    function countLabel(count) {
      return count + (count === 1 ? " article" : " articles");
    }

    function selectedOption() {
      return categorySelect.options[categorySelect.selectedIndex] || null;
    }

    function selectionLabel() {
      const option = selectedOption();
      if (!option) return "";
      return option.getAttribute("data-label") || String(option.textContent || "").replace(/\s*\(\d+\)\s*$/, "");
    }

    function buttonLabel() {
      const option = selectedOption();
      if (!option) return "All categories";
      return option.getAttribute("data-button-label") || option.getAttribute("data-label") || "All categories";
    }

    function emptyLabel() {
      const option = selectedOption();
      if (!option) return "";
      return option.getAttribute("data-empty-name") || selectionLabel();
    }

    function wideMenu() {
      return wideMq.matches;
    }

    function menuOptions() {
      if (!panel) return [];
      return Array.from(panel.querySelectorAll('[role="option"]'));
    }

    function subForToggle(toggle) {
      if (!toggle || !toggle.id) return null;
      return document.getElementById(toggle.id.replace("blog-group-", "blog-sub-"));
    }

    function openToggle() {
      if (!panel) return null;
      return panel.querySelector(".blog-category-group-toggle[aria-expanded='true']");
    }

    function syncMenu() {
      if (!panel) return;
      const active = categorySelect.value;
      menuOptions().forEach(function (option) {
        const on = (option.getAttribute("data-value") || "") === active;
        option.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (valueEl) valueEl.textContent = buttonLabel();
    }

    function visibleRows() {
      if (!panel) return [];
      const rows = [];
      const all = document.getElementById("blog-opt-all");
      if (all) rows.push(all);
      Array.from(panel.querySelectorAll(".blog-category-group")).forEach(function (group) {
        const toggle = group.querySelector(".blog-category-group-toggle");
        if (toggle) rows.push(toggle);
        const sub = toggle ? subForToggle(toggle) : null;
        if (sub && sub.classList.contains("is-open")) {
          Array.from(sub.querySelectorAll('[role="option"]')).forEach(function (option) {
            rows.push(option);
          });
        }
      });
      return rows;
    }

    function leftRows() {
      const rows = [];
      const all = document.getElementById("blog-opt-all");
      if (all) rows.push(all);
      if (!panel) return rows;
      Array.from(panel.querySelectorAll(".blog-category-group-toggle")).forEach(function (toggle) {
        rows.push(toggle);
      });
      return rows;
    }

    function rightRows() {
      const toggle = openToggle();
      if (!toggle) return [];
      const sub = subForToggle(toggle);
      if (!sub) return [];
      return Array.from(sub.querySelectorAll('[role="option"]'));
    }

    function columnRows(node) {
      if (!wideMenu()) return visibleRows();
      if (node && rightRows().indexOf(node) !== -1) return rightRows();
      return leftRows();
    }

    function syncDetail() {
      const detail = document.getElementById("blog-category-detail");
      const hint = document.getElementById("blog-category-hint");
      const toggle = openToggle();
      const wide = wideMenu();
      if (hint) {
        if (wide && !toggle) hint.removeAttribute("hidden");
        else hint.setAttribute("hidden", "");
      }
      if (!detail) return;
      if (wide && toggle) {
        detail.setAttribute("role", "listbox");
        detail.setAttribute("aria-label", toggle.getAttribute("data-label") || "");
      } else {
        detail.removeAttribute("role");
        detail.removeAttribute("aria-label");
      }
    }

    function announce(message) {
      const live = document.getElementById("blog-category-live");
      if (!live || !wideMenu()) return;
      const next = message || "";
      if (live.textContent === next) {
        live.textContent = "";
        window.setTimeout(function () {
          live.textContent = next;
        }, 30);
      } else {
        live.textContent = next;
      }
    }

    function announceGroup(toggle) {
      if (!wideMenu()) return;
      if (!toggle) {
        announce("Choose Workout, Nutrition or Supplementation to see topics.");
        return;
      }
      const sub = subForToggle(toggle);
      const count = sub ? sub.querySelectorAll('[role="option"]').length : 0;
      const name = toggle.getAttribute("data-label") || "Category";
      announce(name + " topics, " + count + " " + (count === 1 ? "option" : "options"));
    }

    function layoutColumns() {
      if (!panel) return;
      const detail = document.getElementById("blog-category-detail");
      const all = document.getElementById("blog-opt-all");
      if (!detail || !all) return;
      const wide = wideMenu();
      const toggles = Array.from(panel.querySelectorAll(".blog-category-group-toggle"));
      if (wide) {
        let main = document.getElementById("blog-category-main");
        if (!main) {
          main = document.createElement("div");
          main.id = "blog-category-main";
          main.className = "blog-category-main";
          panel.insertBefore(main, panel.firstChild);
        }
        let allWrap = document.getElementById("blog-category-all");
        if (!allWrap) {
          allWrap = document.createElement("div");
          allWrap.id = "blog-category-all";
          allWrap.className = "blog-category-all";
        }
        allWrap.setAttribute("role", "listbox");
        allWrap.setAttribute("aria-label", "Categories");
        if (all.parentNode !== allWrap) allWrap.appendChild(all);
        if (allWrap.parentNode !== main) main.insertBefore(allWrap, main.firstChild);
        toggles.forEach(function (toggle) {
          const group = toggle.closest(".blog-category-group");
          const sub = subForToggle(toggle);
          if (group && group.parentNode !== main) main.appendChild(group);
          if (sub && sub.parentNode !== detail) detail.appendChild(sub);
          if (sub) {
            if (!sub.getAttribute("data-label")) sub.setAttribute("data-label", sub.getAttribute("aria-label") || "");
            sub.setAttribute("role", "presentation");
            sub.removeAttribute("aria-label");
          }
          toggle.setAttribute("aria-controls", "blog-category-detail");
        });
        if (detail.parentNode === panel && main.nextSibling !== detail) panel.insertBefore(detail, main.nextSibling);
        panel.classList.add("is-wide");
        panel.removeAttribute("role");
        panel.removeAttribute("aria-labelledby");
      } else {
        panel.classList.remove("is-wide");
        if (all.parentNode !== panel) panel.insertBefore(all, panel.firstChild);
        toggles.forEach(function (toggle) {
          const group = toggle.closest(".blog-category-group");
          const sub = subForToggle(toggle);
          if (group && group.parentNode !== panel) panel.appendChild(group);
          if (sub && group && sub.parentNode !== group) group.appendChild(sub);
          if (sub) {
            const label = sub.getAttribute("data-label") || sub.getAttribute("aria-label") || "";
            sub.setAttribute("role", "group");
            if (label) sub.setAttribute("aria-label", label);
          }
          if (sub) toggle.setAttribute("aria-controls", sub.id);
        });
        if (detail.parentNode === panel) panel.appendChild(detail);
        const main = document.getElementById("blog-category-main");
        if (main && main.parentNode) main.parentNode.removeChild(main);
        const allWrap = document.getElementById("blog-category-all");
        if (allWrap && allWrap.parentNode) allWrap.parentNode.removeChild(allWrap);
        panel.setAttribute("role", "listbox");
        panel.setAttribute("aria-labelledby", "blog-category-label");
      }
      syncDetail();
    }

    function setToggleOpen(toggle, open) {
      if (!toggle) return;
      const sub = subForToggle(toggle);
      if (!sub) return;
      if (open) {
        Array.from(panel.querySelectorAll(".blog-category-group-toggle")).forEach(function (other) {
          if (other !== toggle) setToggleOpen(other, false);
        });
      }
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (isOpen === open) return;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      sub.classList.toggle("is-open", open);
      if (open) {
        sub.removeAttribute("aria-hidden");
        sub.removeAttribute("inert");
      } else {
        sub.setAttribute("aria-hidden", "true");
        sub.setAttribute("inert", "");
      }
    }

    function toggleGroup(toggle) {
      if (!toggle) return;
      setToggleOpen(toggle, toggle.getAttribute("aria-expanded") !== "true");
      syncDetail();
    }

    function focusRight(toggle) {
      const sub = subForToggle(toggle);
      if (!sub) return;
      const rows = Array.from(sub.querySelectorAll('[role="option"]'));
      if (!rows.length) return;
      let target = rows[0];
      rows.forEach(function (row) {
        if (row.getAttribute("aria-selected") === "true") target = row;
      });
      focusOption(target);
    }

    function finishFade() {
      const job = fadeJob;
      fadeJob = null;
      fadeTimer = 0;
      if (!job || !panel) {
        if (panel) panel.classList.remove("is-fading");
        return;
      }
      setToggleOpen(job.toggle, true);
      syncDetail();
      announceGroup(job.toggle);
      if (job.focus) focusRight(job.toggle);
      const detail = document.getElementById("blog-category-detail");
      if (detail) void detail.offsetWidth;
      window.requestAnimationFrame(function () {
        if (panel) panel.classList.remove("is-fading");
      });
    }

    function activateGroup(toggle, opts) {
      opts = opts || {};
      if (!toggle) return;
      const already = toggle.getAttribute("aria-expanded") === "true";
      if (already) {
        if (opts.focus) focusRight(toggle);
        return;
      }
      const instant = opts.instant || !wideMenu() || reduceBlogMotion;
      if (instant) {
        window.clearTimeout(fadeTimer);
        fadeTimer = 0;
        fadeJob = null;
        if (panel) {
          panel.classList.remove("is-fading");
          panel.classList.add("is-instant");
        }
        setToggleOpen(toggle, true);
        syncDetail();
        announceGroup(toggle);
        if (opts.focus) focusRight(toggle);
        if (panel) {
          void panel.offsetWidth;
          panel.classList.remove("is-instant");
        }
        return;
      }
      fadeJob = { toggle: toggle, focus: !!opts.focus };
      if (panel.classList.contains("is-fading")) return;
      panel.classList.add("is-fading");
      fadeTimer = window.setTimeout(finishFade, 150);
    }

    function expandForSelection() {
      if (!panel) return;
      let match = null;
      const value = categorySelect.value;
      if (value) {
        const option = document.getElementById("blog-opt-" + value);
        const sub = option && option.closest(".blog-category-sub");
        if (sub && sub.id.indexOf("blog-sub-") === 0) {
          match = document.getElementById(sub.id.replace("blog-sub-", "blog-group-"));
        }
      }
      window.clearTimeout(fadeTimer);
      fadeTimer = 0;
      fadeJob = null;
      panel.classList.remove("is-fading");
      panel.classList.add("is-instant");
      Array.from(panel.querySelectorAll(".blog-category-group-toggle")).forEach(function (toggle) {
        setToggleOpen(toggle, toggle === match);
      });
      syncDetail();
      if (wideMenu()) announceGroup(match);
      void panel.offsetWidth;
      panel.classList.remove("is-instant");
    }

    function groupToggleFromEvent(event) {
      let node = event.target;
      while (node && node !== panel) {
        if (node.classList && node.classList.contains("blog-category-group-toggle")) return node;
        node = node.parentNode;
      }
      return null;
    }

    function applyFilter(category) {
      const active = category && known.indexOf(category) !== -1 ? category : "";
      categorySelect.value = active;
      if (grid) {
        grid.classList.toggle("is-filtered", !!active);
        grid.hidden = false;
      }
      let shown = 0;
      cards.forEach(function (card) {
        const cats = (card.getAttribute("data-categories") || "").split(/\s+/);
        const match = !active || cats.indexOf(active) !== -1;
        card.hidden = !match;
        if (match) shown += 1;
      });
      if (grid) grid.hidden = shown === 0;
      if (emptyNote) emptyNote.hidden = shown !== 0;
      if (emptyName) emptyName.textContent = active && shown === 0 ? emptyLabel() : "";
      if (countEl) countEl.textContent = countLabel(shown);
      if (statusEl) statusEl.hidden = !active;
      if (selectionEl) selectionEl.textContent = active ? selectionLabel() : "";
      syncMenu();
    }

    function categoryFromUrl() {
      return new URLSearchParams(window.location.search).get("category") || "";
    }

    function writeUrl(mode) {
      const url = new URL(window.location.href);
      if (categorySelect.value) url.searchParams.set("category", categorySelect.value);
      else url.searchParams.delete("category");
      const next = url.pathname + url.search;
      const state = { category: categorySelect.value };
      if (mode === "replace") window.history.replaceState(state, "", next);
      else window.history.pushState(state, "", next);
    }

    function publish(category, mode) {
      applyFilter(category);
      writeUrl(mode);
    }

    function placePanel() {
      if (!panel || !trigger) return;
      const field = trigger.closest(".blog-filter-field") || bar;
      if (!field) return;
      const triggerRect = trigger.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const margin = 16;
      const viewport = window.innerWidth;
      const wide = wideMenu();
      let width = wide ? Math.min(620, viewport - margin * 2) : Math.min(fieldRect.width, viewport - margin * 2);
      let left = triggerRect.left - fieldRect.left;
      if (fieldRect.left + left + width > viewport - margin) left = triggerRect.right - fieldRect.left - width;
      if (fieldRect.left + left < margin) left = margin - fieldRect.left;
      if (fieldRect.left + left + width > viewport - margin) {
        width = Math.max(160, viewport - margin - (fieldRect.left + left));
      }
      const available = Math.floor(window.innerHeight - triggerRect.bottom - 12);
      const cap = Math.floor(window.innerHeight * 0.6);
      panel.style.top = Math.round(triggerRect.bottom - fieldRect.top + 6) + "px";
      panel.style.left = Math.round(left) + "px";
      panel.style.right = "auto";
      panel.style.width = Math.round(width) + "px";
      panel.style.setProperty("--blog-menu-cap", Math.max(Math.min(available, cap), 160) + "px");
      if (wide) panel.style.maxHeight = "";
      else panel.style.maxHeight = Math.max(Math.min(available, cap), 96) + "px";
    }

    function focusOption(option) {
      if (!option || !panel) return;
      const inRight = wideMenu() && rightRows().indexOf(option) !== -1;
      const rows = inRight ? rightRows() : wideMenu() ? leftRows() : visibleRows();
      const others = wideMenu() ? (inRight ? leftRows() : rightRows()) : [];
      rows.forEach(function (item) {
        item.tabIndex = item === option ? 0 : -1;
      });
      others.forEach(function (item) {
        if (item !== option) item.tabIndex = -1;
      });
      option.focus({ preventScroll: true });
      const scroller = inRight ? option.closest(".blog-category-sub") || panel : panel;
      const rowRect = option.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      if (rowRect.top < scrollerRect.top) scroller.scrollTop -= scrollerRect.top - rowRect.top;
      else if (rowRect.bottom > scrollerRect.bottom) scroller.scrollTop += rowRect.bottom - scrollerRect.bottom;
    }

    function openMenu(where) {
      if (!panel || !trigger || menuOpen) return;
      layoutColumns();
      expandForSelection();
      panel.hidden = false;
      menuOpen = true;
      trigger.setAttribute("aria-expanded", "true");
      placePanel();
      let target = null;
      if (wideMenu()) {
        const left = leftRows();
        const right = rightRows();
        if (where === "end") target = right.length ? right[right.length - 1] : left[left.length - 1];
        else {
          target = left[0];
          left.forEach(function (row) {
            if (row.getAttribute("aria-selected") === "true") target = row;
          });
          right.forEach(function (row) {
            if (row.getAttribute("aria-selected") === "true") target = row;
          });
        }
      } else {
        const rows = visibleRows();
        target = rows[0];
        if (where === "end") target = rows[rows.length - 1];
        else {
          rows.forEach(function (row) {
            if (row.getAttribute("aria-selected") === "true") target = row;
          });
        }
      }
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          if (menuOpen) panel.classList.add("is-open");
        });
      });
      focusOption(target);
    }

    function closeMenu(restoreFocus) {
      if (!panel || !trigger) return;
      if (!menuOpen) {
        if (restoreFocus) trigger.focus();
        return;
      }
      window.clearTimeout(fadeTimer);
      fadeTimer = 0;
      fadeJob = null;
      menuOpen = false;
      panel.classList.remove("is-open");
      panel.classList.remove("is-fading");
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      visibleRows().forEach(function (row) {
        row.tabIndex = -1;
      });
      leftRows().forEach(function (row) {
        row.tabIndex = -1;
      });
      menuOptions().forEach(function (option) {
        option.tabIndex = -1;
      });
      if (restoreFocus) trigger.focus();
    }

    function commit(value) {
      const next = value && known.indexOf(value) !== -1 ? value : "";
      if (next !== categorySelect.value) publish(next, "push");
      closeMenu(true);
    }

    function clearFilter() {
      publish("", "push");
      closeMenu(false);
    }

    function optionFromEvent(event) {
      let node = event.target;
      while (node && node !== panel) {
        if (node.getAttribute && node.getAttribute("role") === "option") return node;
        node = node.parentNode;
      }
      return null;
    }

    if (trigger && panel && wrap) {
      trigger.hidden = false;
      categorySelect.classList.add("visually-hidden");
      categorySelect.tabIndex = -1;
      categorySelect.setAttribute("aria-hidden", "true");
      wrap.classList.add("is-enhanced");
      if (labelEl) labelEl.htmlFor = trigger.id;
      trigger.addEventListener("click", function () {
        if (menuOpen) closeMenu(false);
        else openMenu("selected");
      });
      let groupKeyToggle = 0;
      panel.addEventListener("click", function (event) {
        const toggle = groupToggleFromEvent(event);
        if (toggle) {
          if (Date.now() - groupKeyToggle < 400) return;
          event.preventDefault();
          if (wideMenu()) activateGroup(toggle, { focus: false });
          else toggleGroup(toggle);
          return;
        }
        const option = optionFromEvent(event);
        if (!option) return;
        commit(option.getAttribute("data-value") || "");
      });
      bar.addEventListener("keydown", function (event) {
        if (!menuOpen) {
          if (
            event.target === trigger &&
            (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            openMenu(event.key === "ArrowUp" ? "end" : "selected");
          }
          return;
        }
        const rows = columnRows(document.activeElement);
        const index = rows.indexOf(document.activeElement);
        const current = index === -1 ? null : rows[index];
        const onGroup = current && current.classList.contains("blog-category-group-toggle");
        const onRight = wideMenu() && current && rightRows().indexOf(current) !== -1;
        if (event.key === "Escape") {
          event.preventDefault();
          closeMenu(true);
          return;
        }
        if (event.target === trigger && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End")) {
          event.preventDefault();
          const edgeRows = wideMenu() ? leftRows() : rows;
          const edge = event.key === "ArrowUp" || event.key === "End" ? edgeRows[edgeRows.length - 1] : edgeRows[0];
          focusOption(edge);
          return;
        }
        if (!wideMenu() && onGroup && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
          event.preventDefault();
          setToggleOpen(current, event.key === "ArrowRight");
          syncDetail();
          return;
        }
        if (wideMenu() && onGroup && (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          groupKeyToggle = Date.now();
          activateGroup(current, { focus: true });
          return;
        }
        if (wideMenu() && onRight && event.key === "ArrowLeft") {
          event.preventDefault();
          const back = openToggle();
          if (back) focusOption(back);
          return;
        }
        if (wideMenu() && onRight && event.key === "ArrowRight") {
          event.preventDefault();
          return;
        }
        if (wideMenu() && !onRight && event.key === "ArrowLeft") {
          event.preventDefault();
          return;
        }
        if (wideMenu() && current === document.getElementById("blog-opt-all") && event.key === "ArrowRight") {
          const right = rightRows();
          if (!right.length) return;
          event.preventDefault();
          let target = right[0];
          right.forEach(function (row) {
            if (row.getAttribute("aria-selected") === "true") target = row;
          });
          focusOption(target);
          return;
        }
        if (!wideMenu() && onGroup && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          groupKeyToggle = Date.now();
          toggleGroup(current);
          return;
        }
        if (index === -1) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusOption(rows[Math.min(index + 1, rows.length - 1)]);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusOption(rows[Math.max(index - 1, 0)]);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusOption(rows[0]);
        } else if (event.key === "End") {
          event.preventDefault();
          focusOption(rows[rows.length - 1]);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          commit(current.getAttribute("data-value") || "");
        } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          typeBuffer += event.key.toLowerCase();
          window.clearTimeout(typeTimer);
          typeTimer = window.setTimeout(function () {
            typeBuffer = "";
          }, 500);
          const ordered = rows.slice(index + 1).concat(rows.slice(0, index + 1));
          let match = null;
          for (let i = 0; i < ordered.length; i += 1) {
            const label = (ordered[i].getAttribute("data-label") || "").toLowerCase();
            if (label.indexOf(typeBuffer) === 0) {
              match = ordered[i];
              break;
            }
          }
          if (match) {
            event.preventDefault();
            focusOption(match);
          }
        }
      });
      bar.addEventListener("focusout", function () {
        window.setTimeout(function () {
          if (!menuOpen) return;
          if (bar.contains(document.activeElement)) return;
          closeMenu(false);
        }, 0);
      });
      document.addEventListener("click", function (event) {
        if (!menuOpen) return;
        if (bar.contains(event.target)) return;
        closeMenu(false);
      });
      document.addEventListener("keydown", function (event) {
        if (!menuOpen || event.key !== "Escape") return;
        event.preventDefault();
        closeMenu(true);
      });
      window.addEventListener("resize", function () {
        layoutColumns();
        if (menuOpen) placePanel();
      });
      layoutColumns();
    }

    applyFilter(categoryFromUrl());
    if (categoryFromUrl() !== categorySelect.value) {
      const url = new URL(window.location.href);
      url.searchParams.delete("category");
      window.history.replaceState({ category: "" }, "", url.pathname + url.search);
    }
    categorySelect.addEventListener("change", function () {
      publish(categorySelect.value, "push");
    });
    window.addEventListener("popstate", function () {
      applyFilter(categoryFromUrl());
      if (categoryFromUrl() !== categorySelect.value) {
        const url = new URL(window.location.href);
        url.searchParams.delete("category");
        window.history.replaceState({ category: "" }, "", url.pathname + url.search);
      }
      closeMenu(false);
    });
    if (clearEl) clearEl.addEventListener("click", clearFilter);
    if (seeAllEl) seeAllEl.addEventListener("click", clearFilter);
  }

  const blogCards = Array.from(document.querySelectorAll(".blog-card"));
  if (blogCards.length && !reduceBlogMotion && "IntersectionObserver" in window) {
    const cardObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-inview");
          cardObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    window.requestAnimationFrame(function () {
      document.documentElement.classList.add("blog-motion");
      blogCards.forEach(function (card) {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) card.classList.add("is-inview");
        else cardObserver.observe(card);
      });
    });
  }
})();
