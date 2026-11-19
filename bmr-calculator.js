/* BMR and daily calorie calculator: client-side maths, three SVG charts, guidance,
   related posts and the lead form.
   Age, sex, height, weight and body fat stay in the browser. They are kept only in
   sessionStorage (bmrSession) for this tab, never in cookies, localStorage, the URL or logs.
   Health numbers leave the browser only if the visitor ticks "Share my results" and sends
   the contact form, and then only age band, BMR, TDEE, goal and units. */

import guidanceData from "./content/bmr/guidance.json";
import relatedData from "./content/bmr/related.json";

(function () {
  "use strict";

  const BMR_FORM_ENDPOINT = "https://formspree.io/f/maeywvbo";
  const CM_PER_IN = 2.54;
  const KG_PER_LB = 0.45359237;
  const SESSION_KEY = "bmrSession";
  const BMI_SESSION_KEY = "bmiSession";
  /* Digestion (thermic effect of food) is a typical estimate of about 10 percent of intake. */
  const DIGESTION_SHARE = 0.1;

  const ACTIVITY = {
    sedentary: { factor: 1.2, label: "Sedentary" },
    light: { factor: 1.375, label: "Lightly active" },
    moderate: { factor: 1.55, label: "Moderately active" },
    very: { factor: 1.725, label: "Very active" },
    extra: { factor: 1.9, label: "Extra active" },
  };

  const GOALS = {
    lose: "Lose fat gradually",
    maintain: "Maintain",
    build: "Build muscle",
  };

  /* ───── Pure maths (also exposed on window.__bmrTest) ───── */

  function mifflin(kg, cm, age, sex) {
    return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
  }

  function katchMcArdle(kg, bodyFat) {
    return 370 + 21.6 * kg * (1 - bodyFat / 100);
  }

  function bmiOf(kg, cm) {
    const m = cm / 100;
    return kg / (m * m);
  }

  function round10(n) {
    return Math.round(n / 10) * 10;
  }

  function ceil10(n) {
    return Math.ceil(n / 10) * 10;
  }

  function ageBand(age) {
    if (age >= 65) return "65+";
    if (age >= 50) return "50-64";
    if (age >= 30) return "30-49";
    return "18-29";
  }

  function imperialToMetric(ft, inches, lb) {
    return { cm: (ft * 12 + inches) * CM_PER_IN, kg: lb * KG_PER_LB };
  }

  /**
   * Gentle starting ranges only. Safety rules:
   * - never below BMR;
   * - age 65 and over: maintenance only;
   * - internal BMI under 18.5: never a fat-loss range.
   */
  function goalPlan(goal, bmr, tdee, age, bmi) {
    const plan = { requested: goal, effective: goal, low: tdee, high: tdee, notes: [] };
    if (age >= 65) {
      plan.effective = "maintain";
      plan.notes.push("age65");
    } else if (goal === "lose" && bmi < 18.5) {
      plan.effective = "maintain";
      plan.notes.push("lowBmi");
    }
    if (plan.effective === "lose") {
      plan.low = tdee * 0.8;
      plan.high = tdee * 0.9;
      if (plan.low < bmr) {
        plan.low = bmr;
        plan.notes.push("floor");
      }
    } else if (plan.effective === "build") {
      plan.low = tdee * 1.05;
      plan.high = tdee * 1.1;
    } else {
      plan.low = tdee;
      plan.high = tdee;
    }
    plan.low = Math.max(plan.low, bmr);
    plan.high = Math.max(plan.high, bmr);
    return plan;
  }

  /** Rounded figures for display. The low end rounds up so it never shows below the BMR. */
  function displayRange(plan, bmr) {
    const low = Math.max(ceil10(plan.low), round10(bmr));
    const high = Math.max(round10(plan.high), low);
    return { low: low, high: high };
  }

  function estimate(input) {
    const mifflinValue = mifflin(input.kg, input.cm, input.age, input.sex);
    const hasBodyFat = Number.isFinite(input.bodyFat);
    const katchValue = hasBodyFat ? katchMcArdle(input.kg, input.bodyFat) : null;
    const bmr = hasBodyFat ? katchValue : mifflinValue;
    const factor = ACTIVITY[input.activity].factor;
    const tdee = bmr * factor;
    const digestion = tdee * DIGESTION_SHARE;
    const bmi = bmiOf(input.kg, input.cm);
    return {
      mifflin: mifflinValue,
      katch: katchValue,
      formula: hasBodyFat ? "katch" : "mifflin",
      bmr: bmr,
      factor: factor,
      tdee: tdee,
      digestion: digestion,
      activity: tdee - bmr - digestion,
      bmi: bmi,
      band: ageBand(input.age),
      plan: goalPlan(input.goal, bmr, tdee, input.age, bmi),
    };
  }

  function fmt(n) {
    return Math.round(n).toLocaleString("en-CA");
  }

  function about(n) {
    return "about " + fmt(round10(n));
  }

  window.__bmrTest = {
    mifflin: mifflin,
    katchMcArdle: katchMcArdle,
    bmiOf: bmiOf,
    round10: round10,
    ageBand: ageBand,
    imperialToMetric: imperialToMetric,
    goalPlan: goalPlan,
    displayRange: displayRange,
    estimate: estimate,
    ACTIVITY: ACTIVITY,
  };

  const form = document.getElementById("bmr-form");
  if (!form) return;

  /* ───── Elements ───── */

  const $ = function (id) {
    return document.getElementById(id);
  };
  const ageInput = $("bmr-age");
  const heightCm = $("bmr-height-cm");
  const heightFt = $("bmr-height-ft");
  const heightIn = $("bmr-height-in");
  const weightKg = $("bmr-weight-kg");
  const weightLb = $("bmr-weight-lb");
  const bodyFatInput = $("bmr-bodyfat");
  const advanced = $("bmr-advanced");
  const metricFields = $("bmr-metric-fields");
  const imperialFields = $("bmr-imperial-fields");
  const unitButtons = form.querySelectorAll("[data-bmr-units]");
  const prefillNote = $("bmr-prefill-note");

  const emptyState = $("bmr-empty-state");
  const under18Box = $("bmr-under18");
  const results = $("bmr-results");
  const resultCard = $("bmr-result-card");
  const resultFocus = $("bmr-result-focus");
  const liveRegion = $("bmr-live");
  const followUp = $("bmr-follow-up");
  const guidanceBlock = $("bmr-guidance");
  const relatedBlock = $("bmr-related");
  const relatedGrid = $("bmr-related-grid");
  const relatedSeeAll = $("bmr-related-see-all");
  const clearBtn = $("bmr-clear");
  const resultCta = $("bmr-result-cta");
  const shareResults = $("bmr-share-results");
  const summaryField = $("bmr-summary");
  const contactForm = $("bmr-contact-form");

  let units = "metric";
  let lastResult = null;
  let keyboardSubmit = false;

  /* ───── Inputs ───── */

  function radioValue(name) {
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function setRadio(name, value) {
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.checked = input.value === value;
    });
  }

  function setUnits(next) {
    units = next === "imperial" ? "imperial" : "metric";
    unitButtons.forEach(function (btn) {
      const active = btn.getAttribute("data-bmr-units") === units;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });
    metricFields.hidden = units !== "metric";
    imperialFields.hidden = units !== "imperial";
    [heightCm, weightKg].forEach(function (el) {
      el.disabled = units !== "metric";
    });
    [heightFt, heightIn, weightLb].forEach(function (el) {
      el.disabled = units !== "imperial";
    });
  }

  unitButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setUnits(btn.getAttribute("data-bmr-units"));
    });
  });

  function toMetric() {
    if (units === "metric") {
      return { cm: parseFloat(heightCm.value), kg: parseFloat(weightKg.value) };
    }
    const ft = parseFloat(heightFt.value);
    const inches = parseFloat(heightIn.value);
    const lb = parseFloat(weightLb.value);
    return imperialToMetric(Number.isFinite(ft) ? ft : 0, Number.isFinite(inches) ? inches : 0, lb);
  }

  function readBodyFat() {
    const raw = bodyFatInput.value.trim();
    if (!raw) return NaN;
    return parseFloat(raw);
  }

  /* ───── Errors ───── */

  function clearErrors() {
    form.querySelectorAll(".bmi-field-error").forEach(function (el) {
      el.hidden = true;
      el.textContent = "";
    });
    form.querySelectorAll("[aria-invalid]").forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
  }

  function validate() {
    clearErrors();
    let first = null;
    function mark(input, errorId, message) {
      const err = $(errorId);
      err.textContent = message;
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
      if (!first) first = input;
    }

    if (!radioValue("sex")) mark(form.querySelector('input[name="sex"]'), "bmr-sex-error", "Choose female or male.");

    const metric = toMetric();
    if (units === "metric") {
      if (!Number.isFinite(metric.cm) || metric.cm < 120 || metric.cm > 230) {
        mark(heightCm, "bmr-height-cm-error", "Enter height between 120 and 230 cm.");
      }
      if (!Number.isFinite(metric.kg) || metric.kg < 30 || metric.kg > 300) {
        mark(weightKg, "bmr-weight-kg-error", "Enter weight between 30 and 300 kg.");
      }
    } else {
      const ft = parseFloat(heightFt.value);
      const inches = parseFloat(heightIn.value);
      if (!Number.isFinite(ft) || ft < 3 || ft > 7 || !Number.isFinite(inches) || inches < 0 || inches >= 12) {
        mark(heightFt, "bmr-height-imperial-error", "Enter height as feet (3-7) and inches (0-11).");
      } else if (metric.cm < 120 || metric.cm > 230) {
        mark(heightFt, "bmr-height-imperial-error", "That height is outside 120-230 cm. Check the numbers.");
      }
      if (!Number.isFinite(metric.kg) || metric.kg < 30 || metric.kg > 300) {
        mark(weightLb, "bmr-weight-lb-error", "Enter weight between about 66 and 660 lb.");
      }
    }

    if (!radioValue("activity")) {
      mark(form.querySelector('input[name="activity"]'), "bmr-activity-error", "Choose the activity level closest to a normal week.");
    }

    const bodyFat = readBodyFat();
    if (bodyFatInput.value.trim() && (!Number.isFinite(bodyFat) || bodyFat < 5 || bodyFat > 60)) {
      if (advanced) advanced.open = true;
      mark(bodyFatInput, "bmr-bodyfat-error", "Enter body fat between 5 and 60 percent, or leave it empty.");
    }

    if (first) first.focus();
    return !first;
  }

  /* Age first: a valid age under 18 shows the message and nothing else is checked or saved. */
  function readAge() {
    const raw = ageInput.value.trim();
    const age = parseInt(raw, 10);
    if (!raw || !Number.isFinite(age) || age < 1 || age > 100) return NaN;
    return age;
  }

  /* ───── Session storage (this tab only) ───── */

  function readJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeSession(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (err) {
      /* Private windows or blocked storage: the calculator still works. */
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function saveInputs(age) {
    if (!Number.isFinite(age) || age < 18) {
      clearSession();
      return;
    }
    const payload = {
      age: age,
      sex: radioValue("sex"),
      units: units,
      activity: radioValue("activity"),
      goal: radioValue("goal") || "maintain",
      bodyFat: bodyFatInput.value.trim(),
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

  function fillMeasurements(data) {
    setUnits(data.units === "imperial" ? "imperial" : "metric");
    if (units === "metric") {
      heightCm.value = data.heightCm || "";
      weightKg.value = data.weightKg || "";
    } else {
      heightFt.value = data.heightFt || "";
      heightIn.value = data.heightIn || "";
      weightLb.value = data.weightLb || "";
    }
  }

  /* ───── Result states: exactly one of empty, under-18 or result is visible ───── */

  function hideFollowUp() {
    followUp.hidden = true;
    lastResult = null;
    if (summaryField) summaryField.value = "";
  }

  function showEmpty() {
    under18Box.hidden = true;
    results.hidden = true;
    emptyState.hidden = false;
    hideFollowUp();
  }

  function showUnder18(moveFocus) {
    emptyState.hidden = true;
    results.hidden = true;
    hideFollowUp();
    under18Box.hidden = false;
    liveRegion.textContent = under18Box.textContent.trim();
    if (moveFocus) under18Box.focus();
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function goalText(result) {
    const plan = result.plan;
    const range = displayRange(plan, result.bmr);
    if (plan.effective === "maintain") {
      return { label: "Starting point: maintain", value: "about " + fmt(round10(result.tdee)) + " kcal a day" };
    }
    return {
      label: "Starting range: " + GOALS[plan.effective].toLowerCase(),
      value: fmt(range.low) + " to " + fmt(range.high) + " kcal a day",
    };
  }

  function sentenceFor(result) {
    const act = ACTIVITY[result.input.activity].label.toLowerCase();
    let text =
      "At complete rest your body uses " +
      about(result.bmr) +
      " kcal a day. With your " +
      act +
      " week, you burn " +
      about(result.tdee) +
      " kcal a day in total.";
    if (result.plan.effective === "lose") text += " A gentle fat-loss range sits a little below that, never below your BMR.";
    if (result.plan.effective === "build") text += " A small step above that supports building muscle.";
    return text;
  }

  function showResult(result, opts) {
    lastResult = result;
    const goal = goalText(result);
    setText("bmr-value", fmt(round10(result.bmr)));
    setText("bmr-tdee", "about " + fmt(round10(result.tdee)) + " kcal a day");
    setText("bmr-goal-label", goal.label);
    setText("bmr-goal-range", goal.value);
    setText("bmr-sentence", sentenceFor(result));

    const notes = result.plan.notes
      .map(function (key) {
        return guidanceData.messages[key];
      })
      .filter(Boolean);
    const noteEl = $("bmr-goal-note");
    noteEl.textContent = notes.join(" ");
    noteEl.hidden = !notes.length;

    setText(
      "bmr-formula-note",
      result.formula === "katch"
        ? "Shown: Katch-McArdle, which uses your body fat. Mifflin-St Jeor gives " + about(result.mifflin) + " kcal a day."
        : "Shown: Mifflin-St Jeor, the usual formula for adults. Add body fat under Advanced to compare Katch-McArdle."
    );
    setText("bmr-age-line", guidanceData.ageBands[result.band].line);

    /* Show the areas first: the charts measure their container width. */
    emptyState.hidden = true;
    under18Box.hidden = true;
    results.hidden = false;
    followUp.hidden = false;

    renderCharts(result);
    renderGuidance(result);
    renderRelated(result);
    updateSummaryField();

    liveRegion.textContent =
      "Your BMR is " + about(result.bmr) + " calories a day. Estimated daily calories " + about(result.tdee) + ".";

    if (opts.moveFocus) {
      resultFocus.focus();
    } else if (opts.scroll) {
      const top = resultCard.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.6 || top < 0) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        resultCard.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    }
  }

  /**
   * opts.moveFocus: keyboard users only. opts.scroll: pointer submit on small screens.
   * opts.persist: save to bmrSession. Restores pass all three as false.
   */
  function calculate(opts) {
    const age = readAge();
    if (!Number.isFinite(age)) return false;
    if (age < 18) {
      clearSession();
      showUnder18(opts.moveFocus);
      return true;
    }
    const metric = toMetric();
    const sex = radioValue("sex");
    const activity = radioValue("activity");
    if (!Number.isFinite(metric.cm) || !Number.isFinite(metric.kg) || !sex || !ACTIVITY[activity]) return false;
    const bodyFat = readBodyFat();
    const input = {
      age: age,
      sex: sex,
      cm: metric.cm,
      kg: metric.kg,
      activity: activity,
      goal: GOALS[radioValue("goal")] ? radioValue("goal") : "maintain",
      bodyFat: Number.isFinite(bodyFat) && bodyFat >= 5 && bodyFat <= 60 ? bodyFat : NaN,
      units: units,
    };
    const result = estimate(input);
    result.input = input;
    showResult(result, opts);
    if (opts.persist) saveInputs(age);
    return true;
  }

  /* ───── Charts (inline SVG, drawn at the real container width so text never scales down) ───── */

  const SVG_NS_ATTR = 'xmlns="http://www.w3.org/2000/svg"';
  const COLOURS = { bmr: "#1f3a2e", text: "#1a1a1a", muted: "#5c5c5c", grid: "rgba(31,58,46,0.18)" };
  /* White outline behind label text, so grid and marker lines never cut through it. */
  const HALO = ' paint-order="stroke" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"';

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function chartWidth(el) {
    return Math.max(200, Math.floor(el.clientWidth || el.getBoundingClientRect().width || 320));
  }

  function niceStep(span, maxTicks) {
    const steps = [100, 200, 250, 500, 1000, 2000];
    for (let i = 0; i < steps.length; i += 1) {
      if (span / steps[i] <= maxTicks) return steps[i];
    }
    return 5000;
  }

  function svgOpen(width, height, label) {
    return (
      "<svg " +
      SVG_NS_ATTR +
      ' role="img" focusable="false" width="' +
      width +
      '" height="' +
      height +
      '" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" aria-label="' +
      esc(label) +
      '">'
    );
  }

  function tableHtml(head, rows) {
    return (
      '<table class="bmr-chart-table"><thead><tr>' +
      head
        .map(function (h) {
          return '<th scope="col">' + esc(h) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (row) {
          return (
            '<tr><th scope="row">' +
            esc(row[0]) +
            "</th>" +
            row
              .slice(1)
              .map(function (cell) {
                return "<td>" + esc(cell) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function swatch(fill) {
    return (
      '<svg class="bmr-swatch" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><rect x="0.5" y="0.5" width="17" height="17" rx="3" fill="' +
      fill +
      '" stroke="#1f3a2e" stroke-width="1"/></svg>'
    );
  }

  /* 1. Where your calories go: one stacked bar plus a plain key with values (no positional labels). */
  function renderSplit(result) {
    const wrap = $("bmr-chart-split");
    if (!wrap) return;
    const width = chartWidth(wrap);
    const height = 44;
    const parts = [
      { name: "BMR (body at rest)", value: result.bmr, fill: COLOURS.bmr },
      { name: "Digestion (typical estimate)", value: result.digestion, fill: "url(#bmr-pat-dots)" },
      { name: "Activity and daily movement", value: result.activity, fill: "url(#bmr-pat-stripes)" },
    ];
    const total = result.tdee;
    let x = 0;
    let rects = "";
    parts.forEach(function (part, i) {
      const w = (part.value / total) * width;
      rects +=
        '<rect x="' +
        x.toFixed(1) +
        '" y="2" width="' +
        Math.max(0, w - (i < parts.length - 1 ? 2 : 0)).toFixed(1) +
        '" height="' +
        (height - 4) +
        '" rx="4" fill="' +
        part.fill +
        '" stroke="#1f3a2e" stroke-width="1"/>';
      x += w;
    });
    const pct = function (v) {
      return Math.round((v / total) * 100) + "%";
    };
    const label =
      "Where your calories go, out of " +
      about(total) +
      " kcal a day: " +
      parts
        .map(function (p) {
          return p.name + " " + about(p.value) + " kcal, " + pct(p.value);
        })
        .join("; ") +
      ".";
    wrap.innerHTML = svgOpen(width, height, label) + rects + "</svg>";
    $("bmr-split-key").innerHTML = parts
      .map(function (p) {
        return (
          "<li>" +
          swatch(p.fill) +
          "<span><strong>" +
          esc(p.name) +
          "</strong> " +
          esc(about(p.value)) +
          " kcal (" +
          pct(p.value) +
          ")</span></li>"
        );
      })
      .join("");
    $("bmr-split-table").innerHTML = tableHtml(
      ["Part", "kcal a day", "Share"],
      parts
        .map(function (p) {
          return [p.name, about(p.value), pct(p.value)];
        })
        .concat([["Total daily calories (TDEE)", about(total), "100%"]])
    );
  }

  /* 2. Calorie ladder: BMR, maintenance and the goal range on one numeric scale. */
  function renderLadder(result) {
    const wrap = $("bmr-chart-ladder");
    if (!wrap) return;
    const width = chartWidth(wrap);
    const plan = result.plan;
    const range = displayRange(plan, result.bmr);
    const bmrR = round10(result.bmr);
    const tdeeR = round10(result.tdee);
    const maxVal = Math.max(range.high, tdeeR) * 1.08;
    const step = niceStep(maxVal, width < 480 ? 4 : 7);
    const axisMax = Math.ceil(maxVal / step) * step;
    const padR = 12;
    const plotW = width - padR;
    const sx = function (v) {
      return (v / axisMax) * plotW;
    };
    const top = 24;
    /* Narrow charts put the value on its own line under the row name, so long labels never spill out. */
    const twoLine = width < 480;
    const rowH = twoLine ? 74 : 58;
    const barOffset = twoLine ? 44 : 26;
    const barH = 20;
    const goalName = plan.effective === "maintain" ? "Goal: maintain" : "Goal range: " + GOALS[plan.effective].toLowerCase();
    const goalValue =
      plan.effective === "maintain" ? "about " + fmt(tdeeR) : fmt(range.low) + " to " + fmt(range.high);
    const rows = [
      { name: "BMR", value: "about " + fmt(bmrR), from: 0, to: bmrR, fill: COLOURS.bmr },
      { name: "Maintenance (TDEE)", value: "about " + fmt(tdeeR), from: 0, to: tdeeR, fill: "url(#bmr-pat-stripes)" },
      {
        name: goalName,
        value: goalValue,
        from: plan.effective === "maintain" ? tdeeR : range.low,
        to: plan.effective === "maintain" ? tdeeR : range.high,
        fill: "url(#bmr-pat-band)",
        band: true,
      },
    ];
    const axisY = top + rows.length * rowH + 4;
    const height = axisY + 36;
    let body = "";

    /* Grid and axis */
    for (let v = 0; v <= axisMax; v += step) {
      const gx = Math.min(sx(v), plotW - 0.5);
      body +=
        '<line x1="' + gx.toFixed(1) + '" y1="' + top + '" x2="' + gx.toFixed(1) + '" y2="' + axisY + '" stroke="' + COLOURS.grid + '" stroke-width="1"/>';
      const anchor = v === 0 ? "start" : gx > plotW - 20 ? "end" : "middle";
      body +=
        '<text x="' + gx.toFixed(1) + '" y="' + (axisY + 18) + '" font-size="12" fill="' + COLOURS.muted + '" text-anchor="' + anchor + '">' + fmt(v) + "</text>";
    }
    body += '<line x1="0" y1="' + axisY + '" x2="' + plotW + '" y2="' + axisY + '" stroke="' + COLOURS.muted + '" stroke-width="1"/>';
    body +=
      '<text x="' + plotW + '" y="' + (axisY + 33) + '" font-size="12" fill="' + COLOURS.muted + '" text-anchor="end">kcal a day</text>';

    /* Never-below-BMR line across every row (drawn before the labels, which carry a white halo) */
    const lx = sx(bmrR);
    body +=
      '<line x1="' + lx.toFixed(1) + '" y1="' + (top - 6) + '" x2="' + lx.toFixed(1) + '" y2="' + axisY + '" stroke="#7a2e2e" stroke-width="2" stroke-dasharray="5 4"/>';
    const anchor = lx > width / 2 ? "end" : "start";
    const tx = anchor === "end" ? lx - 6 : lx + 6;
    body +=
      '<text x="' + tx.toFixed(1) + '" y="12" font-size="12" font-weight="700" fill="#7a2e2e" text-anchor="' + anchor + '">Never below BMR</text>';

    /* Rows: label line above each bar, so labels never collide with bar ends */
    rows.forEach(function (row, i) {
      const y = top + i * rowH;
      body += twoLine
        ? '<text x="0" y="' + (y + 16) + '" font-size="13" font-weight="700" fill="' + COLOURS.text + '"' + HALO + ">" + esc(row.name) + "</text>" +
          '<text x="0" y="' + (y + 34) + '" font-size="13" fill="' + COLOURS.text + '"' + HALO + ">" + esc(row.value) + "</text>"
        : '<text x="0" y="' + (y + 16) + '" font-size="13" fill="' + COLOURS.text + '"' + HALO + '><tspan font-weight="700">' + esc(row.name) + "</tspan> " + esc(row.value) + "</text>";
      const x1 = sx(row.from);
      const w = Math.max(row.band ? 6 : 2, sx(row.to) - x1);
      const bx = row.band && w === 6 ? x1 - 3 : x1;
      body +=
        '<rect x="' + bx.toFixed(1) + '" y="' + (y + barOffset) + '" width="' + w.toFixed(1) + '" height="' + barH + '" rx="3" fill="' + row.fill + '" stroke="#1f3a2e" stroke-width="1"/>';
    });

    const label =
      "Calorie ladder in kcal a day. BMR " +
      fmt(bmrR) +
      ". Maintenance " +
      fmt(tdeeR) +
      ". " +
      goalName +
      " " +
      goalValue +
      ". A dashed line at the BMR marks the level the goal never goes below.";
    wrap.innerHTML = svgOpen(width, height, label) + body + "</svg>";
    $("bmr-ladder-table").innerHTML = tableHtml(
      ["Level", "kcal a day"],
      rows.map(function (r) {
        return [r.name, r.value];
      })
    );
  }

  /* 3. How BMR changes with age: Mifflin-St Jeor with sex, height and weight held constant. */
  function renderAgeLine(result) {
    const wrap = $("bmr-chart-age");
    if (!wrap) return;
    const input = result.input;
    const width = chartWidth(wrap);
    const height = 250;
    const padL = 46;
    const padR = 14;
    const padT = 30;
    const padB = 54;
    const minAge = Math.min(20, input.age);
    const maxAge = Math.max(80, input.age);
    const valueAt = function (age) {
      return mifflin(input.kg, input.cm, age, input.sex);
    };
    const yMaxRaw = valueAt(minAge) * 1.1;
    const step = niceStep(yMaxRaw, 5);
    const yMax = Math.ceil(yMaxRaw / step) * step;
    const sx = function (age) {
      return padL + ((age - minAge) / (maxAge - minAge)) * (width - padL - padR);
    };
    const sy = function (v) {
      return padT + (1 - v / yMax) * (height - padT - padB);
    };
    let body = "";
    for (let v = 0; v <= yMax; v += step) {
      body +=
        '<line x1="' + padL + '" y1="' + sy(v).toFixed(1) + '" x2="' + (width - padR) + '" y2="' + sy(v).toFixed(1) + '" stroke="' + COLOURS.grid + '" stroke-width="1"/>';
      if (v > 0) {
        body +=
          '<text x="' + (padL - 6) + '" y="' + (sy(v) + 4).toFixed(1) + '" font-size="12" fill="' + COLOURS.muted + '" text-anchor="end">' + fmt(v) + "</text>";
      }
    }
    const ticks = [];
    for (let a = 20; a <= 80; a += 10) ticks.push(a);
    const showEvery = width < 420 ? 20 : 10;
    ticks.forEach(function (a) {
      if ((a - 20) % showEvery !== 0) return;
      body +=
        '<text x="' + sx(a).toFixed(1) + '" y="' + (height - padB + 18) + '" font-size="12" fill="' + COLOURS.muted + '" text-anchor="' + (a === 80 && sx(a) > width - padR - 8 ? "end" : "middle") + '">' + a + "</text>";
    });
    body +=
      '<text x="' + (width - padR) + '" y="' + (height - 8) + '" font-size="12" fill="' + COLOURS.muted + '" text-anchor="end">Age (years)</text>';
    body +=
      '<line x1="' + padL + '" y1="' + sy(0) + '" x2="' + (width - padR) + '" y2="' + sy(0) + '" stroke="' + COLOURS.muted + '" stroke-width="1"/>';
    const points = [minAge, maxAge]
      .map(function (a) {
        return sx(a).toFixed(1) + "," + sy(valueAt(a)).toFixed(1);
      })
      .join(" ");
    body += '<polyline points="' + points + '" fill="none" stroke="' + COLOURS.bmr + '" stroke-width="3"/>';
    ticks.forEach(function (a) {
      body += '<circle cx="' + sx(a).toFixed(1) + '" cy="' + sy(valueAt(a)).toFixed(1) + '" r="3" fill="' + COLOURS.bmr + '"/>';
    });
    const mx = sx(input.age);
    const my = sy(valueAt(input.age));
    body +=
      '<line x1="' + mx.toFixed(1) + '" y1="' + my.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y2="' + sy(0) + '" stroke="#7a2e2e" stroke-width="1.5" stroke-dasharray="4 3"/>';
    body +=
      '<rect x="' + (mx - 7).toFixed(1) + '" y="' + (my - 7).toFixed(1) + '" width="14" height="14" transform="rotate(45 ' + mx.toFixed(1) + " " + my.toFixed(1) + ')" fill="#ffffff" stroke="#7a2e2e" stroke-width="3"/>';
    const youText = "You, " + input.age + ": " + about(valueAt(input.age));
    /* Centre the label on the marker, then clamp it inside the plot so it never clips. */
    const youW = youText.length * 7.6;
    const youX = Math.max(padL + 2, Math.min(mx - youW / 2, width - 4 - youW));
    body +=
      '<text x="' + youX.toFixed(1) + '" y="' + Math.max(14, my - 14).toFixed(1) + '" font-size="13" font-weight="700" fill="#7a2e2e" text-anchor="start"' + HALO + ">" + esc(youText) + "</text>";
    const label =
      "Line chart of estimated BMR by age, from the Mifflin-St Jeor formula with your sex, height and weight held constant: " +
      ticks
        .map(function (a) {
          return "age " + a + " " + about(valueAt(a));
        })
        .join(", ") +
      ". You are marked at age " +
      input.age +
      ", " +
      about(valueAt(input.age)) +
      " kcal a day.";
    wrap.innerHTML = svgOpen(width, height, label) + body + "</svg>";
    const rows = ticks.map(function (a) {
      return [String(a), about(valueAt(a))];
    });
    if (ticks.indexOf(input.age) === -1) {
      rows.push([input.age + " (you)", about(valueAt(input.age))]);
      rows.sort(function (a, b) {
        return parseInt(a[0], 10) - parseInt(b[0], 10);
      });
    } else {
      rows[ticks.indexOf(input.age)][0] = input.age + " (you)";
    }
    $("bmr-age-table").innerHTML = tableHtml(["Age", "Estimated BMR, kcal a day"], rows);
    $("bmr-age-katch-note").hidden = result.formula !== "katch";
  }

  function renderCharts(result) {
    renderSplit(result);
    renderLadder(result);
    renderAgeLine(result);
  }

  let resizeTimer = null;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (lastResult) renderCharts(lastResult);
    }, 150);
  });

  /* ───── Guidance and related posts ───── */

  function guidanceCard(block, showBadge) {
    return (
      (showBadge && block.reviewed ? '<p class="bmi-reviewed">' + esc(guidanceData.reviewedPlaceholder) + "</p>" : "") +
      "<h3>" +
      esc(block.headline) +
      "</h3><p>" +
      esc(block.body) +
      '</p><ul class="bmi-actions">' +
      block.actions
        .map(function (a) {
          return "<li>" + esc(a) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderGuidance(result) {
    const goal = guidanceData.goals[result.plan.effective];
    const band = guidanceData.ageBands[result.band];
    guidanceBlock.innerHTML =
      '<div class="bmr-guidance-part">' +
      guidanceCard(goal, true) +
      '</div><div class="bmr-guidance-part">' +
      guidanceCard(band, true) +
      "</div>";
    resultCta.textContent = goal.cta || "Talk to Sanjeev";
  }

  function pictureHtml(src) {
    const base = src.replace(/\.jpg$/i, "");
    const sizes = "(min-width: 1024px) 22rem, (min-width: 768px) 46vw, calc(100vw - 2rem)";
    const set = function (ext) {
      return base + "-480." + ext + " 480w, " + base + "-768." + ext + " 768w, " + base + "-1200." + ext + " 1200w";
    };
    return (
      '<picture><source type="image/avif" srcset="' +
      set("avif") +
      '" sizes="' +
      sizes +
      '"><source type="image/webp" srcset="' +
      set("webp") +
      '" sizes="' +
      sizes +
      '"><img src="' +
      src +
      '" srcset="' +
      base +
      "-480.jpg 480w, " +
      base +
      "-768.jpg 768w, " +
      src +
      ' 1200w" sizes="' +
      sizes +
      '" alt="" width="1200" height="800" loading="lazy" decoding="async"></picture>'
    );
  }

  function scorePosts(topics) {
    return relatedData.posts
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
  }

  /** Always three cards: two or three best goal matches, one 50+ match for older bands, then the next best. */
  function pickRelated(goal, band) {
    const rule = relatedData.rules[goal] || relatedData.rules.maintain;
    const older = relatedData.age50Plus.bands.indexOf(band) !== -1;
    const picked = [];
    const seen = {};
    function take(rows, limit, needScore) {
      rows.forEach(function (row) {
        if (picked.length >= limit || seen[row.post.slug]) return;
        if (needScore && row.score <= 0) return;
        seen[row.post.slug] = true;
        picked.push(row.post);
      });
    }
    const byGoal = scorePosts(rule.topics);
    take(byGoal, older ? 2 : 3, true);
    if (older) take(scorePosts(relatedData.age50Plus.topics), picked.length + 1, true);
    take(byGoal, 3, true);
    take(byGoal, 3, false);
    return {
      posts: picked.slice(0, 3),
      seeAll: older && goal === "maintain" ? relatedData.age50Plus.seeAllCategory : rule.seeAllCategory,
    };
  }

  function renderRelated(result) {
    const picked = pickRelated(result.plan.effective, result.band);
    relatedGrid.innerHTML = picked.posts
      .map(function (post) {
        return (
          '<article class="blog-card"><a class="blog-card-link" href="blog/' +
          esc(post.slug) +
          '.html"><div class="blog-card-media">' +
          pictureHtml(post.image) +
          '</div><div class="blog-card-copy"><p class="blog-card-category">' +
          esc(post.categoryLabel) +
          '</p><h3 class="blog-card-title">' +
          esc(post.title) +
          '</h3><p class="blog-card-excerpt">' +
          esc(post.description) +
          "</p></div></a></article>"
        );
      })
      .join("");
    relatedSeeAll.href = "blog/index.html?category=" + encodeURIComponent(picked.seeAll);
    relatedBlock.hidden = !picked.posts.length;
  }

  /* ───── Lead form summary: age band, BMR, TDEE, goal and units only ───── */

  function updateSummaryField() {
    if (!summaryField) return;
    if (!lastResult || !shareResults || !shareResults.checked) {
      summaryField.value = "Visitor did not share calculator numbers. Source: bmr-calculator.";
      return;
    }
    summaryField.value =
      "Source: bmr-calculator. Age band: " +
      lastResult.band +
      ". BMR: " +
      about(lastResult.bmr) +
      " kcal. TDEE: " +
      about(lastResult.tdee) +
      " kcal. Goal: " +
      GOALS[lastResult.plan.effective] +
      ". Units: " +
      lastResult.input.units +
      ".";
  }

  if (shareResults) shareResults.addEventListener("change", updateSummaryField);

  /* ───── Events ───── */

  /* Focus moves to the result only when the form was sent from the keyboard. */
  document.addEventListener(
    "pointerdown",
    function () {
      keyboardSubmit = false;
    },
    true
  );
  form.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") keyboardSubmit = true;
  });
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.addEventListener("click", function (event) {
    keyboardSubmit = event.detail === 0;
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const viaKeyboard = keyboardSubmit;
    clearErrors();
    const age = readAge();
    if (!Number.isFinite(age)) {
      const err = $("bmr-age-error");
      err.textContent = "Enter your age in whole years, from 18 to 100.";
      err.hidden = false;
      ageInput.setAttribute("aria-invalid", "true");
      ageInput.focus();
      showEmpty();
      return;
    }
    /* An old result never stays on screen next to an error. */
    if (age >= 18 && !validate()) {
      showEmpty();
      return;
    }
    if (prefillNote) prefillNote.hidden = true;
    calculate({ moveFocus: viaKeyboard, scroll: !viaKeyboard, persist: true });
  });

  function resetForm() {
    form.reset();
    setUnits("metric");
    setRadio("goal", "maintain");
    if (advanced) advanced.open = false;
    clearErrors();
  }

  clearBtn.addEventListener("click", function () {
    clearSession();
    resetForm();
    if (prefillNote) prefillNote.hidden = true;
    showEmpty();
    liveRegion.textContent = "Results cleared.";
    ageInput.focus();
  });

  /* ───── Restore: own session first, else prefill age, height, weight and units from the BMI page ───── */

  function restore() {
    const data = readJson(SESSION_KEY);
    if (data && data.age >= 18 && data.age <= 100) {
      ageInput.value = String(data.age);
      fillMeasurements(data);
      setRadio("sex", data.sex);
      setRadio("activity", data.activity);
      setRadio("goal", GOALS[data.goal] ? data.goal : "maintain");
      bodyFatInput.value = data.bodyFat || "";
      if (advanced && data.bodyFat) advanced.open = true;
      if (prefillNote) prefillNote.hidden = true;
      if (!calculate({ moveFocus: false, scroll: false, persist: false })) showEmpty();
      return;
    }
    showEmpty();
    const bmi = readJson(BMI_SESSION_KEY);
    if (bmi && bmi.age >= 18 && bmi.age <= 100 && !ageInput.value) {
      ageInput.value = String(bmi.age);
      fillMeasurements(bmi);
      if (prefillNote) prefillNote.hidden = false;
    }
  }

  /* ───── Contact form ───── */

  if (contactForm) {
    const success = $("bmr-form-success");
    const errorBox = $("bmr-form-error");
    const alertBox = $("bmr-form-alert");
    const formShell = $("bmr-form-shell");
    /* Shared honeypot + minimum-time check from script.js (loaded first on this page). */
    const spamCheck =
      typeof window.siteSpamGuard === "function"
        ? window.siteSpamGuard(contactForm, alertBox)
        : function () {
            return "ok";
          };
    const fields = {
      name: $("bmr-contact-name"),
      email: $("bmr-contact-email"),
      age: $("bmr-age-confirm"),
      consent: $("bmr-consent"),
    };
    const sendBtn = contactForm.querySelector('button[type="submit"]');
    contactForm.action = BMR_FORM_ENDPOINT;

    function showSent() {
      contactForm.hidden = true;
      formShell.classList.add("is-sent");
      success.hidden = false;
      success.focus();
    }

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      alertBox.hidden = true;
      errorBox.hidden = true;
      let first = null;
      function check(input, errorId, message) {
        const err = $(errorId);
        err.textContent = message;
        err.hidden = !message;
        if (message) {
          input.setAttribute("aria-invalid", "true");
          if (!first) first = input;
        } else {
          input.removeAttribute("aria-invalid");
        }
      }
      check(fields.name, "bmr-contact-name-error", fields.name.value.trim() ? "" : "Enter your name.");
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim());
      check(fields.email, "bmr-contact-email-error", emailOk ? "" : "Enter an email address like name@example.com.");
      check(fields.age, "bmr-age-confirm-error", fields.age.checked ? "" : "Confirm you are 18 or older.");
      check(fields.consent, "bmr-consent-error", fields.consent.checked ? "" : "Tick the box to agree to be contacted.");
      if (first) {
        first.focus();
        return;
      }

      const verdict = spamCheck();
      if (verdict === "spam") {
        showSent();
        return;
      }
      if (verdict === "wait") return;

      updateSummaryField();
      sendBtn.disabled = true;
      fetch(BMR_FORM_ENDPOINT, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Formspree request failed");
          showSent();
        })
        .catch(function () {
          errorBox.hidden = false;
          errorBox.focus();
        })
        .finally(function () {
          sendBtn.disabled = false;
        });
    });
  }

  /* ───── Guide contents toggle (small screens) ───── */

  const tocToggle = document.querySelector(".bmi-guide-toc-toggle");
  const tocNav = document.querySelector(".bmi-guide-toc");
  if (tocToggle && tocNav) {
    tocToggle.addEventListener("click", function () {
      const open = tocToggle.getAttribute("aria-expanded") === "true";
      tocToggle.setAttribute("aria-expanded", open ? "false" : "true");
      tocNav.classList.toggle("is-collapsed", open);
    });
  }

  setUnits("metric");
  restore();
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) restore();
  });
})();
