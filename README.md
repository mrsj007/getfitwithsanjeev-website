# Sanjeev Kumar - Personal Trainer Website

Three-page site for Sanjeev Kumar, a Level 3 personal trainer in Vancouver and South Surrey. Free fitness guidance stays on the site, alongside in-person training packages (the main offer) and online consultations. Built with plain HTML, CSS, and vanilla JavaScript so it can be hosted on Netlify, Vercel, GitHub Pages, or any static host.

## Pages

- `index.html` - home: free guidance, client transformations, training packages, testimonials, FAQ, and the contact form
- `about.html` - Sanjeev's story, certifications, method, specialized knowledge, FAQ, and the same contact form
- `book.html` - booking page with a Cal.com calendar embed

Every "Book a Consultation" and "Book an Online Consultation" button links to `book.html`.

## Cal.com booking link

The profile username lives in one place, at the top of the script in `book.html`:

```javascript
const CAL_LINK = "sanjeev-kumar-rge18l"; // TODO: once event slugs are known, this can point to a single event (e.g. "username/consultation").
```

That value drives the inline calendar and the "Open the booking calendar in a new tab" button. The page's JSON-LD `ReserveAction` also points at `https://cal.com/sanjeev-kumar-rge18l`. If the username changes, update `CAL_LINK` and that JSON-LD URL together.

The public profile currently offers a 15 min meeting and a 30 min meeting. The hint above the calendar uses those names.

## Preview locally

```bash
# Simple static server (recommended so images and routing behave consistently)
npx serve
```

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:3000` (`serve`) or `http://localhost:8080` (Python).

Files:

- `index.html` - home page
- `about.html` - about page
- `book.html` - booking page
- `styles.css` - design tokens, layout, responsive rules
- `script.js` - mobile nav, FAQ accordion, Formspree submit
- `images/sanjeev-kumar.jpg` - portrait used on the about page and in social cards

## Contact form (Formspree)

The home and about pages post the same form to [Formspree](https://formspree.io/f/maeywvbo), which delivers messages to **getfitwithsk007@gmail.com**. People can ask for free guidance or send a message to find a time to talk about training. After a successful send, the form shows "Thanks, I'll be in touch." The booking page links back to that form and does not replace it.

Serve the site over HTTP (for example `npx serve` or `python3 -m http.server`) rather than opening the file directly, so the browser can reach Formspree.

## SEO files

- `sitemap.xml` - lists `/`, `/about.html`, and `/book.html` with absolute URLs
- `robots.txt` - allows crawling and points to the sitemap
- `llms.txt` - a short plain-text summary for answer engines

Each page has one title, one meta description, one canonical URL, Open Graph and Twitter card tags, and JSON-LD. The home page describes the training practice and its visible FAQ. The about page describes Sanjeev and its visible FAQ. The booking page is a WebPage with a ReserveAction for the Cal.com calendar.

## Contact details

- Email: `getfitwithsk007@gmail.com`
- LinkedIn: [sanjeev-kumar-0387b6207](https://www.linkedin.com/in/sanjeev-kumar-0387b6207)

## Placeholders still open

- Package sizes, session lengths, and any pricing. Marked in `index.html` on the training packages section. Nothing is invented on the page.
- A single Cal.com event slug, once Sanjeev chooses one. See the comment on `CAL_LINK` in `book.html`.
- Any social profile other than LinkedIn. Structured data lists LinkedIn only.

## Deploy

Upload the site files (including `images/`, `sitemap.xml`, `robots.txt`, and `llms.txt`) to any static host. No build step, no dependencies.
