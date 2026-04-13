import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { AccessCodeAudience } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

/** Effectively unlimited (SQLite INT max). */
const UNLIMITED_USES = 2_147_483_647;

/** Six-digit educator codes: 880101 … 880110 */
const EDUCATOR_CODE_START = 880101;
/** Six-digit student codes: 990101 … 990110 */
const STUDENT_CODE_START = 990101;

const BANKS: { topic: string; file: string }[] = [
  { topic: "Statistics", file: "../../statistics_item_bank/statistics_questions.json" },
  { topic: "Linear Algebra", file: "../../linear_algebra_item_bank/linear_algebra_questions.json" },
  {
    topic: "College Linear Algebra",
    file: "../../linear_algebra_2_item_bank/linear_algebra_2_questions.json",
  },
];

type QuestionRow = {
  id: string;
  prompt: string;
  type: "MCQ" | "FREE_FORM";
  options: string[];
  correctOptionIndex: number | null;
  llmContext: object;
};

/** Remove all questions for a topic and dependent rows (needed when prompts change so DB rows no longer match JSON). */
async function pruneTopicQuestions(topic: string) {
  const questions = await prisma.question.findMany({
    where: { topic },
    select: { id: true },
  });
  const ids = questions.map((x) => x.id);
  if (ids.length === 0) return;

  await prisma.stepAttempt.deleteMany({
    where: { questionAttempt: { questionId: { in: ids } } },
  });
  await prisma.questionAttempt.deleteMany({
    where: { questionId: { in: ids } },
  });
  await prisma.chatMessage.deleteMany({
    where: { questionId: { in: ids } },
  });
  await prisma.question.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`[${topic}] Pruned ${ids.length} existing question(s) and related attempts/messages.`);
}

async function seedTopic(topic: string, relativePath: string) {
  const fullPath = path.join(__dirname, relativePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const data = JSON.parse(raw) as { questions: QuestionRow[] };

  // Item bank uses stable ids (e.g. LA-Q1). Prompt edits used to orphan old rows because upsert matched on full prompt text.
  const wipeTopicFirst =
    topic === "Linear Algebra" || topic === "College Linear Algebra";
  if (wipeTopicFirst) {
    await pruneTopicQuestions(topic);
  }

  for (const q of data.questions) {
    const existing = wipeTopicFirst
      ? null
      : await prisma.question.findFirst({
          where: { topic, prompt: q.prompt },
        });
    const baseData = {
      topic,
      prompt: q.prompt,
      finalAnswer: "",
      type: q.type,
      optionsJson: q.options as unknown as object,
      correctOptionIndex: q.correctOptionIndex,
      stepsJson: q.llmContext as object,
    };
    if (existing) {
      await prisma.question.update({
        where: { id: existing.id },
        data: baseData,
      });
      console.log(`[${topic}] Updated:`, q.id);
    } else {
      await prisma.question.create({
        data: baseData,
      });
      console.log(`[${topic}] Created:`, q.id);
    }
  }
}

async function seedAccessCodes() {
  await prisma.accessCode.deleteMany({});

  const educatorRows = Array.from({ length: 10 }, (_, i) => ({
    code: String(EDUCATOR_CODE_START + i),
    audience: AccessCodeAudience.EDUCATOR,
    maxUses: UNLIMITED_USES,
    usedCount: 0,
    notes: `Educator preset ${i + 1}/10`,
  }));
  const studentRows = Array.from({ length: 10 }, (_, i) => ({
    code: String(STUDENT_CODE_START + i),
    audience: AccessCodeAudience.STUDENT,
    maxUses: UNLIMITED_USES,
    usedCount: 0,
    notes: `Student preset ${i + 1}/10`,
  }));

  await prisma.accessCode.createMany({ data: [...educatorRows, ...studentRows] });
  console.log(
    `Access codes: 10 educators (${EDUCATOR_CODE_START}–${EDUCATOR_CODE_START + 9}), 10 students (${STUDENT_CODE_START}–${STUDENT_CODE_START + 9}), unlimited uses.`,
  );
}

async function main() {
  await seedAccessCodes();

  for (const bank of BANKS) {
    await seedTopic(bank.topic, bank.file);
  }
  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
