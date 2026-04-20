import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { MY_QUESTIONS_TOPIC } from "../lib/topics";
import { renderMarkdownToTrustedHtml, renderOptionsToTrustedHtml } from "../lib/markdownRenderer";
import { chat, type LLMMessage } from "../services/ollama";

export const router = Router();

const GenerateBody = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  numQuestions: z.coerce.number().int().min(1).max(50),
  gradeLevel: z.string().min(1, "Grade level is required"),
  /** Full text of questions already in this session; model must use different scenarios, not re-skin these. */
  existingPrompts: z.array(z.string().max(25000)).max(80).optional(),
});

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fence?.[1] != null ? fence[1].trim() : trimmed;
  const start = inner.indexOf("[");
  const end = inner.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON array found in model response");
  }
  return JSON.parse(inner.slice(start, end + 1));
}

function normalizeQuestionText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseRefinePromptFromRaw(raw: string): string | null {
  let data: unknown;
  try {
    data = extractJsonObject(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || !("prompt" in data)) {
    return null;
  }
  const p = (data as { prompt: unknown }).prompt;
  if (typeof p !== "string" || !p.trim()) {
    return null;
  }
  return p.trim();
}

/**
 * Extract first top-level JSON object. Uses brace depth outside strings so prompts with `}` (e.g. LaTeX)
 * do not break `lastIndexOf("}")` parsing.
 */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fence?.[1] != null ? fence[1].trim() : trimmed;
  const start = inner.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in model response");
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < inner.length; i++) {
    const c = inner[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
    } else {
      if (c === '"') {
        inString = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(inner.slice(start, i + 1));
        }
      }
    }
  }
  throw new Error("Unbalanced or invalid JSON object in model response");
}

const RefineBody = z
  .object({
    baseQuestion: z.string().min(1),
    mode: z.enum(["instruction", "difficulty_up", "difficulty_down"]),
    educatorInstruction: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "instruction" && (!data.educatorInstruction || !data.educatorInstruction.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "educatorInstruction is required when mode is instruction",
        path: ["educatorInstruction"],
      });
    }
  });

