# How to add a blog post

This is the short version. You do not need to know how to code. You copy a template, write the article, get Sanjeev's approval, then publish it.

## Add the article

1. Copy `content/blog/_template.md`.
2. Save the copy as `content/blog/your-slug.md`. The file name and the slug must match. Use lowercase words with hyphens, for example `strength-training-after-50.md`.
3. Fill in the fields at the top:
   - **title**: the article headline.
   - **slug**: the same words as the file name, without `.md`.
   - **description**: one or two plain sentences for Google. Keep it under 155 characters.
   - **date**: the day you first publish it, written as `YYYY-MM-DD`.
   - **updated**: the day you last made a real edit. Use the same date as `date` if nothing has changed since.
   - **categories**: 1 to 3 names from `content/blog/categories.json`. The first name is the primary category. It shows on the card, in the breadcrumb, and in related articles. Use the name exactly, for example `["Active Aging", "Strength"]`.
   - **tags**: a few short labels. These are optional.
   - **image**: optional. Put the picture in `images/blog/` and set this to `/images/blog/your-photo.jpg`.
   - **imageAlt**: a short description of what is in the picture.
   - **status**: leave this as `draft` until Sanjeev has approved the article.
   - **keyTakeaways**: 3 to 5 short bullets. These show in a box under the byline and hero image, before the opening paragraphs.
   - **faq**: optional. Two to four real questions a reader might ask, with short answers.
4. Write the article under the fields. Use `##` for section headings. Link to the About page and the booking page at least once.
5. Files whose names start with `_` are templates. The build skips them. `sample-post.md` is a layout test. Leave it as a draft.

Allowed categories, in this order, live in `content/blog/categories.json`. Use the name, not the slug. A post needs at least one and at most three. The build stops with an error if a name is missing, unknown, or if there are more than three.

Trending and Special are editorial labels. Sanjeev decides which posts get them. Fitness Digest is for roundup-style posts.

| Name | Slug |
| --- | --- |
| Trending | trending |
| Special | special |
| Fitness Digest | fitness-digest |
| Getting Started | getting-started |
| Mobility | mobility |
| Strength | strength |
| Endurance | endurance |
| Active Aging | active-aging |
| Women's Fitness | womens-fitness |
| Nutrition and Recovery | nutrition-and-recovery |

## Preview it on your computer

Install the tools once, from the project folder:

```bash
npm install
```

Build a local preview, including drafts:

```bash
npm run build:blog -- --drafts
```

Open `blog/your-slug.html` in a browser. You can also start a small local site and visit the page there:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/blog/your-slug.html`.

The preview also fills the home page, the Blog link, and the blog index so you can check the layout. That preview is only for your computer.

## After Sanjeev approves it

1. Set `status` to `published`.
2. Set `reviewedBy` to `Sanjeev Kumar`.
3. Set `reviewedOn` to the day he approved it, as `YYYY-MM-DD`.
4. Build the live pages (this drops draft previews):

```bash
npm run build:blog
```

5. Save the work:

```bash
git add .
git commit -m "Add a blog post"
git push
```

Run the normal `npm run build:blog` before `git add`. Do not commit the extra files that `--drafts` creates. Those are preview pages, and drafts should not go on the live site.

Only `status: published` articles show on the live site. With no published articles, the Blog link stays hidden and the home page does not show a blog section.

## Review checklist

Before you set `status` to `published`, check each of these:

- Facts and numbers are checked.
- There are no medical claims and no promises of results.
- There are no real client details unless you have written consent.
- The language is plain.
- There is one clear takeaway.
- The article links to the About page and the booking page.
- Image alt text describes the picture.
- Spelling is Canadian (for example colour, centre, favourite, travelling; use organize and aging).
- There are no em dashes. Use a comma, a period, or a hyphen instead.
