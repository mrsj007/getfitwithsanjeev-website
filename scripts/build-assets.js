#!/usr/bin/env node
/**
 * Minify styles.css, script.js, and BMI calculator page assets.
 * Source maps are not written. The minified files are what the pages load.
 * Vercel does not run a build, so commit the output.
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");

async function buildCss(entry, outfile) {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [entry],
    outfile: outfile,
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

  console.log("styles.min.css " + cssBytes + " bytes");
  console.log("script.min.js " + jsBytes + " bytes");
  console.log("bmi-calculator.min.css " + bmiCssBytes + " bytes");
  console.log("bmi-calculator.min.js " + bmiJsBytes + " bytes");

  // Budget covers shared layout plus feedback-card and address styles from main.
  if (cssBytes > 68 * 1024) {
    console.warn("styles.min.css is over 68 KB. Split page CSS before shipping.");
    process.exitCode = 1;
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
