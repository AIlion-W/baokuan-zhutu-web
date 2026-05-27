import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseJSON, readUserConfig } from "@/lib/claude";
import { EXPAND_SYSTEM } from "@/lib/framework";

export const runtime = "nodejs";
export const maxDuration = 120;

const dirLabel: Record<string, string> = {
  swap_scene: "换场景（保留人群+需求的表现形式和手法）",
  swap_need: "换需求表达（保留场景+人群）",
  crossover: "交叉重组（场景/人群/需求都可换）",
};

export async function POST(req: NextRequest) {
  try {
    const cfg = readUserConfig(req.headers);
    const { analysis, direction, count } = await req.json();
    if (!analysis || !direction || !count) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const text = await callClaude(
      { apiKey: cfg.apiKey, baseURL: cfg.baseURL, model: cfg.claudeModel },
      {
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
      },
    );

    const plans = parseJSON(text);
    return NextResponse.json({ plans });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("expand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
