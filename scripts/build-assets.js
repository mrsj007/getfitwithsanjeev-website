#!/usr/bin/env node
/**
 * Minify styles.css, script.js, and the BMI and BMR calculator page assets.
 * Source maps are not written. The minified files are what the pages load.
 * Vercel does not run a build, so commit the output.
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");

async function buildCss(entry, outfile, bundle) {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [entry],
    outfile: outfile,
    bundle: !!bundle,
    minify: true,
    sourcemap: false,
    legalComments: "none",
    allowOverwrite: true,
  });
  if (result.errors && result.errors.length) {
    console.error(result.errors);
    process.exit(1);
  }
  return fs.statSync(path.join(ROOT, outfile)).size;
}

async function buildJs(entry, outfile, bundle) {
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [entry],
    outfile: outfile,
    minify: true,
    bundle: !!bundle,
    sourcemap: false,
    legalComments: "none",
    target: ["es2018"],
    allowOverwrite: true,
  });
  return fs.statSync(path.join(ROOT, outfile)).size;
}

async function build() {
  const cssBytes = await buildCss("styles.css", "styles.min.css");
  const jsBytes = await buildJs("script.js", "script.min.js", false);
  const bmiCssBytes = await buildCss("bmi-calculator.css", "bmi-calculator.min.css");
  const bmiJsBytes = await buildJs("bmi-calculator.js", "bmi-calculator.min.js", true);
  /* bmr-calculator.css imports bmi-calculator.css, so the BMR page loads one stylesheet. */
  const bmrCssBytes = await buildCss("bmr-calculator.css", "bmr-calculator.min.css", true);
  const bmrJsBytes = await buildJs("bmr-calculator.js", "bmr-calculator.min.js", true);

  console.log("styles.min.css " + cssBytes + " bytes");
  console.log("script.min.js " + jsBytes + " bytes");
  console.log("bmi-calculator.min.css " + bmiCssBytes + " bytes");
  console.log("bmi-calculator.min.js " + bmiJsBytes + " bytes");
  console.log("bmr-calculator.min.css " + bmrCssBytes + " bytes");
  console.log("bmr-calculator.min.js " + bmrJsBytes + " bytes");

  // Raised from 68 KB so spacing/a11y rules are not trimmed to hit the budget.
  const cssBudget = 72 * 1024;
  if (cssBytes > cssBudget) {
    console.warn(
      "styles.min.css is over " + cssBudget + " bytes (" + cssBytes + "). Split page CSS before shipping."
    );
    process.exitCode = 1;
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