/** POST /api/educator/generate-questions — Claude generates question stems for educators (auth required). */
router.post("/generate-questions", requireAuth, async (req: Request, res: Response) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().formErrors.join(" ") || "Invalid body" });
    return;
  }

  const { prompt, numQuestions, gradeLevel, existingPrompts } = parsed.data;
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  if (provider !== "anthropic") {
    res.status(503).json({
      error: "Educator question generation requires LLM_PROVIDER=anthropic and CLAUDE_API_KEY in .env",
    });
    return;
  }

  const prior = (existingPrompts ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
  const diversityBlock =
    prior.length > 0
      ? `

Diversity (mandatory when prior questions are listed below):
- Each NEW question must use a **meaningfully different real-world scenario** from every prior question: change the setting, cast of characters, and story structure—not only different numbers or one extra sentence on the same template (e.g. do not output another "two products, two days of sales" bakery problem if one is already listed unless the educator context strictly requires it and even then prefer a different domain such as sports, travel, chemistry mixes, subscriptions, or rates).
- Do **not** paraphrase or lightly edit a prior question; invent fresh contexts that still satisfy the educator's topic and grade level.
- If you generate multiple questions in one response, each must differ from the others and from all listed priors in scenario type.`
      : "";

  const system = `You generate assessment questions for educators using Claude.

Requirements for EVERY question:
- Prefer **word problems** and **application-based** scenarios (realistic context, modeling, interpretation).
- Make them **cognitively demanding**: multi-step reasoning, explaining choices, analyzing a situation—not simple recall or one-step plug-in facts.
- Avoid bare vocabulary or "what is the definition of…" unless the educator explicitly asked for definitions.
- Questions must match the educator's topic and the stated grade level.${diversityBlock}

Output ONLY valid JSON: a single array of exactly ${numQuestions} objects. Each object has one key "prompt" whose value is the full question text for students (clear, self-contained). No markdown outside LaTeX in the prompt if needed, no explanation, no code fences—only the JSON array.`;

  const priorSection =
    prior.length > 0
      ? [
          "",
          "Questions already generated in this session (do not repeat these scenarios or close variants):",
          ...prior.map((text, i) => `--- Prior ${i + 1} ---\n${text}`),
          "",
        ].join("\n")
      : "";

  const userContent = [
    `Grade level: ${gradeLevel}`,
    "",
    "Educator instructions / context (use this to shape topics and constraints):",
    prompt,
    priorSection,
    `Generate exactly ${numQuestions} distinct questions that follow the cognitive and word-problem requirements above${
      prior.length > 0 ? ", and that diversify away from every prior question listed above" : ""
    }.`,
  ].join("\n");

  const messages: LLMMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  const maxTokens = Math.min(16384, Math.max(2048, numQuestions * 400));

  try {
    const raw = await chat(messages, { maxTokens });
    let data: unknown;
    try {
      data = extractJsonArray(raw);
    } catch {
      res.status(502).json({ error: "Could not parse model output as JSON. Try fewer questions or a shorter prompt." });
      return;
    }
    if (!Array.isArray(data)) {
      res.status(502).json({ error: "Model did not return a JSON array" });
      return;
    }
    const questions: { id: string; prompt: string }[] = [];
    for (const item of data) {
      if (questions.length >= numQuestions) break;
      if (item && typeof item === "object" && "prompt" in item) {
        const p = (item as { prompt: unknown }).prompt;
        if (typeof p === "string" && p.trim()) {
          questions.push({ id: randomUUID(), prompt: p.trim() });
        }
      }
    }
    if (questions.length === 0) {
      res.status(502).json({ error: "Model returned no usable questions" });
      return;
    }
    if (questions.length < numQuestions) {
      res.status(200).json({
        questions,
        warning: `Only ${questions.length} of ${numQuestions} questions could be parsed. Try again or lower the count.`,
      });
      return;
    }
    res.json({ questions });
  } catch (e) {
    console.error("Educator generate error:", e);
    const msg = e instanceof Error ? e.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

/** POST /api/educator/refine-question — rewrite one question (instruction-only or marginal difficulty). */
router.post("/refine-question", requireAuth, async (req: Request, res: Response) => {
  const parsed = RefineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().formErrors.join(" ") || "Invalid body" });
    return;
  }

  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  if (provider !== "anthropic") {
    res.status(503).json({
      error: "Educator tools require LLM_PROVIDER=anthropic and CLAUDE_API_KEY in .env",
    });
    return;
  }

  const { baseQuestion, mode, educatorInstruction } = parsed.data;

  let system: string;
  let userContent: string;

  if (mode === "instruction") {
    const instr = (educatorInstruction ?? "").trim();
    system = `You revise a single assessment question. Apply ONLY what the educator asks in their instruction—do not add other goals or constraints. Keep it one self-contained question. Output ONLY valid JSON with one key "prompt" (the full revised question text). No markdown fences, no extra keys.`;
    userContent = [
      "Current question:",
      baseQuestion,
      "",
      "Educator instruction (follow this and nothing else):",
      instr,
    ].join("\n");
  } else if (mode === "difficulty_up") {
    system = `You revise a single assessment question. **Increase** challenge by a clear step (e.g. an extra constraint, interpretation, or reasoning link)—not a trivial word swap. Keep the same core topic and learning goal.

**You must produce text that is meaningfully different from the input** (not the same question re-pasted). If you cannot add difficulty without breaking the task, still rephrase and add one modest intellectual demand.

The result must remain an application/word-problem style task with real reasoning when the original was—avoid collapsing to bare recall.

Output ONLY valid JSON with one key "prompt". The value must be one JSON string; escape double quotes as \\". No markdown fences, no text outside the JSON.`;
    userContent = ["Revise this question (harder; output must not duplicate the original verbatim):", "", baseQuestion].join("\n");
  } else {
    system = `You revise a single assessment question to make it **clearly easier** while preserving the same core topic and learning goal.

**You must produce text that is meaningfully different from the input**—do not return the same wording, and do not only change a few synonyms. The student should face less cognitive load.

Concrete ways to simplify (use one or more when they fit): remove or merge a sub-part; drop one "explain why" or extension prompt; make the numerical or situational setup more direct; add one clarifying given if the stem was ambiguous; shorten a long multi-step ask into fewer demands while keeping one coherent task.

The result should still be a proper assessment question (not empty fluff), but it may be less demanding than the original.

Output ONLY valid JSON with one key "prompt". The value must be a single JSON string; escape any double quotes inside the question as \\". If the question includes LaTeX, keep it inside the string. No markdown fences, no text before or after the JSON.`;
    userContent = ["Revise this question (easier; output must be visibly different from the input):", "", baseQuestion].join("\n");
  }

  const messages: LLMMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  try {
    let raw = await chat(messages, { maxTokens: 8192 });
    let promptOut = parseRefinePromptFromRaw(raw);

    if (promptOut == null) {
      res.status(502).json({ error: "Could not parse refined question JSON" });
      return;
    }

    const shouldRetryUnchanged =
      (mode === "difficulty_up" || mode === "difficulty_down") &&
      normalizeQuestionText(promptOut) === normalizeQuestionText(baseQuestion);

    if (shouldRetryUnchanged) {
      const nudge =
        mode === "difficulty_down"
          ? "Your last JSON repeated the original question (same wording). Respond again with ONLY valid JSON { \"prompt\": \"...\" }. Rewrite so the task is clearly easier: remove a sub-question, shorten explanations asked for, or simplify the setup—and use substantially different wording."
          : "Your last JSON repeated the original question (same wording). Respond again with ONLY valid JSON { \"prompt\": \"...\" }. Rewrite so the task is clearly harder—add a constraint or reasoning step—and use substantially different wording.";
      raw = await chat([...messages, { role: "user", content: nudge }], { maxTokens: 8192 });
      const second = parseRefinePromptFromRaw(raw);
      if (second != null) {
        promptOut = second;
      }
    }

    res.json({ prompt: promptOut });
  } catch (e) {
    console.error("Educator refine error:", e);
    const msg = e instanceof Error ? e.message : "Refine failed";
    res.status(500).json({ error: msg });
  }
});

