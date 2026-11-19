/* BMI calculator page: client-side maths, gauge, guidance, related posts, lead form.
   Does not store age, height or weight in cookies, localStorage, URL params or logs.
   Health numbers leave the browser only if the visitor opts in and submits the contact form. */

import guidanceData from "./content/bmi/guidance.json";
import relatedData from "./content/bmi/related.json";

(function () {
  "use strict";

  const BMI_FORM_ENDPOINT = "https://formspree.io/f/maeywvbo";
  const CM_PER_IN = 2.54;
  const KG_PER_LB = 0.45359237;

  /** Unit preference lives in memory only for this page visit. */
  let units = "metric";
  let lastResult = null;

  const form = document.getElementById("bmi-form");
  if (!form) return;

  const ageInput = document.getElementById("bmi-age");
  const heightCm = document.getElementById("bmi-height-cm");
  const heightFt = document.getElementById("bmi-height-ft");
  const heightIn = document.getElementById("bmi-height-in");
  const weightKg = document.getElementById("bmi-weight-kg");
  const weightLb = document.getElementById("bmi-weight-lb");
  const southAsian = document.getElementById("bmi-south-asian");
  const metricFields = document.getElementById("bmi-metric-fields");
  const imperialFields = document.getElementById("bmi-imperial-fields");
  const unitButtons = form.querySelectorAll("[data-bmi-units]");

  const under18Box = document.getElementById("bmi-under18");
  const emptyState = document.getElementById("bmi-empty-state");
  const results = document.getElementById("bmi-results");
  const resultFocus = document.getElementById("bmi-result-focus");
  const liveRegion = document.getElementById("bmi-live");
  const valueEl = document.getElementById("bmi-value");
  const categoryEl = document.getElementById("bmi-category-label");
  const detailEl = document.getElementById("bmi-detail");
  const rangeEl = document.getElementById("bmi-healthy-range");
  const distanceEl = document.getElementById("bmi-distance");
  const gaugeMarker = document.getElementById("bmi-gauge-marker");
  const gaugeValue = document.getElementById("bmi-gauge-value");
  const gaugeTicks = document.getElementById("bmi-gauge-ticks");
  const gaugeLabel = document.getElementById("bmi-gauge-label");
  const gaugeLegend = document.getElementById("bmi-gauge-legend");
  const ageChart = document.getElementById("bmi-age-chart");
  const guidanceBlock = document.getElementById("bmi-guidance");
  const relatedBlock = document.getElementById("bmi-related");
  const relatedGrid = document.getElementById("bmi-related-grid");
  const relatedSeeAll = document.getElementById("bmi-related-see-all");
  const leadSection = document.getElementById("bmi-lead");
  const limitsSection = document.getElementById("bmi-limits");
  const followUp = document.getElementById("bmi-follow-up");
  const shareResults = document.getElementById("bmi-share-results");
  const summaryField = document.getElementById("bmi-summary");
  const contactForm = document.getElementById("bmi-contact-form");
  const clearBtn = document.getElementById("bmi-clear");
  const resultAgeNote = document.getElementById("bmi-result-age-note");
  const resultCta = document.getElementById("bmi-result-cta");
  const SESSION_KEY = "bmiSession";
  const GAUGE_FLOOR = 12.5;
  const GAUGE_CEILING = 40;

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function calcBmi(kg, cm) {
    const m = cm / 100;
    if (!m) return NaN;
    return kg / (m * m);
  }

  function toMetric() {
    if (units === "metric") {
      return {
        cm: parseFloat(heightCm.value, 10),
        kg: parseFloat(weightKg.value, 10),
      };
    }
    const ft = parseFloat(heightFt.value, 10);
    const inches = parseFloat(heightIn.value, 10);
    const lb = parseFloat(weightLb.value, 10);
    const totalIn = (Number.isFinite(ft) ? ft : 0) * 12 + (Number.isFinite(inches) ? inches : 0);
    return {
      cm: totalIn * CM_PER_IN,
      kg: lb * KG_PER_LB,
    };
  }

  function clearErrors() {
    form.querySelectorAll(".bmi-field-error").forEach(function (el) {
      el.hidden = true;
      el.textContent = "";
    });
    form.querySelectorAll("[aria-invalid]").forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
  }

  function showError(input, errorId, message) {
    const err = document.getElementById(errorId);
    if (!input || !err) return !!message;
    err.textContent = message || "";
    err.hidden = !message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    return !!message;
  }

  function setUnits(next) {
    units = next === "imperial" ? "imperial" : "metric";
    unitButtons.forEach(function (btn) {
      const active = btn.getAttribute("data-bmi-units") === units;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });
    if (metricFields) metricFields.hidden = units !== "metric";
    if (imperialFields) imperialFields.hidden = units !== "imperial";
    [heightCm, weightKg].forEach(function (el) {
      if (el) el.disabled = units !== "metric";
    });
    [heightFt, heightIn, weightLb].forEach(function (el) {
      if (el) el.disabled = units !== "imperial";
    });
  }

  unitButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setUnits(btn.getAttribute("data-bmi-units"));
    });
  });
  setUnits("metric");

  function isSouthAsianMode() {
    return !!(southAsian && southAsian.checked);
  }

  /**
   * Standard WHO labels, or South Asian action-point labels (no "obese" wording).
   * guidanceKey maps to content/bmi/guidance.json categories.
   */
  function categoryFor(bmi, south) {
    if (south) {
      if (bmi < 18.5) {
        return {
          key: "underweight",
          guidanceKey: "underweight",
          label: "Underweight",
          detail: "Below 18.5",
          healthyLow: 18.5,
          healthyHigh: 22.9,
        };
      }
      if (bmi < 23) {
        return {
          key: "healthy",
          guidanceKey: "healthy",
          label: "Healthy range",
          detail: "18.5 to 22.9 (South Asian reference)",
          healthyLow: 18.5,
          healthyHigh: 22.9,
        };
      }
      if (bmi < 27.5) {
        return {
          key: "increased",
          guidanceKey: "overweight",
          label: "Increased risk",
          detail: "23 to 27.4 (South Asian reference)",
          healthyLow: 18.5,
          healthyHigh: 22.9,
        };
      }
      return {
        key: "high",
        guidanceKey: "obese",
        label: "High risk",
        detail: "27.5 or more (South Asian reference)",
        healthyLow: 18.5,
        healthyHigh: 22.9,
      };
    }

    if (bmi < 18.5) {
      return {
        key: "underweight",
        guidanceKey: "underweight",
        label: "Underweight",
        detail: "Below 18.5",
        healthyLow: 18.5,
        healthyHigh: 24.9,
      };
    }
    if (bmi < 25) {
      return {
        key: "healthy",
        guidanceKey: "healthy",
        label: "Healthy weight",
        detail: "18.5 to 24.9",
        healthyLow: 18.5,
        healthyHigh: 24.9,
      };
    }
    if (bmi < 30) {
      return {
        key: "overweight",
        guidanceKey: "overweight",
        label: "Overweight",
        detail: "25 to 29.9",
        healthyLow: 18.5,
        healthyHigh: 24.9,
      };
    }
    if (bmi < 35) {
      return {
        key: "obese",
        guidanceKey: "obese",
        label: "Obese - Class I",
        detail: "30 to 34.9",
        healthyLow: 18.5,
        healthyHigh: 24.9,
      };
    }
    if (bmi < 40) {
      return {
        key: "obese",
        guidanceKey: "obese",
        label: "Obese - Class II",
        detail: "35 to 39.9",
        healthyLow: 18.5,
        healthyHigh: 24.9,
      };
    }
    return {
      key: "obese",
      guidanceKey: "obese",
      label: "Obese - Class III",
      detail: "40+",
      healthyLow: 18.5,
      healthyHigh: 24.9,
    };
  }

  function ageBand(age) {
    if (age >= 65) return "65+";
    if (age >= 50) return "50-64";
    if (age >= 30) return "30-49";
    return "18-29";
  }

  function formatWeight(kg) {
    if (units === "imperial") {
      return round1(kg / KG_PER_LB) + " lb";
    }
    return round1(kg) + " kg";
  }

  function healthyRangeText(cm, low, high) {
    const m = cm / 100;
    const lowKg = low * m * m;
    const highKg = high * m * m;
    return formatWeight(lowKg) + " to " + formatWeight(highKg);
  }

  /** Distance from actual kg to the healthy band that is displayed (not from rounded BMI). */
  function distanceText(kg, cm, low, high) {
    const m = cm / 100;
    const lowKg = low * m * m;
    const highKg = high * m * m;
    if (kg >= lowKg && kg <= highKg) {
      return "You are inside the healthy BMI range shown for your height (" + low + " to " + high + ").";
    }
    if (kg < lowKg) {
      return "About " + formatWeight(lowKg - kg) + " below the lower end of the healthy range shown for your height.";
    }
    return "About " + formatWeight(kg - highKg) + " above the upper end of the healthy range shown for your height.";
  }

  /** Cut-offs that end each coloured segment, from GAUGE_FLOOR to GAUGE_CEILING. */
  function gaugeCuts(south) {
    return south ? [18.5, 23, 27.5, GAUGE_CEILING] : [18.5, 25, 30, GAUGE_CEILING];
  }

  function gaugeSegmentWidths(south) {
    const cuts = gaugeCuts(south);
    const widths = [];
    let prev = GAUGE_FLOOR;
    cuts.forEach(function (cut) {
      widths.push(cut - prev);
      prev = cut;
    });
    return widths;
  }

  /** Marker position on the same continuum as the segment widths. */
  function gaugePercent(bmi, south) {
    const span = GAUGE_CEILING - GAUGE_FLOOR;
    const clamped = Math.min(GAUGE_CEILING, Math.max(GAUGE_FLOOR, bmi));
    return ((clamped - GAUGE_FLOOR) / span) * 100;
  }

  function clampMarkerPct(pct) {
    return Math.min(96, Math.max(4, pct));
  }

  function updateGauge(bmi, label, south) {
    const widths = gaugeSegmentWidths(south);
    const total = widths.reduce(function (sum, w) {
      return sum + w;
    }, 0);
    document.querySelectorAll("[data-bmi-seg]").forEach(function (el) {
      const idx = parseInt(el.getAttribute("data-bmi-seg"), 10);
      const flex = widths[idx] / total;
      el.style.flex = flex + " 0 0%";
      el.style.width = flex * 100 + "%";
    });
    const rawPct = Math.min(100, Math.max(0, gaugePercent(bmi, south)));
    const pct = clampMarkerPct(rawPct);
    if (gaugeMarker) {
      gaugeMarker.style.left = pct + "%";
    }
    if (gaugeValue) {
      gaugeValue.textContent = String(round1(bmi));
      gaugeValue.style.left = pct + "%";
    }
    if (gaugeTicks) {
      const cuts = south ? [18.5, 23, 27.5] : [18.5, 25, 30];
      gaugeTicks.innerHTML = cuts
        .map(function (cut) {
          const left = clampMarkerPct(gaugePercent(cut, south));
          return (
            '<span class="bmi-gauge-tick" data-cut="' +
            cut +
            '" style="left:' +
            left +
            '%">' +
            cut +
            "</span>"
          );
        })
        .join("");
      window.requestAnimationFrame(function () {
        const ticks = Array.prototype.slice.call(gaugeTicks.querySelectorAll(".bmi-gauge-tick"));
        ticks.forEach(function (tick) {
          tick.hidden = false;
        });
        for (let i = 1; i < ticks.length; i += 1) {
          const prev = ticks[i - 1];
          const curr = ticks[i];
          if (prev.hidden) continue;
          const a = prev.getBoundingClientRect();
          const b = curr.getBoundingClientRect();
          if (a.right + 4 > b.left) {
            /* Prefer keeping the outer cut-offs; hide the middle if needed. */
            if (i === 1 && ticks[2]) ticks[1].hidden = true;
            else curr.hidden = true;
          }
        }
      });
    }
    if (gaugeLabel) {
      gaugeLabel.textContent = "BMI " + round1(bmi) + " - " + label;
    }
    if (gaugeLegend) {
      if (south) {
        gaugeLegend.innerHTML =
          '<li><span class="bmi-gauge-seg-1"></span>Underweight</li>' +
          '<li><span class="bmi-gauge-seg-2"></span>Healthy weight</li>' +
          '<li><span class="bmi-gauge-seg-3"></span>Increased</li>' +
          '<li><span class="bmi-gauge-seg-4"></span>High risk</li>';
      } else {
        gaugeLegend.innerHTML =
          '<li><span class="bmi-gauge-seg-1"></span>Underweight</li>' +
          '<li><span class="bmi-gauge-seg-2"></span>Healthy weight</li>' +
          '<li><span class="bmi-gauge-seg-3"></span>Overweight</li>' +
          '<li><span class="bmi-gauge-seg-4"></span>Obese</li>';
      }
    }
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function writeSession(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (err) {
      /* Private windows or blocked storage: calculator still works. */
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function saveCurrentInputs() {
    const age = parseInt(ageInput.value, 10);
    if (!Number.isFinite(age) || age < 18) {
      clearSession();
      return;
    }
    const payload = {
      age: age,
      units: units,
      southAsian: isSouthAsianMode(),
    };
    if (units === "metric") {
      payload.heightCm = heightCm.value;
      payload.weightKg = weightKg.value;
    } else {
      payload.heightFt = heightFt.value;
      payload.heightIn = heightIn.value;
      payload.weightLb = weightLb.value;
    }
    writeSession(payload);
  }

  function highlightAgeBand(band) {
    if (!ageChart) return;
    ageChart.querySelectorAll("[data-age-band]").forEach(function (row) {
      const match = row.getAttribute("data-age-band") === band;
      row.classList.toggle("is-current", match);
      if (match) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGuidance(guidanceKey, band) {
    if (!guidanceBlock) return;
    const cat = guidanceData.categories[guidanceKey];
    if (!cat) {
      guidanceBlock.hidden = true;
      return;
    }
    const ageEntry = guidanceData.ageBandNotes[band];
    const ageNote = ageEntry && ageEntry.text ? ageEntry.text : "";
    const showReviewed = !!(cat.reviewed || (ageEntry && ageEntry.reviewed));
    const actions = cat.actions
      .map(function (item) {
        return "<li>" + escapeHtml(item) + "</li>";
      })
      .join("");
    guidanceBlock.innerHTML =
      (showReviewed
        ? '<p class="bmi-reviewed">' + escapeHtml(guidanceData.reviewedPlaceholder) + "</p>"
        : "") +
      "<h3>" +
      escapeHtml(cat.headline) +
      "</h3>" +
      "<p>" +
      escapeHtml(cat.body) +
      "</p>" +
      '<ul class="bmi-actions">' +
      actions +
      "</ul>";
    guidanceBlock.hidden = false;
    if (resultAgeNote) {
      if (ageNote) {
        resultAgeNote.textContent = ageNote;
        resultAgeNote.hidden = false;
      } else {
        resultAgeNote.textContent = "";
        resultAgeNote.hidden = true;
      }
    }
    if (resultCta) {
      resultCta.textContent = cat.cta || "Talk to Sanjeev";
    }
  }

  function pictureHtml(src) {
    const base = src.replace(/\.jpg$/i, "");
    const sizes = "(min-width: 1024px) 22rem, (min-width: 768px) 46vw, calc(100vw - 2rem)";
    return (
      "<picture>" +
      '<source type="image/avif" srcset="' +
      base +
      "-480.avif 480w, " +
      base +
      "-768.avif 768w, " +
      base +
      '-1200.avif 1200w" sizes="' +
      sizes +
      '">' +
      '<source type="image/webp" srcset="' +
      base +
      "-480.webp 480w, " +
      base +
      "-768.webp 768w, " +
      base +
      '-1200.webp 1200w" sizes="' +
      sizes +
      '">' +
      '<img src="' +
      src +
      '" srcset="' +
      base +
      "-480.jpg 480w, " +
      base +
      "-768.jpg 768w, " +
      src +
      ' 1200w" sizes="' +
      sizes +
      '" alt="" width="1200" height="800" loading="lazy" decoding="async">' +
      "</picture>"
    );
  }

  function relatedRuleKey(guidanceKey) {
    if (guidanceKey === "obese") return "obese";
    if (guidanceKey === "overweight") return "overweight";
    if (guidanceKey === "underweight") return "underweight";
    return "healthy";
  }

  function pickRelated(guidanceKey, band) {
    const rule = relatedData.rules[relatedRuleKey(guidanceKey)];
    if (!rule) return { posts: [], seeAll: "workout" };
    let topics = rule.topics.slice();
    if (band === "50-64" || band === "65+") {
      relatedData.age50PlusExtraTopics.forEach(function (t) {
        if (topics.indexOf(t) === -1) topics.push(t);
      });
    }
    const scored = relatedData.posts
      .map(function (post) {
        let score = 0;
        post.topics.forEach(function (t) {
          const idx = topics.indexOf(t);
          if (idx !== -1) score += 10 - idx;
        });
        return { post: post, score: score };
      })
      .sort(function (a, b) {
        return b.score - a.score || b.post.date.localeCompare(a.post.date);
      });

    const posts = [];
    const seen = {};
    scored.forEach(function (row) {
      if (posts.length >= 3) return;
      if (row.score <= 0) return;
      if (seen[row.post.slug]) return;
      seen[row.post.slug] = true;
      posts.push(row.post);
    });
    /* Fill to 3 with next best published posts from the mapping. */
    scored.forEach(function (row) {
      if (posts.length >= 3) return;
      if (seen[row.post.slug]) return;
      seen[row.post.slug] = true;
      posts.push(row.post);
    });
    return { posts: posts.slice(0, 3), seeAll: rule.seeAllCategory };
  }

  function renderRelated(guidanceKey, band) {
    if (!relatedBlock || !relatedGrid) return;
    const picked = pickRelated(guidanceKey, band);
    if (!picked.posts.length) {
      relatedBlock.hidden = true;
      return;
    }
    relatedGrid.innerHTML = picked.posts
      .map(function (post) {
        return (
          '<article class="blog-card">' +
          '<a class="blog-card-link" href="blog/' +
          escapeHtml(post.slug) +
          '.html">' +
          '<div class="blog-card-media">' +
          pictureHtml(post.image) +
          "</div>" +
          '<div class="blog-card-copy">' +
          '<p class="blog-card-category">' +
          escapeHtml(post.categoryLabel) +
          "</p>" +
          '<h3 class="blog-card-title">' +
          escapeHtml(post.title) +
          "</h3>" +
          '<p class="blog-card-excerpt">' +
          escapeHtml(post.description) +
          "</p>" +
          "</div></a></article>"
        );
      })
      .join("");
    if (relatedSeeAll) {
      relatedSeeAll.href = "blog/index.html?category=" + encodeURIComponent(picked.seeAll);
    }
    relatedBlock.hidden = false;
  }

  function hideFollowUp() {
    if (followUp) followUp.hidden = true;
    if (limitsSection) limitsSection.hidden = true;
    if (guidanceBlock) guidanceBlock.hidden = true;
    if (relatedBlock) relatedBlock.hidden = true;
    if (leadSection) leadSection.hidden = true;
    lastResult = null;
    if (summaryField) summaryField.value = "";
    if (clearBtn) clearBtn.hidden = true;
    if (resultAgeNote) {
      resultAgeNote.hidden = true;
      resultAgeNote.textContent = "";
    }
  }

  function showEmptyResultCard() {
    if (under18Box) under18Box.hidden = true;
    if (results) results.hidden = true;
    if (emptyState) emptyState.hidden = false;
    hideFollowUp();
  }

  function applyCalculation(options) {
    const opts = options || {};
    const moveFocus = opts.moveFocus !== false;
    const persist = opts.persist !== false;
    const age = parseInt(ageInput.value, 10);

    if (!Number.isFinite(age)) return false;
    if (age < 18) {
      if (persist) clearSession();
      showUnder18(moveFocus);
      return true;
    }

    const metric = toMetric();
    if (!Number.isFinite(metric.cm) || !Number.isFinite(metric.kg)) return false;
    const south = isSouthAsianMode();
    const bmi = round1(calcBmi(metric.kg, metric.cm));
    const category = categoryFor(bmi, south);
    showResult(
      {
        age: age,
        band: ageBand(age),
        bmi: bmi,
        kg: metric.kg,
        cm: metric.cm,
        category: category,
        healthyRange: healthyRangeText(metric.cm, category.healthyLow, category.healthyHigh),
        distance: distanceText(metric.kg, metric.cm, category.healthyLow, category.healthyHigh),
        units: units,
        southAsian: south,
      },
      { moveFocus: moveFocus }
    );
    if (persist) saveCurrentInputs();
    return true;
  }

  function restoreSession() {
    const data = readSession();
    if (!data || !data.age || data.age < 18) {
      showEmptyResultCard();
      return;
    }
    ageInput.value = String(data.age);
    setUnits(data.units === "imperial" ? "imperial" : "metric");
    if (southAsian) southAsian.checked = !!data.southAsian;
    if (units === "metric") {
      if (heightCm) heightCm.value = data.heightCm || "";
      if (weightKg) weightKg.value = data.weightKg || "";
    } else {
      if (heightFt) heightFt.value = data.heightFt || "";
      if (heightIn) heightIn.value = data.heightIn || "";
      if (weightLb) weightLb.value = data.weightLb || "";
    }
    const ok = applyCalculation({ moveFocus: false, persist: false });
    if (!ok) showEmptyResultCard();
  }

  function validate() {
    clearErrors();
    let first = null;
    function mark(input, errorId, message) {
      const bad = showError(input, errorId, message);
      if (bad && !first) first = input;
      return bad;
    }

    const age = parseInt(ageInput.value, 10);
    if (!Number.isFinite(age) || age < 1 || age > 100) {
      mark(ageInput, "bmi-age-error", "Enter an age between 1 and 100.");
    }

    const metric = toMetric();
    if (units === "metric") {
      if (!Number.isFinite(metric.cm) || metric.cm < 120 || metric.cm > 230) {
        mark(heightCm, "bmi-height-cm-error", "Enter height between 120 and 230 cm.");
      }
      if (!Number.isFinite(metric.kg) || metric.kg < 30 || metric.kg > 300) {
        mark(weightKg, "bmi-weight-kg-error", "Enter weight between 30 and 300 kg.");
      }
    } else {
      const ft = parseFloat(heightFt.value, 10);
      const inches = parseFloat(heightIn.value, 10);
      if (!Number.isFinite(ft) || ft < 3 || ft > 7 || !Number.isFinite(inches) || inches < 0 || inches >= 12) {
        mark(heightFt, "bmi-height-imperial-error", "Enter height as feet (3-7) and inches (0-11).");
      } else if (metric.cm < 120 || metric.cm > 230) {
        mark(heightFt, "bmi-height-imperial-error", "That height is outside 120-230 cm. Check the numbers.");
      }
      if (!Number.isFinite(metric.kg) || metric.kg < 30 || metric.kg > 300) {
        mark(weightLb, "bmi-weight-lb-error", "Enter weight between about 66 and 660 lb.");
      }
    }

    if (first && typeof first.focus === "function") first.focus();
    return !first;
  }

  function showUnder18(moveFocus) {
    if (emptyState) emptyState.hidden = true;
    if (results) results.hidden = true;
    hideFollowUp();
    if (under18Box) {
      under18Box.hidden = false;
      if (moveFocus !== false && typeof under18Box.focus === "function") under18Box.focus();
    }
    if (liveRegion) {
      liveRegion.textContent =
        "BMI for young people is read against growth charts. Please talk to your family doctor or pharmacist.";
    }
  }

  function showResult(payload, options) {
    const opts = options || {};
    if (under18Box) under18Box.hidden = true;
    if (emptyState) emptyState.hidden = true;
    lastResult = payload;

    if (valueEl) valueEl.textContent = String(payload.bmi);
    if (categoryEl) categoryEl.textContent = payload.category.label;
    if (detailEl) detailEl.textContent = payload.category.detail;
    if (rangeEl) {
      rangeEl.textContent =
        "Healthy weight range for your height: " +
        payload.healthyRange +
        " (BMI " +
        payload.category.healthyLow +
        " to " +
        payload.category.healthyHigh +
        ").";
    }
    if (distanceEl) distanceEl.textContent = payload.distance;
    updateGauge(payload.bmi, payload.category.label, payload.southAsian);
    highlightAgeBand(payload.band);
    renderGuidance(payload.category.guidanceKey, payload.band);
    renderRelated(payload.category.guidanceKey, payload.band);

    if (results) results.hidden = false;
    if (clearBtn) clearBtn.hidden = false;
    if (followUp) followUp.hidden = false;
    if (limitsSection) limitsSection.hidden = false;
    if (leadSection) leadSection.hidden = false;
    updateSummaryField();

    if (liveRegion) {
      liveRegion.textContent = "Your BMI is " + payload.bmi + ", category " + payload.category.label + ".";
    }
    if (opts.moveFocus !== false && resultFocus && typeof resultFocus.focus === "function") {
      resultFocus.focus({ preventScroll: false });
    }
  }

  function updateSummaryField() {
    if (!summaryField) return;
    if (!lastResult || !shareResults || !shareResults.checked) {
      summaryField.value = "Visitor did not share BMI numbers. Source: bmi-calculator.";
      return;
    }
    summaryField.value =
      "Source: bmi-calculator. Age band: " +
      lastResult.band +
      ". BMI: " +
      lastResult.bmi +
      ". Category: " +
      lastResult.category.label +
      ". Units: " +
      lastResult.units +
      ".";
  }

  if (shareResults) {
    shareResults.addEventListener("change", updateSummaryField);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validate()) return;
    applyCalculation({ moveFocus: true, persist: true });
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      clearSession();
      form.reset();
      setUnits("metric");
      if (southAsian) southAsian.checked = false;
      showEmptyResultCard();
      if (liveRegion) liveRegion.textContent = "Results cleared.";
      if (ageInput && typeof ageInput.focus === "function") ageInput.focus();
    });
  }

  if (contactForm) {
    const success = document.getElementById("bmi-form-success");
    const errorBox = document.getElementById("bmi-form-error");
    const alertBox = document.getElementById("bmi-form-alert");
    /* Shared honeypot + minimum-time check from script.js (loaded first on this page). */
    const spamCheck =
      typeof window.siteSpamGuard === "function"
        ? window.siteSpamGuard(contactForm, alertBox)
        : function () {
            return "ok";
          };
    const consent = document.getElementById("bmi-consent");
    const ageConfirm = document.getElementById("bmi-age-confirm");
    const nameInput = document.getElementById("bmi-contact-name");
    const emailInput = document.getElementById("bmi-contact-email");
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const sourceField = document.getElementById("bmi-source");
    const formShell = document.getElementById("bmi-form-shell");

    contactForm.noValidate = true;
    contactForm.action = BMI_FORM_ENDPOINT;
    if (sourceField) sourceField.value = "bmi-calculator";

    function showContactError(input, errorId, message) {
      const err = document.getElementById(errorId);
      if (!input || !err) return !!message;
      err.textContent = message || "";
      err.hidden = !message;
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
      return !!message;
    }

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (alertBox) alertBox.hidden = true;
      if (errorBox) errorBox.hidden = true;

      let first = null;
      function mark(input, errorId, message) {
        const bad = showContactError(input, errorId, message);
        if (bad && !first) first = input;
      }

      mark(nameInput, "bmi-contact-name-error", nameInput && nameInput.value.trim() ? "" : "Enter your name.");
      const emailVal = emailInput ? emailInput.value.trim() : "";
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      mark(emailInput, "bmi-contact-email-error", emailOk ? "" : "Enter an email address like name@example.com.");
      mark(ageConfirm, "bmi-age-confirm-error", ageConfirm && ageConfirm.checked ? "" : "Confirm you are 18 or older.");
      mark(consent, "bmi-consent-error", consent && consent.checked ? "" : "Tick the box to agree to be contacted.");

      if (first && typeof first.focus === "function") {
        first.focus();
        return;
      }

      const verdict = spamCheck();
      if (verdict === "spam") {
        contactForm.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        return;
      }
      if (verdict === "wait") return;

      updateSummaryField();
      if (submitBtn) submitBtn.disabled = true;

      fetch(BMI_FORM_ENDPOINT, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Formspree request failed");
          contactForm.hidden = true;
          if (formShell) formShell.classList.add("is-sent");
          if (success) {
            success.hidden = false;
            success.focus();
          }
        })
        .catch(function () {
          if (errorBox) errorBox.hidden = false;
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* Guide TOC: mirror blog post behaviour on small screens. */
  const tocToggle = document.querySelector(".bmi-guide-toc-toggle");
  const tocNav = document.querySelector(".bmi-guide-toc");
  if (tocToggle && tocNav) {
    tocToggle.addEventListener("click", function () {
      const open = tocToggle.getAttribute("aria-expanded") === "true";
      tocToggle.setAttribute("aria-expanded", open ? "false" : "true");
      tocNav.classList.toggle("is-collapsed", open);
    });
  }

  restoreSession();
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) restoreSession();
  });

  window.__bmiTest = {
    calcBmi: calcBmi,
    round1: round1,
    categoryFor: categoryFor,
    distanceText: distanceText,
    healthyRangeText: healthyRangeText,
    gaugePercent: gaugePercent,
    gaugeSegmentWidths: gaugeSegmentWidths,
    toImperialBmi: function (ft, inches, lb) {
      const cm = (ft * 12 + inches) * CM_PER_IN;
      const kg = lb * KG_PER_LB;
      return round1(calcBmi(kg, cm));
    },
  };
})();
