const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";

/** Topic id for educator-administered items (Student Testing Sandbox only; not listed for students). */
export const EDUCATOR_SANDBOX_TOPIC = "My questions";

function getToken(): string | null {
  return localStorage.getItem("cred_token");
}

export async function login(email: string, accessCode: string, role: "educator" | "student") {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, accessCode, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as { token: string; user: { id: string; email: string } };
}

export async function getTopics() {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/questions/topics`, { headers });
  if (!res.ok) throw new Error("Failed to fetch topics");
  return res.json() as Promise<{ id: string; name: string; description?: string }[]>;
}

export async function getQuestions(topic: string) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/questions?topic=${encodeURIComponent(topic)}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json() as Promise<{ id: string; prompt: string }[]>;
}

export async function getQuestion(questionId: string) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/questions/${encodeURIComponent(questionId)}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch question");
  return res.json() as Promise<{
    id: string;
    prompt: string;
    topic: string;
    /** Server-derived; use for final answer check stepIndex. */
    finalStepIndex?: number;
    steps?: { index: number; id: string; label: string; prompt: string }[];
  }>;
}

/** Mark assessment session ended (duration in DB + optional duplicate [AUDIT] in logs). */
export async function endSession(sessionId: string) {
  const token = getToken();
  if (!token || !sessionId) return;
  const url = `${API_BASE}/api/questions/sessions/${encodeURIComponent(sessionId)}/end`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    });
  } catch {
    /* non-blocking */
  }
}

export async function createSession(topic: string) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/questions/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ topic }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create session");
  return data as { sessionId: string };
}

export async function startAttempt(sessionId: string, questionId: string) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/questions/sessions/${sessionId}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ questionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to start attempt");
  return data as { attemptId: string };
}

export async function getAttemptProgress(attemptId: string) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/questions/attempts/${attemptId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to get progress");
  return data as { completedStepIndices: number[] };
}

export async function checkStep(attemptId: string, stepIndex: number, answer: string) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/questions/attempts/${attemptId}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stepIndex, answer }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Check failed");
  return data as { correct: boolean; completedStepIndices: number[] };
}

export async function sendChat(sessionId: string, questionId: string, message: string) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId, questionId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Chat failed");
  return data as { content: string };
}

export interface GeneratedQuestion {
  id: string;
  prompt: string;
}

/** Educator: generate question stems via Claude (requires LLM_PROVIDER=anthropic on server). */
export async function generateEducatorQuestions(params: {
  prompt: string;
  numQuestions: number;
  gradeLevel: string;
  /** Pass prompts already shown in this session so the model avoids repeating the same scenarios. */
  existingPrompts?: string[];
}): Promise<{ questions: GeneratedQuestion[]; warning?: string }> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    numQuestions: params.numQuestions,
    gradeLevel: params.gradeLevel,
  };
  if (params.existingPrompts?.length) {
    body.existingPrompts = params.existingPrompts;
  }
  const res = await fetch(`${API_BASE}/api/educator/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Generation failed");
  return {
    questions: (data as { questions: GeneratedQuestion[] }).questions,
    warning: (data as { warning?: string }).warning,
  };
}

export type RefineMode = "instruction" | "difficulty_up" | "difficulty_down";

/** Educator: refine one generated question (Claude). */
export async function refineEducatorQuestion(params: {
  baseQuestion: string;
  mode: RefineMode;
  educatorInstruction?: string;
}): Promise<{ prompt: string }> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/educator/refine-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Refine failed");
  return { prompt: (data as { prompt: string }).prompt };
}

/** Educator: PDF answer key for kept prompts (Claude + server PDF). */
export async function exportEducatorPdf(prompts: string[]): Promise<Blob> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/educator/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompts }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "PDF export failed");
  }
  return res.blob();
}

/** Educator: convert prompts to MCQ + tutor guide and save to “My questions”. */
export async function getEducatorBankCount(): Promise<number> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/educator/bank-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load bank count");
  return (data as { count: number }).count;
}

export async function administerEducatorBank(prompts: string[]): Promise<{
  created: number;
  questionIds: string[];
  errors?: { index: number; detail: string }[];
}> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/educator/administer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompts }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Administer failed");
  return data as {
    created: number;
    questionIds: string[];
    errors?: { index: number; detail: string }[];
  };
}

export async function activateHelp(sessionId: string, questionId: string) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/api/chat/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId, questionId }),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error ?? "Failed to activate help");
  }
}
