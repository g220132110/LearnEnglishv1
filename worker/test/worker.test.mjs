// 執行：node --test worker/test/*.mjs
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { cleanRewrite, parseJSON } from "../src/schema.js";

const call = (path, body, env = {}, headers = {}) =>
  worker.fetch(
    new Request(`http://x${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );

const fakeKV = () => {
  const m = new Map();
  return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) };
};

test("health 回報示範模式", async () => {
  const r = await (await call("/api/health")).json();
  assert.equal(r.provider, "demo");
});

test("沒有金鑰時回傳示範結果", async () => {
  const r = await (await call("/api/rewrite", { text: "Give me the menu.", level: "A2", context: "restaurant" })).json();
  assert.equal(r.ok, true);
  assert.equal(r.demo, true);
  assert.equal(r.data.tone.label, "直接");
  assert.ok(r.data.better.length >= 2);
});

test("Try Again 有 compare", async () => {
  const r = await (await call("/api/rewrite", { text: "Could I have the menu, please?", previous: "Give me the menu." })).json();
  assert.equal(r.data.compare.improved, true);
});

test("空白與過長輸入被擋下", async () => {
  assert.equal((await call("/api/rewrite", { text: "  " })).status, 400);
  assert.equal((await call("/api/rewrite", { text: "a".repeat(301) })).status, 400);
});

test("不允許的來源被擋下", async () => {
  const res = await call("/api/rewrite", { text: "hi" }, { ALLOWED_ORIGINS: "https://good.example" }, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
});

test("用量上限", async () => {
  const env = { QUOTA: fakeKV(), DEVICE_DAILY_LIMIT: "2" };
  const h = { "x-ep-device": "abc" };
  assert.equal((await call("/api/rewrite", { text: "hi" }, env, h)).status, 200);
  assert.equal((await call("/api/rewrite", { text: "hi" }, env, h)).status, 200);
  assert.equal((await call("/api/rewrite", { text: "hi" }, env, h)).status, 429);
});

test("清理模型輸出：去掉未知名稱、補上限制", () => {
  const raw = parseJSON('```json\n{"tone":{"label":"直接","note":"n"},"fixes":[{"from":"a","to":"b","note":"c"}],"better":[{"en":"Could you?","zh":"可以嗎","why":"w","giving":"給人快樂"}],"acts":[{"name":"說好話","evidence":"e"},{"name":"很善良","evidence":"x"}],"givings":[],"keys":["could"]}\n```');
  const out = cleanRewrite(raw);
  assert.equal(out.better[0].giving, "");
  assert.deepEqual(out.acts.map((a) => a.name), ["說好話"]);
});

test("格式錯誤時重試，兩次都錯就改回示範", async () => {
  const realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => {
    n++;
    return new Response(JSON.stringify({ content: [{ type: "text", text: n === 1 ? "not json" : '{"tone":{"label":"禮貌","note":"好"},"fixes":[],"better":[{"en":"Thanks!","zh":"謝謝","why":"w","giving":"給人歡喜"}],"acts":[],"givings":[],"keys":[]}' }] }));
  };
  try {
    const r = await (await call("/api/rewrite", { text: "Thanks" }, { ANTHROPIC_API_KEY: "k" })).json();
    assert.equal(n, 2);
    assert.equal(r.demo, false);
    assert.equal(r.data.tone.label, "禮貌");

    n = -10; // 一直回傳錯誤格式
    globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: "text", text: "oops" }] }));
    const r2 = await (await call("/api/rewrite", { text: "Thanks" }, { ANTHROPIC_API_KEY: "k" })).json();
    assert.equal(r2.demo, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});
