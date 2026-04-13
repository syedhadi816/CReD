import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { auditLog } from "../lib/auditLog";
import { getFinalStepIndexFromStepsJson } from "../lib/questionSteps";
import { MY_QUESTIONS_TOPIC } from "../lib/topics";

export const router = Router();

function bearerUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return token && token.length > 0 ? token : null;
}

// Fixed paths must come before /:id so "topics", "attempts", "sessions" are not parsed as id.

/** GET /api/questions/topics — public curriculum topics only (educator-administered items stay in the educator sandbox, not here). */
router.get("/topics", (_req: Request, res: Response) => {
  res.json([
    {
      id: "Statistics",
      name: "Statistics",
      description: "8th Grade Statistics Assessment",
    },
    {
      id: "Linear Algebra",
      name: "Linear Algebra",
      description: "High School Linear Algebra Assessment",
    },
    {
      id: "College Linear Algebra",
      name: "College Linear Algebra",
      description: "College Linear Algebra Assessment",
    },
  ]);
});

/** POST /api/questions/sessions — create assessment session (auth required). */
router.post("/sessions", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const body = z.object({ topic: z.string().min(1) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "topic required" });
    return;
  }
  try {
    const session = await prisma.assessmentSession.create({
      data: { userId, topic: body.data.topic },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    auditLog("assessment_session_start", {
      sessionId: session.id,
      userId,
      email: user?.email,
      topic: body.data.topic,
      startedAt: session.startedAt.toISOString(),
    });
    res.json({ sessionId: session.id });
  } catch (e) {
    console.error("Create session error:", e);
    res.status(500).json({ error: "Failed to create session" });
  }
});

/** POST /api/questions/sessions/:sessionId/end — mark assessment session ended (for duration logs). */
router.post("/sessions/:sessionId/end", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const sessionId = String(req.params.sessionId ?? "");
  try {
    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId },
      include: { user: { select: { email: true } } },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.endedAt) {
      const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
      res.json({ ok: true, alreadyEnded: true, durationMs });
      return;
    }
    const endedAt = new Date();
    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: { endedAt },
    });
    const durationMs = endedAt.getTime() - session.startedAt.getTime();
    auditLog("assessment_session_end", {
      sessionId,
      userId,
      email: session.user.email,
      topic: session.topic,
      durationMs,
      startedAt: session.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    });
    res.json({ ok: true, durationMs });
  } catch (e) {
    console.error("End session error:", e);
    res.status(500).json({ error: "Failed to end session" });
  }
});

/** POST /api/questions/sessions/:sessionId/attempts — start question attempt. */
router.post("/sessions/:sessionId/attempts", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const sessionId = String(req.params.sessionId ?? "");
  const body = z.object({ questionId: z.string().min(1) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "questionId required" });
    return;
  }
  try {
    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const q = await prisma.question.findFirst({ where: { id: body.data.questionId } });
    if (!q || q.topic !== session.topic) {
      res.status(400).json({ error: "Question does not match this session topic" });
      return;
    }
    if (q.userId && q.userId !== userId) {
      res.status(403).json({ error: "Not allowed for this question" });
      return;
    }
    const attempt = await prisma.questionAttempt.create({
      data: {
        sessionId,
        questionId: body.data.questionId,
      },
    });
    auditLog("question_attempt_start", {
      attemptId: attempt.id,
      sessionId,
      userId,
      questionId: body.data.questionId,
      startedAt: attempt.startedAt.toISOString(),
    });
    res.json({ attemptId: attempt.id });
  } catch (e) {
    console.error("Create attempt error:", e);
    res.status(500).json({ error: "Failed to create attempt" });
  }
});

/** GET /api/questions/attempts/:attemptId — get progress (completed step indices). */
router.get("/attempts/:attemptId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const attemptId = String(req.params.attemptId ?? "");
  try {
    const attempt = await prisma.questionAttempt.findFirst({
      where: { id: attemptId, session: { userId } },
      include: { stepAttempts: true },
    });
    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }
    const steps = (attempt as { stepAttempts: { correct: boolean | null; stepIndex: number }[] }).stepAttempts;
    const completedStepIndices = steps
      .filter((s: { correct: boolean | null }) => s.correct === true)
      .map((s: { stepIndex: number }) => s.stepIndex);
    res.json({ completedStepIndices: [...new Set(completedStepIndices)].sort((a: number, b: number) => a - b) });
  } catch (e) {
    console.error("Get attempt error:", e);
    res.status(500).json({ error: "Failed to get attempt" });
  }
});

