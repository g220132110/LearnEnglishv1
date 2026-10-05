// 模型轉接層：同一個介面，可切換 Claude 或 Gemini。
// complete({ system, user, env }) → 模型回傳的純文字。

const TIMEOUT_MS = 20000;

async function post(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`provider HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const anthropic = {
  name: "anthropic",
  defaultModel: "claude-sonnet-5-5",
  async complete({ system, user, env }) {
    const data = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      {
        model: env.AI_MODEL || this.defaultModel,
        max_tokens: 1200,
        temperature: 0.3,
        system,
        messages: [{ role: "user", content: user }],
      },
    );
    return (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  },
};

const gemini = {
  name: "gemini",
  defaultModel: "gemini-2.5-flash",
  async complete({ system, user, env }) {
    const model = env.AI_MODEL || this.defaultModel;
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": env.GEMINI_API_KEY },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json", maxOutputTokens: 1200 },
      },
    );
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  },
};

// 沒有設定金鑰時回傳 null，由呼叫端改走示範模式。
export function pickProvider(env) {
  const want = (env.AI_PROVIDER || "anthropic").toLowerCase();
  if (want === "gemini" && env.GEMINI_API_KEY) return gemini;
  if (want === "anthropic" && env.ANTHROPIC_API_KEY) return anthropic;
  if (env.ANTHROPIC_API_KEY) return anthropic;
  if (env.GEMINI_API_KEY) return gemini;
  return null;
}
