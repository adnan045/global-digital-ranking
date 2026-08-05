# Global Digital Ranking

A responsive multi-page static website plus a lightweight custom lead CRM for Global Digital Ranking.

## Final public pages

- `index.html` — home
- `services.html` — services overview
- `website-design.html` — website design
- `seo.html` — SEO
- `google-ads.html` — Google Ads
- `process.html` — process
- `about.html` — why GDR
- `contact.html` — general enquiry
- `free-audit.html` — lead-generation audit page
- `work.html` — concept work and demos
- `plumbers.html` — USA plumbers niche landing page
- `faq.html` — common questions
- `privacy.html` — starter privacy notice
- `terms.html` — starter terms page
- `404.html` — not-found page

## Shared editing system

The source uses a build step so shared elements are edited once:

- `src/partials/header.html` — shared header/nav
- `src/partials/footer.html` — shared footer
- `src/partials/audit-form.html` — shared lead form
- `src/layout.html` — shared document shell
- `src/pages/*.html` — page content only
- `src/styles.css` — shared website styling
- `src/app.js` — shared website interactions
- `src/site.json` — business name, domain and email

Run `npm run build` after editing a shared file. Vercel runs this automatically using `vercel.json`.

## Custom CRM

- Dashboard: `/admin.html`
- Lead API: `/api/leads.js`
- Public config endpoint: `/api/config.js`
- Database schema: `supabase/schema.sql`
- Dashboard source: `src/admin.html`, `src/admin.css`, `src/admin.js`

The CRM supports:

- Website form → Supabase lead capture
- Admin login through Supabase Auth
- Search and filters
- Lead statuses: new, contacted, qualified, proposal, won, lost
- Lead priorities: hot, warm, cold
- Notes and next follow-up date
- CSV export
- Optional lead notification and confirmation emails through Resend

### One-time Supabase setup

1. Create a free project at Supabase.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Authentication → Users**, create one email/password user for the admin dashboard.
4. Copy the project URL, anon key and service-role key.
5. In Vercel → Project → Settings → Environment Variables, add:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in browser code or commit it to GitHub.

### Optional email notifications

Add these Vercel environment variables if you want a new-lead notification and confirmation email:

```text
RESEND_API_KEY=re_xxxxx
MAIL_FROM=Global Digital Ranking <hello@yourdomain.com>
CRM_NOTIFICATION_EMAIL=your-admin-email@example.com
```

Use a verified sending domain. Before marketing automation, configure SPF, DKIM and DMARC and add the appropriate unsubscribe/privacy flow.

## Run locally

```bash
npm run build
npm run dev
```

Then open `http://localhost:4173` for the website or `http://localhost:4173/admin.html` for the CRM. The CRM API will show a setup message locally until the Vercel/Supabase environment variables are configured.

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repository in Vercel.
3. Vercel reads `vercel.json`, runs `npm run build`, and serves `public/`.
4. Add the Supabase and optional Resend environment variables in Vercel.
5. Redeploy.

The default site URL is configured in `src/site.json` as `https://globaldigitalranking.com`. Change it there if your actual domain is different; the build will regenerate canonical tags, sitemap and robots.txt.

## Before launch

- Replace the starter privacy and terms text with reviewed legal copy and your real business address.
- Confirm the business email and domain in `src/site.json` and the footer.
- Connect and test the form endpoint.
- Add rate limiting or CAPTCHA/Turnstile to the public form.
- Add real proof/case studies only when available; do not publish fabricated metrics or testimonials.
- Do not edit generated files in `public/`; edit `src/` and run `npm run build`.