const KeptPromptsBody = z.object({
  prompts: z.array(z.string().max(25000)).min(1).max(40),
});

const SolutionsJsonSchema = z.object({
  solutions: z.array(z.object({ solution: z.string() })),
});

const McqAdministerSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).length(4),
  correctOptionIndex: z.number().int().min(0).max(3),
  llmContext: z.unknown(),
});

const GroundTruthAnswerSchema = z.object({
  answer: z.string().min(1),
});

const SemanticOptionMatchSchema = z.object({
  correctOptionIndex: z.union([z.number().int().min(0).max(3), z.null()]),
});

const GROUND_TRUTH_SYSTEM = `You are a careful math tutor solving assessment items. Output ONLY valid JSON with one object: {"answer":"..."}.

The "answer" must be the definitive correct result in the shortest form that could appear as one multiple-choice option (number, expression, or short phrase). No explanation, no markdown fences.`;

function stripMcqLabel(s: string): string {
  return s.replace(/^\s*\(?[A-Za-z]\)?[\.\)]\s*/, "").trim();
}

function normalizeComparable(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** First index whose text matches canonical truth (normalized), or -1. */
function findMatchingOptionIndex(options: string[], truth: string): number {
  const t = normalizeComparable(stripMcqLabel(truth));
  if (!t) return -1;
  for (let i = 0; i < options.length; i++) {
    const o = normalizeComparable(stripMcqLabel(options[i]!));
    if (o === t) return i;
  }
  for (let i = 0; i < options.length; i++) {
    const o = normalizeComparable(stripMcqLabel(options[i]!));
    if (o.includes(t) || t.includes(o)) {
      const minLen = Math.min(o.length, t.length);
      if (minLen >= 4 || /^\d/.test(t)) return i;
    }
  }
  return -1;
}

async function resolveGroundTruthAnswer(stem: string): Promise<string | null> {
  try {
    const raw = await chat(
      [
        { role: "system", content: GROUND_TRUTH_SYSTEM },
        {
          role: "user",
          content: `Solve this. Reply with JSON only as specified.\n\nQuestion:\n\n${stem}`,
        },
      ],
      { maxTokens: 2048, temperature: 0 },
    );
    const data = extractJsonObject(raw);
    const p = GroundTruthAnswerSchema.safeParse(data);
    return p.success ? p.data.answer.trim() : null;
  } catch {
    return null;
  }
}

/** When string match fails (e.g. 0.5 vs 1/2), ask which option is mathematically the same as truth. */
async function resolveSemanticOptionIndex(truth: string, options: string[]): Promise<number | null> {
  const system = `You match a canonical correct answer to multiple-choice options. Output ONLY valid JSON: {"correctOptionIndex":0|1|2|3} if exactly one option is mathematically equivalent to the canonical answer, else {"correctOptionIndex":null}. No other keys.`;

  const user = [
    "Canonical correct answer:",
    truth,
    "",
    "Options:",
    ...options.map((o, i) => `${i}: ${o}`),
    "",
    "Which single option index (if any) matches?",
  ].join("\n");

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { maxTokens: 512, temperature: 0 },
    );
    const data = extractJsonObject(raw);
    const p = SemanticOptionMatchSchema.safeParse(data);
    if (!p.success || p.data.correctOptionIndex == null) return null;
    return p.data.correctOptionIndex;
  } catch {
    return null;
  }
}

