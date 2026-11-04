# Deployment: gestion.somosventro.com (SCRUM-127)

The app is a static build (`npm run build` → `dist/`) served by Cloudflare Pages. Supabase is
the backend; the browser only talks to the site itself and to Supabase.

## Repository settings

- `.node-version`: Node 22 for the Cloudflare build.
- `public/_headers` (copied to `dist/`): security headers for every page.
  - CSP: scripts and styles only from the site; network only to the site and `*.supabase.co`;
    no iframes in or out; no plugins.
  - HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (no
    camera, microphone, location or payments) and `Cross-Origin-Opener-Policy`.
  - Hashed files under `/assets/` are cached for a year; `index.html` is always revalidated, so a
    new deploy is seen on the next reload.
- Routes use the URL hash (`#/presupuestos`), so no SPA redirect rule is needed.

If a new external service is added (fonts, analytics, another API), its domain must be added to
the CSP in `public/_headers`, otherwise the browser blocks it.

## Cloudflare (once)

1. Workers & Pages → Create → Pages → Connect to Git → `david-qa-ia/ingenya-quote-manager`,
   production branch `main`.
2. Build command `npm run build`, output directory `dist`.
3. Environment variables (Production): `VITE_SUPABASE_URL` = `https://<project>.supabase.co` and
   `VITE_SUPABASE_ANON_KEY` = the anon/publishable key. Both end up in the browser by design;
   never use the `service_role` key here.
4. Settings → Builds → Preview deployments: None. Previews would get public URLs for every
   branch.
5. Custom domains → `gestion.somosventro.com`. The DNS record is created automatically because the
   domain is on Cloudflare.

## Supabase (once)

Authentication → URL Configuration: Site URL `https://gestion.somosventro.com`; Redirect URLs
`https://gestion.somosventro.com/**`. Public sign-up stays disabled; users are created by Ventro.

## Checks after each deploy

Sign in, open a quote, download its PDF and sign out. The browser console must show no
"Content Security Policy" errors.
