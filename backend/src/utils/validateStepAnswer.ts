import type { ExpectedAnswer } from "../types/questionChain";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Returns true if the user's answer matches the expected answer (with normalization). */
export function validateStepAnswer(expected: ExpectedAnswer, userAnswer: string): boolean {
  const u = normalize(userAnswer);
  if (u === "") return false;

  switch (expected.type) {
    case "exact":
      return u === normalize(expected.value);
    case "numeric": {
      const n = Number.parseFloat(u.replace(/,/g, ""));
      if (Number.isNaN(n)) return false;
      const tol = expected.tolerance ?? 0.01;
      return Math.abs(n - expected.value) <= tol;
    }
    case "oneOf":
      return expected.values.some((v) => u === normalize(v));
    case "fraction": {
      if (u === normalize(expected.value)) return true;
      if (expected.alternateForms?.some((v) => u === normalize(v))) return true;
      return false;
    }
    default:
      return false;
  }
}
