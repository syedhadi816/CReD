/**
 * Node-chain data structure for each question.
 * Used for:
 * - Validation (expectedAnswer per step)
 * - LLM context (overview + teachingMetadata when student struggles)
 * - Training data (same structure can drive hint-only dialogue generation)
 */

/** How the backend accepts expected answers for validation (normalize & compare). */
export type ExpectedAnswer =
  | { type: "exact"; value: string }
  | { type: "numeric"; value: number; tolerance?: number }
  | { type: "fraction"; value: string; alternateForms?: string[] }
  | { type: "oneOf"; values: string[] };

/** Teaching/hint metadata for one step — used by the LLM to guide when the student struggles. */
export interface StepTeachingMetadata {
  /** One-sentence concept reminder the LLM can use (never states the answer). */
  conceptReminder: string;
  /** Increasingly specific hints; LLM picks by hint level. Never include the answer. */
  hintTiers: string[];
  /** What to do after this step (e.g. "Then apply the change and recount."). */
  nextStepPrompt?: string;
}

/** One node in the step chain (one intermediate or final step). */
export interface QuestionStepNode {
  /** 0-based index in the chain. */
  index: number;
  /** Stable id for references (e.g. "current-mode", "new-mode", "conclusion"). */
  id: string;
  /** Short label for UI and progress (e.g. "Arrange the data"). */
  label: string;
  /** Question/prompt for this step (e.g. "What is the current mode?"). */
  prompt: string;
  /** Expected answer(s) — used only by backend for validation; never sent to the LLM. */
  expectedAnswer: ExpectedAnswer;
  /** Metadata the LLM references to teach/hint when the student struggles at this step. */
  teachingMetadata: StepTeachingMetadata;
}

/** Overarching explanation of the question — LLM uses this to frame guidance. */
export interface QuestionOverview {
  /** One-paragraph summary of what this question is about. */
  summary: string;
  /** What the student should learn or demonstrate. */
  learningGoal: string;
  /** Concepts the LLM can reference when guiding (e.g. "mode", "frequency"). */
  keyConcepts: string[];
  /** Optional: general strategy (e.g. "First find the current value, then apply the change, then find the new value."). */
  strategy?: string;
}

/** Full node chain for a single question — stored in Question.stepsJson. */
export interface QuestionNodeChain {
  /** Overarching explanation the LLM uses to guide the student through the whole question. */
  overview: QuestionOverview;
  /** Ordered chain of steps; order defines progression. */
  steps: QuestionStepNode[];
}
