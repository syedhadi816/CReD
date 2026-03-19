/**
 * Export one assessment session (or all sessions for a user) to JSON for download / archiving.
 *
 * Usage (from backend/, with DATABASE_URL set):
 *   npx tsx scripts/export-session.ts --session <sessionId>
 *   npx tsx scripts/export-session.ts --email you@example.com
 *   npx tsx scripts/export-session.ts --email you@example.com --out ./exports/
 *
 * On Render: Web Service → Shell, cd to app root (usually already backend), run the same command;
 * copy JSON from the terminal or redirect: npx tsx scripts/export-session.ts --session ID > session.json
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../src/lib/prisma";

function parseArgs(): { sessionId?: string; email?: string; outDir?: string } {
  const argv = process.argv.slice(2);
  let sessionId: string | undefined;
  let email: string | undefined;
  let outDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--session" && argv[i + 1]) {
      sessionId = argv[++i];
    } else if (argv[i] === "--email" && argv[i + 1]) {
      email = argv[++i];
    } else if (argv[i] === "--out" && argv[i + 1]) {
      outDir = argv[++i];
    }
  }
  return { sessionId, email, outDir };
}

async function buildSessionExport(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { id: true, email: true, createdAt: true } },
      questionAttempts: {
        include: {
          question: {
            select: { id: true, prompt: true, topic: true, type: true },
          },
          stepAttempts: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { startedAt: "asc" },
      },
      chatMessages: {
        orderBy: { createdAt: "asc" },
        include: {
          question: { select: { id: true, prompt: true } },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const logins = await prisma.pilotLoginLog.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const durationMs =
    session.endedAt != null
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : null;

  return {
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      topic: session.topic,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs,
      user: session.user,
    },
    questionAttempts: session.questionAttempts.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      questionPrompt: a.question.prompt,
      questionTopic: a.question.topic,
      questionType: a.question.type,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      timeSpentMs:
        a.completedAt != null
          ? a.completedAt.getTime() - a.startedAt.getTime()
          : null,
      finalCorrect: a.finalCorrect,
      finalAnswerText: a.finalAnswerText,
      stepAttempts: a.stepAttempts.map((s) => ({
        stepIndex: s.stepIndex,
        answerText: s.answerText,
        correct: s.correct,
        createdAt: s.createdAt,
      })),
    })),
    chatMessages: session.chatMessages.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      role: m.role,
      questionId: m.questionId,
      questionPromptPreview: m.question?.prompt?.slice(0, 200) ?? null,
      content: m.content,
    })),
    pilotLoginsForUser: logins.map((l) => ({
      at: l.createdAt,
      email: l.email,
      accessCodeEntered: l.accessCodeEntered,
      clientIp: l.clientIp,
    })),
  };
}

async function main() {
  const { sessionId, email, outDir } = parseArgs();

  if (!sessionId && !email) {
    console.error(
      "Usage:\n  npx tsx scripts/export-session.ts --session <id>\n  npx tsx scripts/export-session.ts --email <email> [--out ./dir]",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const payloads: { filename: string; data: unknown }[] = [];

  if (sessionId) {
    const data = await buildSessionExport(sessionId);
    if (!data) {
      console.error(`Session not found: ${sessionId}`);
      process.exit(1);
    }
    payloads.push({ filename: `session-${sessionId}.json`, data });
  } else if (email) {
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: normalized },
    });
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }
    const sessions = await prisma.assessmentSession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (sessions.length === 0) {
      console.error(`User has no assessment sessions: ${email}`);
      process.exit(1);
    }
    for (const s of sessions) {
      const data = await buildSessionExport(s.id);
      if (data) {
        payloads.push({ filename: `session-${s.id}.json`, data });
      }
    }
  }

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const { filename, data } of payloads) {
      const fp = path.join(outDir, filename);
      fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
      console.error(`Wrote ${fp}`);
    }
  } else {
    if (payloads.length === 1) {
      console.log(JSON.stringify(payloads[0].data, null, 2));
    } else {
      console.log(JSON.stringify(payloads.map((p) => p.data), null, 2));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
