import * as fs from "fs";
import * as path from "path";

const BANKS: { topic: string; file: string }[] = [
  { topic: "Statistics", file: "../../statistics_item_bank/statistics_questions.json" },
  { topic: "Linear Algebra", file: "../../linear_algebra_item_bank/linear_algebra_questions.json" },
  { topic: "College Calculus", file: "../../college_calculus_item_bank/college_calculus_questions.json" },
  { topic: "College Linear Algebra", file: "../../linear_algebra_2_item_bank/linear_algebra_2_questions.json" },
];

function countUnescapedDollars(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "$") continue;
    let bs = 0;
    for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) bs++;
    if (bs % 2 === 0) n++;
  }
  return n;
}

function validatePrompt(prompt: string, label: string): string[] {
  const errs: string[] = [];
  const dollars = countUnescapedDollars(prompt);
  if (dollars % 2 === 1) {
    errs.push(`${label}: odd number of unescaped $ (${dollars}) — math delimiters likely broken`);
  }
  const doubleBlocks = prompt.split("$$").length - 1;
  if (doubleBlocks % 2 === 1) {
    errs.push(`${label}: unbalanced $$ display blocks`);
  }
  return errs;
}

type Q = {
  id: string;
  prompt: string;
  type: 'MCQ' | 'FREE_FORM';
  options?: string[];
  correctOptionIndex?: number;
};

function main() {
  const allErrors: string[] = [];

  for (const bank of BANKS) {
    const fullPath = path.join(__dirname, bank.file);
    if (!fs.existsSync(fullPath)) {
      allErrors.push(`Missing file: ${fullPath}`);
      continue;
    }
    const raw = fs.readFileSync(fullPath, "utf-8");
    let data: { questions: Q[] };
    try {
      data = JSON.parse(raw) as { questions: Q[] };
    } catch (e) {
      allErrors.push(`${bank.topic}: invalid JSON — ${e}`);
      continue;
    }
    if (!Array.isArray(data.questions)) {
      allErrors.push(`${bank.topic}: no questions array`);
      continue;
    }

    for (const q of data.questions) {
      const prefix = `${bank.topic} ${q.id}`;
      allErrors.push(...validatePrompt(q.prompt, `${prefix} prompt`));

      if (q.type === "MCQ") {
        if (!q.options || q.options.length !== 4) {
          allErrors.push(`${prefix}: MCQ must have exactly 4 options`);
        }
        if (
          typeof q.correctOptionIndex !== "number" ||
          q.correctOptionIndex < 0 ||
          q.correctOptionIndex > 3
        ) {
          allErrors.push(`${prefix}: correctOptionIndex must be 0–3`);
        }
        if (q.options) {
          q.options.forEach((opt, i) => {
            allErrors.push(...validatePrompt(opt, `${prefix} option[${i}]`));
          });
        }
      }
    }
  }

  if (allErrors.length > 0) {
    console.error("Question bank validation failed:\n");
    for (const e of allErrors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`Question bank validation passed (${BANKS.length} banks).`);
}

main();
