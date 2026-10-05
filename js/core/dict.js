/* =========================================================================
 * App.dict — 共用字典與單字卡；App.words — 生字本
 * 條目格式（字串，用 | 分隔）："IPA|詞性|中文意思|字的組成（選填）"
 *   字的組成寫法："suit 套裝 ＋ case 箱子 → 說明"
 * 任何內容包都可以呼叫 App.dict.add({...}) 補充條目，後載入的會覆蓋先載入的。
 * ========================================================================= */
(function () {
  const $ = App.$, esc = App.esc;
  const DICT = {};

  const keyOf = (t) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z'\-]/g, "").replace(/^['\-]+|['\-]+$/g, "");

  // 美式 IPA → KK 音標（台灣教科書慣用）
  // 規則：長音符號省略、eɪ→e、oʊ→o、e→ɛ、ɜːr→ɝ、ər→ɚ、主重音 ˈ→ˋ、次重音 ˌ→ˏ
  function toKK(ipa) {
    return ipa.replace(/ˈ/g, "ˋ").replace(/ˌ/g, "ˏ")
      .replace(/ɜːr/g, "ɝ").replace(/ər/g, "ɚ")
      .replace(/eɪ/g, "\u0001").replace(/oʊ/g, "o").replace(/e/g, "ɛ").replace(/\u0001/g, "e")
      .replace(/ː/g, "").replace(/ɡ/g, "g");
  }

  // 查字：先查原字，再試著還原成原形（複數、過去式、進行式、所有格）
  function lookup(raw) {
    const cleaned = raw.replace(/[“”"()]/g, "");
    if (/^[A-Z]\.([A-Z]\.)+/.test(cleaned)) return { key: keyOf(cleaned), entry: null }; // U.S. / D.C. 這類縮寫
    const key = keyOf(cleaned);
    if (DICT[key]) return { key, entry: DICT[key], base: key };
    const tries = [];
    if (key.endsWith("'s")) tries.push(key.slice(0, -2));
    if (key.endsWith("ies")) tries.push(key.slice(0, -3) + "y");
    if (key.endsWith("es")) tries.push(key.slice(0, -2));
    if (key.endsWith("s")) tries.push(key.slice(0, -1));
    if (key.endsWith("ied")) tries.push(key.slice(0, -3) + "y");
    if (key.endsWith("ed")) { tries.push(key.slice(0, -2), key.slice(0, -1)); if (/(.)\1ed$/.test(key)) tries.push(key.slice(0, -3)); }
    if (key.endsWith("ing")) { tries.push(key.slice(0, -3), key.slice(0, -3) + "e"); if (/(.)\1ing$/.test(key)) tries.push(key.slice(0, -4)); }
    if (key.endsWith("ly")) tries.push(key.slice(0, -2));
    for (const t of tries) if (DICT[t]) return { key: t, entry: DICT[t], base: t };
    return { key, entry: null };
  }

  /* ---------- 生字本 ---------- */
  let saved = App.store.get("words", []); // [{w, from, t}]
  App.words = {
    all: () => saved.slice(),
    has: (w) => saved.some((x) => x.w === w),
    add(w, from) { if (!App.words.has(w)) { saved.unshift({ w, from: from || "", t: Date.now() }); App.store.set("words", saved); } },
    remove(w) { saved = saved.filter((x) => x.w !== w); App.store.set("words", saved); },
  };

  /* ---------- 字根家族與片語 ----------
   * ROOTS：{ 字根id: { form, zh, origin, note, words: [[單字, IPA, 詞性, 意思, 拆解], ...] } }
   * LINKS：{ 單字: [字根id, ...] }（家族成員會自動連結，不用重複寫）
   * PHRASES：{ 單字: [[英文片語, 中文], ...] }
   */
  const ROOTS = {}, LINKS = {}, PHRASES = {};
  const linkWord = (w, id) => { (LINKS[w] = LINKS[w] || []); if (!LINKS[w].includes(id)) LINKS[w].push(id); };

  /* ---------- 單字卡 ---------- */
  let openKey = null, openFrom = "", openShown = "";
  const history = [];
  function renderSaveBtn() {
    const b = $("#wsSave"); if (!b) return;
    const on = App.words.has(openKey);
    b.textContent = on ? "✓ 已在生字本" : "＋ 加入生字本";
    b.setAttribute("aria-pressed", on);
  }
  function open(raw, opts = {}) {
    const sheet = $("#wordSheet");
    if (!sheet.hidden && openShown && !opts.back && keyOf(raw) !== keyOf(openShown)) history.push({ raw: openShown, from: openFrom });
    const { key, entry, base } = lookup(raw);
    const shown = raw.replace(/[“”"()]/g, "").replace(/[.,!?;:]+$/, "");
    let [ipa, pos, zh, parts] = entry ? entry.split("|") : ["", "", "", ""];
    // 條目沒有拆解時，從字根家族借用
    if (entry && !(parts && parts.trim())) {
      const w = base || key;
      for (const id of LINKS[w] || []) { const hit = (ROOTS[id] || { words: [] }).words.find((x) => x[0] === w); if (hit && hit[4]) { parts = hit[4]; break; } }
    }
    openKey = base || key; openFrom = opts.from || openFrom || ""; openShown = shown;
    $("#wsPrev").hidden = !history.length;
    if (history.length) $("#wsPrev").textContent = "← 回到 " + history[history.length - 1].raw.replace(/[.,!?;:“”"()]+/g, "");
    $("#wsWord").textContent = shown;
    $("#wsBase").hidden = !(base && base !== keyOf(shown));
    $("#wsBase").textContent = base ? "原形：" + base : "";
    $("#wsKK").textContent = ipa ? "[" + toKK(ipa) + "]" : "—";
    $("#wsIpa").textContent = ipa ? "/" + ipa + "/" : "—";
    $("#wsPos").textContent = pos || "";
    $("#wsZh").textContent = entry ? zh : "這個字還沒有收錄解說，可以先聽發音，或到線上字典查詢。";
    const hasParts = !!(entry && parts && parts.trim());
    $("#wsParts").hidden = !hasParts;
    if (hasParts) {
      const [formula, story] = parts.split("→").map((s) => s.trim());
      $("#wsFormula").innerHTML = formula.split("＋").map((p) => {
        const m = p.trim().match(/^([A-Za-z\-']+)\s*(.*)$/);
        return m ? `<span class="piece"><b>${esc(m[1])}</b><small>${esc(m[2])}</small></span>` : `<span class="piece plain">${esc(p.trim())}</span>`;
      }).join(`<span class="plus">＋</span>`);
      $("#wsStory").textContent = story ? "→ " + story : "";
    }
    renderFamily(openKey);
    renderPhrases(openKey);
    sheet.scrollTop = 0;
    const dictWord = encodeURIComponent(openKey || shown.toLowerCase());
    $("#wsMore").href = "https://dictionary.cambridge.org/dictionary/english-chinese-traditional/" + dictWord;
    $("#wsSave").hidden = !entry;
    renderSaveBtn();
    $("#wsBack").hidden = false; $("#wordSheet").hidden = false;
    $("#wsPlay").onclick = () => App.speech.speak(shown, 0.85);
    $("#wsSlow").onclick = () => App.speech.speak(shown, 0.5);
    App.speech.speak(shown, 0.85);
    $("#wsPlay").focus({ preventScroll: true });
  }
  function close() { const s = $("#wordSheet"); if (s) { s.hidden = true; $("#wsBack").hidden = true; } history.length = 0; openShown = ""; openFrom = ""; }

  // 字根家族：列出同字根的單字；點任一個會打開它自己的單字卡（可以一路往下學）
  function renderFamily(w) {
    const ids = (LINKS[w] || []).filter((id) => ROOTS[id]);
    $("#wsFamily").hidden = !ids.length;
    if (!ids.length) return;
    $("#wsFamilyBody").innerHTML = ids.map((id) => {
      const r = ROOTS[id];
      return `<div class="fam">
        <div class="fam-head"><b>${esc(r.form)}</b><span>＝ ${esc(r.zh)}</span>${r.origin ? `<small>${esc(r.origin)}</small>` : ""}</div>
        <div class="fam-list">${r.words.map(([fw, , , fzh, fparts]) => `
          <button class="fam-word${fw === w ? " self" : ""}" data-w="${esc(fw)}">
            <b>${esc(fw)}</b><em>${esc(fzh.split("；")[0])}</em>
            <span>${esc((fparts || "").split("→")[0].trim())}</span>
          </button>`).join("")}</div>
        ${r.note ? `<p class="fam-note">${esc(r.note)}</p>` : ""}
      </div>`;
    }).join("");
  }
  function renderPhrases(w) {
    const list = PHRASES[w] || [];
    $("#wsPhrases").hidden = !list.length;
    $("#wsPhraseList").innerHTML = list.map(([en, zh]) =>
      `<li><button class="m-play" data-phrase="${esc(en)}" aria-label="播放片語">${App.ui.ICON.play}</button><div><b>${esc(en)}</b><span>${esc(zh)}</span></div></li>`).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#wsBack").onclick = close; $("#wsClose").onclick = close;
    $("#wsPrev").onclick = () => { const h = history.pop(); if (h) open(h.raw, { from: h.from, back: true }); };
    $("#wsPhraseList").onclick = (e) => { const b = e.target.closest("[data-phrase]"); if (b) App.speech.speak(b.dataset.phrase, 0.8); };
    $("#wsSave").onclick = () => {
      App.words.has(openKey) ? App.words.remove(openKey) : App.words.add(openKey, openFrom);
      renderSaveBtn();
      document.dispatchEvent(new CustomEvent("words:changed"));
    };
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  App.dict = {
    add(entries) { Object.assign(DICT, entries); },
    // 註冊字根家族；家族裡的單字若字典沒有，會自動補上條目
    addRoots(roots) {
      Object.entries(roots).forEach(([id, r]) => {
        ROOTS[id] = r;
        r.words.forEach(([w, ipa, pos, zh, parts]) => {
          if (!DICT[w]) DICT[w] = [ipa, pos, zh, parts || ""].join("|");
          linkWord(w, id);
        });
      });
    },
    link(map) { Object.entries(map).forEach(([w, ids]) => ids.forEach((id) => linkWord(w, id))); },
    addPhrases(map) { Object.entries(map).forEach(([w, list]) => { PHRASES[w] = (PHRASES[w] || []).concat(list); }); },
    lookup, toKK, open, close,
    get: (w) => DICT[w],
    size: () => Object.keys(DICT).length,
  };
})();
