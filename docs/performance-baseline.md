# Performance baseline

Mobile Lighthouse 13, simulated throttling (default Slow 4G), form factor mobile. Each number is the median of 3 runs (median by score). Measured after merging `main` at `4f6a3cc` into `speed-pass` (new blog posts, feedback page, address, compact header).

Before: clean checkout of `main` (worktree). After: `speed-pass` with self-hosted fonts, minified CSS/JS, responsive WebP/AVIF, and caching headers. Both columns use a local Node static server with Brotli on HTML/CSS/JS (same compression class as Vercel).

## Before (current main, Brotli)

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 87 | 3.99 s | 0.004 | 0 ms | 1,305,563 | 18 |
| About `/about.html` | 95 | 2.37 s | 0.000 | 0 ms | 706,216 | 13 |
| Book `/book.html` | 94 | 2.94 s | 0.000 | 0 ms | 2,052,358 | 180 |
| Blog `/blog/` | 89 | 3.69 s | 0.001 | 0 ms | 1,152,743 | 14 |
| Post `/blog/vegetarian-plate-for-strength.html` | 99 | 1.99 s | 0.000 | 0 ms | 286,605 | 9 |
| Feedback `/feedback.html` | 99 | 1.70 s | 0.000 | 0 ms | 156,551 | 8 |

Home and the blog index were held up by large JPEG heroes, a render-blocking stylesheet, and Google Fonts.

## After (speed-pass, Brotli)

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 99 | 2.26 s | 0.000 | 0 ms | 373,253 | 16 |
| About `/about.html` | 99 | 2.05 s | 0.000 | 0 ms | 227,416 | 11 |
| Book `/book.html` | 99 | 1.99 s | 0.000 | 0 ms | 2,046,975 | 178 |
| Blog `/blog/` | 100 | 1.53 s | 0.000 | 0 ms | 261,997 | 13 |
| Post `/blog/vegetarian-plate-for-strength.html` | 100 | 1.85 s | 0.000 | 0 ms | 170,521 | 8 |
| Feedback `/feedback.html` | 100 | 0.77 s | 0.000 | 0 ms | 151,462 | 7 |

Every measured page meets its target: 95 or better on Home, About, Blog index, post and feedback; 90 or better on Book. LCP is under 2.5 s, CLS is 0, TBT is 0 ms.

Home transferred bytes dropped from about 1.31 MB to 0.37 MB. The booking page still downloads the Cal.com embed (about 180 requests, about 2 MB), which is why its target stays at 90 rather than 95.
