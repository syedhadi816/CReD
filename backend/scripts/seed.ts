import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../src/lib/prisma";

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

async function main() {
  await prisma.accessCode.upsert({
    where: { code: "123456" },
    create: {
      code: "123456",
      maxUses: 100,
      notes: "Default pilot access code",
    },
    update: {},
  });
  await prisma.accessCode.upsert({
    where: { code: "111111" },
    create: {
      code: "111111",
      maxUses: 100,
      notes: "Secondary pilot access code",
    },
    update: {},
  });

  /** Twenty codes to hand out (one per invitee ideally). Pattern: CRE26-01 … CRE26-20. */
  const PILOT_BATCH = 20;
  for (let i = 1; i <= PILOT_BATCH; i++) {
    const code = `CRE26-${String(i).padStart(2, "0")}`;
    await prisma.accessCode.upsert({
      where: { code },
      create: {
        code,
        maxUses: 10,
        notes: `Pilot distribution ${i}/${PILOT_BATCH} (adjust maxUses in seed if needed)`,
      },
      update: {},
    });
  }

  console.log("Access codes ready: 123456, 111111, plus CRE26-01 … CRE26-20.");

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
