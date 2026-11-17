#!/usr/bin/env node
/**
 * Build responsive WebP (and AVIF when it is clearly smaller) plus
 * narrower JPEG fallbacks. Originals stay in place and keep their names.
 *
 * Replaced images need a new filename. /images/ is cached for a year.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
let picture = require("./picture");

const ROOT = path.join(__dirname, "..");
const IMAGES = path.join(ROOT, "images");
const WIDTHS = [480, 768, 1200, 1600];
const WEBP_QUALITY = 80;
const JPEG_QUALITY = 80;
const AVIF_QUALITY = 50;
const AVIF_KEEP_RATIO = 0.8;

function pageSpecs() {
  return [
    { file: "index.html", lcp: "images/hero/collage-1.jpg", sizes: picture.HERO_SIZES },
    { file: "about.html", lcp: "images/sanjeev-kumar.jpg", sizes: picture.PORTRAIT_SIZES },
  ];
}

function walk(dir, found) {
  for (const name of fs.readdirSync(dir)) {
    if (name === ".DS_Store" || name === "manifest.json" || name === "CREDITS.md") continue;
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      // Social-share OG originals stay as-is; do not emit responsive variants.
      if (name === "og") continue;
      walk(abs, found);
      continue;
    }
    if (/-(\d{3,4})\.(webp|avif|jpe?g)$/i.test(name)) continue;
    if (/\.(jpe?g|png)$/i.test(name)) found.push(abs);
  }
}

function variantWidths(srcWidth) {
  const widths = WIDTHS.filter((width) => width <= srcWidth - 16);
  if (!widths.length || widths[widths.length - 1] !== srcWidth) widths.push(srcWidth);
  return Array.from(new Set(widths));
}

function relSrc(file) {
  return "/" + path.relative(ROOT, file).split(path.sep).join("/");
}

async function encode(source, width, format) {
  let pipeline = sharp(source, { failOn: "none" }).rotate();
  const meta = await sharp(source, { failOn: "none" }).metadata();
  if (width < meta.width) {
    pipeline = sharp(source, { failOn: "none" }).rotate().resize({
      width,
      withoutEnlargement: true,
      fit: "inside",
    });
  }
  if (format === "webp") {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY, effort: 4, alphaQuality: 80 });
  } else if (format === "avif") {
    pipeline = pipeline.avif({ quality: AVIF_QUALITY, effort: 4 });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }
  return pipeline.toBuffer();
}

async function buildOne(file) {
  const meta = await sharp(file, { failOn: "none" }).metadata();
  const width = meta.width;
  const height = meta.height;
  const ext = path.extname(file).toLowerCase();
  const base = file.slice(0, -ext.length);
  const isPng = ext === ".png";
  const widths = variantWidths(width);
  const webp = [];
  const avif = [];
  const fallback = [];

  for (const variantWidth of widths) {
    const webpName = base + "-" + variantWidth + ".webp";
    const webpBuf = await encode(file, variantWidth, "webp");
    fs.writeFileSync(webpName, webpBuf);
    webp.push({ w: variantWidth, src: relSrc(webpName) });

    const avifName = base + "-" + variantWidth + ".avif";
    const avifBuf = await encode(file, variantWidth, "avif");
    if (avifBuf.length < webpBuf.length * AVIF_KEEP_RATIO) {
      fs.writeFileSync(avifName, avifBuf);
      avif.push({ w: variantWidth, src: relSrc(avifName) });
    } else if (fs.existsSync(avifName)) {
      fs.unlinkSync(avifName);
    }

    if (!isPng && variantWidth < width) {
      const jpegName = base + "-" + variantWidth + ".jpg";
      const jpegBuf = await encode(file, variantWidth, "jpeg");
      fs.writeFileSync(jpegName, jpegBuf);
      fallback.push({ w: variantWidth, src: relSrc(jpegName) });
    }
  }

  fallback.push({ w: width, src: relSrc(file) });
  const largestWebp = webp[webp.length - 1];
  const largestAvif = avif[avif.length - 1];
  const note = largestAvif
    ? "avif " + path.basename(largestAvif.src)
    : "webp only";
  console.log(path.relative(ROOT, file) + " -> " + widths.join(",") + " (" + note + ")");
  return {
    key: relSrc(file),
    value: { width, height, webp, avif, fallback },
  };
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  const body = tag.replace(/^<img\b/i, "").replace(/\/?\s*>$/, "");
  while ((match = re.exec(body))) {
    attrs[match[1]] = match[2] != null ? match[2] : match[3] != null ? match[3] : match[4] != null ? match[4] : "";
  }
  return attrs;
}

function rewriteImgTag(tag, heroEagerUsed) {
  const attrs = parseAttrs(tag);
  const src = attrs.src || "";
  if (!src || /^https?:/i.test(src) || src.startsWith("data:")) {
    return { html: tag, heroEagerUsed };
  }
  if (!/(^|\/)images\//.test(src)) {
    return { html: tag, heroEagerUsed };
  }
  const key = picture.absKey(src);
  let nextHero = heroEagerUsed;
  const isFirstHero = key.endsWith("/images/hero/collage-1.jpg") && !heroEagerUsed;
  if (isFirstHero) nextHero = true;
  const eager =
    isFirstHero ||
    key.endsWith("/images/sanjeev-kumar.jpg") ||
    attrs.fetchpriority === "high";
  const extra = attrs.draggable ? ' draggable="' + attrs.draggable + '"' : "";
  return {
    html: picture.renderPicture({
      src,
      alt: attrs.alt || "",
      width: attrs.width || "",
      height: attrs.height || "",
      className: attrs.class || "",
      eager,
      sizes: picture.sizesFor(key),
      extra,
    }),
    heroEagerUsed: nextHero,
  };
}

function rewriteHtml(html) {
  let heroEagerUsed = false;
  // Re-render bare <img> and existing <picture> blocks so sizes/srcset stay current.
  return html.replace(/<picture\b[\s\S]*?<\/picture>|<img\b[\s\S]*?>/gi, (tag) => {
    if (tag.toLowerCase().startsWith("<picture")) {
      const img = tag.match(/<img\b[\s\S]*?>/i);
      if (!img) return tag;
      const result = rewriteImgTag(img[0], heroEagerUsed);
      heroEagerUsed = result.heroEagerUsed;
      return result.html;
    }
    const result = rewriteImgTag(tag, heroEagerUsed);
    heroEagerUsed = result.heroEagerUsed;
    return result.html;
  });
}

function injectPreload(html, src, sizes) {
  const start = "<!-- LCP:PRELOAD:START -->";
  const end = "<!-- LCP:PRELOAD:END -->";
  if (!html.includes(start) || !html.includes(end)) return html;
  const tag = picture.preloadTag(src, sizes);
  const block = start + (tag ? "\n    " + tag : "") + "\n    " + end;
  return html.replace(new RegExp(start + "[\\s\\S]*?" + end), block);
}

async function main() {
  const files = [];
  walk(IMAGES, files);
  files.sort();
  const manifest = {};
  for (const file of files) {
    const built = await buildOne(file);
    manifest[built.key] = built.value;
  }
  const ordered = {};
  Object.keys(manifest)
    .sort()
    .forEach((key) => {
      ordered[key] = manifest[key];
    });
  fs.writeFileSync(path.join(IMAGES, "manifest.json"), JSON.stringify(ordered, null, 2) + "\n");
  delete require.cache[require.resolve("./picture")];
  picture = require("./picture");

  for (const page of pageSpecs()) {
    const file = path.join(ROOT, page.file);
    let html = fs.readFileSync(file, "utf8");
    html = rewriteHtml(html);
    const tag = picture.preloadTag(page.lcp, page.sizes);
    const start = "<!-- LCP:PRELOAD:START -->";
    const end = "<!-- LCP:PRELOAD:END -->";
    if (html.includes(start) && html.includes(end)) {
      const block = start + (tag ? "\n    " + tag : "") + "\n    " + end;
      html = html.replace(new RegExp(start + "[\\s\\S]*?" + end), block);
    }
    fs.writeFileSync(file, html);
    console.log("updated " + page.file);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