/** POST /api/questions/attempts/:attemptId/check — submit step answer, get correct/incorrect. */
router.post("/attempts/:attemptId/check", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const attemptId = String(req.params.attemptId ?? "");
  const body = z
    .object({
      stepIndex: z.number().int().min(0),
      answer: z.string(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "stepIndex and answer required" });
    return;
  }
  try {
    const attempt = await prisma.questionAttempt.findFirst({
      where: { id: attemptId, session: { userId } },
      include: { question: true },
    });
    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }
    const question = attempt.question;
    const finalStepIndex = getFinalStepIndexFromStepsJson(question.stepsJson);
    const isFinalCheck = body.data.stepIndex === finalStepIndex;

    const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

    let correct = false;
    if (question.type === "MCQ") {
      const options = (question.optionsJson as unknown as string[] | null) ?? null;
      const correctIndex = question.correctOptionIndex;
      const expectedOption =
        options && typeof correctIndex === "number" ? options[correctIndex] : undefined;
      correct = expectedOption ? normalize(body.data.answer) === normalize(expectedOption) : false;
    } else {
      // FREE_FORM: keep this conservative until a finalAnswer rubric is added per question.
      // We still record the attempt for analytics, but we don't mark it correct.
      correct = false;
    }

    await prisma.stepAttempt.create({
      data: {
        questionAttemptId: attemptId,
        stepIndex: body.data.stepIndex,
        answerText: body.data.answer,
        correct,
      },
    });
    const completedNow = await prisma.stepAttempt.findMany({
      where: { questionAttemptId: attemptId, correct: true },
      select: { stepIndex: true },
    });
    const completedIndices = [...new Set(completedNow.map((s) => s.stepIndex))].sort((a, b) => a - b);

    if (isFinalCheck) {
      const completedAt = new Date();
      await prisma.questionAttempt.update({
        where: { id: attemptId },
        data: {
          completedAt,
          finalCorrect: correct,
          finalAnswerText: body.data.answer,
        },
      });
      const started = attempt.startedAt;
      const timeSpentMs = completedAt.getTime() - started.getTime();
      auditLog("question_attempt_complete", {
        attemptId,
        sessionId: attempt.sessionId,
        questionId: question.id,
        userId,
        finalCorrect: correct,
        timeSpentMs,
        startedAt: started.toISOString(),
        completedAt: completedAt.toISOString(),
      });
    }

    res.json({ correct, completedStepIndices: completedIndices });
  } catch (e) {
    console.error("Check step error:", e);
    res.status(500).json({ error: "Failed to check answer" });
  }
});

/** GET /api/questions?topic= — list questions for topic (id, prompt only). */
router.get("/", async (req: Request, res: Response) => {
  const topic = (req.query.topic as string)?.trim();
  if (!topic) {
    res.status(400).json({ error: "topic required" });
    return;
  }
  try {
    const uid = bearerUserId(req);
    if (topic === MY_QUESTIONS_TOPIC) {
      if (!uid) {
        res.status(401).json({ error: "Authorization required for My questions" });
        return;
      }
      const questions = await prisma.question.findMany({
        where: { topic: MY_QUESTIONS_TOPIC, userId: uid },
        select: { id: true, prompt: true },
        orderBy: { id: "asc" },
      });
      res.json(questions);
      return;
    }

    const questions = await prisma.question.findMany({
      where: { topic, userId: null },
      select: { id: true, prompt: true },
      orderBy: { id: "asc" },
    });
    res.json(questions);
  } catch (e) {
    console.error("List questions error:", e);
    res.status(500).json({ error: "Failed to list questions" });
  }
});

/** GET /api/questions/:id — get question for UI. */
router.get("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  try {
    const q = await prisma.question.findUnique({ where: { id } });
    if (!q) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    if (q.userId) {
      const uid = bearerUserId(req);
      if (!uid || uid !== q.userId) {
        res.status(404).json({ error: "Question not found" });
        return;
      }
    }
    const finalStepIndex = getFinalStepIndexFromStepsJson(q.stepsJson);
    res.json({
      id: q.id,
      prompt: q.prompt,
      topic: q.topic,
      type: q.type,
      options: (q.optionsJson as unknown as string[] | null) ?? null,
      correctOptionIndex: q.correctOptionIndex,
      /** Aligns client final "Check" with server completion + analytics. */
      finalStepIndex,
    });
  } catch (e) {
    console.error("Get question error:", e);
    res.status(500).json({ error: "Failed to get question" });
  }
});
