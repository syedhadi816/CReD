import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

type CanonicalQuestion = {
  prompt: string;
  type: "MCQ" | "FREE_FORM";
  options?: string[];
  correctOptionIndex?: number;
  llmContext?: unknown;
};

type CanonicalFile = {
  questions: CanonicalQuestion[];
};

async function main() {
  const topic = "College Linear Algebra";
  const canonicalPath = join(process.cwd(), "..", "linear_algebra_2_item_bank", "linear_algebra_2_questions.json");
  const raw = await readFile(canonicalPath, "utf8");
  const parsed = JSON.parse(raw) as CanonicalFile;
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Canonical College Linear Algebra file has no questions.");
  }

  const existing = await prisma.question.findMany({
    where: { topic, userId: null },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (existing.length !== parsed.questions.length) {
    throw new Error(
      `Count mismatch: DB has ${existing.length} public "${topic}" questions, canonical file has ${parsed.questions.length}.`,
    );
  }

  for (let i = 0; i < existing.length; i += 1) {
    const row = existing[i];
    const canonical = parsed.questions[i];
    await prisma.question.update({
      where: { id: row.id },
      data: {
        prompt: canonical.prompt,
        type: canonical.type,
        optionsJson: canonical.type === "MCQ" ? (canonical.options ?? null) : null,
        correctOptionIndex: canonical.type === "MCQ" ? (canonical.correctOptionIndex ?? null) : null,
        stepsJson: (canonical.llmContext ?? {}) as object,
      },
    });
  }

  console.log(`Repaired ${existing.length} "${topic}" questions from canonical source.`);
}

main()
  .catch((err) => {
    console.error("Repair failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
