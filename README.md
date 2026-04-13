# CReD

**Conceptual Regression Depth** — an AI tutor to actively combat cognitive offloading.

Assessment app: login with email + access code, choose a topic, work through questions with an LLM tutor that gives hints (not direct answers). Interactions can be logged.

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env   # add DATABASE_URL, LLM_PROVIDER, CLAUDE_API_KEY (or Ollama vars)
npm install
npx prisma generate
npm run seed           # access codes 123456, 111111; loads item banks
npm run dev            # API on http://localhost:4000
```

**Backend env (`.env`):** see [backend/.env.example](backend/.env.example). Never commit `.env`.

### 2. Frontend (CReD_Sandbox)

```bash
cd CReD_Sandbox
npm install
npm run dev            # app on http://localhost:5173 (or next free port)
```

Optional: set `VITE_API_URL=http://localhost:4000` in `CReD_Sandbox/.env` if the API runs elsewhere.

### 3. Use the app

1. Open the Vite URL (e.g. http://localhost:5173)
2. Choose **For Students** or **For Educators**, then log in (email + 6-digit access code, e.g. **123456** or **111111**).
3. **Students:** pick a topic (Statistics, Linear Algebra, College Linear Algebra), work through questions, use **Need Help?** for the tutor.
4. **Educators:** enter a prompt, **Number of questions**, and **Grade level**; questions are generated with **Claude** (`LLM_PROVIDER=anthropic` and `CLAUDE_API_KEY` required in `backend/.env`).

## Project layout

- **backend** — Express API, Prisma (SQLite), auth, questions/sessions/attempts, chat (Ollama or Anthropic Claude)
- **CReD_Sandbox** — React (Vite) UI
- **statistics_item_bank**, **linear_algebra_item_bank**, **linear_algebra_2_item_bank** — JSON item banks; `npm run seed` loads them

## License

Open source — see repository settings on GitHub.
