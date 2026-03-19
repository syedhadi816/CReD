import type { QuestionNodeChain, QuestionStepNode } from "../types/questionChain";

/** Asserts that a question's stepsJson is a valid QuestionNodeChain (call after loading from DB). */
export function parseQuestionChain(stepsJson: unknown): QuestionNodeChain | null {
  if (!stepsJson || typeof stepsJson !== "object") return null;
  const raw = stepsJson as Record<string, unknown>;
  if (!raw.overview || !Array.isArray(raw.steps)) return null;
  const overview = raw.overview as QuestionNodeChain["overview"];
  const steps = raw.steps as QuestionStepNode[];
  if (
    typeof overview.summary !== "string" ||
    typeof overview.learningGoal !== "string" ||
    !Array.isArray(overview.keyConcepts)
  )
    return null;
  for (const s of steps) {
    if (
      typeof s.index !== "number" ||
      typeof s.id !== "string" ||
      typeof s.label !== "string" ||
      typeof s.prompt !== "string" ||
      !s.expectedAnswer ||
      !s.teachingMetadata ||
      typeof s.teachingMetadata.conceptReminder !== "string" ||
      !Array.isArray(s.teachingMetadata.hintTiers)
    )
      return null;
  }
  return { overview, steps };
}

/** Progress for one question: which steps are completed and which is current. */
export interface StepProgress {
  completedIndices: number[];
  currentStepIndex: number;
  currentStep: QuestionStepNode | null;
}

/** Derive progress from completed step indices (e.g. from StepAttempts where correct=true). */
export function getStepProgress(chain: QuestionNodeChain, completedStepIndices: number[]): StepProgress {
  const completedSet = new Set(completedStepIndices);
  let currentStepIndex = 0;
  for (let i = 0; i < chain.steps.length; i++) {
    if (!completedSet.has(i)) {
      currentStepIndex = i;
      break;
    }
    currentStepIndex = i + 1;
  }
  const currentStep =
    currentStepIndex < chain.steps.length ? chain.steps[currentStepIndex] ?? null : null;
  return {
    completedIndices: completedStepIndices,
    currentStepIndex,
    currentStep,
  };
}

/** Build the context string the LLM receives: overview + strategy + progress + current step teaching metadata (no answers). */
export function buildLLMContextFromChain(
  chain: QuestionNodeChain,
  progress: StepProgress,
  hintLevelForCurrentStep: number
): string {
  const parts: string[] = [];

  parts.push("## Question overview");
  parts.push(chain.overview.summary);
  parts.push(`Learning goal: ${chain.overview.learningGoal}`);
  parts.push(`Key concepts: ${chain.overview.keyConcepts.join(", ")}`);
  if (chain.overview.strategy) parts.push(`Strategy: ${chain.overview.strategy}`);

  parts.push("\n## Progress");
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    if (!step) continue;
    const status = progress.completedIndices.includes(i) ? "completed" : i === progress.currentStepIndex ? "current" : "not started";
    parts.push(`- Step ${i + 1} (${step.label}): ${status}`);
  }

  if (progress.currentStep) {
    const step = progress.currentStep;
    parts.push("\n## Current step (guide the student here; never give the answer)");
    parts.push(`Label: ${step.label}`);
    parts.push(`Prompt: ${step.prompt}`);
    parts.push(`Concept reminder: ${step.teachingMetadata.conceptReminder}`);
    const tierIndex = Math.min(hintLevelForCurrentStep, step.teachingMetadata.hintTiers.length - 1);
    const hint = step.teachingMetadata.hintTiers[tierIndex];
    if (hint) parts.push(`Hint to use (tier ${tierIndex + 1}): ${hint}`);
    if (step.teachingMetadata.nextStepPrompt) {
      parts.push(`After this step: ${step.teachingMetadata.nextStepPrompt}`);
    }
  }

  return parts.join("\n");
}
