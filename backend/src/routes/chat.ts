import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { auditLog, truncateForAudit } from "../lib/auditLog";
import { chat as llmChat } from "../services/ollama";

export const router = Router();

const HINT_SYSTEM = `You are a patient, diagnostic math tutor.

Your job is to help the student reason through the problem step by step, without ever giving them a numerical answer (final or intermediate).

General rules:
- NEVER state any numerical result (no intermediate numbers, no final answer).
- When the student seems lost or asks generic questions like "how do I get started", first:
  - Briefly restate the overall goal in plain language.
  - Explicitly name the first conceptual step they should take (e.g. "First, let's arrange the data from least to greatest so it's easier to see patterns").
  - Ask a simple check question to see what they already know (e.g. "Have you seen the idea of mode before? What do you remember about it?").
- Use the current step information from the context:
  - If a current step is indicated, start by naming that step in your own words.
  - Then give a small, concrete hint focused on *that* step only.
- Do not assume the student already knows which step comes first; make the step explicit before asking them to act.
- If they ask "is it X?", you may say whether they are correct or not, but do NOT say what the correct value is.
- Keep replies concise (1–3 short sentences), but you may add a second turn-once the student answers to gently deepen the explanation.

Tone:
- Sound like a human tutor, not a script.
- Use plain, direct language, avoid over-explaining obvious details.

Mathematics formatting (required when you write any math):
- The student UI renders your replies as Markdown with KaTeX.
- Use LaTeX inside dollar signs: inline math as $...$ (e.g. $x^2$, $\\mathbf{A}$, $\\frac{1}{2}$).
- Use display (block) equations on their own lines as $$...$$.
- Use normal LaTeX command syntax (e.g. \\frac, \\sum, Greek letters).
- Never write a backslash immediately before a plain digit in place of a number (wrong: \\3s — use $3s$ or $3s + 5d = 78$). Keep $...$ pairs balanced.
- For equations like $3s + 5d = 78$, wrap the whole expression in one pair of $ delimiters; do not split or drop opening $$ for display math.
- Do not leave stray backslashes at the end of variables or words (wrong: t\\ or r\\). If you need math, write $t$ or $r$ or $dt/dt$ etc.`;

/** Best-effort cleanup for tutor replies so malformed LaTeX/Markdown does not break the UI. */
function sanitizeTutorReply(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    let current = line;
    // Remove stray backslash after a letter when it's not starting a LaTeX command (e.g. "t\" -> "t").
    current = current.replace(/([A-Za-z])\\(?![A-Za-z])/g, "$1");
    // If a line has an odd number of $ symbols, drop all of them so it renders as plain text.
    const dollars = current.match(/\$/g);
    if (dollars && dollars.length % 2 === 1) {
      current = current.replace(/\$/g, "");
    }
    cleaned.push(current);
  }
  return cleaned.join("\n");
}

/** POST /api/chat/activate — prime the LLM with the guide prompt (no visible response). */
router.post("/activate", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const body = z
    .object({
      sessionId: z.string().min(1),
      questionId: z.string().min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "sessionId and questionId required" });
    return;
  }
  const { sessionId, questionId } = body.data;

  try {
    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    if (question.userId && question.userId !== userId) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    const answerType =
      question.type === "MCQ"
        ? "This question is multiple choice. The student selects one of a few answer options."
        : "This question expects a short free-form text or numeric answer from the student.";

    const guidePrompt = [
      "You are a patient, diagnostic math tutor integrated within an assessment interface. Your job is to help the student reason through the problem on their screen step by step, without ever giving them an answer, final or intermediate. Rather, probe the student to reach intermediate conclusions all the way to the final response. If a student is smart and is capable of skipping a few intermediate steps on their own, do not enforce the steps, help exactly where the student is struggling.",
      "",
      "Here's the question the student needs help with:",
      question.prompt,
      "",
      "Answer Options:",
      answerType,
      "",
      "Here's a guide you can reference while tutoring. It's NOT a strict rubric; it's reference info about plausible intermediate steps.",
      "",
      JSON.stringify(question.stepsJson),
      "",
      "Whenever a student answers an intermediate question, be sure to check it for accuracy against the question statement and the guide. If a student gets something wrong, gently tell them what's missing. NEVR directly provide answers. Keep your responses short and explanatory. It is okay for a student to jump steps that are listed in the guide - identify how far a student has made it on their own, then proceed to help exactly from where they need help. Your job is to help the student learn and work through the problem on their own. When a student reaches a correct intermediate or final conclusion, let them know. And tell them to input their response (select if multiple choice and enter if free form).",
      "",
      "When you include equations or formulas in later messages to the student, use Markdown with LaTeX: inline $...$ and display $$...$$ so they render correctly.",
      "",
      "Respond with \"CLAUDE UNDERSTANDS\" after reading this text. You will now be connected to the student.",
    ].join("\n");

    const messages = [{ role: "user" as const, content: guidePrompt }];

    try {
      await llmChat(messages);
    } catch (e) {
      console.error("LLM activation error:", e);
    }

    auditLog("chat_activate", { sessionId, questionId, userId });

    res.status(204).send();
  } catch (e) {
    console.error("Chat activate error:", e);
    res.status(500).json({ error: "Activation failed" });
  }
});

/** POST /api/chat — send a message, get hint from LLM (auth required). */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const body = z
    .object({
      sessionId: z.string().min(1),
      questionId: z.string().min(1),
      message: z.string().min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "sessionId, questionId, and message required" });
    return;
  }
  const { sessionId, questionId, message } = body.data;

  try {
    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    if (question.userId && question.userId !== userId) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    const answerType =
      question.type === "MCQ"
        ? "This question is multiple choice. The student selects one of a few answer options."
        : "This question expects a short free-form text or numeric answer from the student.";

    const systemContent = [
      HINT_SYSTEM,
      "",
      "Question:",
      question.prompt,
      "",
      "Answer format:",
      answerType,
      "",
      "Reference guide (not a strict rubric):",
      JSON.stringify(question.stepsJson),
    ].join("\n");

    const recentMessages = await prisma.chatMessage.findMany({
      where: { sessionId, questionId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });
    const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemContent },
      ...recentMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const stepIndex = 0;
    await prisma.chatMessage.create({
      data: {
        sessionId,
        userId,
        questionId,
        stepIndex,
        role: "user",
        content: message,
      },
    });

    auditLog("chat_user", {
      sessionId,
      questionId,
      userId,
      content: truncateForAudit(message),
    });

    let reply: string;
    try {
      reply = await llmChat(llmMessages);
    } catch (e) {
      console.error("LLM chat error:", e);
      reply =
        "I'm having trouble connecting to the tutor right now. Please check that the LLM provider is configured and reachable.";
    }

    const safeReply = sanitizeTutorReply(reply);

    await prisma.chatMessage.create({
      data: {
        sessionId,
        userId,
        questionId,
        stepIndex,
        role: "assistant",
        content: safeReply,
      },
    });

    auditLog("chat_assistant", {
      sessionId,
      questionId,
      userId,
      content: truncateForAudit(safeReply),
    });

    res.json({ content: safeReply });
  } catch (e) {
    console.error("Chat error:", e);
    res.status(500).json({ error: "Chat failed" });
  }
});
