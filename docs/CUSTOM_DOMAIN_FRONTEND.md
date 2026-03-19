# Put the frontend on your own subdomain (e.g. `app.yourdomain.com`)

Your **frontend** is a **Render Static Site**. Your **API** can stay on `*.onrender.com` unless you also want `api.yourdomain.com` later.

## What you need

1. A **domain** you control (bought from Google Domains, Namecheap, Cloudflare, GoDaddy, etc.).
2. Access to that domain’s **DNS** settings.

## Step 1 — Add the domain in Render

1. Open [Render Dashboard](https://dashboard.render.com).
2. Click your **Static Site** (the one that serves the CReD UI).
3. Go to **Settings** → **Custom Domains**.
4. Click **Add Custom Domain**.
5. Enter your subdomain, for example: **`app.yourdomain.com`**  
   (replace `yourdomain.com` with your real domain).

Render will show **DNS instructions** — usually one of these:

- **CNAME** name: `app` (or `@` for root — Render will say which)
- **CNAME** value: something like **`your-static-site-name.onrender.com`**  
  (copy exactly what Render shows; do not guess.)

## Step 2 — Add DNS at your domain provider

Log in where you bought the domain → **DNS** / **DNS records**.

Add a record **exactly** as Render specifies:

| Type | Name / Host | Value / Target |
|------|-------------|----------------|
| **CNAME** | `app` (or as Render says) | `…onrender.com` from Render |

**Notes:**

- DNS can take **15 minutes to 48 hours** to propagate (often under an hour).
- **Do not** set both an **A** record and a **CNAME** on the same name — follow Render’s wizard.

## Step 3 — HTTPS

Render will **automatically** issue a certificate (Let’s Encrypt) once DNS points correctly. Refresh the Custom Domains section until it shows **Verified** / certificate active.

## Step 4 — Environment variable (important)

Your app is built with **`VITE_API_URL`** pointing at your **API** (e.g. `https://cred-kq7m.onrender.com`).

- **You do not** need to change `VITE_API_URL` just because the **frontend** moved to `app.yourdomain.com`.
- Only change it if you later put the API on a **custom domain** too.

After any env change on the Static Site, **redeploy** so the site rebuilds.

## Optional: subdomain for the API later

If you want `api.yourdomain.com`:

1. Add a **Custom Domain** on the **Web Service** (backend), not the static site.
2. Add the CNAME Render gives you for `api`.
3. Update **`VITE_API_URL`** to `https://api.yourdomain.com` and redeploy the **static site**.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| “Domain not verified” | CNAME host/value match Render exactly; wait for DNS propagation. |
| Site loads but API errors | `VITE_API_URL` still correct and **https**; backend CORS if you locked it down. |
| www vs non-www | Pick one subdomain (e.g. `app.…`) and use that consistently. |
