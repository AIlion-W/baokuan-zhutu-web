"use client";

import { useEffect, useState } from "react";

type TriItem = {
  form_code: string;
  form_name: string;
  form_detail: string;
  method_code: string;
  method_name: string;
  method_detail: string;
  evidence: string;
  why_works: string;
};

type Analysis = {
  overall: string;
  scene: TriItem;
  people: TriItem;
  need: TriItem;
  formula: string;
  key_success: string;
  category_guess: string;
  subject_lock?: string;
};

type Plan = {
  index: number;
  new_formula: string;
  title: string;
  scene_desc: string;
  subject_desc: string;
  atmosphere: string;
  composition: string;
  text_overlay: string;
  image_prompt: string;
};

type Direction = "swap_scene" | "swap_need" | "crossover";

const DIRECTION_LABELS: Record<Direction, string> = {
  swap_scene: "换场景（保人群+需求）",
  swap_need: "换需求表达（保场景+人群）",
  crossover: "交叉重组（全部可换）",
};

const DIRECTION_HINTS: Record<Direction, string> = {
  swap_scene: "适合：跨场景拓展同款公式",
  swap_need: "适合：A/B 测试不同卖点表达",
  crossover: "适合：跨品类灵感借鉴",
};

type Settings = {
  baseURL: string;
  apiKey: string;
  claudeModel: string;
  imageModel: string;
};

const DEFAULT_SETTINGS: Settings = {
  baseURL: "https://yunwu.ai",
  apiKey: "",
  claudeModel: "claude-opus-4-7",
  imageModel: "gemini-2.5-flash-image",
};

