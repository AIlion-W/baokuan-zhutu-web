// 浏览器直连中转站，绕过 Vercel API 中间层（避免超时和 body 限制）

import { ANALYZE_SYSTEM, EXPAND_SYSTEM } from "./framework";

export type RelayConfig = {
  baseURL: string;
  apiKey: string;
  claudeModel: string;
  imageModel: string;
};

function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

async function callClaude(
  cfg: RelayConfig,
  opts: {
    system?: string;
    messages: Array<{ role: "user" | "assistant"; content: unknown }>;
    max_tokens?: number;
  },
): Promise<string> {
  const base = cfg.baseURL.replace(/\/$/, "");
  const resp = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.claudeModel,
      max_tokens: opts.max_tokens ?? 4000,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error?.message || `Claude HTTP ${resp.status}`);
  }
  const text = ((json.content || []) as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");
  if (!text) throw new Error(`Claude 返回空: ${JSON.stringify(json).slice(0, 300)}`);
  return text;
}

export async function analyze(cfg: RelayConfig, imageDataURL: string) {
  const m = imageDataURL.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) throw new Error("图片格式错误");
  const text = await callClaude(cfg, {
    system: ANALYZE_SYSTEM,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
          { type: "text", text: "拆解这张电商爆款主图，严格按 JSON 格式输出，不要任何额外文字。" },
        ],
      },
    ],
  });
  return parseJSON(text);
}

export async function expand(
  cfg: RelayConfig,
  analysis: unknown,
  direction: string,
  count: number,
) {
  const dirLabel: Record<string, string> = {
    swap_scene: "换场景（保留人群+需求的表现形式和手法）",
    swap_need: "换需求表达（保留场景+人群）",
    crossover: "交叉重组（场景/人群/需求都可换）",
  };
  const text = await callClaude(cfg, {
    system: EXPAND_SYSTEM,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `原图拆解：\n${JSON.stringify(analysis, null, 2)}\n\n裂变方向：${
          dirLabel[direction] || direction
        }\n要生成方案数量：${count}\n\n请输出 JSON 数组，包含 ${count} 个方案。直接输出 JSON，不要任何额外文字。`,
      },
    ],
  });
  return parseJSON(text);
}

function dataURLtoBlob(dataURL: string): Blob {
  const m = dataURL.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("dataURL 格式错误");
  const bin = atob(m[2]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: m[1] });
}

function extractImageFromChat(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const choices = j.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  if (!msg) return null;

  const images = msg.images as
    | Array<{ image_url?: { url?: string }; url?: string; b64_json?: string }>
    | undefined;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    if (first.image_url?.url) return first.image_url.url;
    if (first.url) return first.url;
    if (first.b64_json) return `data:image/png;base64,${first.b64_json}`;
  }

  const content = msg.content;
  if (Array.isArray(content)) {
    for (const part of content as Array<{
      type?: string;
      image_url?: { url?: string };
      source?: { data?: string; media_type?: string };
    }>) {
      if (part?.type === "image_url" && part?.image_url?.url) return part.image_url.url;
      if (part?.type === "image" && part?.source?.data) {
        return `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
      }
    }
  }

  if (typeof content === "string") {
    const mdMatch = content.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
    if (mdMatch) return mdMatch[1];
    const urlMatch = content.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp)/i);
    if (urlMatch) return urlMatch[0];
    const b64Match = content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
    if (b64Match) return b64Match[0];
  }
  return null;
}

async function pollTask(cfg: RelayConfig, taskId: string, timeoutMs = 540_000): Promise<string> {
  const base = cfg.baseURL.replace(/\/$/, "");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const resp = await fetch(`${base}/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    const poll = await resp.json();
    const st = poll?.status;
    if (st === "completed" || st === "succeeded" || st === "success") {
      const url = poll?.result_data?.[0]?.url || poll?.results?.[0];
      if (url) return url as string;
    }
    if (st === "failed" || st === "error") {
      throw new Error(poll?.error?.message || "生图任务失败");
    }
  }
  throw new Error("生图超时（9 分钟）");
}

export async function generate(
  cfg: RelayConfig,
  prompt: string,
  referenceImageDataURL: string | null,
  size = "1024x1024",
): Promise<string> {
  const base = cfg.baseURL.replace(/\/$/, "");

  // gpt-image 系列 + 有参考图 → /v1/images/edits (multipart)
  if (referenceImageDataURL && /^gpt-image/i.test(cfg.imageModel)) {
    const form = new FormData();
    form.append("model", cfg.imageModel);
    form.append("prompt", prompt);
    form.append("n", "1");
    form.append("size", size);
    form.append("image", dataURLtoBlob(referenceImageDataURL), "reference.png");
    const resp = await fetch(`${base}/v1/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error?.message || `生图 HTTP ${resp.status}`);
    if (json?.data?.[0]?.url) return json.data[0].url;
    if (json?.data?.[0]?.b64_json) return `data:image/png;base64,${json.data[0].b64_json}`;
    if (json?.id) return pollTask(cfg, json.id);
    throw new Error("未拿到图片：" + JSON.stringify(json).slice(0, 200));
  }

  // 有参考图 + 其他模型 → chat completions 多模态（nano-banana 等）
  if (referenceImageDataURL) {
    const resp = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.imageModel,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: referenceImageDataURL } },
            ],
          },
        ],
      }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error?.message || `生图 HTTP ${resp.status}`);
    const img = extractImageFromChat(json);
    if (img) return img;
    throw new Error("模型返回里没图片：" + JSON.stringify(json).slice(0, 200));
  }

  // 纯文字 → /v1/images/generations
  const resp = await fetch(`${base}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: cfg.imageModel, prompt, size, n: 1 }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message || `生图 HTTP ${resp.status}`);
  if (json?.data?.[0]?.url) return json.data[0].url;
  if (json?.data?.[0]?.b64_json) return `data:image/png;base64,${json.data[0].b64_json}`;
  if (json?.id) return pollTask(cfg, json.id);
  throw new Error("未拿到图片：" + JSON.stringify(json).slice(0, 200));
}
