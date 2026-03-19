const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";

function getToken(): string | null {
  return localStorage.getItem("cred_token");
}

export async function login(email: string, accessCode: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, accessCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data as { token: string; user: { id: string; email: string } };
}

export async function getTopics() {
  const res = await fetch(`${API_BASE}/api/questions/topics`);
  if (!res.ok) throw new Error("Failed to fetch topics");
  return res.json() as Promise<{ id: string; name: string; description?: string }[]>;
}

export async function getQuestions(topic: string) {
  const res = await fetch(`${API_BASE}/api/questions?topic=${encodeURIComponent(topic)}`);
  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json() as Promise<{ id: string; prompt: string }[]>;
}

export async function getQuestion(questionId: string) {
  const res = await fetch(`${API_BASE}/api/questions/${questionId}`);
  if (!res.ok) throw new Error("Failed to fetch question");
  return res.json() as Promise<{
    id: string;
    prompt: string;
    topic: string;
    steps: { index: number; id: string; label: string; prompt: string }[];
  }>;
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
