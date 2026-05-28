// 直连 Claude（兼容中转站），绕过 @anthropic-ai/sdk

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export type ClaudeConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export async function callClaude(
  cfg: ClaudeConfig,
  opts: {
    system?: string;
    messages: ClaudeMessage[];
    max_tokens?: number;
  },
): Promise<string> {
  const base = cfg.baseURL.replace(/\/$/, "");
  const body = {
    model: cfg.model,
    max_tokens: opts.max_tokens ?? 4000,
    system: opts.system,
    messages: opts.messages,
  };
  const resp = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error?.message || `Claude HTTP ${resp.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const text = (json.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  if (!text) throw new Error(`Claude 返回为空: ${JSON.stringify(json).slice(0, 300)}`);
  return text;
}

export function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

export type UserConfig = {
  baseURL: string;
  apiKey: string;
  claudeModel: string;
  imageModel: string;
};

export function readUserConfig(headers: Headers): UserConfig {
  const baseURL = headers.get("x-user-base-url") || "";
  const apiKey = headers.get("x-user-api-key") || "";
  const claudeModel = headers.get("x-user-claude-model") || "claude-opus-4-7";
  const imageModel = headers.get("x-user-image-model") || "gpt-5.5";
  if (!baseURL || !apiKey) {
    throw new Error("缺少 API 配置：请在页面顶部填写 Base URL 和 API Key");
  }
  return { baseURL, apiKey, claudeModel, imageModel };
}
