# Deploy backend on Render (free tier)

## 1. Create a Web Service

1. In [Render Dashboard](https://dashboard.render.com), click **New +** → **Web Service**.
2. Connect **GitHub** and select repo **`syedhadi816/CReD`** (or your fork).
3. Configure:
   - **Name:** e.g. `cred-api`
   - **Region:** choose closest to you
   - **Branch:** `main`
   - **Root Directory:** `backend`  ← important
   - **Runtime:** **Node**
   - **Build Command:** `npm install && npm run render-build`
   - **Start Command:** `npm start`

## 2. Environment variables

In the service → **Environment**, add:

| Key | Example value |
|-----|----------------|
| `DATABASE_URL` | `file:./prisma/render.db` |
| `LLM_PROVIDER` | `anthropic` |
| `CLAUDE_API_KEY` | *(your key — paste in Render only, never in GitHub)* |
| `LLM_MODEL_NAME` | `claude-3-5-sonnet-20241022` *(or model your account supports)* |

Render sets **`PORT`** automatically; the app uses it.

## 3. Deploy

Click **Create Web Service**. Wait for the first build (several minutes). When it shows **Live**, open:

- `https://YOUR-SERVICE.onrender.com/` — should show `{"ok":true,"service":"CReD API"}`

## 4. Free tier notes

- The service **spins down** after idle time; the **first request** after that can take ~30–60 seconds.
- **SQLite** lives on the instance disk. **New deploys** can reset it; the **build** runs migrations + seed so questions/access codes come back. Pilot **user/chat** data may be lost on redeploy — fine for early testing; use **Postgres** later if you need durable history.

## 5. Pilot access codes

Twenty distributable 6-digit codes **`620001` … `620020`** (plus `123456` / `111111`) — see **`docs/PILOT_ACCESS_CODES.md`**. Created on deploy via seed.

## 6. Custom subdomain (frontend)

See **`docs/CUSTOM_DOMAIN_FRONTEND.md`** — add a domain on your **Static Site** and a **CNAME** at your DNS host.

## 7. Pilot / tester logs

See **`docs/PILOT_LOGS.md`**: one command **`npm run export-all-logs`** → single **`all-pilot-logs.json`** with all sessions, chat, and logins.

## 8. Frontend (separate step)

Point the Vite app at this API:

- Set **`VITE_API_URL`** to `https://YOUR-SERVICE.onrender.com` when building the static site (e.g. second Render **Static Site** from `CReD_Sandbox`, or GitHub Pages).
