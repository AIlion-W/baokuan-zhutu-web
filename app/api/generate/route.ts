import { NextRequest, NextResponse } from "next/server";
import { readUserConfig } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 300;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 从 chat completions 响应里挖出图片（base64 或 URL），尽量兼容多种中转格式
function extractImageFromChat(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const choices = j.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  if (!msg) return null;

  // 形式1: message.images = [{ image_url: { url } }]
  const images = msg.images as Array<{ image_url?: { url?: string }; url?: string; b64_json?: string }> | undefined;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    if (first.image_url?.url) return first.image_url.url;
    if (first.url) return first.url;
    if (first.b64_json) return `data:image/png;base64,${first.b64_json}`;
  }

  // 形式2: message.content = [{ type:"image_url", image_url:{url} }, ...]
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === "image_url" && part?.image_url?.url) return part.image_url.url;
      if (part?.type === "image" && part?.source?.data) {
        return `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
      }
    }
  }

  // 形式3: message.content = string，可能含 markdown 图片或 base64
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

export async function POST(req: NextRequest) {
  try {
    const cfg = readUserConfig(req.headers);
    const { prompt, referenceImage, size = "1024x1024" } = await req.json();
    if (!prompt) return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });

    const base = cfg.baseURL.replace(/\/$/, "");

    // 有参考图 → 走 chat completions 多模态（nano-banana / gemini-image 系标准接法）
    if (referenceImage) {
      const chatResp = await fetch(`${base}/v1/chat/completions`, {
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
                { type: "image_url", image_url: { url: referenceImage } },
              ],
            },
          ],
        }),
      });
      const chatJson = await chatResp.json();
      if (!chatResp.ok) {
        return NextResponse.json(
          { error: (chatJson?.error?.message as string) || `生图失败 HTTP ${chatResp.status}`, raw: chatJson },
          { status: 500 },
        );
      }
      const img = extractImageFromChat(chatJson);
      if (img) return NextResponse.json({ image: img });
      return NextResponse.json(
        { error: "模型返回里没找到图片，可能模型不支持多模态输出", raw: chatJson },
        { status: 500 },
      );
    }

    // 无参考图 → 退回纯文字生图（/v1/images/generations）
    const submitResp = await fetch(`${base}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: cfg.imageModel, prompt, size, n: 1 }),
    });
    const submit = await submitResp.json();
    if (!submitResp.ok) {
      return NextResponse.json(
        { error: submit?.error?.message || "提交生图失败", raw: submit },
        { status: 500 },
      );
    }
    if (submit?.data?.[0]?.url) return NextResponse.json({ image: submit.data[0].url });
    if (submit?.data?.[0]?.b64_json)
      return NextResponse.json({ image: `data:image/png;base64,${submit.data[0].b64_json}` });

    const taskId = submit?.id;
    if (!taskId) return NextResponse.json({ error: "未拿到 task id", raw: submit }, { status: 500 });

    const deadline = Date.now() + 270_000;
    while (Date.now() < deadline) {
      await sleep(3000);
      const pollResp = await fetch(`${base}/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      const poll = await pollResp.json();
      const status = poll?.status;
      if (status === "completed" || status === "succeeded" || status === "success") {
        const url = poll?.result_data?.[0]?.url || poll?.results?.[0];
        if (url) return NextResponse.json({ image: url });
        return NextResponse.json({ error: "完成但找不到图片 URL", raw: poll }, { status: 500 });
      }
      if (status === "failed" || status === "error") {
        return NextResponse.json(
          { error: poll?.error?.message || "生图任务失败", raw: poll },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ error: "生图超时" }, { status: 504 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("generate error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
