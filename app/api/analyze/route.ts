import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseJSON, readUserConfig } from "@/lib/claude";
import { ANALYZE_SYSTEM } from "@/lib/framework";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const cfg = readUserConfig(req.headers);
    const { image } = await req.json();
    if (!image) return NextResponse.json({ error: "缺少图片" }, { status: 400 });

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: "图片格式错误" }, { status: 400 });
    const mediaType = match[1];
    const data = match[2];

    const text = await callClaude(
      { apiKey: cfg.apiKey, baseURL: cfg.baseURL, model: cfg.claudeModel },
      {
        system: ANALYZE_SYSTEM,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: "拆解这张电商爆款主图，严格按 JSON 格式输出，不要任何额外文字。" },
            ],
          },
        ],
      },
    );

    const analysis = parseJSON(text);
    return NextResponse.json({ analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("analyze error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
