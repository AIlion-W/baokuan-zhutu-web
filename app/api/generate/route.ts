import { NextRequest, NextResponse } from "next/server";
import { readUserConfig } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 300;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  try {
    const cfg = readUserConfig(req.headers);
    const { prompt, size = "1024x1024" } = await req.json();
    if (!prompt) return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });

    const base = cfg.baseURL.replace(/\/$/, "");
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

    if (submit?.data?.[0]?.url) {
      return NextResponse.json({ image: submit.data[0].url });
    }
    if (submit?.data?.[0]?.b64_json) {
      return NextResponse.json({ image: `data:image/png;base64,${submit.data[0].b64_json}` });
    }

    const taskId = submit?.id;
    if (!taskId) {
      return NextResponse.json({ error: "未拿到 task id", raw: submit }, { status: 500 });
    }

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
