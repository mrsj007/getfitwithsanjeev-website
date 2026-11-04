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
   - **categories**: 1 to 3 entries written as `Group > Topic`, using the exact names from `content/blog/categories.json`. The first is the primary topic. It shows on the card and under the post title as `Group - Topic`, for example `Workout - Strength`. Related articles prefer the same primary topic. Posts may mix groups. Example: `["Workout > Strength", "Workout > Beginner / Getting Started"]`.
   - **featured**: optional. Set this to `true` to use the post as the large card on the blog index when All categories is selected. If more than one published post is featured, the newest is used. If the dates match, the title that comes first alphabetically is used. If none are featured, the newest post is the large card. A category filter keeps every matching card at the normal size.
   - **tags**: a few short labels. These are optional.
   - **image**: optional. Put the picture in `images/blog/` and set this to `/images/blog/your-photo.jpg`.
   - **imageAlt**: a short description of what is in the picture.
   - **status**: leave this as `draft` until Sanjeev has approved the article.
   - **keyTakeaways**: 3 to 5 short bullets. These show in a box under the byline and hero image, before the opening paragraphs.
   - **faq**: optional. Two to four real questions a reader might ask, with short answers.
4. Write the article under the fields. Use `##` for section headings. Link to the About page and the booking page at least once.
5. Files whose names start with `_` are templates. The build skips them. `sample-post.md` is a layout test. Leave it as a draft.

Allowed categories live in `content/blog/categories.json`, in the order below. Each entry is `Group > Topic`. Use those exact names, not the slug. A post needs at least one and at most three. The build stops with an error if an entry is missing, is not in `Group > Topic` form, is not in the file, if there are more than three, or if the same topic is repeated.

The blog index menu always shows the full list from `categories.json`. Adding a group or topic there adds it to the menu on the next build, even when that topic has no published post yet. A count is shown only when it is above zero. Choosing a group shows posts with any topic in that group. Choosing a topic shows posts that list that topic, including when it is not the primary one. If that choice has no published posts, the index shows a short note with links to all articles and to booking. There are no separate category pages, and categories are not added to the sitemap. Filtered addresses use `?category=` on the blog index, and the canonical URL stays `/blog/`. The breadcrumb on a post stays Home, Blog, then the article title.

| Group | Topic | Entry | Slug |
| --- | --- | --- | --- |
| Workout | Beginner / Getting Started | Workout > Beginner / Getting Started | workout-beginner-getting-started |
| Workout | Fat Loss | Workout > Fat Loss | workout-fat-loss |
| Workout | Muscle Gain | Workout > Muscle Gain | workout-muscle-gain |
| Workout | Body Composition Changes | Workout > Body Composition Changes | workout-body-composition-changes |
| Workout | Strength | Workout > Strength | workout-strength |
| Workout | GLP-1 (Ozempic) | Workout > GLP-1 (Ozempic) | workout-glp-1 |
| Workout | TRT | Workout > TRT | workout-trt |
| Workout | Prenatal / Postnatal | Workout > Prenatal / Postnatal | workout-prenatal-postnatal |
| Workout | Stress Management / Healthy Lifestyle | Workout > Stress Management / Healthy Lifestyle | workout-stress-management-healthy-lifestyle |
| Workout | Arthritis, Osteoporosis and Sarcopenia | Workout > Arthritis, Osteoporosis and Sarcopenia | workout-arthritis-osteoporosis-and-sarcopenia |
| Nutrition | Fat / Weight Loss | Nutrition > Fat / Weight Loss | nutrition-fat-weight-loss |
| Nutrition | Ozempic | Nutrition > Ozempic | nutrition-ozempic |
| Nutrition | Vegetarian Diet | Nutrition > Vegetarian Diet | nutrition-vegetarian-diet |
| Nutrition | Vegan Diet | Nutrition > Vegan Diet | nutrition-vegan-diet |
| Nutrition | Athletic Performance | Nutrition > Athletic Performance | nutrition-athletic-performance |
| Nutrition | Gluten-Free and Lactose-Free Diet | Nutrition > Gluten-Free and Lactose-Free Diet | nutrition-gluten-free-and-lactose-free-diet |
| Supplementation | Performance Enhancement | Supplementation > Performance Enhancement | supplementation-performance-enhancement |
| Supplementation | Recovery | Supplementation > Recovery | supplementation-recovery |
| Supplementation | General Health | Supplementation > General Health | supplementation-general-health |

Group slugs are `workout`, `nutrition` and `supplementation`. Topic slugs are prefixed with the group so they stay unique. Each group and topic also has a one-sentence description in the JSON file.

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

### Editorial safety for medical-adjacent topics

Several topics sit next to medical care: GLP-1 (Ozempic), TRT, supplements, arthritis, osteoporosis, sarcopenia, and prenatal or postnatal training.

- Posts are about training, food and habits that support people alongside their medical care. Never advise starting, stopping, changing or dosing a medication or hormone, or say a workout, food or supplement treats or cures a condition.
- For GLP-1 and TRT posts, include a visible reminder to follow their doctor's guidance and check with them before changing training or nutrition.
- Supplement posts must stay general, mention that evidence varies, avoid disease claims and exact dosing, and advise checking with a doctor or pharmacist, especially with medications, pregnancy or health conditions.
- Do not describe Sanjeev as a doctor, dietitian or medical professional. His certifications are fitness and nutrition-coaching credentials.
- Use sources: link to reputable references (health agencies, peer-reviewed research) where claims are made.

The build still finishes if a published post contains words such as "cure", "treat", "heal", "prescribe", "dosage", "dose", "stop taking", "replace your medication", "guaranteed" or "detox". It prints a warning so the wording can be changed.