/** pdfkit is plain text only — strip markdown/LaTeX delimiters so PDFs read cleanly. */
function stripMarkdownForPdf(s: string): string {
  let t = s.replace(/\r\n/g, "\n");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
  t = t.replace(/\$([^$\n]+)\$/g, "$1");
  t = t.replace(/^#{1,6}\s*/gm, "");
  return t.trim();
}

function buildPdfBuffer(prompts: string[], solutions: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(14).text("CReD — Questions and solutions", { underline: true });
    doc.moveDown();
    for (let i = 0; i < prompts.length; i++) {
      doc.fontSize(11).font("Helvetica-Bold").text(`Question ${i + 1}`);
      doc.font("Helvetica").text(prompts[i] ?? "", { width: 500 });
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text("Solution");
      doc.font("Helvetica").text(stripMarkdownForPdf(solutions[i] ?? ""), { width: 500 });
      doc.moveDown(1.2);
    }
    doc.end();
  });
}

const ADMINISTER_SYSTEM = `You prepare assessment content for a math learning platform.

Convert the educator's free-form question into one multiple-choice item for students.
The administered stem must remain the same educator question (same scenario, entities, and numbers).
Do not replace it with a different setup; only adapt it into MCQ form.

**Output ONLY valid JSON** with one object:
{
  "prompt": string — the MCQ stem, preserving the educator question content.
  "options": string[] — exactly 4 distinct options.
  "correctOptionIndex": number — 0–3 for the correct option.
  "llmContext": {
    "overviewText": string — what the problem is about; learning goal (for an AI tutor, not the student rubric).
    "nodes": [ { "id": string, "title": string, "reference": string } ] — 3–6 nodes with hints and concept reminders that do NOT state the final numeric answer outright; follow the style of worked-answer guides.
    "note": "This is reference guidance only. It is not a strict rubric."
  }

Distractors must be plausible but incorrect. Exactly one option must be mathematically correct — re-check all arithmetic before answering.

No markdown fences—only the JSON object.

The "prompt" string must stay faithful to the educator question, but the server stores the exact educator text shown above — you may still echo it in JSON.`;

/** POST /api/educator/export-pdf — answer key PDF for kept prompts (Claude + pdfkit). */
router.post("/export-pdf", requireAuth, async (req: Request, res: Response) => {
  const parsed = KeptPromptsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "prompts array (1–40) required" });
    return;
  }
  const { prompts } = parsed.data;
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  if (provider !== "anthropic") {
    res.status(503).json({
      error: "Export requires LLM_PROVIDER=anthropic and CLAUDE_API_KEY in .env",
    });
    return;
  }

  const system = `You write clear answer keys for math educators. Be accurate and concise.

IMPORTANT for the PDF: solution strings must be **plain text only** — no markdown (no **, no #), no LaTeX dollar delimiters ($ or $$). Write math in readable plain form (e.g. 3s + 5d = 78, fractions as a/b or "one half").`;
  const userContent = [
    "For each question below, write a worked solution (answer key).",
    "Output ONLY valid JSON: { \"solutions\": [ { \"solution\": \"...\" } ] } with the SAME number of entries as questions, in the SAME order.",
    "",
    ...prompts.map((p, i) => `Question ${i + 1}:\n${p}`),
  ].join("\n\n---\n\n");

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      { maxTokens: 16384 },
    );
    let data: unknown;
    try {
      data = extractJsonObject(raw);
    } catch {
      res.status(502).json({ error: "Could not parse solutions JSON from model" });
      return;
    }
    const solParsed = SolutionsJsonSchema.safeParse(data);
    if (!solParsed.success) {
      res.status(502).json({ error: "Invalid solutions shape from model" });
      return;
    }
    let rows = solParsed.data.solutions;
    while (rows.length < prompts.length) {
      rows = [...rows, { solution: "(Solution not generated.)" }];
    }
    if (rows.length > prompts.length) {
      rows = rows.slice(0, prompts.length);
    }
    const solutionTexts = rows.map((r) => r.solution);
    const pdf = await buildPdfBuffer(prompts, solutionTexts);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="cred-questions.pdf"');
    res.send(pdf);
  } catch (e) {
    console.error("Educator export-pdf error:", e);
    const msg = e instanceof Error ? e.message : "Export failed";
    res.status(500).json({ error: msg });
  }
});

