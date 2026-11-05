/**
 * Responsive <picture> markup from images/manifest.json.
 * Falls back to a plain <img> when a file has no generated variants,
 * so a blog build still works before images are generated.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "images", "manifest.json");

const HERO_SIZES = "82rem";
const PORTRAIT_SIZES = "(min-width: 768px) 34rem, calc(100vw - 2rem)";
const GUIDANCE_SIZES = "(min-width: 1024px) 24rem, (min-width: 768px) 31vw, (min-width: 480px) 46vw, calc(100vw - 2rem)";
const TRANSFORM_SIZES = "(min-width: 1024px) 14rem, (min-width: 768px) 20vw, 44vw";
const LOGO_SIZES = "8rem";
const BLOG_CARD_SIZES = "(min-width: 1024px) 40rem, (min-width: 768px) 46vw, calc(100vw - 2rem)";
const BLOG_HERO_SIZES = "min(44rem, calc(100vw - 2rem))";
const CONTACT_SIZES = "100vw";

let manifestCache = null;

function loadManifest() {
  if (manifestCache) return manifestCache;
  if (!fs.existsSync(MANIFEST_PATH)) {
    manifestCache = {};
    return manifestCache;
  }
  manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  return manifestCache;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absKey(src) {
  return "/" + String(src).replace(/^\.\.\//, "").replace(/^\//, "");
}

function prefixOf(src) {
  if (String(src).startsWith("../")) return "../";
  if (String(src).startsWith("/")) return "/";
  return "";
}

function rel(src, absPath) {
  const clean = String(absPath).replace(/^\//, "");
  const prefix = prefixOf(src);
  if (prefix === "/") return "/" + clean;
  return prefix + clean;
}

function srcset(src, variants) {
  return variants.map((item) => rel(src, item.src) + " " + item.w + "w").join(", ");
}

function sizesFor(absPath) {
  if (absPath.includes("/images/hero/")) return HERO_SIZES;
  if (absPath.endsWith("/images/sanjeev-kumar.jpg")) return PORTRAIT_SIZES;
  if (absPath.includes("/images/guidance/")) return GUIDANCE_SIZES;
  if (absPath.includes("/images/transformations/")) return TRANSFORM_SIZES;
  if (absPath.includes("/images/logos/")) return LOGO_SIZES;
  if (absPath.includes("/images/contact/")) return CONTACT_SIZES;
  if (absPath.includes("/images/blog/")) return BLOG_CARD_SIZES;
  return "100vw";
}

function entryFor(src) {
  return loadManifest()[absKey(src)] || null;
}

function preloadTag(src, sizes) {
  const entry = entryFor(src);
  if (!entry) return "";
  const chosen = entry.avif && entry.avif.length ? entry.avif : entry.webp;
  const type = entry.avif && entry.avif.length ? "image/avif" : "image/webp";
  if (!chosen || !chosen.length) return "";
  const href = rel(src, chosen[chosen.length - 1].src);
  return (
    '<link rel="preload" as="image" href="' +
    escapeHtml(href) +
    '" imagesrcset="' +
    escapeHtml(srcset(src, chosen)) +
    '" imagesizes="' +
    escapeHtml(sizes) +
    '" type="' +
    type +
    '" fetchpriority="high" />'
  );
}

function renderPicture(options) {
  const src = options.src;
  const alt = options.alt == null ? "" : options.alt;
  const width = options.width || "";
  const height = options.height || "";
  const eager = !!options.eager;
  const sizes = options.sizes || sizesFor(absKey(src));
  const extra = options.extra || "";
  const entry = entryFor(src);
  const priority = eager
    ? ' fetchpriority="high"'
    : ' loading="lazy" fetchpriority="low"';
  const dims = (width ? ' width="' + width + '"' : "") + (height ? ' height="' + height + '"' : "");
  const classAttr = options.className ? ' class="' + escapeHtml(options.className) + '"' : "";

  if (!entry || !entry.webp || !entry.webp.length) {
    return (
      '<img src="' +
      escapeHtml(src) +
      '" alt="' +
      escapeHtml(alt) +
      '"' +
      dims +
      classAttr +
      priority +
      ' decoding="async"' +
      extra +
      ">"
    );
  }

  let html = "<picture>";
  if (entry.avif && entry.avif.length) {
    html +=
      '<source type="image/avif" srcset="' +
      escapeHtml(srcset(src, entry.avif)) +
      '" sizes="' +
      escapeHtml(sizes) +
      '">';
  }
  html +=
    '<source type="image/webp" srcset="' +
    escapeHtml(srcset(src, entry.webp)) +
    '" sizes="' +
    escapeHtml(sizes) +
    '">';
  html += '<img src="' + escapeHtml(src) + '"';
  if (entry.fallback && entry.fallback.length) {
    html += ' srcset="' + escapeHtml(srcset(src, entry.fallback)) + '" sizes="' + escapeHtml(sizes) + '"';
  }
  html +=
    ' alt="' +
    escapeHtml(alt) +
    '"' +
    dims +
    classAttr +
    priority +
    ' decoding="async"' +
    extra +
    "></picture>";
  return html;
}

module.exports = {
  HERO_SIZES,
  PORTRAIT_SIZES,
  GUIDANCE_SIZES,
  TRANSFORM_SIZES,
  LOGO_SIZES,
  BLOG_CARD_SIZES,
  BLOG_HERO_SIZES,
  CONTACT_SIZES,
  absKey,
  sizesFor,
  preloadTag,
  renderPicture,
  loadManifest,
};
