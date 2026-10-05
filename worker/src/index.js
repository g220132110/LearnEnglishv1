// Good English, Good Life — 後端代理（Cloudflare Workers）
//
// 前端只送「任務名稱＋使用者文字」，提示詞、金鑰、用量上限都在這裡。
// 路由：POST /api/rewrite   GET /api/health

import { LEVELS } from "./rubric.js";
import { REWRITE_CONTEXTS, rewriteSystem, retrySystem, rewriteUser } from "./prompts.js";
import { parseJSON, cleanRewrite } from "./schema.js";
import { pickProvider } from "./providers.js";
import { mockRewrite } from "./mock.js";

const MAX_TEXT = 300;

// ---------- 共用 ----------

function corsHeaders(req, env) {
  const origin = req.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    ok,
    headers: {
      "access-control-allow-origin": ok && origin ? origin : allowed[0] || "*",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type, x-ep-device",
      "access-control-max-age": "86400",
      vary: "origin",
    },
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const fail = (code, message, status, headers) => json({ ok: false, error: code, message }, status, headers);

// 台灣時間的日期，用量每天 00:00 重算
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

// ---------- 用量上限（需綁定 KV：QUOTA；沒綁定就不限制，方便本機開發） ----------

async function checkQuota(req, env) {
  if (!env.QUOTA) return { ok: true, used: 0, limit: 0 };
  const day = today();
  const device = (req.headers.get("x-ep-device") || "anon").replace(/[^\w-]/g, "").slice(0, 40) || "anon";
  const ip = req.headers.get("cf-connecting-ip") || "0";
  const limits = [
    [`q:${day}:d:${device}`, Number(env.DEVICE_DAILY_LIMIT || 60)],
    [`q:${day}:ip:${ip}`, Number(env.IP_DAILY_LIMIT || 200)],
    [`q:${day}:all`, Number(env.GLOBAL_DAILY_LIMIT || 3000)],
  ];
  const counts = await Promise.all(limits.map(([k]) => env.QUOTA.get(k).then((v) => Number(v || 0))));
  const over = counts.findIndex((c, i) => c >= limits[i][1]);
  if (over >= 0) return { ok: false, scope: ["device", "ip", "global"][over] };
  await Promise.all(
    limits.map(([k], i) => env.QUOTA.put(k, String(counts[i] + 1), { expirationTtl: 2 * 86400 })),
  );
  return { ok: true, used: counts[0] + 1, limit: limits[0][1] };
}

// ---------- 呼叫模型：格式錯誤重試一次 ----------

async function runModel(provider, env, system, user, clean) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await provider.complete({ system, user, env });
      return clean(parseJSON(text));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---------- 任務：rewrite（Say It Better） ----------

async function handleRewrite(body, env) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const previous = typeof body.previous === "string" ? body.previous.trim() : "";
  const level = LEVELS.includes(body.level) ? body.level : "B1";
  const context = body.context in REWRITE_CONTEXTS ? body.context : "free";
  if (!text) return { status: 400, error: "empty", message: "請先輸入或說出一句英文。" };
  if (text.length > MAX_TEXT || previous.length > MAX_TEXT)
    return { status: 400, error: "too_long", message: `一次最多 ${MAX_TEXT} 個字元。` };

  const retry = Boolean(previous);
  const provider = pickProvider(env);
  if (!provider) return { data: mockRewrite({ text, previous }), demo: true };

  try {
    const data = await runModel(
      provider,
      env,
      retry ? retrySystem(level) : rewriteSystem(level),
      rewriteUser({ text, context, previous }),
      (raw) => cleanRewrite(raw, { retry }),
    );
    return { data, demo: false };
  } catch (err) {
    console.error("rewrite failed:", err.message);
    return { data: mockRewrite({ text, previous }), demo: true };
  }
}

const TASKS = { rewrite: handleRewrite };

// ---------- 入口 ----------

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
    if (!cors.ok) return fail("origin", "不允許的來源。", 403, cors.headers);

    if (url.pathname === "/api/health") {
      const p = pickProvider(env);
      return json({ ok: true, provider: p ? p.name : "demo" }, 200, cors.headers);
    }

    const task = url.pathname.match(/^\/api\/(\w+)$/)?.[1];
    if (!task || !TASKS[task]) return fail("not_found", "找不到這個功能。", 404, cors.headers);
    if (req.method !== "POST") return fail("method", "只接受 POST。", 405, cors.headers);

    let body;
    try {
      body = await req.json();
    } catch {
      return fail("bad_json", "資料格式錯誤。", 400, cors.headers);
    }

    const quota = await checkQuota(req, env);
    if (!quota.ok)
      return fail("quota", "今天的 AI 練習次數已用完，明天再來，或先用示範內容練習。", 429, cors.headers);

    const r = await TASKS[task](body, env);
    if (r.error) return fail(r.error, r.message, r.status, cors.headers);
    return json(
      { ok: true, demo: r.demo, data: r.data, quota: { used: quota.used, limit: quota.limit } },
      200,
      cors.headers,
    );
  },
};
