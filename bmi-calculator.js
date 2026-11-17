/* BMI calculator page: client-side maths, gauge, guidance, related posts, lead form.
   Does not store age, height or weight in cookies, localStorage, URL params or logs.
   Health numbers leave the browser only if the visitor opts in and submits the contact form. */

import guidanceData from "./content/bmi/guidance.json";
import relatedData from "./content/bmi/related.json";

(function () {
  "use strict";

  const BMI_FORM_ENDPOINT = "https://formspree.io/f/maeywvbo";
  const MIN_TIME_MS = 3000;
  const CM_PER_IN = 2.54;
  const KG_PER_LB = 0.45359237;

  const WHO = {
    underweightMax: 18.5,
    healthyMax: 25,
    overweightMax: 30,
    class1Max: 35,
    class2Max: 40,
  };

  const SOUTH_ASIAN = {
    underweightMax: 18.5,
    healthyMax: 23,
    overweightMax: 27.5,
    class1Max: 32.5,
    class2Max: 37.5,
  };

  /** Unit preference lives in memory only for this page visit. */
  let units = "metric";
  let lastResult = null;
  const openedAt = Date.now();

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
  const results = document.getElementById("bmi-results");
  const resultFocus = document.getElementById("bmi-result-focus");
  const liveRegion = document.getElementById("bmi-live");
  const valueEl = document.getElementById("bmi-value");
  const categoryEl = document.getElementById("bmi-category-label");
  const detailEl = document.getElementById("bmi-detail");
  const rangeEl = document.getElementById("bmi-healthy-range");
  const distanceEl = document.getElementById("bmi-distance");
  const gaugeMarker = document.getElementById("bmi-gauge-marker");
  const gaugeLabel = document.getElementById("bmi-gauge-label");
  const ageChart = document.getElementById("bmi-age-chart");
  const guidanceBlock = document.getElementById("bmi-guidance");
  const relatedBlock = document.getElementById("bmi-related");
  const relatedGrid = document.getElementById("bmi-related-grid");
  const relatedSeeAll = document.getElementById("bmi-related-see-all");
  const leadSection = document.getElementById("bmi-lead");
  const emptyHint = document.getElementById("bmi-empty-hint");
  const shareResults = document.getElementById("bmi-share-results");
  const summaryField = document.getElementById("bmi-summary");
  const contactForm = document.getElementById("bmi-contact-form");

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
    if (!input || !err) return true;
    err.textContent = message;
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

  function categoryFor(bmi, cuts) {
    if (bmi < cuts.underweightMax) {
      return { key: "underweight", label: "Underweight", detail: "Below 18.5" };
    }
    if (bmi < cuts.healthyMax) {
      return {
        key: "healthy",
        label: "Healthy weight",
        detail: cuts === SOUTH_ASIAN ? "18.5 to 22.9 (South Asian reference)" : "18.5 to 24.9",
      };
    }
    if (bmi < cuts.overweightMax) {
      return {
        key: "overweight",
        label: "Overweight",
        detail: cuts === SOUTH_ASIAN ? "23 to 27.4 (South Asian reference)" : "25 to 29.9",
      };
    }
    if (bmi < cuts.class1Max) {
      return { key: "obese", label: "Obese - Class I", detail: cuts === SOUTH_ASIAN ? "27.5 to 32.4" : "30 to 34.9" };
    }
    if (bmi < cuts.class2Max) {
      return { key: "obese", label: "Obese - Class II", detail: cuts === SOUTH_ASIAN ? "32.5 to 37.4" : "35 to 39.9" };
    }
    return { key: "obese", label: "Obese - Class III", detail: cuts === SOUTH_ASIAN ? "37.5+" : "40+" };
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

  function healthyRangeText(cm) {
    const m = cm / 100;
    const low = 18.5 * m * m;
    const high = 24.9 * m * m;
    return formatWeight(low) + " to " + formatWeight(high);
  }

  function distanceText(bmi, cm) {
    const m = cm / 100;
    if (bmi >= 18.5 && bmi <= 24.9) {
      return "You are inside the usual healthy BMI range for adults (18.5 to 24.9).";
    }
    if (bmi < 18.5) {
      const need = 18.5 * m * m;
      const cur = bmi * m * m;
      return "About " + formatWeight(need - cur) + " below the lower end of the usual healthy range for your height.";
    }
    const max = 24.9 * m * m;
    const cur = bmi * m * m;
    return "About " + formatWeight(cur - max) + " above the upper end of the usual healthy range for your height.";
  }

  /** Map BMI onto the four WHO colour bands on the gauge (0-100). */
  function gaugePercent(bmi) {
    if (bmi <= 18.5) return ((Math.max(12, bmi) - 12) / (18.5 - 12)) * 25;
    if (bmi <= 25) return 25 + ((bmi - 18.5) / (25 - 18.5)) * 25;
    if (bmi <= 30) return 50 + ((bmi - 25) / (30 - 25)) * 25;
    if (bmi <= 40) return 75 + ((bmi - 30) / (40 - 30)) * 25;
    return 98;
  }

  function updateGauge(bmi, label) {
    const pct = Math.min(98, Math.max(2, gaugePercent(bmi)));
    if (gaugeMarker) {
      gaugeMarker.style.left = pct + "%";
      gaugeMarker.setAttribute("aria-hidden", "true");
    }
    if (gaugeLabel) {
      gaugeLabel.textContent = "BMI " + round1(bmi) + " - " + label;
    }
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

  function renderGuidance(catKey, band) {
    if (!guidanceBlock) return;
    const cat = guidanceData.categories[catKey];
    if (!cat) {
      guidanceBlock.hidden = true;
      return;
    }
    const ageNote = guidanceData.ageBandNotes[band] || "";
    const actions = cat.actions
      .map(function (item) {
        return "<li>" + escapeHtml(item) + "</li>";
      })
      .join("");
    guidanceBlock.innerHTML =
      '<p class="bmi-reviewed">' +
      escapeHtml(guidanceData.reviewedPlaceholder) +
      "</p>" +
      "<h3>" +
      escapeHtml(cat.headline) +
      "</h3>" +
      "<p>" +
      escapeHtml(cat.body) +
      "</p>" +
      (ageNote ? "<p class=\"bmi-age-note\">" + escapeHtml(ageNote) + "</p>" : "") +
      '<ul class="bmi-actions">' +
      actions +
      "</ul>" +
      '<p><a class="btn btn-primary" href="#bmi-lead">' +
      escapeHtml(cat.cta) +
      "</a></p>";
    guidanceBlock.hidden = false;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pictureHtml(src) {
    const base = src.replace(/\.jpg$/i, "");
    const sizes = "(min-width: 1024px) 22rem, (min-width: 768px) 46vw, calc(100vw - 2rem)";
    return (
      '<picture>' +
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

  function pickRelated(catKey, band) {
    const rule = relatedData.rules[catKey];
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
      .filter(function (row) {
        return row.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score || b.post.date.localeCompare(a.post.date);
      });
    const posts = [];
    const seen = {};
    scored.forEach(function (row) {
      if (posts.length >= 3) return;
      if (seen[row.post.slug]) return;
      seen[row.post.slug] = true;
      posts.push(row.post);
    });
    return { posts: posts, seeAll: rule.seeAllCategory };
  }

  function renderRelated(catKey, band) {
    if (!relatedBlock || !relatedGrid) return;
    const picked = pickRelated(catKey, band);
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
          "<h3 class=\"blog-card-title\">" +
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

  function hideAdultResults() {
    if (results) results.hidden = true;
    if (guidanceBlock) guidanceBlock.hidden = true;
    if (relatedBlock) relatedBlock.hidden = true;
    if (leadSection) leadSection.hidden = true;
    if (emptyHint) emptyHint.hidden = false;
    lastResult = null;
    if (summaryField) summaryField.value = "";
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

  function showUnder18() {
    hideAdultResults();
    if (emptyHint) emptyHint.hidden = true;
    if (under18Box) {
      under18Box.hidden = false;
      under18Box.focus();
    }
    if (liveRegion) {
      liveRegion.textContent =
        "BMI for young people is read against growth charts. Please talk to your family doctor or pharmacist.";
    }
  }

  function showResult(payload) {
    if (under18Box) under18Box.hidden = true;
    if (emptyHint) emptyHint.hidden = true;
    lastResult = payload;

    if (valueEl) valueEl.textContent = String(payload.bmi);
    if (categoryEl) categoryEl.textContent = payload.category.label;
    if (detailEl) detailEl.textContent = payload.category.detail;
    if (rangeEl) rangeEl.textContent = "Healthy weight range for your height: " + payload.healthyRange;
    if (distanceEl) distanceEl.textContent = payload.distance;
    updateGauge(payload.bmi, payload.category.label);
    highlightAgeBand(payload.band);
    renderGuidance(payload.category.key, payload.band);
    renderRelated(payload.category.key, payload.band);

    if (results) results.hidden = false;
    if (leadSection) leadSection.hidden = false;
    updateSummaryField();

    if (liveRegion) {
      liveRegion.textContent =
        "Your BMI is " + payload.bmi + ", category " + payload.category.label + ".";
    }
    if (resultFocus && typeof resultFocus.focus === "function") {
      resultFocus.focus();
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

    const age = parseInt(ageInput.value, 10);
    if (age < 18) {
      showUnder18();
      return;
    }

    const metric = toMetric();
    const bmi = round1(calcBmi(metric.kg, metric.cm));
    const cuts = southAsian && southAsian.checked ? SOUTH_ASIAN : WHO;
    const category = categoryFor(bmi, cuts);
    showResult({
      age: age,
      band: ageBand(age),
      bmi: bmi,
      category: category,
      healthyRange: healthyRangeText(metric.cm),
      distance: distanceText(bmi, metric.cm),
      units: units,
      southAsian: !!(southAsian && southAsian.checked),
    });
  });

  /* Contact form - same Formspree pattern as feedback; no health data unless opted in. */
  if (contactForm) {
    const honeypot = contactForm.querySelector('[name="_gotcha"]');
    const success = document.getElementById("bmi-form-success");
    const errorBox = document.getElementById("bmi-form-error");
    const alertBox = document.getElementById("bmi-form-alert");
    const consent = document.getElementById("bmi-consent");
    const nameInput = document.getElementById("bmi-contact-name");
    const emailInput = document.getElementById("bmi-contact-email");
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const sourceField = document.getElementById("bmi-source");

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
      mark(consent, "bmi-consent-error", consent && consent.checked ? "" : "Tick the box to agree to be contacted.");

      if (first && typeof first.focus === "function") {
        first.focus();
        return;
      }

      if (honeypot && honeypot.value) {
        contactForm.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        return;
      }

      if (Date.now() - openedAt < MIN_TIME_MS) {
        if (alertBox) {
          alertBox.textContent = "Please wait a moment, then send it again.";
          alertBox.hidden = false;
          alertBox.focus();
        }
        return;
      }

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

  /* Expose pure helpers for manual checks in the console during QA. */
  window.__bmiTest = {
    calcBmi: calcBmi,
    round1: round1,
    categoryFor: categoryFor,
    WHO: WHO,
    toImperialBmi: function (ft, inches, lb) {
      const cm = (ft * 12 + inches) * CM_PER_IN;
      const kg = lb * KG_PER_LB;
      return round1(calcBmi(kg, cm));
    },
  };
})();
