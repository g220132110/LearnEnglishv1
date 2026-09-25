/* =========================================================================
 * English Pass — App 核心
 * 負責：共用工具、本機儲存、使用者設定、內容包註冊、模組註冊、路由、底部分頁
 * 所有模組只透過 window.App 溝通，彼此不直接呼叫。
 * ========================================================================= */
(function () {
  const App = (window.App = {});

  /* ---------- 小工具 ---------- */
  App.$ = (s, root = document) => root.querySelector(s);
  App.$$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  App.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- 本機儲存（全部加上 ep. 前綴；失敗時安靜回傳預設值） ---------- */
  App.store = {
    get(k, d) { try { const v = localStorage.getItem("ep." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ep." + k, JSON.stringify(v)); } catch (e) {} },
  };

  /* ---------- 共用設定：程度、口音（所有模組共享） ---------- */
  App.LEVELS = [
    { id: 1, zh: "初級", sub: "會單字，句子說不順", code: "A2" },
    { id: 2, zh: "中級", sub: "能說簡單句，想更自然", code: "B1" },
    { id: 3, zh: "進階", sub: "想練長句與正式用語", code: "B2" },
  ];
  App.ACCENTS = [
    { id: "en-US", zh: "美式", sub: "American English" },
    { id: "en-GB", zh: "英式", sub: "British English" },
    { id: "en-AU", zh: "澳式", sub: "Australian English" },
  ];
  App.profile = Object.assign({ level: 1, accent: "en-US" }, App.store.get("profile", {}));
  App.saveProfile = (patch) => {
    Object.assign(App.profile, patch || {});
    App.store.set("profile", App.profile);
    App.renderHeader();
  };
  App.level = () => App.LEVELS.find((l) => l.id == App.profile.level) || App.LEVELS[0];

  /* ---------- 內容包註冊：data/ 底下的檔案呼叫 App.registerContent ---------- */
  App.content = { speaking: [], news: [] };
  App.registerContent = (type, pack) => {
    (App.content[type] = App.content[type] || []).push(pack);
  };

  /* ---------- 模組註冊 ----------
   * 模組介面（見 ARCHITECTURE.md）：
   * { id, title, tab, icon, order, soon?, mount(el, params), unmount?() }
   */
  App.modules = [];
  App.registerModule = (m) => { App.modules.push(m); App.modules.sort((a, b) => (a.order || 99) - (b.order || 99)); };

  /* ---------- 標頭 ---------- */
  let headerTitle = "", headerSub = "";
  App.setHeader = (title, sub) => { headerTitle = title; headerSub = sub || ""; App.renderHeader(); };
  App.renderHeader = () => {
    const t = App.$("#hdrTitle"); if (!t) return;
    t.textContent = headerTitle;
    App.$("#hdrSub").textContent = headerSub;
    App.$("#hdrLevel").textContent = App.level().code;
  };

  /* ---------- 路由：#/模組/參數1/參數2 ---------- */
  let current = null;
  App.go = (path) => { if (location.hash !== "#/" + path) location.hash = "#/" + path; else route(); };
  function parse() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    return { id: parts[0], params: parts.slice(1) };
  }
  function route() {
    const { id, params } = parse();
    const m = App.modules.find((x) => x.id === id && !x.soon) || App.modules.find((x) => !x.soon);
    if (current && current.unmount) current.unmount();
    App.speech && App.speech.stop();
    App.dict && App.dict.close();
    const view = App.$("#view");
    view.innerHTML = ""; view.onclick = null;
    const act = App.$("#hdrAction"); act.hidden = true; act.onclick = null;
    current = m;
    const active = m.id === "soon" ? params[0] : m.id;
    App.$$(".tab").forEach((b) => b.setAttribute("aria-current", b.dataset.id === active ? "page" : "false"));
    m.mount(view, params);
    window.scrollTo(0, 0);
  }
  App.refresh = route;

  /* ---------- 共用 UI：把一段英文變成可點的單字 ---------- */
  // opts.keys：要特別標示的重點單字（Set，放小寫原形）
  App.ui = {
    tokens(text, opts = {}) {
      return text.split(/(\s+)/).map((part) => {
        if (/^\s+$/.test(part) || !part) return part;
        if (!/[A-Za-z]/.test(part)) return App.esc(part);
        const isKey = opts.keys && App.dict && opts.keys.has(App.dict.lookup(part).key);
        return `<button class="tok${isKey ? " key" : ""}" data-w="${App.esc(part)}">${App.esc(part)}</button>`;
      }).join("");
    },
    chips(list, isOn) {
      return list.map((o) => `<button class="chip" data-id="${o.id}" aria-pressed="${isOn(o.id)}">${App.esc(o.zh)}${o.sub ? `<small>${App.esc(o.sub)}</small>` : ""}</button>`).join("");
    },
    ICON: {
      play: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>`,
      stop: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
      slow: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 17h13a5 5 0 0 0 5-5 7 7 0 0 0-14 0v5"/><circle cx="8" cy="12" r="1" fill="currentColor"/></svg>`,
      mic: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
      micBig: `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
      speak: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
      read: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h6"/></svg>`,
      words: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`,
      quiz: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/></svg>`,
    },
  };

  /* ---------- 啟動 ---------- */
  App.start = () => {
    const nav = App.$("#tabs");
    nav.innerHTML = App.modules.filter((m) => m.tab).map((m) =>
      `<button class="tab" data-id="${m.id}" ${m.soon ? 'data-soon="1"' : ""}>${m.icon || ""}<span>${App.esc(m.tab)}</span>${m.soon ? '<em>即將推出</em>' : ""}</button>`).join("");
    nav.onclick = (e) => {
      const b = e.target.closest(".tab"); if (!b) return;
      if (b.dataset.soon) { App.go("soon/" + b.dataset.id); return; }
      App.go(b.dataset.id);
    };
    // 全域：點任何 data-w 的單字就開單字卡
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-w]");
      if (t) App.dict.open(t.dataset.w, { from: (t.closest("[data-from]") || {}).dataset?.from });
    });
    window.addEventListener("hashchange", route);
    App.renderHeader();
    route();
  };
})();
