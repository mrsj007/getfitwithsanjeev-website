# Sanjeev Kumar - Personal Trainer Website

Two-page site for Sanjeev Kumar, a Level 3 personal trainer in Vancouver and South Surrey. Free fitness guidance stays on the site, alongside in-person training packages (the main offer) and online consultations. Built with plain HTML, CSS, and vanilla JavaScript so it can be hosted on Netlify, Vercel, GitHub Pages, or any static host.

## Pages

- `index.html` - home: free guidance, client transformations, training packages, testimonials, FAQ, and the contact form
- `about.html` - Sanjeev's story, certifications, method, specialized knowledge, FAQ, and the same contact form

A dedicated booking page (`book.html`) is planned next. Until then, every consultation button is controlled by one constant in `script.js`:

```javascript
const BOOKING_HREF = "index.html#guidance"; // TODO: point to book.html in the booking phase
```

Those links use `data-booking` and currently open the contact form (`#guidance` on the home page). Change that one line when `book.html` exists.

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
- `styles.css` - design tokens, layout, responsive rules
- `script.js` - mobile nav, FAQ accordion, booking-link target, Formspree submit
- `images/sanjeev-kumar.jpg` - portrait used on the about page and in social cards

## Contact form (Formspree)

Both pages post the same form to [Formspree](https://formspree.io/f/maeywvbo), which delivers messages to **getfitwithsk007@gmail.com**. People can ask for free guidance or send a message to find a time to talk about training. After a successful send, the form shows "Thanks, I'll be in touch."

Serve the site over HTTP (for example `npx serve` or `python3 -m http.server`) rather than opening the file directly, so the browser can reach Formspree.

## SEO files

- `sitemap.xml` - lists `/` and `/about.html` with absolute URLs
- `robots.txt` - allows crawling and points to the sitemap
- `llms.txt` - a short plain-text summary for answer engines

Each page has one title, one meta description, one canonical URL, Open Graph and Twitter card tags, and JSON-LD. The home page describes the training practice and its visible FAQ. The about page describes Sanjeev and its visible FAQ.

## Contact details

- Email: `getfitwithsk007@gmail.com`
- LinkedIn: [sanjeev-kumar-0387b6207](https://www.linkedin.com/in/sanjeev-kumar-0387b6207)

## Placeholders still open

- Package sizes, session lengths, and any pricing. Marked in `index.html` on the training packages section. Nothing is invented on the page.
- The booking target, which becomes `book.html` in the booking phase. See `BOOKING_HREF` in `script.js`.
- Any social profile other than LinkedIn. Structured data lists LinkedIn only.

## Deploy

Upload the site files (including `images/`, `sitemap.xml`, `robots.txt`, and `llms.txt`) to any static host. No build step, no dependencies.
