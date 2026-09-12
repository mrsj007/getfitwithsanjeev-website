# Sanjeev Kumar - Personal Trainer Website

Single-page site for Sanjeev Kumar, a personal trainer in Vancouver / South Surrey sharing free fitness guidance. Built with plain HTML, CSS, and vanilla JavaScript so it can be hosted on Netlify, Vercel, GitHub Pages, or any static host.

## Preview locally

Any of these work:

```bash
# Open the file directly
open index.html
```

```bash
# Simple static server (recommended so images and routing behave consistently)
npx serve
```

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:3000` (`serve`) or `http://localhost:8080` (Python).

Files:

- `index.html` - markup and copy
- `styles.css` - design tokens, layout, responsive rules
- `script.js` - mobile nav, FAQ accordion, Formspree contact submit
- `images/sanjeev-kumar.jpg` - portrait used in Meet Sanjeev

## Swap in remaining photos

Stock Unsplash URLs are still used for the hero, who-I-help cards, and contact background. Search the HTML for:

```html
<!-- TODO: replace with client's real photos -->
```

Sanjeev's portrait is already local: `images/sanjeev-kumar.jpg`.

## Contact form (Formspree)

The form posts to [Formspree](https://formspree.io/f/maeywvbo) and delivers messages to **getfitwithsk007@gmail.com**. After a successful send, it shows "Thanks, I'll be in touch."

Serve the site over HTTP (for example `npx serve` or `python3 -m http.server`) rather than opening `index.html` as a local file, so the browser can reach Formspree.

## Contact details

- Email: `getfitwithsk007@gmail.com`
- LinkedIn: [sanjeev-kumar-0387b6207](https://www.linkedin.com/in/sanjeev-kumar-0387b6207)
- Address: 2566 148st, South Surrey

## Deploy

Upload the site files (including the `images/` folder) to any static host. No build step, no dependencies.