const STORAGE_KEY = "baokuan-zhutu-settings-v5";

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [direction, setDirection] = useState<Direction>("swap_scene");
  const [count, setCount] = useState(3);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        if (!parsed.apiKey) setSettingsOpen(true);
      } else {
        setSettingsOpen(true);
      }
    } catch {
      setSettingsOpen(true);
    }
    setHydrated(true);
  }, []);

  const saveSettings = (next: Settings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const apiHeaders = (): Record<string, string> => ({
    "Content-Type": "application/json",
    "x-user-base-url": settings.baseURL,
    "x-user-api-key": settings.apiKey,
    "x-user-claude-model": settings.claudeModel,
    "x-user-image-model": settings.imageModel,
  });

  const ensureKey = (): boolean => {
    if (!settings.apiKey || !settings.baseURL) {
      setError("请先在右上角「设置」填写 API Base URL 和 Key");
      setSettingsOpen(true);
      return false;
    }
    return true;
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setAnalysis(null);
      setPlans(null);
      setResults({});
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!image || !ensureKey()) return;
    setLoading("正在拆解三要素…");
    setError(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ image }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "拆解失败");
      setAnalysis(j.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const expand = async () => {
    if (!analysis || !ensureKey()) return;
    setLoading(`正在生成 ${count} 个裂变方案…`);
    setError(null);
    setPlans(null);
    setResults({});
    try {
      const r = await fetch("/api/expand", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ analysis, direction, count }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "裂变失败");
      setPlans(j.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const updatePrompt = (idx: number, val: string) => {
    setPlans((prev) => prev?.map((p) => (p.index === idx ? { ...p, image_prompt: val } : p)) || null);
  };

  const generateOne = async (plan: Plan) => {
    if (!ensureKey()) return;
    setLoading(`正在生成方案 #${plan.index} 的图片…`);
    setError(null);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ prompt: plan.image_prompt, referenceImage: image }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "生图失败");
      setResults((prev) => ({ ...prev, [plan.index]: j.image }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const generateAll = async () => {
    if (!plans || !ensureKey()) return;
    for (const p of plans) {
      await generateOne(p);
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">爆款主图复刻 · Demo</h1>
            <p className="text-neutral-600 mt-2">
              上传爆款主图 → 拆解三要素 → 选裂变方向 → 选张数 → 一键生图
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              settings.apiKey
                ? "border-neutral-300 bg-white hover:bg-neutral-100"
                : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            ⚙️ {settings.apiKey ? "设置" : "请先配置 API"}
          </button>
        </header>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onSave={(s) => {
              saveSettings(s);
              setSettingsOpen(false);
              setError(null);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            ⏳ {loading}
          </div>
        )}

        <Section step={1} title="上传爆款主图">
          <div className="flex items-start gap-6">
            <label className="cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 hover:border-neutral-500 px-6 py-12 text-sm text-neutral-600 bg-white flex-1 text-center">
              <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
              {image ? "重新选择图片" : "点击选择图片（支持 jpg/png/webp）"}
            </label>
            {image && (
              <div className="w-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="预览" className="rounded-lg border border-neutral-200" />
                <button
                  onClick={analyze}
                  disabled={!!loading}
                  className="mt-3 w-full rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
                >
                  开始拆解
                </button>
              </div>
            )}
          </div>
        </Section>

        {analysis && (
          <Section step={2} title="三要素拆解结果">
            <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
              <Field label="整体印象" value={analysis.overall} />
              <Field label="核心公式" value={analysis.formula} mono />
              <Field label="成功关键" value={analysis.key_success} />
              <Field label="品类推测" value={analysis.category_guess} />
              {analysis.subject_lock && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                  <div className="text-xs text-amber-700 font-semibold mb-1">🔒 像素级保留（裂变时不可改变）</div>
                  <div className="text-sm text-amber-900">{analysis.subject_lock}</div>
                </div>
              )}
              <div className="grid md:grid-cols-3 gap-4 pt-2">
                <TriCard title="场景" item={analysis.scene} />
                <TriCard title="人群" item={analysis.people} />
                <TriCard title="需求" item={analysis.need} />
              </div>
            </div>
          </Section>
        )}

        {analysis && (
          <Section step={3} title="选择裂变方向">
            <div className="grid md:grid-cols-3 gap-3">
              {(Object.keys(DIRECTION_LABELS) as Direction[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`rounded-lg border-2 px-4 py-4 text-left text-sm transition ${
                    direction === d
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  }`}
                >
                  <div className="font-semibold mb-1">{DIRECTION_LABELS[d]}</div>
                  <div className={`text-xs ${direction === d ? "text-neutral-300" : "text-neutral-500"}`}>
                    {DIRECTION_HINTS[d]}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {analysis && (
          <Section step={4} title="选择裂变张数">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={8}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1"
              />
              <div className="text-3xl font-bold w-16 text-center">{count}</div>
              <button
                onClick={expand}
                disabled={!!loading}
                className="rounded-lg bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
              >
                生成 {count} 个方案
              </button>
            </div>
          </Section>
        )}

        {plans && (
          <Section step={5} title="裂变方案 & 生图">
            <div className="mb-4 flex justify-end">
              <button
                onClick={generateAll}
                disabled={!!loading}
                className="rounded-lg bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                🎨 全部生图
              </button>
            </div>
            <div className="space-y-5">
              {plans.map((plan) => (
                <div key={plan.index} className="rounded-lg border border-neutral-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="inline-block rounded bg-neutral-100 px-2 py-0.5 text-xs font-mono mr-2">
                        #{plan.index} · {plan.new_formula}
                      </span>
                      <span className="text-sm font-semibold">{plan.title}</span>
                    </div>
                    <button
                      onClick={() => generateOne(plan)}
                      disabled={!!loading}
                      className="rounded bg-neutral-900 text-white px-3 py-1.5 text-xs hover:bg-neutral-700 disabled:opacity-50"
                    >
                      生成这张
                    </button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm">
                      <Mini label="场景" value={plan.scene_desc} />
                      <Mini label="主体" value={plan.subject_desc} />
                      <Mini label="氛围" value={plan.atmosphere} />
                      <Mini label="构图" value={plan.composition} />
                      {plan.text_overlay && <Mini label="文字" value={plan.text_overlay} />}
                      <details className="pt-2">
                        <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-800">
                          编辑生图 Prompt
                        </summary>
                        <textarea
                          value={plan.image_prompt}
                          onChange={(e) => updatePrompt(plan.index, e.target.value)}
                          className="mt-2 w-full h-32 rounded border border-neutral-300 p-2 text-xs font-mono"
                        />
                      </details>
                    </div>
                    <div className="bg-neutral-100 rounded-lg flex items-center justify-center min-h-[280px]">
                      {results[plan.index] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={results[plan.index]}
                          alt={`方案 ${plan.index}`}
                          className="rounded-lg w-full"
                        />
                      ) : (
                        <span className="text-xs text-neutral-400">尚未生图</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <footer className="mt-16 text-xs text-neutral-400 text-center">
          API Key 仅保存在你浏览器的 localStorage，不会上传到任何服务器（每次请求由浏览器直接带给后端转发到中转）。
        </footer>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  return (
    <div className="mb-8 rounded-lg border-2 border-neutral-900 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">API 配置</h3>
        <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">
          ✕
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <Input
          label="Base URL"
          value={draft.baseURL}
          onChange={(v) => setDraft({ ...draft, baseURL: v })}
          placeholder="https://api.evolink.ai"
          hint="中转站根地址，不要带 /v1"
        />
        <Input
          label="API Key"
          value={draft.apiKey}
          onChange={(v) => setDraft({ ...draft, apiKey: v })}
          placeholder="sk-..."
          hint="只保存在你的浏览器"
          type="password"
        />
        <Input
          label="Claude 模型（拆解 + 裂变）"
          value={draft.claudeModel}
          onChange={(v) => setDraft({ ...draft, claudeModel: v })}
          placeholder="claude-opus-4-7"
        />
        <Input
          label="生图模型"
          value={draft.imageModel}
          onChange={(v) => setDraft({ ...draft, imageModel: v })}
          placeholder="gemini-2.5-flash-image"
        />
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          取消
        </button>
        <button
          onClick={() => onSave(draft)}
          disabled={!draft.apiKey || !draft.baseURL}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-500 block mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
      />
      {hint && <span className="text-xs text-neutral-400 mt-1 block">{hint}</span>}
    </label>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-900 text-white text-sm">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function TriCard({ title, item }: { title: string; item: TriItem }) {
  return (
    <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 text-xs space-y-1.5">
      <div className="font-semibold text-sm text-neutral-900 mb-2">{title}</div>
      <div>
        <span className="font-mono text-neutral-500">{item.form_code}</span> {item.form_name}：{item.form_detail}
      </div>
      <div>
        <span className="font-mono text-neutral-500">{item.method_code}</span> {item.method_name}：{item.method_detail}
      </div>
      <div className="pt-1 text-neutral-600">证据：{item.evidence}</div>
      <div className="text-neutral-600">有效性：{item.why_works}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-neutral-500 mr-2">{label}：</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
