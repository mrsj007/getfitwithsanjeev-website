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
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
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

  /* Wall of Love: auto-scrolling rows; full quote in a popover so cards stay fixed-size. */
  const loveWall = document.querySelector(".love-wall");
  const popover = loveWall ? loveWall.querySelector(".love-popover") : null;
  const loveCtrls = [];
  let openCard = null;

  function hidePopover() {
    if (!popover) return;
    popover.classList.remove("is-visible", "is-scrollable", "is-scrolled-end");
    popover.hidden = true;
    popover.style.width = "";
    popover.style.left = "";
    popover.style.top = "";
    popover.style.maxHeight = "";
  }

  function closeAllLoveCards() {
    document.querySelectorAll(".love-row").forEach(function (row) {
      row.classList.remove("is-focused");
    });
    document.querySelectorAll(".love-card.is-open").forEach(function (card) {
      card.classList.remove("is-open");
      if (card.hasAttribute("aria-expanded")) {
        card.setAttribute("aria-expanded", "false");
      }
    });
    loveCtrls.forEach(function (item) {
      item.ctrl.setHoldPause(false);
    });
    openCard = null;
    hidePopover();
  }

  function placePopover(card) {
    if (!popover || !loveWall) return;
    const quote = card.querySelector("blockquote");
    const name = card.querySelector("figcaption");
    const quoteBox = popover.querySelector("blockquote");
    const nameBox = popover.querySelector(".love-popover-name");
    const body = popover.querySelector(".love-popover-body");
    if (quoteBox) quoteBox.textContent = quote ? quote.textContent.replace(/\s+/g, " ").trim() : "";
    if (nameBox) nameBox.textContent = name ? name.textContent.trim() : "";
    popover.hidden = false;
    popover.style.width = "";
    popover.style.maxHeight = "";
    const cardRect = card.getBoundingClientRect();
    const gutter = 12;
    const header = document.querySelector(".site-header");
    const minTop = Math.max(gutter, (header ? header.getBoundingClientRect().bottom : 0) + 8);
    const maxHeight = Math.max(160, window.innerHeight - minTop - gutter);
    popover.style.maxHeight = Math.min(window.innerHeight * 0.8, maxHeight) + "px";
    const width = Math.min(
      window.innerWidth - gutter * 2,
      Math.max(popover.offsetWidth, cardRect.width)
    );
    popover.style.width = width + "px";
    if (body) {
      body.scrollTop = 0;
      popover.classList.remove("is-scrollable", "is-scrolled-end");
      const capped = popover.scrollHeight > popover.clientHeight + 1;
      popover.classList.toggle("is-scrollable", capped);
      popover.classList.toggle("is-scrolled-end", !capped);
    }
    const popH = popover.offsetHeight;
    const popW = popover.offsetWidth;
    let left = cardRect.left;
    left = Math.max(gutter, Math.min(left, window.innerWidth - popW - gutter));
    let top = cardRect.top;
    if (top + popH > window.innerHeight - gutter) {
      top = window.innerHeight - popH - gutter;
    }
    if (top < minTop) top = minTop;
    popover.style.left = left + "px";
    popover.style.top = top + "px";
    popover.classList.add("is-visible");
  }

  function openLoveCard(card, row, ctrl) {
    if (!card) return;
    if (openCard === card) return;

    document.querySelectorAll(".love-card.is-open").forEach(function (el) {
      el.classList.remove("is-open");
      if (el.hasAttribute("aria-expanded")) {
        el.setAttribute("aria-expanded", "false");
      }
    });
    document.querySelectorAll(".love-row").forEach(function (el) {
      el.classList.remove("is-focused");
    });

    card.classList.add("is-open");
    if (card.hasAttribute("aria-expanded")) {
      card.setAttribute("aria-expanded", "true");
    }
    row.classList.add("is-focused");
    loveCtrls.forEach(function (item) {
      item.ctrl.setHoldPause(item.row === row);
    });
    openCard = card;
    placePopover(card);
  }

  document.querySelectorAll(".love-row").forEach(function (row) {
    const speed = parseFloat(row.getAttribute("data-speed")) || 16;
    const direction = parseFloat(row.getAttribute("data-direction")) || 1;
    const ctrl = bindMarquee(row, {
      trackSelector: ".love-track",
      listSelector: ".love-set",
      speed: speed,
      direction: direction,
      duplicate: true,
      pauseOnHover: true,
      onDragStart: closeAllLoveCards,
    });
    if (!ctrl) return;
    loveCtrls.push({ row: row, ctrl: ctrl });

    if (ctrl.canHover) {
      row.addEventListener("mouseover", function (event) {
        const card = event.target.closest(".love-card");
        if (!card) return;
        const from = event.relatedTarget && event.relatedTarget.closest
          ? event.relatedTarget.closest(".love-card")
          : null;
        if (from === card) return;
        openLoveCard(card, row, ctrl);
      });
      function closeRowIfLeft(event) {
        if (event.relatedTarget && popover && popover.contains(event.relatedTarget)) return;
        closeAllLoveCards();
      }
      row.addEventListener("mouseleave", closeRowIfLeft);
      row.addEventListener("pointerleave", closeRowIfLeft);
    }

    row.addEventListener("click", function (event) {
      if (ctrl.consumeClick()) return;
      if (ctrl.canHover) return;
      const card = event.target.closest(".love-card");
      if (!card || !row.contains(card)) return;
      if (openCard === card) {
        closeAllLoveCards();
      } else {
        openLoveCard(card, row, ctrl);
      }
    });

    row.addEventListener("keydown", function (event) {
      const card = event.target.closest(".love-card");
      if (!card || card.closest("[aria-hidden='true']")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (openCard === card) closeAllLoveCards();
        else openLoveCard(card, row, ctrl);
      }
    });
  });

  if (popover) {
    const popoverBody = popover.querySelector(".love-popover-body");
    if (popoverBody) {
      popoverBody.addEventListener("scroll", function () {
        const atEnd =
          popoverBody.scrollTop + popoverBody.clientHeight >= popoverBody.scrollHeight - 2;
        popover.classList.toggle("is-scrolled-end", atEnd);
      });
    }
    function closePopoverIfLeft(event) {
      if (event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest(".love-row")) {
        return;
      }
      closeAllLoveCards();
    }
    popover.addEventListener("mouseleave", closePopoverIfLeft);
    popover.addEventListener("pointerleave", closePopoverIfLeft);
  }

  function nodeInside(container, node) {
    try {
      return !!(container && node && node.nodeType && container.contains(node));
    } catch (err) {
      return false;
    }
  }

  function closeLoveOnPageScroll(event) {
    if (!openCard) return;
    if (nodeInside(popover, event && event.target)) return;
    closeAllLoveCards();
  }

  window.addEventListener("scroll", closeLoveOnPageScroll, { passive: true, capture: true });
  document.addEventListener("scroll", closeLoveOnPageScroll, { passive: true, capture: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", closeLoveOnPageScroll, { passive: true });
  }
  window.addEventListener(
    "wheel",
    function (event) {
      if (!openCard) return;
      const body = popover ? popover.querySelector(".love-popover-body") : null;
      const scrollingQuote =
        body &&
        popover.classList.contains("is-scrollable") &&
        nodeInside(body, event.target);
      if (scrollingQuote) return;
      closeAllLoveCards();
    },
    { passive: true, capture: true }
  );

  document.addEventListener("focusout", function (event) {
    if (!openCard) return;
    if (!loveWall || !nodeInside(loveWall, event.target)) return;
    if (nodeInside(loveWall, event.relatedTarget)) return;
    closeAllLoveCards();
  });

  document.addEventListener("click", function (event) {
    if (event.target.closest(".love-wall")) return;
    closeAllLoveCards();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeAllLoveCards();
  });

  function updateLoveMores() {
    document.querySelectorAll(".love-card").forEach(function (card) {
      const quote = card.querySelector("blockquote");
      const more = card.querySelector(".love-more");
      if (!quote || !more) return;
      const clipped = quote.scrollHeight > quote.clientHeight + 2;
      more.hidden = !clipped;
      quote.classList.toggle("is-clipped", clipped);
    });
  }

  requestAnimationFrame(updateLoveMores);
  window.addEventListener("resize", updateLoveMores);
})();
