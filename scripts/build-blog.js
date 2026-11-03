#!/usr/bin/env node
/**
 * Build static blog pages from content/blog/*.md.
 *
 *   npm run build:blog
 *   npm run build:blog -- --drafts
 *
 * Drafts are skipped unless --drafts is set. That flag is a local preview:
 * it writes draft pages and fills the home page and Blog links. Run the
 * command again without --drafts before you commit.
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const BLOG_DIR = path.join(ROOT, "blog");
const SITE = "https://www.getfitwithsanjeev.com";
const INCLUDE_DRAFTS = process.argv.includes("--drafts");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BANNED_JSON_KEYS = new Set([
  "aggregateRating",
  "review",
  "reviews",
  "offers",
  "price",
  "telephone",
  "streetAddress",
  "address",
]);

const INDEX_TITLE = "Blog | Sanjeev Kumar - Fitness Guidance in South Surrey";
const INDEX_H1 = "Guidance for Longevity, Mobility and Endurance";
const INDEX_DESCRIPTION =
  "Practical articles on longevity, mobility and endurance from Sanjeev Kumar, a Level 3 personal trainer in South Surrey.";
const INDEX_INTRO =
  "Plain-language guidance from Sanjeev Kumar on strength, mobility and training that fits real life.";
const DISCLAIMER =
  "This article is for education and is not medical advice. If you have a health condition or injury, check with your doctor or physiotherapist before changing your training.";
const PORTRAIT = "/images/sanjeev-kumar.jpg";
const PORTRAIT_ALT = "Sanjeev Kumar, personal trainer, photographed in a gym";

const warnings = [];
let CATEGORIES = [];

function fail(message) {
  console.error("Error: " + message);
  process.exit(1);
}

function warn(message) {
  warnings.push(message);
  console.warn("Warning: " + message);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decode(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function escapeReg(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value == null ? "" : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function requireDate(value, file, field) {
  const iso = asIsoDate(value);
  if (!iso) fail(file + " " + field + " must be YYYY-MM-DD.");
  const parts = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (
    utc.getUTCFullYear() !== parts[0] ||
    utc.getUTCMonth() !== parts[1] - 1 ||
    utc.getUTCDate() !== parts[2]
  ) {
    fail(file + " " + field + " is not a real calendar date.");
  }
  return iso;
}

function formatDate(iso) {
  const parts = iso.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function rssDate(iso) {
  const parts = iso.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 16, 0, 0)).toUTCString();
}

function headingSlug(text) {
  const slug = String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || "section";
}

function uniqueId(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = base + "-" + n;
    n += 1;
  }
  used.add(id);
  return id;
}

function documentTitle(title) {
  const suffix = " | Sanjeev Kumar";
  if ((title + suffix).length <= 60) return title + suffix;
  const ellipsis = "...";
  const budget = 60 - suffix.length - ellipsis.length;
  let cut = title.slice(0, budget);
  const paren = cut.lastIndexOf(" (");
  const space = cut.lastIndexOf(" ");
  const breakAt = paren >= 18 ? paren : space;
  if (breakAt >= 18) cut = cut.slice(0, breakAt);
  cut = cut.replace(/[\s,.:;|(/-]+$/g, "");
  const result = cut + ellipsis + suffix;
  if (result.length <= 60) return result;
  return title.slice(0, budget).replace(/[\s,.:;|(/-]+$/g, "") + ellipsis + suffix;
}

function readingMinutes(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_`|~-]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function imageSize(filePath) {
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch (error) {
    return null;
  }
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1];
      if (marker === 0xd8) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9) return null;
      const length = buf.readUInt16BE(offset + 2);
      if (length < 2) return null;
      const isSizeMarker =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSizeMarker) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function stringList(value, file, field) {
  if (value == null || value === "") return [];
  if (!Array.isArray(value)) fail(file + " " + field + " must be a list.");
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function loadCategories() {
  const filePath = path.join(CONTENT_DIR, "categories.json");
  if (!fs.existsSync(filePath)) fail("Missing content/blog/categories.json.");
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail("content/blog/categories.json could not be read. " + error.message);
  }
  if (!Array.isArray(data) || data.length === 0) {
    fail("content/blog/categories.json must list at least one category.");
  }
  if (data.length > 10) {
    fail("content/blog/categories.json lists " + data.length + " categories. The maximum is 10.");
  }
  const names = new Set();
  const slugs = new Set();
  CATEGORIES = data.map((item, index) => {
    const label = "content/blog/categories.json item " + (index + 1);
    const name = cleanText(item && item.name);
    const slug = cleanText(item && item.slug);
    const description = cleanText(item && item.description);
    if (!name || !slug || !description) fail(label + " needs a name, a slug and a description.");
    if (!SLUG_RE.test(slug)) {
      fail(label + ' slug "' + slug + '" must be lowercase words separated by hyphens.');
    }
    if (names.has(name)) fail(label + ' repeats the name "' + name + '".');
    if (slugs.has(slug)) fail(label + ' repeats the slug "' + slug + '".');
    names.add(name);
    slugs.add(slug);
    return { name, slug, description };
  });
  return CATEGORIES;
}

function categoriesForPost(data, file) {
  if (Object.prototype.hasOwnProperty.call(data, "category")) {
    fail(file + ' uses "category". Use categories with 1 to 3 names from content/blog/categories.json.');
  }
  if (!Object.prototype.hasOwnProperty.call(data, "categories") || data.categories == null || data.categories === "") {
    fail(file + " has no categories. Add 1 to 3 names from content/blog/categories.json.");
  }
  if (!Array.isArray(data.categories)) {
    fail(file + " categories must be a list of 1 to 3 names from content/blog/categories.json.");
  }
  const names = data.categories.map((item) => cleanText(item)).filter((item) => item !== "");
  if (!names.length) fail(file + " has no categories. Add 1 to 3 names from content/blog/categories.json.");
  if (names.length > 3) fail(file + " has " + names.length + " categories. A post can have at most 3.");
  const seen = new Set();
  return names.map((name) => {
    const found = CATEGORIES.find((item) => item.name === name);
    if (!found) fail(file + ' uses category "' + name + '", which is not in content/blog/categories.json.');
    if (seen.has(found.slug)) fail(file + ' lists "' + name + '" more than once.');
    seen.add(found.slug);
    return found;
  });
}

function loadPosts() {
  if (!fs.existsSync(CONTENT_DIR)) fail("Missing content/blog/. Create it and add a Markdown file.");
  const names = fs
    .readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_") && !name.startsWith("."));
  const posts = names.map((name) => {
    const full = path.join(CONTENT_DIR, name);
    const raw = fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
    let parsed;
    try {
      parsed = matter(raw);
    } catch (error) {
      fail(name + " has front matter that could not be read. " + error.message);
    }
    return normalizePost(parsed.data || {}, parsed.content || "", name, raw);
  });
  const seen = new Set();
  posts.forEach((post) => {
    if (seen.has(post.slug)) fail("Two posts use the slug " + post.slug + ".");
    seen.add(post.slug);
  });
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.updated !== b.updated) return a.updated < b.updated ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
  return posts;
}

function normalizePost(data, body, name, raw) {
  const file = "content/blog/" + name;
  const title = cleanText(data.title);
  const slug = cleanText(data.slug);
  const description = cleanText(data.description);
  const categories = categoriesForPost(data, file);
  const status = cleanText(data.status);
  if (!title) fail(file + " is missing a title.");
  if (!slug) fail(file + " is missing a slug.");
  if (!SLUG_RE.test(slug)) {
    fail(file + ' slug "' + slug + '" must be lowercase words separated by hyphens.');
  }
  if (name !== slug + ".md") fail(file + " must be named " + slug + ".md so it matches the slug.");
  if (!description) fail(file + " is missing a description.");
  if ([...description].length > 160) {
    fail(file + " description is " + [...description].length + " characters. Keep it to 160 or fewer.");
  }
  if (status !== "draft" && status !== "published") {
    fail(file + ' status must be "draft" or "published".');
  }
  if (slug === "sample-post" && status === "published") {
    fail(file + " is a layout test and must stay status: draft.");
  }
  const date = requireDate(data.date, file, "date");
  const updated = data.updated == null || cleanText(data.updated) === "" ? date : requireDate(data.updated, file, "updated");
  const image = cleanText(data.image);
  const imageAlt = cleanText(data.imageAlt);
  const reviewedBy = cleanText(data.reviewedBy);
  const reviewedOn = data.reviewedOn == null || cleanText(data.reviewedOn) === "" ? "" : requireDate(data.reviewedOn, file, "reviewedOn");
  const keyTakeaways = stringList(data.keyTakeaways, file, "keyTakeaways");
  const faq = normalizeFaq(data.faq, file);
  if (raw.includes("\u2014") || raw.includes("&mdash;") || raw.includes("&#8212;") || raw.includes("&#x2014;")) {
    warn(file + " contains an em dash. Use a comma, a period, or a hyphen.");
  }
  if (image && !imageAlt) warn(file + " has an image with no imageAlt.");
  if (status === "published" && !reviewedBy) warn(file + " is published with no reviewedBy.");
  const bodyImages = body.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
  bodyImages.forEach((token) => {
    const alt = token.slice(2, token.indexOf("]"));
    if (!alt.trim()) warn(file + " has an image with no alt text.");
  });
  let imageWidth = 0;
  let imageHeight = 0;
  let imageMissing = false;
  if (image) {
    const relative = image.replace(/^\//, "");
    const absolute = path.join(ROOT, relative);
    if (!fs.existsSync(absolute)) {
      imageMissing = true;
      warn(file + " image file was not found: " + image);
    } else {
      const size = imageSize(absolute);
      if (size) {
        imageWidth = size.width;
        imageHeight = size.height;
      }
    }
  }
  const pageTitle = documentTitle(title);
  if (pageTitle.length > 60) fail(file + " browser title is " + pageTitle.length + " characters. Keep it to about 60.");
  return {
    file,
    title,
    slug,
    description,
    date,
    updated,
    categories,
    category: categories[0].name,
    categorySlug: categories[0].slug,
    categorySlugs: categories.map((item) => item.slug),
    tags: stringList(data.tags, file, "tags"),
    image,
    imageAlt,
    imageWidth,
    imageHeight,
    imageMissing,
    status,
    reviewedBy,
    reviewedOn,
    keyTakeaways,
    faq,
    body: body.trim(),
    minutes: readingMinutes(body),
    pageTitle,
  };
}

function normalizeFaq(value, file) {
  if (value == null || value === "") return [];
  if (!Array.isArray(value)) fail(file + " faq must be a list of questions.");
  const items = [];
  value.forEach((item, index) => {
    const q = cleanText(item && item.q);
    const a = cleanText(item && item.a);
    if (!q && !a) return;
    if (!q || !a) fail(file + " faq item " + (index + 1) + " needs both a question and an answer.");
    items.push({ q, a });
  });
  return items;
}

function localizeUrl(url) {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  if (url === "/" || url === "/index.html") return "../index.html";
  if (url.startsWith("/blog/")) {
    const rest = url.slice("/blog/".length);
    return !rest || rest === "index.html" ? "index.html" : rest;
  }
  return ".." + url;
}

function renderBody(markdown) {
  const html = marked.parse(markdown, { gfm: true, breaks: false });
  if (typeof html !== "string") fail("Markdown could not be turned into HTML.");
  let next = html.replace(/<h1>/g, "<h2>").replace(/<\/h1>/g, "</h2>");
  next = next.replace(/\b(href|src)="([^"]+)"/g, (full, attr, value) => {
    const decoded = decode(value);
    const local = localizeUrl(decoded);
    if (local === decoded) return full;
    return attr + '="' + escapeHtml(local) + '"';
  });
  next = next.replace(/<a href="(https?:\/\/[^"]+)"/g, (full, href) => {
    if (full.includes("target=")) return full;
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer"';
  });
  next = next.replace(/<p><img ([^>]+)><\/p>/g, (full, attrs) => figureFromAttrs(attrs));
  const headings = [];
  const used = new Set();
  next = next.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (full, level, inner) => {
    const text = decode(inner.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const id = uniqueId(headingSlug(text), used);
    headings.push({ level: Number(level), id, text });
    return "<h" + level + ' id="' + id + '">' + inner + "</h" + level + ">";
  });
  next = next.replace(/<table>[\s\S]*?<\/table>/g, (table) => {
    const withScope = table.replace(/<thead>[\s\S]*?<\/thead>/g, (thead) => {
      return thead.replace(/<th>/g, '<th scope="col">');
    });
    return '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table">' + withScope + "</div>";
  });
  const splitAt = next.search(/<h2\b/);
  const intro = splitAt === -1 ? next.trim() : next.slice(0, splitAt).trim();
  const rest = splitAt === -1 ? "" : next.slice(splitAt).trim();
  return { intro, rest, headings };
}

function figureFromAttrs(attrs) {
  const map = {};
  attrs.replace(/([\w:-]+)="([^"]*)"/g, (full, key, value) => {
    map[key] = decode(value);
    return "";
  });
  const src = map.src || "";
  const alt = map.alt || "";
  const title = map.title || "";
  let dims = "";
  if (src.startsWith("../") || src.startsWith("images/")) {
    const relative = src.replace(/^\.\.\//, "");
    const size = imageSize(path.join(ROOT, relative));
    if (size) dims = ' width="' + size.width + '" height="' + size.height + '"';
  }
  const caption = title ? "<figcaption>" + escapeHtml(title) + "</figcaption>" : "";
  return (
    '<figure class="post-figure"><img src="' +
    escapeHtml(src) +
    '" alt="' +
    escapeHtml(alt) +
    '"' +
    dims +
    ' loading="lazy" decoding="async">' +
    caption +
    "</figure>"
  );
}

function tocHtml(headings) {
  const sections = [];
  headings.forEach((heading) => {
    if (heading.level === 2) sections.push({ ...heading, children: [] });
    else if (heading.level === 3 && sections.length) sections[sections.length - 1].children.push(heading);
  });
  if (sections.length < 3) return "";
  const items = sections
    .map((section) => {
      const children = section.children.length
        ? "<ol>" +
          section.children
            .map((child) => '<li><a href="#' + child.id + '">' + escapeHtml(child.text) + "</a></li>")
            .join("") +
          "</ol>"
        : "";
      return '<li><a href="#' + section.id + '">' + escapeHtml(section.text) + "</a>" + children + "</li>";
    })
    .join("");
  return (
    '<nav class="post-toc is-collapsed" aria-label="On this page">' +
    '<button type="button" class="post-toc-toggle" aria-expanded="false" aria-controls="post-toc-list">On this page</button>' +
    '<ol id="post-toc-list" class="post-toc-list">' +
    items +
    "</ol></nav>"
  );
}

function takeawaysHtml(items) {
  if (!items.length) return "";
  return (
    '<aside class="takeaways" aria-label="Key takeaways">' +
    '<p class="eyebrow">Key takeaways</p><ul>' +
    items.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") +
    "</ul></aside>"
  );
}

function faqHtml(items) {
  if (!items.length) return "";
  const blocks = items
    .map((item, index) => {
      const n = index + 1;
      return (
        '<div class="accordion-item"><h3><button type="button" class="accordion-trigger" aria-expanded="false" aria-controls="post-faq-panel-' +
        n +
        '" id="post-faq-btn-' +
        n +
        '">' +
        escapeHtml(item.q) +
        '<span class="accordion-icon" aria-hidden="true">+</span></button></h3>' +
        '<div class="accordion-panel" id="post-faq-panel-' +
        n +
        '" role="region" aria-labelledby="post-faq-btn-' +
        n +
        '" hidden><p>' +
        escapeHtml(item.a) +
        "</p></div></div>"
      );
    })
    .join("");
  return (
    '<section class="post-faq" aria-labelledby="post-faq-heading"><h2 id="post-faq-heading">Common questions</h2><div class="accordion">' +
    blocks +
    "</div></section>"
  );
}

function relatedPosts(post, posts) {
  const others = posts.filter((item) => item.slug !== post.slug);
  const same = others.filter((item) => item.category === post.category);
  const rest = others.filter((item) => item.category !== post.category);
  return same.concat(rest).slice(0, 3);
}

function cardHtml(post, options) {
  const media = !post.image || post.imageMissing
    ? '<span class="blog-card-fallback" aria-hidden="true"></span>'
    : '<img src="' +
      escapeHtml(options.img) +
      '" alt="' +
      escapeHtml(post.imageAlt) +
      '"' +
      (post.imageWidth ? ' width="' + post.imageWidth + '" height="' + post.imageHeight + '"' : "") +
      (options.eager ? ' fetchpriority="high"' : ' loading="lazy"') +
      ' decoding="async">';
  const titleId = "blog-card-" + post.slug + (options.idSuffix || "");
  return (
    '<article class="blog-card' +
    (options.featured ? " blog-card-feature" : "") +
    '" data-blog-card data-categories="' +
    escapeHtml(post.categorySlugs.join(" ")) +
    '"><a class="blog-card-link" href="' +
    escapeHtml(options.href) +
    '" aria-labelledby="' +
    titleId +
    '"><span class="blog-card-media">' +
    media +
    '</span><span class="blog-card-copy"><p class="blog-card-category">' +
    escapeHtml(post.category) +
    "</p><" +
    options.level +
    ' class="blog-card-title" id="' +
    titleId +
    '">' +
    escapeHtml(post.title) +
    "</" +
    options.level +
    '><p class="blog-card-excerpt">' +
    escapeHtml(post.description) +
    '</p><p class="blog-card-meta"><time datetime="' +
    post.date +
    '">' +
    escapeHtml(formatDate(post.date)) +
    '</time><span aria-hidden="true"> · </span><span>' +
    post.minutes +
    " min read</span></p></span></a></article>"
  );
}

function cardOptions(post, where, level, featured) {
  const inBlog = where !== "home";
  return {
    href: (inBlog ? "" : "blog/") + post.slug + ".html",
    img: post.image ? (inBlog ? "../" : "") + post.image.replace(/^\//, "") : "",
    level,
    featured: !!featured,
    eager: !!featured,
    idSuffix: where === "home" ? "-home" : where === "related" ? "-related" : "",
  };
}

function jsonScript(data) {
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return '<script type="application/ld+json">\n' + json + "\n</script>";
}

function absoluteImage(post) {
  if (post.image && !post.imageMissing) return SITE + (post.image.startsWith("/") ? post.image : "/" + post.image);
  return SITE + PORTRAIT;
}

function articleJson(post) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: absoluteImage(post),
    datePublished: post.date,
    dateModified: post.updated,
    articleSection: post.category,
    inLanguage: "en-CA",
    author: {
      "@type": "Person",
      name: "Sanjeev Kumar",
      url: SITE + "/about.html",
    },
    publisher: {
      "@type": "Organization",
      name: "Sanjeev Kumar",
      url: SITE + "/",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": SITE + "/blog/" + post.slug + ".html",
    },
  };
}

function breadcrumbJson(post) {
  const url = SITE + "/blog/" + post.slug + ".html";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: SITE + "/blog/" },
      {
        "@type": "ListItem",
        position: 3,
        name: post.category,
        item: SITE + "/blog/?category=" + post.categorySlug,
      },
      { "@type": "ListItem", position: 4, name: post.title, item: url },
    ],
  };
}

function faqJson(post) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function collectionJson(posts) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: INDEX_H1,
    description: INDEX_DESCRIPTION,
    url: SITE + "/blog/",
    inLanguage: "en-CA",
  };
  if (posts.length) {
    data.mainEntity = {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.title,
        url: SITE + "/blog/" + post.slug + ".html",
      })),
    };
  }
  return data;
}

function headHtml(options) {
  const image = options.image || SITE + PORTRAIT;
  const robots = options.robots ? '    <meta name="robots" content="' + options.robots + '" />\n' : "";
  const articleTimes = options.article
    ? '    <meta property="article:published_time" content="' +
      options.article.published +
      '" />\n    <meta property="article:modified_time" content="' +
      options.article.modified +
      '" />\n'
    : "";
  const preload = options.preload
    ? '    <link rel="preload" as="image" href="' + escapeHtml(options.preload) + '" />\n'
    : "";
  return (
    "    <meta charset=\"UTF-8\" />\n" +
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    "    <title>" +
    escapeHtml(options.title) +
    "</title>\n" +
    '    <meta name="description" content="' +
    escapeHtml(options.description) +
    '" />\n' +
    robots +
    '    <link rel="canonical" href="' +
    escapeHtml(options.canonical) +
    '" />\n' +
    '    <link rel="alternate" type="application/rss+xml" title="Sanjeev Kumar Blog" href="' +
    SITE +
    '/blog/rss.xml" />\n' +
    '    <meta property="og:title" content="' +
    escapeHtml(options.title) +
    '" />\n' +
    '    <meta property="og:description" content="' +
    escapeHtml(options.description) +
    '" />\n' +
    '    <meta property="og:url" content="' +
    escapeHtml(options.canonical) +
    '" />\n' +
    '    <meta property="og:type" content="' +
    options.type +
    '" />\n' +
    '    <meta property="og:image" content="' +
    escapeHtml(image) +
    '" />\n' +
    articleTimes +
    '    <meta name="twitter:card" content="summary_large_image" />\n' +
    '    <meta name="twitter:url" content="' +
    escapeHtml(options.canonical) +
    '" />\n' +
    '    <meta name="twitter:title" content="' +
    escapeHtml(options.title) +
    '" />\n' +
    '    <meta name="twitter:description" content="' +
    escapeHtml(options.description) +
    '" />\n' +
    '    <meta name="twitter:image" content="' +
    escapeHtml(image) +
    '" />\n' +
    options.json.map((block) => "    " + jsonScript(block).replace(/\n/g, "\n    ")).join("\n") +
    "\n" +
    preload +
    '    <link rel="icon" type="image/svg+xml" href="../favicon.svg" />\n' +
    '    <link rel="icon" type="image/x-icon" href="../favicon.ico" />\n' +
    '    <link rel="apple-touch-icon" href="../apple-touch-icon.png" />\n' +
    '    <link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
    '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
    '    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,900;1,500;1,600;1,700&display=swap" rel="stylesheet" />\n' +
    '    <link rel="stylesheet" href="../styles.css" />'
  );
}

function headerHtml() {
  return `    <a class="skip-link" href="#main">Skip to main content</a>
    <div class="reading-progress" id="reading-progress" aria-hidden="true"></div>
    <header class="site-header is-simple" id="top">
      <div class="header-inner">
        <a class="brand" href="../index.html">
          <span class="brand-name">SANJEEV KUMAR</span>
          <span class="brand-tag">Personal Trainer • South Surrey</span>
        </a>
        <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="primary-nav">
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
        </button>
        <nav class="primary-nav" id="primary-nav" aria-label="Primary">
          <ul class="nav-list nav-primary">
            <li><a href="../index.html">Home</a></li>
            <li><a href="../about.html">About Us</a></li>
            <!-- BLOG:NAV:START -->
            <!-- BLOG:NAV:END -->
          </ul>
          <a class="btn btn-primary header-cta" href="../book.html">Book a Consultation</a>
        </nav>
      </div>
    </header>`;
}

function footerHtml() {
  return `    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <p class="brand-name footer-brand">SANJEEV KUMAR</p>
          <p class="footer-place">Personal Trainer - South Surrey</p>
          <p class="footer-tagline">Guidance for longevity, mobility and endurance.</p>
        </div>
        <div>
          <p class="footer-heading">Explore</p>
          <ul>
            <li><a href="../index.html">Home</a></li>
            <li><a href="../about.html">About Sanjeev Kumar</a></li>
            <!-- BLOG:FOOTER:START -->
            <!-- BLOG:FOOTER:END -->
            <li><a href="../book.html">Book a Consultation</a></li>
            <li><a href="../index.html#packages">In-person training in South Surrey</a></li>
            <li><a href="../index.html#transformations">Real Results</a></li>
            <li><a href="../index.html#testimonials">Social Proof</a></li>
            <li><a href="../about.html#approach">The Sanjeev Method</a></li>
            <li><a href="../index.html#faq">FAQ</a></li>
            <li><a href="../index.html#guidance">Personalized Guidance</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-heading">Contact</p>
          <ul>
            <li><a href="mailto:getfitwithsk007@gmail.com">getfitwithsk007@gmail.com</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-heading">Follow</p>
          <ul class="social-list">
            <li>
              <a href="https://www.linkedin.com/in/sanjeev-kumar-0387b6207" aria-label="Sanjeev Kumar on LinkedIn" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M8 10v7M8 7.5v.01M12 17v-4.5a2.5 2.5 0 0 1 5 0V17" />
                </svg>
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/_sam.001___?stkn=NXowMmVoNnc1Nndo" aria-label="Sanjeev Kumar on Instagram" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container">
          <p>Fitness and nutrition information provided on this website is for educational purposes only and does not constitute medical advice. Individual results vary.</p>
          <p>© 2026 GetFitWithSanjeev. All rights reserved.</p>
        </div>
      </div>
    </footer>
    <script src="../script.js"></script>`;
}

function renderPost(post, posts) {
  const rendered = renderBody(post.body);
  const toc = tocHtml(rendered.headings);
  const related = relatedPosts(post, posts);
  const url = SITE + "/blog/" + post.slug + ".html";
  const hero = post.image && !post.imageMissing
    ? '<figure class="post-hero"><img src="' +
      escapeHtml("../" + post.image.replace(/^\//, "")) +
      '" alt="' +
      escapeHtml(post.imageAlt) +
      '"' +
      (post.imageWidth ? ' width="' + post.imageWidth + '" height="' + post.imageHeight + '"' : "") +
      ' fetchpriority="high" decoding="async"></figure>'
    : "";
  const updated = post.updated !== post.date
    ? '<li>Updated <time datetime="' + post.updated + '">' + escapeHtml(formatDate(post.updated)) + "</time></li>"
    : "";
  const reviewed = post.reviewedBy
    ? "<li>Reviewed by " +
      escapeHtml(post.reviewedBy) +
      (post.reviewedOn ? ' on <time datetime="' + post.reviewedOn + '">' + escapeHtml(formatDate(post.reviewedOn)) + "</time>" : "") +
      "</li>"
    : "";
  const draft = post.status === "draft"
    ? '<p class="draft-banner" role="note">Draft preview. This page is a layout test and is not published.</p>'
    : "";
  const relatedHtml = related.length
    ? '<section class="post-related" aria-labelledby="post-related-heading"><h2 id="post-related-heading">Keep reading</h2><div class="blog-card-grid">' +
      related.map((item) => cardHtml(item, cardOptions(item, "related", "h3", false))).join("") +
      "</div></section>"
    : "";
  const json = [articleJson(post), breadcrumbJson(post)];
  if (post.faq.length) json.push(faqJson(post));
  const bodyHtml = [rendered.intro, rendered.rest].filter(Boolean).join("\n");
  const articleBody = bodyHtml
    ? '<div class="article-body">' + bodyHtml.replace(/<p>/, '<p class="post-lead">') + "</div>"
    : "";
  const html = `<!DOCTYPE html>
<html lang="en-CA" class="page-blog">
  <head>
${headHtml({
  title: post.pageTitle,
  description: post.description,
  canonical: url,
  type: "article",
  image: absoluteImage(post),
  article: { published: post.date, modified: post.updated },
  preload: hero ? "../" + post.image.replace(/^\//, "") : "",
  json,
})}
  </head>
  <body class="blog-post">
${headerHtml()}
    <main id="main">
      <article class="post-article${toc ? " has-toc" : ""}">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><a href="../index.html">Home</a></li>
            <li><a href="index.html">Blog</a></li>
            <li><a href="index.html?category=${encodeURIComponent(post.categorySlug)}">${escapeHtml(post.category)}</a></li>
            <li aria-current="page">${escapeHtml(post.title)}</li>
          </ol>
        </nav>
        <header class="post-header">
          <h1>${escapeHtml(post.title)}</h1>
          <p class="post-category"><a href="index.html?category=${encodeURIComponent(post.categorySlug)}">${escapeHtml(post.category)}</a></p>
          <p class="post-byline"><a href="../about.html">By Sanjeev Kumar, Level 3 Personal Trainer</a></p>
          <ul class="post-meta">
            <li><time datetime="${post.date}">${escapeHtml(formatDate(post.date))}</time></li>
            ${updated}
            <li>${post.minutes} min read</li>
            ${reviewed}
          </ul>
        </header>
        ${draft}
        ${toc}
        ${hero}
        ${takeawaysHtml(post.keyTakeaways)}
        ${articleBody}
        ${faqHtml(post.faq)}
        <aside class="post-cta" aria-labelledby="post-cta-heading">
          <h2 id="post-cta-heading">Want guidance built around you?</h2>
          <p>Tell Sanjeev where you are today and what you want to understand.</p>
          <div class="post-cta-actions">
            <a class="btn btn-primary" href="../book.html">Book a Consultation</a>
            <a class="btn btn-outline" href="../index.html#guidance">Ask a Question</a>
          </div>
        </aside>
        ${relatedHtml}
        <p class="post-disclaimer">${DISCLAIMER}</p>
      </article>
    </main>
${footerHtml()}
  </body>
</html>
`;
  assertPost(html, post);
  return html;
}

function categoryCounts(posts) {
  const counts = new Map();
  posts.forEach((post) => {
    post.categories.forEach((category) => {
      counts.set(category.slug, (counts.get(category.slug) || 0) + 1);
    });
  });
  return counts;
}

function articleCountLabel(count) {
  return count + (count === 1 ? " article" : " articles");
}

function renderIndex(posts, publishedCount) {
  const counts = categoryCounts(posts);
  const options = CATEGORIES.filter((category) => counts.has(category.slug))
    .map((category) => {
      const count = counts.get(category.slug);
      return (
        '<option value="' +
        escapeHtml(category.slug) +
        '">' +
        escapeHtml(category.name) +
        " (" +
        count +
        ")</option>"
      );
    })
    .join("");
  const filters = posts.length
    ? '<div class="blog-filter-bar">' +
      '<div class="blog-filter-field">' +
      '<label class="blog-filter-label" for="blog-category">Filter by category</label>' +
      '<div class="blog-select-wrap">' +
      '<select id="blog-category" name="category">' +
      '<option value="" selected>All categories</option>' +
      options +
      "</select></div></div>" +
      '<p class="blog-count">' +
      articleCountLabel(posts.length) +
      "</p></div>"
    : "";
  const grid = posts.length
    ? '<div class="blog-card-grid" id="blog-card-grid">' +
      posts.map((post, index) => cardHtml(post, cardOptions(post, "blog", "h2", index === 0))).join("") +
      "</div>"
    : "";
  const filterEmpty = posts.length
    ? '<p class="blog-filter-empty" hidden>No articles in this category yet. Choose another category, or view all articles.</p>'
    : "";
  const empty = posts.length
    ? ""
    : `<div class="blog-empty">
          <h2>First articles are coming soon</h2>
          <p>Sanjeev is writing plain-language guidance on longevity, mobility and endurance. You can book a conversation or ask a question in the meantime.</p>
          <div class="blog-empty-actions">
            <a class="btn btn-primary" href="../book.html">Book a Consultation</a>
            <a class="btn btn-outline" href="../index.html#guidance">Ask a Question</a>
          </div>
        </div>`;
  const html = `<!DOCTYPE html>
<html lang="en-CA" class="page-blog">
  <head>
${headHtml({
  title: INDEX_TITLE,
  description: INDEX_DESCRIPTION,
  canonical: SITE + "/blog/",
  type: "website",
  robots: publishedCount === 0 ? "noindex" : "",
  preload: posts[0] && posts[0].image && !posts[0].imageMissing ? "../" + posts[0].image.replace(/^\//, "") : "",
  json: [collectionJson(posts)],
})}
  </head>
  <body class="blog-index">
${headerHtml().replace('    <div class="reading-progress" id="reading-progress" aria-hidden="true"></div>\n', "")}
    <main id="main">
      <section class="section section-cream blog-index" aria-labelledby="blog-heading">
        <div class="container">
          <header class="section-intro">
            <p class="eyebrow">The Blog</p>
            <h1 id="blog-heading">${INDEX_H1}</h1>
            <p>${INDEX_INTRO}</p>
          </header>
          ${[filters, grid, filterEmpty, empty].filter(Boolean).join("\n          ")}
        </div>
      </section>
    </main>
${footerHtml()}
  </body>
</html>
`;
  assertIndex(html, posts, publishedCount);
  return html;
}

function walkJson(value) {
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach((key) => {
    if (BANNED_JSON_KEYS.has(key)) fail("JSON-LD includes " + key + ", which this site does not publish.");
    walkJson(value[key]);
  });
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      fail("A JSON-LD block is not valid JSON. " + error.message);
    }
  }
  if (!blocks.length) fail("A generated page is missing JSON-LD.");
  blocks.forEach(walkJson);
  return blocks;
}

function assertPost(html, post) {
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) fail(post.file + " must have exactly one h1.");
  if (!html.includes(DISCLAIMER)) fail(post.file + " is missing the medical disclaimer.");
  if (!html.includes("Want guidance built around you?")) fail(post.file + " is missing the consultation card.");
  post.keyTakeaways.forEach((item) => {
    if (!html.includes(escapeHtml(item))) fail(post.file + " is missing a key takeaway on the page.");
  });
  const blocks = extractJsonLd(html);
  const article = blocks.find((block) => block["@type"] === "Article");
  const crumbs = blocks.find((block) => block["@type"] === "BreadcrumbList");
  if (!article) fail(post.file + " is missing Article JSON-LD.");
  if (article.headline !== post.title || article.description !== post.description) {
    fail(post.file + " Article JSON-LD does not match the page title or description.");
  }
  if (article.datePublished !== post.date || article.dateModified !== post.updated) {
    fail(post.file + " Article dates do not match the front matter.");
  }
  if (article.articleSection !== post.category) {
    fail(post.file + " Article articleSection must be the primary category.");
  }
  if (!article.author || article.author.name !== "Sanjeev Kumar" || article.author.url !== SITE + "/about.html") {
    fail(post.file + " Article author must be Sanjeev Kumar with a link to About.");
  }
  const crumbItems = crumbs && crumbs.itemListElement;
  if (!crumbItems || crumbItems.length !== 4) {
    fail(post.file + " BreadcrumbList must list Home, Blog, the primary category and the article.");
  }
  if (
    crumbItems[0].name !== "Home" ||
    crumbItems[1].name !== "Blog" ||
    crumbItems[2].name !== post.category ||
    crumbItems[3].name !== post.title
  ) {
    fail(post.file + " BreadcrumbList must list Home, Blog, the primary category and the article.");
  }
  if (post.faq.length) {
    const faq = blocks.find((block) => block["@type"] === "FAQPage");
    if (!faq || !faq.mainEntity || faq.mainEntity.length !== post.faq.length) {
      fail(post.file + " is missing FAQPage JSON-LD.");
    }
    post.faq.forEach((item, index) => {
      const entity = faq.mainEntity[index];
      if (!entity || entity.name !== item.q || !entity.acceptedAnswer || entity.acceptedAnswer.text !== item.a) {
        fail(post.file + " FAQ JSON-LD does not match the visible question text.");
      }
      if (!html.includes(escapeHtml(item.q)) || !html.includes(escapeHtml(item.a))) {
        fail(post.file + " is missing a visible FAQ question or answer.");
      }
    });
  } else if (blocks.some((block) => block["@type"] === "FAQPage")) {
    fail(post.file + " has FAQ JSON-LD without visible questions.");
  }
}

function assertIndex(html, posts, publishedCount) {
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1 || !html.includes(INDEX_H1)) fail("The blog index must have one h1: " + INDEX_H1);
  if (publishedCount === 0 && !html.includes('content="noindex"')) {
    fail("The blog index must be noindex while nothing is published.");
  }
  if (publishedCount > 0 && html.includes('content="noindex"')) {
    fail("The blog index must be indexable once a post is published.");
  }
  if (!posts.length && !html.includes("First articles are coming soon")) {
    fail("The blog index is missing the empty state.");
  }
  if (posts.length && !html.includes('<option value="" selected>All categories</option>')) {
    fail("The blog index filter must default to All categories.");
  }
  posts.forEach((post) => {
    if (!html.includes(escapeHtml(post.title))) fail("The blog index is missing " + post.title + ".");
  });
  const blocks = extractJsonLd(html);
  const collection = blocks.find((block) => block["@type"] === "CollectionPage");
  if (!collection || collection.name !== INDEX_H1) fail("The blog index is missing CollectionPage JSON-LD.");
  const items = collection.mainEntity && collection.mainEntity.itemListElement ? collection.mainEntity.itemListElement : [];
  if (items.length !== posts.length) fail("CollectionPage ItemList does not match the posts on the page.");
}

function renderRss(posts) {
  const items = posts
    .map((post) => {
      const url = SITE + "/blog/" + post.slug + ".html";
      const categories = post.categories
        .map((category) => "      <category>" + escapeXml(category.name) + "</category>\n")
        .join("");
      return (
        "    <item>\n" +
        "      <title>" + escapeXml(post.title) + "</title>\n" +
        "      <link>" + escapeXml(url) + "</link>\n" +
        "      <description>" + escapeXml(post.description) + "</description>\n" +
        "      <pubDate>" + rssDate(post.date) + "</pubDate>\n" +
        categories +
        '      <guid isPermaLink="true">' + escapeXml(url) + "</guid>\n" +
        "    </item>"
      );
    })
    .join("\n");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    "  <channel>\n" +
    "    <title>" + escapeXml(INDEX_H1) + "</title>\n" +
    "    <link>" + SITE + "/blog/</link>\n" +
    "    <description>" + escapeXml(INDEX_DESCRIPTION) + "</description>\n" +
    "    <language>en-ca</language>\n" +
    items +
    (items ? "\n" : "") +
    "  </channel>\n" +
    "</rss>\n"
  );
}

function replaceBlock(source, start, end, inner, fileLabel) {
  const pattern = new RegExp("([ \\t]*)" + escapeReg(start) + "[\\s\\S]*?" + escapeReg(end));
  const match = pattern.exec(source);
  if (!match) fail((fileLabel || "A file") + " is missing " + start + ".");
  const indent = match[1];
  const trimmed = String(inner || "").replace(/^\n+/, "").replace(/\n+$/, "");
  const lines = trimmed
    ? trimmed
        .split("\n")
        .map((line) => (line ? indent + line : ""))
        .join("\n")
    : "";
  const block = trimmed ? indent + start + "\n" + lines + "\n" + indent + end : indent + start + "\n" + indent + end;
  return source.replace(pattern, () => block);
}

function latestSection(posts) {
  if (!posts.length) return "";
  const cards = posts
    .slice(0, 3)
    .map((post) => cardHtml(post, cardOptions(post, "home", "h3", false)))
    .join("\n");
  return [
    '<section class="section section-white" id="latest" aria-labelledby="latest-heading">',
    '  <div class="container">',
    '    <header class="section-intro">',
    '      <p class="eyebrow">From the Blog</p>',
    '      <h2 id="latest-heading">Free Guidance You Can Read Today</h2>',
    "      <p>Short articles on strength, mobility and training for real life, written by Sanjeev Kumar.</p>",
    "    </header>",
    '    <div class="blog-card-grid">',
    cards
      .split("\n")
      .map((line) => "      " + line)
      .join("\n"),
    "    </div>",
    '    <p class="blog-latest-more"><a class="btn btn-outline" href="blog/index.html">Read all articles</a></p>',
    "  </div>",
    "</section>",
  ].join("\n");
}

function navInner(kind, posts) {
  if (!posts.length) return "";
  if (kind === "blog-index") return '<li><a href="index.html" aria-current="page">Blog</a></li>';
  if (kind === "blog-post") return '<li><a href="index.html">Blog</a></li>';
  return '<li><a href="blog/index.html">Blog</a></li>';
}

function footerInner(kind, posts) {
  if (!posts.length) return "";
  if (kind === "blog-index") return '<li><a href="index.html" aria-current="page">Blog</a></li>';
  if (kind === "blog-post") return '<li><a href="index.html">Blog</a></li>';
  return '<li><a href="blog/index.html">Blog</a></li>';
}

function applyMarkers(filePath, kind, posts) {
  let html = fs.readFileSync(filePath, "utf8");
  const label = path.relative(ROOT, filePath);
  if (html.includes("<!-- BLOG:NAV:START -->")) {
    html = replaceBlock(html, "<!-- BLOG:NAV:START -->", "<!-- BLOG:NAV:END -->", navInner(kind, posts), label);
  }
  if (html.includes("<!-- BLOG:FOOTER:START -->")) {
    html = replaceBlock(html, "<!-- BLOG:FOOTER:START -->", "<!-- BLOG:FOOTER:END -->", footerInner(kind, posts), label);
  }
  if (kind === "home") {
    html = replaceBlock(
      html,
      "<!-- BLOG:PAGE-NAV:START -->",
      "<!-- BLOG:PAGE-NAV:END -->",
      posts.length ? '<li><a href="#latest">Latest Guidance</a></li>' : "",
      label
    );
    html = replaceBlock(html, "<!-- BLOG:LATEST:START -->", "<!-- BLOG:LATEST:END -->", latestSection(posts), label);
  }
  fs.writeFileSync(filePath, html);
}

function assertSourceMarkers() {
  const required = {
    "index.html": [
      "<!-- BLOG:NAV:START -->",
      "<!-- BLOG:NAV:END -->",
      "<!-- BLOG:FOOTER:START -->",
      "<!-- BLOG:FOOTER:END -->",
      "<!-- BLOG:PAGE-NAV:START -->",
      "<!-- BLOG:PAGE-NAV:END -->",
      "<!-- BLOG:LATEST:START -->",
      "<!-- BLOG:LATEST:END -->",
    ],
    "about.html": ["<!-- BLOG:NAV:START -->", "<!-- BLOG:NAV:END -->", "<!-- BLOG:FOOTER:START -->", "<!-- BLOG:FOOTER:END -->"],
    "book.html": ["<!-- BLOG:NAV:START -->", "<!-- BLOG:NAV:END -->", "<!-- BLOG:FOOTER:START -->", "<!-- BLOG:FOOTER:END -->"],
  };
  Object.keys(required).forEach((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    required[file].forEach((marker) => {
      if (!text.includes(marker)) fail(file + " is missing " + marker + ".");
    });
  });
}

function updateLlms(posts) {
  const filePath = path.join(ROOT, "llms.txt");
  let text = fs.readFileSync(filePath, "utf8");
  if (!text.includes("<!-- BLOG:START -->") || !text.includes("<!-- BLOG:END -->")) {
    if (!text.endsWith("\n")) text += "\n";
    text += "\n<!-- BLOG:START -->\n<!-- BLOG:END -->\n";
  }
  const lines = posts
    .map((post) => post.title + " - " + SITE + "/blog/" + post.slug + ".html - " + post.description.replace(/\s+/g, " "))
    .join("\n");
  text = replaceBlock(text, "<!-- BLOG:START -->", "<!-- BLOG:END -->", lines, "llms.txt");
  if (!text.endsWith("\n")) text += "\n";
  fs.writeFileSync(filePath, text);
}

function updateSitemap(posts) {
  const filePath = path.join(ROOT, "sitemap.xml");
  const xml = fs.readFileSync(filePath, "utf8");
  const dates = {
    [SITE + "/"]: "2026-11-02",
    [SITE + "/about.html"]: "2026-11-02",
    [SITE + "/book.html"]: "2026-11-03",
  };
  const found = /<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
  let match;
  while ((match = found.exec(xml))) {
    if (Object.prototype.hasOwnProperty.call(dates, match[1])) dates[match[1]] = match[2];
  }
  const urls = [
    { loc: SITE + "/", lastmod: dates[SITE + "/"] },
    { loc: SITE + "/about.html", lastmod: dates[SITE + "/about.html"] },
    { loc: SITE + "/book.html", lastmod: dates[SITE + "/book.html"] },
  ];
  if (posts.length) {
    const latest = posts.map((post) => post.updated).sort().pop();
    urls.push({ loc: SITE + "/blog/", lastmod: latest });
    posts.forEach((post) => {
      urls.push({ loc: SITE + "/blog/" + post.slug + ".html", lastmod: post.updated });
    });
  }
  const body = urls
    .map((url) => "  <url>\n    <loc>" + escapeXml(url.loc) + "</loc>\n    <lastmod>" + url.lastmod + "</lastmod>\n  </url>")
    .join("\n");
  fs.writeFileSync(
    filePath,
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n"
  );
}

function writeOutputs(live, published) {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  live.forEach((post) => {
    fs.writeFileSync(path.join(BLOG_DIR, post.slug + ".html"), renderPost(post, live));
  });
  fs.writeFileSync(path.join(BLOG_DIR, "index.html"), renderIndex(live, published.length));
  fs.writeFileSync(path.join(BLOG_DIR, "rss.xml"), renderRss(live));
  const keep = new Set(["index.html"].concat(live.map((post) => post.slug + ".html")));
  fs.readdirSync(BLOG_DIR).forEach((name) => {
    if (name.endsWith(".html") && !keep.has(name)) fs.unlinkSync(path.join(BLOG_DIR, name));
  });
  applyMarkers(path.join(ROOT, "index.html"), "home", live);
  applyMarkers(path.join(ROOT, "about.html"), "about", live);
  applyMarkers(path.join(ROOT, "book.html"), "book", live);
  applyMarkers(path.join(BLOG_DIR, "index.html"), "blog-index", live);
  live.forEach((post) => applyMarkers(path.join(BLOG_DIR, post.slug + ".html"), "blog-post", live));
  updateLlms(published);
  updateSitemap(published);
}

function summary(publishedCount, draftCount) {
  const draftLabel = draftCount === 1 ? "draft" : "drafts";
  const draftVerb = INCLUDE_DRAFTS ? "included" : "skipped";
  const warningLabel = warnings.length === 1 ? "warning" : "warnings";
  if (INCLUDE_DRAFTS) {
    console.log("Draft preview only. Run npm run build:blog again before you commit.");
  }
  console.log(publishedCount + " published, " + draftCount + " " + draftLabel + " " + draftVerb + ", " + warnings.length + " " + warningLabel);
}

function main() {
  assertSourceMarkers();
  loadCategories();
  const posts = loadPosts();
  const published = posts.filter((post) => post.status === "published");
  const drafts = posts.filter((post) => post.status === "draft");
  const live = INCLUDE_DRAFTS ? posts : published;
  writeOutputs(live, published);
  summary(published.length, drafts.length);
}

main();
