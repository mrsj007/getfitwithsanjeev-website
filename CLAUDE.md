# CLAUDE.md - getfitwithsanjeev.com

Website for Sanjeev Kumar, personal trainer in South Surrey and Vancouver, BC. Static site (plain HTML, CSS and vanilla JS) deployed by Vercel from GitHub `mrsj007/getfitwithsanjeev-website`, branch `main`. The person you work with does not code: explain results in plain words, show exact command output, and stop and explain any error instead of working around it.

## Git rules

- Never force-push. Never push to `main` without being asked. Merge only with `git merge --ff-only`; if that fails, merge `origin/main` into the branch and try again.

- Small, low-risk text or link fixes may go straight to `main` once every check passes. Anything visual or bigger goes on a preview branch (for example `name-preview`), pushed alone, approved, then fast-forwarded to `main`.

- Always `git fetch`, `git pull` and confirm a clean `git status` before starting. Show `git diff --stat` before merging and `git log origin/main -3` after.

- Never commit QA files (`.tmp-qa/`, screenshots, Lighthouse reports) or anything from `private-client-photos/`. Keep them out of the repo (they are gitignored).

## Build (there is no build step on Vercel; build locally and commit the output)

- `npm run build:site` = assets, images, then blog. Also `build:assets`, `build:images`, `build:blog`. Run the full build twice before committing: the second run must change nothing.

- Never hand-edit generated files (`styles.min.css`, `script.min.js`, `bmi-calculator.min.*`, `blog/*.html`, `sitemap.xml`, `llms.txt`, `blog/rss.xml`, `images/manifest.json`). Edit sources and templates (`styles.css`, `script.js`, `scripts/build-blog.js`, `content/`) and rebuild.

- Some root pages are partly generated. `build:blog` rewrites the marked blog link and section blocks in `index.html`, `about.html`, `book.html`, `feedback.html`, `bmi-calculator.html`, `privacy.html` and `terms.html` (and the shared nav/footer blocks on all pages). `build:images` rewrites every `<picture>` tag in `index.html` and `about.html`. Hand edits inside those parts are overwritten on the next build: change the template or script instead.

- Lighthouse: use `node scripts/serve-brotli.mjs` (compresses like Vercel). A plain `python3 -m http.server` gives misleadingly low scores. Targets on mobile: 95+ performance, 100 accessibility, best practices and SEO.

## Content and style

- Plain hyphen " - " for dashes, never em dashes. Canadian spelling (colour, fibre, labour, but "-ize" spellings are fine; avoid British "-ise"). Search for both before committing.

- Header tagline is "Personal Trainer • Vancouver and South Surrey" with a bullet. Keep the bullet. Business address: 1715 152 St #120, Surrey, BC V4A 4N3, Canada (use the full text with postal code and "Canada" everywhere). Contact email: getfitwithsk007@gmail.com.

- Health wording: no cure, treat, heal, prescribe, dosage, dose, stop taking, guaranteed, detox or "replace your medication" (the blog build warns on these, see `scripts/build-blog.js`; keep it at 0 warnings). Never diagnose; add "talk to your doctor" where fitting. The BMI calculator is a screening number only.

- The site and every form are for adults aged 18 or older.

- Blog posts live in `content/blog/*.md` with the front matter described in `scripts/build-blog.js` and categories in `content/blog/categories.json` ("Group > Topic" format). Publish only after Sanjeev has reviewed. Do not change post text unless asked.

- BMI copy is in `content/bmi/guidance.json` and `content/bmi/related.json`. Keep `reviewed: false` until Sanjeev approves (this hides the "Reviewed by Sanjeev" badge).

## Images and privacy

- Replaced or changed images need NEW file names: `/images` and `/fonts` are cached for a year (`immutable`). Run `npm run build:images` for responsive WebP/AVIF/JPEG variants, and use `<picture>` with width, height, `loading="lazy"` and `decoding="async"` (only the single LCP image gets `fetchpriority="high"`, on its `<img>` and its matching preload link).

- Every image is local (never hotlinked), has EXIF stripped, and an entry in `images/CREDITS.md` with source, page URL, photographer and licence. No visible logos, brand names, signage, watermarks or text in stock photos; crop them out or pick another photo.

- Client photos: faces are blurred inside the image file, never with CSS. Unblurred originals stay only in the gitignored `private-client-photos/`. Responsive variants are made only from the committed, already-blurred files. Publish client photos, quotes and stories only with written consent.

## Forms, privacy and third parties

- All forms post to the same Formspree address (`https://formspree.io/f/maeywvbo`): the feedback form (`FEEDBACK_FORM_ENDPOINT` in `script.js`), the BMI form (its own constant in `bmi-calculator.js`) and the Home and About contact forms (the URL in the form tag). Every form must have a honeypot and a minimum-time check. The free plan allows about 50 submissions a month for all forms together, so spam wastes real leads. `feedback.html` is `noindex` and stays out of the sitemap.

- No analytics, tracking pixels or cookies. (`book.html` has an unused `gtag` hook that does nothing without a Google Analytics script; do not add one without updating `privacy.html`.) If any are ever added, update `privacy.html` first. Fonts are self-hosted (no Google Fonts). Booking uses the Cal.com embed.

- BMI calculator: numbers stay in the browser, kept only in `sessionStorage` (`bmiSession`) for the tab; nothing about age, height or weight goes in cookies, the URL or any request except a deliberate, consented "share my results" form submit. Under-18 entries are never saved.

- `privacy.html` and `terms.html` must match what the site really does. Update both (and the "Last updated" date) whenever data collection, storage or third parties change.

## Design and accessibility

- Keep the existing design tokens, fonts and components. Do not redesign unasked.

- Colour contrast at least 4.5:1 for text (measure it, including text over photos); visible keyboard focus; 44px touch targets; no layout shift; respect `prefers-reduced-motion`.

- Links on dark sections use the reusable `.on-dark` style (cream, underlined).

- After visual changes, check at 375, 768, 1024 and 1440px and report what changed.

## Before saying "done"

Show: command output, files changed, the checks you ran, `git log origin/main -3`, and (after a deploy) the live URL status codes. Say plainly what you could not verify.
