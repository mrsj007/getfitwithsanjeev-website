# Performance baseline

Mobile Lighthouse 12, simulated throttling (default Slow 4G), form factor mobile. Each number is the median of 3 runs. Measured after merging `main` at `4979f5e` into `speed-pass` (16 blog posts, feedback page, address, compact header, guidance v2/v3, transformation cards 14-16).

Before: clean checkout of `main` at `4979f5e` (worktree). After: `speed-pass` with self-hosted fonts, minified CSS/JS, responsive WebP/AVIF, and caching headers. Both columns use a local Node static server with **Brotli** on HTML/CSS/JS (same compression class as Vercel). Without Brotli, transfer sizes are higher (for example Home CSS alone is about 67 KB raw / about 13 KB gzip); the uncompressed Python `http.server` is not representative of production.

## Before (current main, Brotli)

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 86 | 4.21 s | 0.002 | 0 ms | 1,504,608 | 18 |
| About `/about.html` | 98 | 2.29 s | 0.000 | 0 ms | 706,562 | 13 |
| Book `/book.html` | 97 | 2.49 s | 0.000 | 0 ms | 2,052,773 | 178 |
| Blog `/blog/` | 84 | 4.43 s | 0.001 | 0 ms | 1,460,200 | 16 |
| Post `/blog/exercise-with-arthritis-osteoporosis-sarcopenia.html` | 98 | 2.14 s | 0.002 | 0 ms | 315,442 | 9 |
| Feedback `/feedback.html` | 100 | 1.52 s | 0.000 | 0 ms | 156,856 | 8 |

Home and the blog index were held up by large JPEG heroes, a render-blocking stylesheet, and Google Fonts. Blog index card images alone were about 2.6 MB of full JPEGs (16 posts).

## After (speed-pass, Brotli)

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 99 | 2.19 s | 0.000 | 0 ms | 358,048 | 16 |
| About `/about.html` | 99 | 2.05 s | 0.000 | 0 ms | 227,729 | 11 |
| Book `/book.html` | 99 | 2.00 s | 0.000 | 0 ms | 2,047,190 | 176 |
| Blog `/blog/` | 99 | 1.98 s | 0.000 | 0 ms | 334,371 | 15 |
| Post `/blog/exercise-with-arthritis-osteoporosis-sarcopenia.html` | 100 | 1.54 s | 0.000 | 0 ms | 172,852 | 8 |
| Feedback `/feedback.html` | 100 | 1.37 s | 0.000 | 0 ms | 151,755 | 7 |

Every measured page meets its target: 95 or better on Home, About, Blog index, post and Feedback; 90 or better on Book. LCP is under 2.5 s, CLS is 0, TBT is 0 ms.

Home transferred bytes dropped from about 1.50 MB to 0.36 MB. Blog index transferred bytes dropped from about 1.46 MB to 0.33 MB; realistic mobile card image weight is about 164 KB (one 768 AVIF featured + fifteen 480 AVIF thumbnails) versus about 2.60 MB of full JPEGs on main. The booking page still downloads the Cal.com embed (about 176 requests, about 2 MB), which is why its target stays at 90 rather than 95.

Feedback SEO score stays at 66 because the page is intentionally `noindex` and is omitted from `sitemap.xml`.
