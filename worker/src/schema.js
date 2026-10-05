import { ACTS, GIVINGS, TONES } from "./rubric.js";

// 把模型回傳的文字整理成固定格式。格式不對就丟出錯誤，讓呼叫端重試一次。

export function parseJSON(text) {
  if (typeof text !== "string") throw new Error("empty model output");
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(s, e + 1));
}

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

const named = (list, allowed) =>
  arr(list, 4)
    .map((x) => ({ name: str(x?.name, 10), evidence: str(x?.evidence, 160) }))
    .filter((x) => allowed.includes(x.name) && x.evidence)
    .filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i);

export function cleanRewrite(raw, { retry = false } = {}) {
  if (!raw || typeof raw !== "object") throw new Error("not an object");
  const label = str(raw.tone?.label, 10);
  if (!TONES.includes(label)) throw new Error(`bad tone label: ${label}`);

  const out = {
    tone: { label, note: str(raw.tone?.note, 200) },
    fixes: arr(raw.fixes, 3)
      .map((f) => ({ from: str(f?.from, 80), to: str(f?.to, 80), note: str(f?.note, 120) }))
      .filter((f) => f.from && f.to),
    better: arr(raw.better, 3)
      .map((b) => ({
        en: str(b?.en, 200),
        zh: str(b?.zh, 120),
        why: str(b?.why, 120),
        giving: GIVINGS.includes(b?.giving) ? b.giving : "",
      }))
      .filter((b) => b.en),
    acts: named(raw.acts, ACTS),
    givings: named(raw.givings, GIVINGS),
    keys: arr(raw.keys, 3).map((k) => str(k, 40)).filter(Boolean),
  };
  if (label !== "無法分析" && out.better.length === 0) throw new Error("no better versions");
  if (retry) {
    out.compare = {
      improved: raw.compare?.improved === true,
      note: str(raw.compare?.note, 240),
    };
    if (!out.compare.note) throw new Error("missing compare note");
  }
  return out;
}