/** POST /api/educator/administer — MCQ + tutor guide per prompt; store in user's item bank. */
router.post("/administer", requireAuth, async (req: Request, res: Response) => {
  const parsed = KeptPromptsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "prompts array (1–40) required" });
    return;
  }
  const { prompts } = parsed.data;
  const userId = (req as Request & { userId: string }).userId;
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  if (provider !== "anthropic") {
    res.status(503).json({
      error: "Administer requires LLM_PROVIDER=anthropic and CLAUDE_API_KEY in .env",
    });
    return;
  }

  const createdIds: string[] = [];
  const errors: { index: number; detail: string }[] = [];

  const mcqMaxAttempts = 3;

  for (let i = 0; i < prompts.length; i++) {
    const stem = prompts[i] ?? "";
    const truth = await resolveGroundTruthAnswer(stem);
    if (!truth) {
      errors.push({ index: i, detail: "Could not resolve correct answer for question" });
      continue;
    }

    let stored = false;
    for (let genAttempt = 0; genAttempt < mcqMaxAttempts && !stored; genAttempt++) {
      try {
        const userContent =
          genAttempt === 0
            ? [
                "Definitive correct answer — exactly ONE of the four MCQ options MUST express this result (same value/meaning; wording can match typical MCQ style but must be reconcilable with the string below):",
                truth,
                "",
                "Educator question:",
                stem,
              ].join("\n")
            : [
                "Your previous JSON was invalid, unparsable, or the four options did not contain the definitive correct answer.",
                "",
                "Definitive correct answer (one option must match this — regenerate all four options if needed):",
                truth,
                "",
                "Regenerate a complete valid JSON object per the system instructions. Keep the educator question as the stem content; only add MCQ structure and four distinct options including the correct one.",
                "",
                "Educator question:",
                stem,
              ].join("\n");

        const raw = await chat(
          [{ role: "system", content: ADMINISTER_SYSTEM }, { role: "user", content: userContent }],
          { maxTokens: 8192, temperature: 0 },
        );
        let data: unknown;
        try {
          data = extractJsonObject(raw);
        } catch {
          if (genAttempt === mcqMaxAttempts - 1) errors.push({ index: i, detail: "Could not parse MCQ JSON" });
          continue;
        }
        const m = McqAdministerSchema.safeParse(data);
        if (!m.success) {
          if (genAttempt === mcqMaxAttempts - 1) errors.push({ index: i, detail: "Invalid MCQ shape" });
          continue;
        }
        const opts = m.data.options;
        let verifiedIdx = findMatchingOptionIndex(opts, truth);
        if (verifiedIdx === -1) {
          const semIdx = await resolveSemanticOptionIndex(truth, opts);
          if (semIdx != null) verifiedIdx = semIdx;
        }
        if (verifiedIdx === -1) {
          if (genAttempt === mcqMaxAttempts - 1) {
            errors.push({ index: i, detail: "MCQ options never included resolved correct answer" });
          }
          continue;
        }

        const correct = opts[verifiedIdx] ?? "";
        if (!correct.trim()) {
          if (genAttempt === mcqMaxAttempts - 1) errors.push({ index: i, detail: "Empty option after alignment" });
          continue;
        }
        const promptHtml = await renderMarkdownToTrustedHtml(stem);
        const optionsHtml = await renderOptionsToTrustedHtml(opts);
        const row = await prisma.question.create({
          data: {
            topic: MY_QUESTIONS_TOPIC,
            userId,
            prompt: stem,
            promptHtml,
            finalAnswer: correct,
            type: "MCQ",
            optionsJson: opts,
            optionsHtml: optionsHtml as unknown as object,
            correctOptionIndex: verifiedIdx,
            stepsJson: m.data.llmContext as object,
          },
        });
        createdIds.push(row.id);
        stored = true;
      } catch (e) {
        if (genAttempt === mcqMaxAttempts - 1) {
          errors.push({ index: i, detail: e instanceof Error ? e.message : "Failed" });
        }
      }
    }
  }

  if (createdIds.length === 0 && errors.length > 0) {
    res.status(502).json({
      error: "Could not create any questions",
      errors,
    });
    return;
  }

  res.json({
    created: createdIds.length,
    questionIds: createdIds,
    errors: errors.length ? errors : undefined,
  });
});

/** GET /api/educator/bank-count — administered MCQ count for Student Testing Sandbox. */
router.get("/bank-count", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  try {
    const count = await prisma.question.count({
      where: { userId, topic: MY_QUESTIONS_TOPIC },
    });
    res.json({ count });
  } catch (e) {
    console.error("Educator bank-count error:", e);
    res.status(500).json({ error: "Failed to count bank items" });
  }
});
