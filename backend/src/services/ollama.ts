import * as fs from "fs";
import * as path from "path";
function getConfig() {
  const baseUrl = process.env.LLM_BASE_URL || "http://localhost:11434";
  const model = process.env.LLM_MODEL_NAME || "llama3.2:3b";
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  const claudeKey = process.env.CLAUDE_API_KEY;
  return { baseUrl, model, provider, claudeKey };
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function logLLMInteraction(args: {
  provider: string;
  model: string;
  messages: LLMMessage[];
  reply?: string;
  error?: unknown;
}) {
  try {
    const timestamp = new Date().toISOString();
    const rootDir = path.join(__dirname, "..", "..");
    const logDir = path.join(rootDir, "llm_logs");
    fs.mkdirSync(logDir, { recursive: true });
    const dateTag = timestamp.slice(0, 10);
    const logPath = path.join(logDir, `llm-${dateTag}.log`);
    const line = JSON.stringify({
      timestamp,
      provider: args.provider,
      model: args.model,
      messages: args.messages,
      reply: args.reply,
      error: args.error ? String(args.error) : undefined,
    });
    fs.appendFileSync(logPath, line + "\n", "utf8");
  } catch {
    // logging should never break the main flow
  }
}

async function chatOllama(messages: LLMMessage[]): Promise<string> {
  const { baseUrl, model, provider } = getConfig();
  const url = `${baseUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    logLLMInteraction({ provider, model, messages, error: text });
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const reply = data.message?.content?.trim() ?? "";
  logLLMInteraction({ provider, model, messages, reply });
  return reply;
}

async function chatClaude(messages: LLMMessage[], options?: { maxTokens?: number }): Promise<string> {
  const { claudeKey, model, provider } = getConfig();
  if (!claudeKey) {
    throw new Error("CLAUDE_API_KEY is not set");
  }

  const maxTokens = options?.maxTokens ?? 512;

  const systemMessage = messages.find((m) => m.role === "system");
  const system = systemMessage?.content ?? "";

  const nonSystem = messages.filter((m) => m.role !== "system");
  const claudeMessages = nonSystem.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: [{ type: "text", text: m.content }],
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: claudeMessages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logLLMInteraction({ provider, model, messages, error: text });
    throw new Error(`Claude error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const firstText = data.content?.find((c) => c.type === "text")?.text;
  const reply = (firstText ?? "").trim();
  logLLMInteraction({ provider, model, messages, reply });
  return reply;
}

/** Call configured LLM; returns assistant message content or throws. */
export async function chat(messages: LLMMessage[], options?: { maxTokens?: number }): Promise<string> {
  const { provider } = getConfig();
  if (provider === "anthropic") {
    return chatClaude(messages, options);
  }
  if (options?.maxTokens != null) {
    // Ollama path ignores maxTokens; chat API may still work.
  }
  return chatOllama(messages);
}
