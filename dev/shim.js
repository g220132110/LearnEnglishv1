/* 測試用的最小 App 核心，只為了讓新模組能獨立執行。
 * 正式整合時不要載入這個檔案，改用你 English Pass 的 js/core/app.js、speech.js、dict.js。
 * 這裡模擬的介面依 v0.3 架構文件第 4 節。
 */
(function () {
  const PREFIX = "ep.";
  const LEVELS = [null, { id: 1, zh: "初級", code: "A2" }, { id: 2, zh: "中級", code: "B1" }, { id: 3, zh: "中高級", code: "B2" }];
  const modules = [];
  let current = null;

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch {}
    },
  };

  const App = (window.App = {
    store,
    config: {},
    content: {},
    profile: store.get("profile", { level: 2, accent: "en-US" }),
    level: () => LEVELS[App.profile.level] || LEVELS[2],
    registerModule(m) { modules.push(m); },
    registerContent(type, pack) { (App.content[type] = App.content[type] || []).push(pack); },
    setHeader(t, sub) {
      document.getElementById("hdrTitle").textContent = t;
      document.getElementById("hdrSub").textContent = sub || "";
    },
    go(path) { location.hash = "#/" + path; },
    ui: {
      tokens(en, { keys = [] } = {}) {
        const k = keys.map((s) => s.toLowerCase());
        return en.split(/(\s+)/).map((w) => {
          if (/^\s+$/.test(w)) return w;
          const bare = w.replace(/[^\w']/g, "").toLowerCase();
          const key = k.some((x) => x.split(/\s+/).includes(bare));
          return `<span data-w="${bare}" class="${key ? "kw" : ""}">${w.replace(/</g, "&lt;")}</span>`;
        }).join("");
      },
      ICON: {},
    },
    speech: {
      speak(text, rate = 1) {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = App.profile.accent; u.rate = rate;
        speechSynthesis.speak(u);
      },
      listen({ onText, onEnd, onError } = {}) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { onError && onError(new Error("no speech")); return null; }
        const r = new SR();
        r.lang = App.profile.accent; r.interimResults = false;
        r.onresult = (e) => onText && onText(e.results[0][0].transcript);
        r.onerror = (e) => onError && onError(e);
        r.onend = () => onEnd && onEnd();
        r.start();
        return () => r.stop();
      },
      grade(target, said) {
        const norm = (s) => s.toLowerCase().replace(/[^\w'\s]/g, "").split(/\s+/).filter(Boolean);
        const t = norm(target), s = new Set(norm(said));
        const words = t.map((w) => ({ w, ok: s.has(w) }));
        return { score: (100 * words.filter((x) => x.ok).length) / (t.length || 1), words };
      },
    },
  });

  if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) delete App.speech.listen;

  function route() {
    const id = (location.hash.replace(/^#\//, "").split("/")[0]) || modules.sort((a, b) => a.order - b.order)[0].id;
    const m = modules.find((x) => x.id === id) || modules[0];
    if (current && current.unmount) current.unmount();
    const view = document.getElementById("view");
    const fresh = view.cloneNode(false);
    view.replaceWith(fresh);
    current = m;
    m.mount(fresh, location.hash.split("/").slice(2));
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);
})();
