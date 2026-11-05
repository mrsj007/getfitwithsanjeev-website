# Performance baseline

Mobile Lighthouse 12, simulated throttling (default Slow 4G), form factor mobile. Each number is the median of that metric across 3 runs, not the middle run. `privacy.html` does not exist, so it was not measured. There is no case-study page.

The before column and the first after column use the same local server: Python `http.server` on port 8765. That server speaks HTTP/1.0 and does not compress HTML or CSS. The second after column uses `serve` on port 58500, which sends Brotli the way Vercel does. Image and font bytes barely change between the two, because they are already compressed.

## Before

Measured on the unchanged `main` tree.

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 80 | 4.88 s | 0.004 | 0 ms | 1,486,412 | 18 |
| About `/about.html` | 93 | 3.00 s | 0.000 | 0 ms | 861,422 | 13 |
| Book `/book.html` | 93 | 2.97 s | 0.000 | 0 ms | 2,181,568 | 179 |
| Blog `/blog/` | 74 | 4.80 s | 0 | 0 ms | 763,404 | 11 |
| Post `/blog/strength-training-after-50.html` | 94 | 2.85 s | 0.001 | 0 ms | 453,255 | 9 |

Home and the blog index were held up by the hero or featured JPEG, a render-blocking stylesheet, and the Google Fonts stylesheet.

## After, same server (no compression)

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 87 | 3.68 s | 0 | 0 ms | 532,567 | 16 |
| About `/about.html` | 93 | 2.93 s | 0 | 0 ms | 354,668 | 11 |
| Book `/book.html` | 96 | 2.70 s | 0 | 0 ms | 2,142,354 | 177 |
| Blog `/blog/` | 95 | 2.70 s | 0 | 0 ms | 294,478 | 10 |
| Post `/blog/strength-training-after-50.html` | 96 | 2.55 s | 0 | 0 ms | 263,264 | 8 |

Bytes dropped sharply (home from 1.49 MB to 0.53 MB). Scores rose. LCP on this server is still over 2.5 s because the HTML and CSS go out uncompressed. Home HTML is about 105 KB raw and 15 KB with Brotli. The stylesheet is about 59 KB raw and 12 KB with Brotli.

## After, with Brotli (closer to Vercel)

| Page | Score | LCP | CLS | TBT | Transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home `/` | 98 | 2.41 s | 0 | 0 ms | 378,523 | 16 |
| About `/about.html` | 99 | 2.18 s | 0 | 0 ms | 231,391 | 12 |
| Book `/book.html` | 99 | 2.13 s | 0 | 0 ms | 2,058,244 | 179 |
| Blog `/blog/` | 99 | 1.96 s | 0 | 0 ms | 204,344 | 10 |
| Post `/blog/strength-training-after-50.html` | 99 | 1.96 s | 0 | 0 ms | 179,116 | 9 |

On a compressing server every measured page is at or above its target: 95 or better on Home, About, the blog index and the post, and 90 or better on the booking page. LCP is under 2.5 s, CLS is 0, and TBT is 0 ms.

The booking page still downloads the Cal.com embed (about 180 requests, about 2 MB). That is why its target is 90 rather than 95. With compression it scores 99.

## What the local server cannot show

The Python server cannot hit the LCP target on its own. Vercel compresses HTML and CSS and uses HTTP/2, which is the condition in the Brotli column. No further code change is required for that gap.
