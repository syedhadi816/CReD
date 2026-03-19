# Pilot / tester activity logs

Two ways to review what testers did:

## 1. Render dashboard → **Logs**

All structured events are printed as a single line prefixed with **`[AUDIT]`**, followed by JSON.

Examples of `event` values:

| `event` | Meaning |
|---------|---------|
| `pilot_login` | Email, access code entered, user id, optional IP |
| `assessment_session_start` | Topic assessment started (`sessionId`, `startedAt`) |
| `assessment_session_end` | Session closed (`durationMs`, `endedAt`) — call `POST .../sessions/:id/end` or tab close |
| `question_attempt_start` | Tester opened a question |
| `question_attempt_complete` | Final answer checked (`finalCorrect`, `timeSpentMs`) |
| `chat_activate` | Clicked “Need Help?” |
| `chat_user` | User chat line (content truncated in logs) |
| `chat_assistant` | Tutor reply (truncated in logs) |

In Render: open your **Web Service** → **Logs** → filter or search for `[AUDIT]`.

**Note:** Log retention and search are limited; use the database for a full history.

## 2. SQLite / Postgres (source of truth)

| Data | Table(s) |
|------|-----------|
| Email, access code, login time, IP | `PilotLoginLog` |
| Assessment topic, session start/end | `AssessmentSession` (`startedAt`, `endedAt`) |
| Per-question work, final correctness, time | `QuestionAttempt` (`startedAt`, `completedAt`, `finalCorrect`, `finalAnswerText`) |
| Full chat transcript | `ChatMessage` (`role`, `content`, `createdAt`, `sessionId`, `questionId`) |

### Example SQLite queries (Render **Shell** or local `file:./prisma/render.db`)

```sql
-- Recent logins
SELECT datetime("createdAt") AS at, email, "accessCodeEntered", "clientIp"
FROM "PilotLoginLog"
ORDER BY "createdAt" DESC
LIMIT 50;

-- Sessions with duration (seconds)
SELECT s.id, u.email, s.topic,
       datetime(s."startedAt") AS start_at,
       datetime(s."endedAt") AS end_at,
       ROUND((julianday(s."endedAt") - julianday(s."startedAt")) * 86400) AS seconds
FROM "AssessmentSession" s
JOIN "User" u ON u.id = s."userId"
ORDER BY s."startedAt" DESC
LIMIT 50;

-- Question attempts with time spent (ms)
SELECT a.id, a."sessionId", a."questionId", a."finalCorrect",
       a."startedAt", a."completedAt",
       (strftime('%s', a."completedAt") - strftime('%s', a."startedAt")) * 1000 AS ms
FROM "QuestionAttempt" a
WHERE a."completedAt" IS NOT NULL
ORDER BY a."startedAt" DESC
LIMIT 100;
```

Full chat for one session:

```sql
SELECT datetime("createdAt"), role, substr(content, 1, 120)
FROM "ChatMessage"
WHERE "sessionId" = 'YOUR_SESSION_ID'
ORDER BY "createdAt";
```

## HTTPS on Render

Render provides **HTTPS** for `*.onrender.com` on all tiers. If a browser showed “Not secure”, it was usually **mixed content** (e.g. frontend on `http://` calling an API on `https://`) or a **custom domain** DNS issue—not the lack of SSH. Starter still helps with uptime, scaling, and features.
