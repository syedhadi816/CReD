# Download **all** pilot logs (one step)

## The only command you need

**On Render:** open your **API Web Service** → **Shell**.  
You should be in the folder that has `package.json` (the `backend` app). Then run:

```bash
npm run export-all-logs
```

**On your computer** (same repo, `backend` folder, with `DATABASE_URL` in `.env`):

```bash
cd backend
npm run export-all-logs
```

### What you get

One file appears in that same folder:

**`all-pilot-logs.json`**

It contains **everything** in one place:

- Every **login** (email, access code used, time, IP)
- Every **user**
- Every **access code** (usage counts — not “live” secrets beyond what’s in the DB)
- Every **assessment session** with **all question attempts**, **step answers**, and **full chat** transcripts

### How to save it on your laptop from Render

After the command runs, it prints something like `Wrote /opt/render/project/src/all-pilot-logs.json`.

1. In Shell, run: `cat all-pilot-logs.json`  
2. Copy the output (or use your terminal’s “Save output” if your client supports it).

*(Render Shell doesn’t always have a “Download file” button; copying the file content is the usual approach.)*

### Optional: different filename

```bash
npx tsx scripts/export-all-logs.ts --out my-backup.json
```

---

## Extra: live tail in Render (optional)

In **Logs**, search for **`[AUDIT]`** — short JSON lines for real-time checks. **Not** a full export; use **`npm run export-all-logs`** for the complete archive.

---

## HTTPS note

Render serves the API over **HTTPS** on `*.onrender.com`. “Not secure” in the browser is usually mixed content or DNS on a custom domain, not missing SSH.
