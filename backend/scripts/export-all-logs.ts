/**
 * ONE-SHOT EXPORT: everything useful for pilot review in a single JSON file.
 *
 * From the backend app directory (Render Shell or local), run:
 *   npm run export-all-logs
 *
 * Creates: all-pilot-logs.json in the current directory (override with --out path).
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../src/lib/prisma";

const DEFAULT_OUT = "all-pilot-logs.json";

function parseOutArg(): string {
  const i = process.argv.indexOf("--out");
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return DEFAULT_OUT;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const outFile = path.resolve(process.cwd(), parseOutArg());

  const [pilotLoginLog, users, accessCodes, sessions] = await Promise.all([
    prisma.pilotLoginLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, createdAt: true },
    }),
    prisma.accessCode.findMany({
      orderBy: { code: "asc" },
      select: {
        code: true,
        email: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        notes: true,
      },
    }),
    prisma.assessmentSession.findMany({
      orderBy: { startedAt: "asc" },
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
        questionAttempts: {
          orderBy: { startedAt: "asc" },
          include: {
            question: {
              select: { id: true, prompt: true, topic: true, type: true },
            },
            stepAttempts: { orderBy: { createdAt: "asc" } },
          },
        },
        chatMessages: {
          orderBy: { createdAt: "asc" },
          include: {
            question: { select: { id: true, prompt: true } },
          },
        },
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    summary: {
      pilotLoginEvents: pilotLoginLog.length,
      users: users.length,
      accessCodes: accessCodes.length,
      assessmentSessions: sessions.length,
      questionAttempts: sessions.reduce((n, s) => n + s.questionAttempts.length, 0),
      chatMessages: sessions.reduce((n, s) => n + s.chatMessages.length, 0),
    },
    pilotLoginLog,
    users,
    accessCodes,
    assessmentSessions: sessions.map((s) => ({
      id: s.id,
      topic: s.topic,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMs:
        s.endedAt != null ? s.endedAt.getTime() - s.startedAt.getTime() : null,
      user: s.user,
      questionAttempts: s.questionAttempts.map((a) => ({
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
        stepAttempts: a.stepAttempts,
      })),
      chatMessages: s.chatMessages.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        role: m.role,
        questionId: m.questionId,
        questionPromptPreview: m.question?.prompt?.slice(0, 300) ?? null,
        content: m.content,
      })),
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(outFile, json, "utf-8");
  const mb = (Buffer.byteLength(json, "utf-8") / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${outFile} (${mb} MB)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
