/** Last step index in a QuestionNodeChain.stepsJson (0 if unknown). */
export function getFinalStepIndexFromStepsJson(stepsJson: unknown): number {
  const obj = stepsJson as { steps?: { index: number }[] } | null;
  const steps = obj?.steps;
  if (!Array.isArray(steps) || steps.length === 0) return 0;
  return Math.max(...steps.map((s) => (typeof s.index === "number" ? s.index : 0)));
}
