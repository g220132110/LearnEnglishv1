/* App.virtue — 三好四給的統一標籤與 Goodness Passport 紀錄（v0.5 第 3、4 節）
 *
 *   App.virtue.badge("給人信心")        → 小徽章 HTML
 *   App.virtue.log("說好話", "saybetter") → 記錄一次實踐
 *   App.virtue.stats()                   → { acts:{說好話:3,…}, givings:{…}, sources:{…} }
 *
 * 只記次數、只跟自己比，不排名、不打分數。
 */
(function () {
  const ACTS = {
    說好話: { en: "Speak Good Words", short: "Speak Well" },
    做好事: { en: "Do Good Deeds", short: "Do Well" },
    存好心: { en: "Think Good Thoughts", short: "Think Well" },
  };
  const GIVINGS = {
    給人信心: { en: "Confidence" },
    給人歡喜: { en: "Joy" },
    給人希望: { en: "Hope" },
    給人方便: { en: "Convenience" },
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function info(name) {
    if (ACTS[name]) return { kind: "act", ...ACTS[name] };
    if (GIVINGS[name]) return { kind: "giving", ...GIVINGS[name] };
    return null;
  }

  function badge(name) {
    const i = info(name);
    if (!i) return "";
    return `<span class="gv-badge gv-${i.kind}" title="${esc(i.en)}">${esc(name)}<small>${esc(i.en)}</small></span>`;
  }

  function log(name, source) {
    if (!info(name)) return;
    const s = App.store.get("virtue.log", { acts: {}, givings: {}, sources: {} });
    const bucket = ACTS[name] ? s.acts : s.givings;
    bucket[name] = (bucket[name] || 0) + 1;
    if (source) s.sources[source] = (s.sources[source] || 0) + 1;
    App.store.set("virtue.log", s);
  }

  function stats() {
    return App.store.get("virtue.log", { acts: {}, givings: {}, sources: {} });
  }

  App.virtue = { ACTS, GIVINGS, info, badge, log, stats };
})();
