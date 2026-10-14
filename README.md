# PurePest Job Card & Service Warranty

A mobile-first web form technicians fill in on-site: job details, client
details, photos (before/after + extras), warranty terms, and a finger-drawn
client signature. On submit it generates a branded PDF in the browser
(jsPDF) and — once Supabase is connected — also saves the submission (and
uploaded photos/PDF) to a database so the office can see what was done.

## Project layout

```
index.html              the page itself (loads everything below)
css/style.css           all styling
js/app.js               form logic, photo handling, PDF generation
js/supabase-client.js   wraps Supabase: uploads photos/PDF, inserts a row
js/config.example.js    template for your Supabase credentials
js/config.js            YOUR credentials — gitignored, you create this
assets/                 the three brand images (logo, PCO signature, gov logo)
supabase/schema.sql     run this once in your Supabase project
```

## Running it locally

No build step — it's a static site. From this folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. (Opening `index.html` directly by
double-clicking also mostly works, but some browsers restrict `fetch()` on
`file://` pages, which the Supabase upload step needs — a local server avoids
that entirely.)

Without `js/config.js`, the Supabase sync step is automatically skipped — the
form and PDF generation work exactly as before, nothing breaks.

## Connecting Supabase

1. Create a project at supabase.com (free tier is enough to start).
2. Dashboard → SQL Editor → paste the contents of `supabase/schema.sql` → Run.
   This creates the `job_cards` table and the Row Level Security policies
   that let the public form insert rows but not read, edit, or delete them.
3. Dashboard → Storage → New bucket → create `job-card-photos` and
   `job-card-pdfs`, both **public**. (The schema.sql script also tries to
   create these via SQL as a convenience — the dashboard is the reliable
   fallback if that part doesn't apply cleanly.)
4. Dashboard → Project Settings → API → copy the **Project URL** and the
   **anon public** key (not the `service_role` key — that one must never go
   into client-side code).
5. `cp js/config.example.js js/config.js` and paste those two values in.
6. Reload the page. Submitting a job card now also saves it to Supabase —
   check Table Editor → `job_cards` to see it land.

**Security model, explained plainly:** the anon key is meant to be public —
it ships inside the JS anyone can view. What actually protects your data is
the Row Level Security policy in `schema.sql`: it only allows `insert`, never
`select`/`update`/`delete`. So anyone with the link can submit a job card,
but nobody (other than you, via the dashboard) can read, change, or delete
one through the app. If you later add technician login, you'd tighten this
further to also check `auth.uid()` on insert.

**No office dashboard yet.** The brief for this version was "save submissions
to Supabase," not "let the office browse them in-app" — right now the only
way to see submitted job cards is the Supabase dashboard itself. A
second page that lists/searches submissions is a reasonable next step; ask
for it whenever you want it built.

## Putting it on GitHub

```
cd purepest-jobcard
git init
git add .
git commit -m "Initial commit: PurePest Job Card & Service Warranty"
gh repo create purepest-jobcard --private --source=. --remote=origin --push
```

(`gh repo create` needs the GitHub CLI signed in — `gh auth login` first if
you haven't. If you'd rather not use the CLI: create an empty repo on
github.com, then `git remote add origin <url>` and `git push -u origin main`.)

`js/config.js` is in `.gitignore`, so your Supabase key never gets committed
— good, since even though the anon key is safe to expose in a *running* page,
there's no reason to also leave it sitting in your git history.

## Making it live

This is a fully static site (plain HTML/CSS/JS, no server-side code), so the
simplest free option is **GitHub Pages**:

1. Repo → Settings → Pages → Source: "Deploy from a branch" → Branch: `main`,
   folder `/ (root)` → Save.
2. GitHub builds and gives you a URL like
   `https://<your-username>.github.io/purepest-jobcard/` within a minute or
   two. That's your live link — bookmark it on technicians' phones.
3. Every `git push` to `main` updates the live site automatically within
   about a minute.

If you later want server-side code (e.g. emailing the PDF automatically, or
a protected admin API), Vercel is the natural next step — it deploys from
the same GitHub repo with one click and adds serverless functions without
you having to change anything about this project's structure.

## What Claude Code can do from here that this chat couldn't

This project was built in a cloud sandbox with no access to your GitHub
account, your Supabase project, or your own machine. Once you open this
folder in Claude Code locally, it can do things this chat was never able to:
run `git`/`gh` with *your* authenticated accounts, actually create the
Supabase project and run the schema for you via the Supabase CLI if you
install it, enable GitHub Pages via `gh api`, and iterate on the code with
instant local preview. Point Claude Code at this folder and tell it what to
do next — the structure above is meant to make that straightforward.
