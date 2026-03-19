# CReD Sandbox – Full stack

Assessment app: login with email + access code, choose topic (Statistics), work through step-by-step questions with an LLM tutor that only gives hints. All interactions are logged.

## Quick start

### 1. Ollama (local LLM)

Install [Ollama](https://ollama.com) and pull a model:

```bash
ollama pull llama3.2:3b
```

Use the same model name in the backend (see below). For a smaller/faster option: `ollama pull phi3:mini`.

### 2. Backend

```bash
cd backend
cp .env.example .env   # edit if needed (DATABASE_URL, LLM_*)
npm install
npm run seed           # access code 123456, Statistics questions
npm run dev            # API on http://localhost:4000
```

**Backend env (`.env`):**

- `DATABASE_URL` – SQLite default: `file:./prisma/dev.db` (or set in `prisma.config.ts`; backend uses adapter with this URL).
- `LLM_BASE_URL` – optional; default `http://localhost:11434` (Ollama).
- `LLM_MODEL_NAME` – optional; default `llama3.2:3b`. Must match a model you pulled, e.g. `llama3.2:3b` or `phi3:mini`.

### 3. Frontend (CReD_Sandbox)

```bash
cd CReD_Sandbox
npm install
npm run dev            # app on http://localhost:5173
```

Optional: set `VITE_API_URL=http://localhost:4000` in `.env` if the API runs elsewhere.

### 4. Use the app

1. Open http://localhost:5173
2. Log in: any email + access code **123456**
3. Choose topic **Statistics**
4. Work through questions: answer each step and click **Check**; use the chat on the right for hints (Ollama must be running).

## Project layout

- **backend** – Express API, Prisma (SQLite), auth (email + access code), questions (list, get, sessions, attempts, step check), chat (Ollama proxy with hint-only context from node chains).
- **CReD_Sandbox** – React (Vite) UI: Home (login), ChooseTopic, Assessment (step-based questions + chat), Results.
- **statistics_item_bank** – Item bank and **all_questions_chain.json** (node chains for all Statistics questions); backend seed loads these into the DB.

## Model for production

For deployment, run Ollama (or another compatible server) on your server, load the same or a fine-tuned model, and set `LLM_BASE_URL` and `LLM_MODEL_NAME` in the backend env. No code changes required.
