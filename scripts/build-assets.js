#!/usr/bin/env node
/**
 * Minify styles.css and script.js.
 * Source maps are not written. The minified files are what the pages load.
 * Vercel does not run a build, so commit the output.
 */

const esbuild = require("esbuild");
const path = require("path");

const ROOT = path.join(__dirname, "..");

async function build() {
  const css = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["styles.css"],
    outfile: "styles.min.css",
    minify: true,
    sourcemap: false,
    legalComments: "none",
    allowOverwrite: true,
  });
  if (css.errors && css.errors.length) {
    console.error(css.errors);
    process.exit(1);
  }

  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["script.js"],
    outfile: "script.min.js",
    minify: true,
    bundle: false,
    sourcemap: false,
    legalComments: "none",
    target: ["es2018"],
    allowOverwrite: true,
  });

  const fs = require("fs");
  const cssBytes = fs.statSync(path.join(ROOT, "styles.min.css")).size;
  const jsBytes = fs.statSync(path.join(ROOT, "script.min.js")).size;
  console.log("styles.min.css " + cssBytes + " bytes");
  console.log("script.min.js " + jsBytes + " bytes");
  if (cssBytes > 60 * 1024) {
    console.warn("styles.min.css is over 60 KB. Split page CSS before shipping.");
    process.exitCode = 1;
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
