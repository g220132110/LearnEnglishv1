/* App.ai — 所有 AI 呼叫的唯一出入口（v0.5 第 5 節）
 *
 *   const r = await App.ai.call("rewrite", { text, level, context });
 *   r.ok      → 有拿到結果（AI 或後端示範模式）
 *   r.demo    → true＝示範結果，畫面要標示「示範模式」
 *   r.data    → 任務的固定格式 JSON
 *   r.offline → true＝連不到後端，模組應改用內容包裡的示範
 *   r.message → 給使用者看的中文訊息（失敗時）
 *
 * 後端網址：App.config.aiEndpoint，或在 index.html 設 window.EP_AI_ENDPOINT。
 */
(function () {
  const TIMEOUT = 25000;

  function endpoint() {
    return ((App.config && App.config.aiEndpoint) || window.EP_AI_ENDPOINT || "").replace(/\/$/, "");
  }

  // 匿名裝置代號：只用來計算每日用量，不含任何個人資料
  function deviceId() {
    let id = App.store.get("ai.device", "");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).slice(0, 36);
      App.store.set("ai.device", id);
    }
    return id;
  }

  const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

  function countUse() {
    const q = App.store.get("ai.quota", {});
    const d = today();
    App.store.set("ai.quota", { day: d, used: (q.day === d ? q.used : 0) + 1, limit: q.limit || 0 });
  }

  async function call(task, input, opts = {}) {
    const base = endpoint();
    if (!base) return { ok: false, offline: true, message: "尚未設定 AI 服務，先用示範內容練習。" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT);
    try {
      const res = await fetch(`${base}/api/${task}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ep-device": deviceId() },
        body: JSON.stringify({ level: App.level().code, ...input }),
        signal: ctrl.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        return {
          ok: false,
          offline: res.status >= 500,
          quota: res.status === 429,
          message: body.message || "AI 暫時沒有回應，請稍後再試。",
        };
      }
      countUse();
      if (body.quota && body.quota.limit) {
        App.store.set("ai.quota", { day: today(), used: body.quota.used, limit: body.quota.limit });
      }
      return { ok: true, demo: Boolean(body.demo), data: body.data };
    } catch (err) {
      return {
        ok: false,
        offline: true,
        message: err.name === "AbortError" ? "AI 回應太久，先用示範內容練習。" : "連不到 AI 服務，先用示範內容練習。",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function quota() {
    const q = App.store.get("ai.quota", {});
    return q.day === today() ? { used: q.used || 0, limit: q.limit || 0 } : { used: 0, limit: q.limit || 0 };
  }

  App.ai = { call, quota, endpoint };
})();
