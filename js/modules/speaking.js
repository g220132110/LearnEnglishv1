/* =========================================================================
 * 模組：口說（旅遊情境）
 * 路由：#/speaking
 * 資料：App.content.speaking（data/speaking/*.js）
 * 儲存：speaking.prefs（情境、每課句數）、speaking.best（各單元最佳成績）
 * ========================================================================= */
(function () {
  const { $, esc } = App;
  const ICON = App.ui.ICON;
  const SIZES = [{ id: 4, zh: "4 句", sub: "約 5 分鐘" }, { id: 6, zh: "6 句", sub: "約 8 分鐘" }, { id: 8, zh: "8 句", sub: "約 12 分鐘" }];
  const POOL = { 1: { pool: [1, 2], weight: { 1: 3, 2: 1 } }, 2: { pool: [1, 2, 3], weight: { 1: 1, 2: 3, 3: 1 } }, 3: { pool: [2, 3], weight: { 2: 1, 3: 3 } } };
  const ORDER = ["airport", "transport", "directions", "hotel", "restaurant", "sightseeing", "shopping", "emergency"];

  let prefs, best, draft, course = [], extra = [], L = null;
  const topics = () => App.content.speaking.flatMap((p) => p.topics);

  const TEMPLATE = `
  <section id="spSetup" class="stack" hidden>
    <div class="panel"><div class="label">Step 1</div><h2>你的英文程度？</h2><div class="chips" id="levelChips"></div></div>
    <div class="panel"><div class="label">Step 2</div><h2>要去哪裡旅行？</h2><p class="muted" style="margin:0">決定示範發音的口音與語音辨識設定。</p><div class="chips" id="destChips"></div></div>
    <div class="panel"><div class="label">Step 3</div><h2>你最想練哪些情境？（可複選）</h2><div class="chips" id="topicChips"></div></div>
    <div class="panel"><div class="label">Step 4</div><h2>每課幾句？</h2><div class="chips" id="sizeChips"></div></div>
    <button class="btn btn-primary" id="btnBuild">幫我設計課程</button>
  </section>

  <section id="spCourse" class="stack" style="gap:14px" hidden>
    <div class="section-head">
      <div><div class="label">Your itinerary</div><h2>我的旅遊英語課程</h2></div>
      <button class="linkbtn" id="btnReset">重新設定</button>
    </div>
    <p class="muted" id="courseNote" style="margin:0"></p>
    <div id="unitList" style="display:flex;flex-direction:column;gap:10px"></div>
  </section>

  <section id="spLesson" class="stack" style="gap:14px" hidden>
    <div class="topbar">
      <button class="btn btn-ghost" id="btnExit" style="padding:8px 12px" aria-label="回課程列表">✕</button>
      <div class="progress"><i id="prog"></i></div>
      <span class="label" id="progTxt" style="font-variant-numeric:tabular-nums"></span>
    </div>
    <div class="panel" id="card" data-from="口說"></div>
  </section>

  <section id="spSummary" class="stack" hidden><div class="panel" id="sumCard"></div></section>

  <div class="ws-back" id="menuBack" hidden style="z-index:8"></div>
  <nav class="drawer" id="menu" aria-label="單元選單" hidden data-from="口說">
    <div class="ws-head">
      <div><div class="label">Units · 隨時複習</div><h2>單元選單</h2></div>
      <button class="btn btn-ghost" id="menuClose" style="padding:6px 12px" aria-label="關閉">✕</button>
    </div>
    <div id="menuBody"></div>
  </nav>`;

  function show(id) { ["spSetup", "spCourse", "spLesson", "spSummary"].forEach((s) => ($("#" + s).hidden = s !== id)); window.scrollTo(0, 0); }
  function headerMenu(on) {
    App.setHeader("旅遊口說", on ? "" : "Travel speaking");
    const b = $("#hdrAction");
    b.hidden = !on; b.textContent = "單元選單"; b.onclick = openMenu;
  }

  /* ---------- 設定 ---------- */
  function chipGroup(el, list, isOn, onTap) {
    el.innerHTML = App.ui.chips(list, isOn);
    el.onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; onTap(b.dataset.id); renderSetup(); };
  }
  function renderSetup() {
    chipGroup($("#levelChips"), App.LEVELS, (id) => draft.level == id, (id) => (draft.level = +id));
    chipGroup($("#destChips"), [
      { id: "en-US", zh: "美國／加拿大", sub: "American English" },
      { id: "en-GB", zh: "英國／歐洲", sub: "British English" },
      { id: "en-AU", zh: "澳洲／紐西蘭", sub: "Australian English" }], (id) => draft.accent == id, (id) => (draft.accent = id));
    chipGroup($("#topicChips"), topics().map((t) => ({ id: t.id, zh: t.zh, sub: t.en })), (id) => draft.topics.includes(id),
      (id) => { draft.topics = draft.topics.includes(id) ? draft.topics.filter((x) => x !== id) : [...draft.topics, id]; });
    chipGroup($("#sizeChips"), SIZES, (id) => draft.size == id, (id) => (draft.size = +id));
    $("#btnBuild").disabled = draft.topics.length === 0;
    $("#btnBuild").textContent = draft.topics.length ? "幫我設計課程" : "請至少選一個情境";
  }

  /* ---------- 課程規劃 ---------- */
  function makeUnit(tid) {
    const cfg = POOL[App.profile.level] || POOL[1];
    const t = topics().find((x) => x.id === tid);
    const pool = t.items.filter((i) => cfg.pool.includes(i[0]))
      .map((i) => ({ lv: i[0], raw: i[1], zh: i[2], w: cfg.weight[i[0]] || 1 }))
      .sort((a, b) => b.w - a.w || a.lv - b.lv);
    return { id: tid, zh: t.zh, en: t.en, items: pool.slice(0, prefs.size).sort((a, b) => a.lv - b.lv) };
  }
  function buildCourse() {
    const lv = App.level();
    const all = topics().map((t) => t.id);
    const order = [...ORDER.filter((x) => all.includes(x)), ...all.filter((x) => !ORDER.includes(x))];
    course = order.filter((t) => prefs.topics.includes(t)).map(makeUnit);
    extra = order.filter((t) => !prefs.topics.includes(t)).map(makeUnit);
    headerMenu(true);
    $("#courseNote").textContent = `依你的程度（${lv.zh}）排出 ${course.length} 個單元，照旅程順序。每課先「跟讀」再「填空口說」。`;
    $("#unitList").innerHTML = course.map((u, i) => {
      const b = best[App.profile.level + "_" + u.id];
      return `<button class="unit" data-i="${i}">
        <span class="no">${String(i + 1).padStart(2, "0")}</span>
        <span><h3>${esc(u.zh)}</h3><span class="meta">${esc(u.en)} · ${u.items.length} 句</span></span>
        <span class="badge ${b != null ? "done" : ""}">${b != null ? "最佳 " + b + "%" : "未開始"}</span></button>`;
    }).join("");
    $("#unitList").onclick = (e) => { const b = e.target.closest(".unit"); if (b) startLesson(course[+b.dataset.i]); };
    show("spCourse");
  }

  /* ---------- 課堂 ---------- */
  function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function startLesson(u) {
    App.speech.stop(); App.dict.close(); closeMenu();
    L = { unit: u, steps: [...u.items.map((it) => ({ type: "shadow", it })), ...shuffle(u.items).map((it) => ({ type: "cloze", it }))], idx: 0, results: [] };
    show("spLesson"); renderStep();
  }

  function renderStep() {
    const S = App.speech;
    const st = L.steps[L.idx], it = st.it, words = S.parse(it.raw);
    const plain = words.map((w) => w.text).join(" ");
    const n = L.steps.length;
    $("#prog").style.width = (L.idx / n) * 100 + "%";
    $("#progTxt").textContent = `${L.idx + 1}/${n}`;
    const shadow = st.type === "shadow";
    const blanks = words.filter((w) => w.blank).length;
    const tokHtml = (w) => `<button class="tok" data-w="${esc(w.text)}">${esc(w.text)}</button>`;
    const enHtml = shadow ? words.map(tokHtml).join(" ")
      : words.map((w) => (w.blank ? `<span class="gap" data-hint="${esc(w.text)}">${"_".repeat(Math.max(3, Math.min(w.text.length, 8)))}</span>` : tokHtml(w))).join(" ");
    const micOK = S.canListen && !S.micBlocked;
    $("#card").innerHTML = `
      <div class="stage-tag"><span>${shadow ? "PART 1" : "PART 2"}</span><b>${shadow ? "跟讀：看中文、聽示範，照著說" : "填空口說：依中文意思，說出整句"}</b></div>
      <div class="zh">${esc(it.zh)}</div>
      <div class="en ${shadow ? "" : "cloze"}" id="enLine">${enHtml}</div>
      <div class="tip">點任一個單字，聽發音、看意思和字的組成</div>
      <div class="row">
        ${shadow ? `<button class="btn btn-dark" id="bPlay">${ICON.play}聽示範</button><button class="btn btn-ghost" id="bSlow">${ICON.slow}慢速</button>`
                 : `<button class="btn btn-ghost" id="bHint">提示字首</button><button class="btn btn-ghost" id="bPeek">${ICON.play}偷聽一次</button>`}
      </div>
      ${micOK ? `<button class="mic" id="bMic" aria-label="開始說">${ICON.mic}</button><div class="heard" id="heard">按麥克風，說完會自動評分</div>`
              : `<div class="notice">${S.canListen ? "麥克風無法使用，" : "這個瀏覽器不支援語音辨識，"}先用打字作答。手機請用 Chrome（Android）或 Safari（iOS 14.5 以上）開啟。</div>`}
      <div class="typein" id="typeRow" ${micOK ? "hidden" : ""}><input id="typeIn" placeholder="輸入你要說的英文句子" autocomplete="off"><button class="btn btn-dark" id="bType" style="padding:10px 14px">送出</button></div>
      ${micOK ? `<button class="linkbtn" id="bShowType" style="align-self:center">改用打字</button>` : ""}
      <div id="result" hidden></div>`;
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on("#bPlay", () => S.speak(plain, 0.95));
    on("#bSlow", () => S.speak(plain, 0.6));
    on("#bHint", (e) => { App.$$(".gap").forEach((g) => { const t = g.dataset.hint; g.textContent = t[0] + "_".repeat(Math.max(2, t.length - 1)); }); e.currentTarget.disabled = true; });
    on("#bPeek", (e) => { S.speak(plain, 0.95); e.currentTarget.disabled = true; });
    on("#bShowType", (e) => { $("#typeRow").hidden = false; e.currentTarget.hidden = true; $("#typeIn").focus(); });
    const submitTyped = () => { const v = $("#typeIn").value.trim(); if (v) finish([v]); };
    on("#bType", submitTyped);
    $("#typeIn").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); submitTyped(); } };
    on("#bMic", () => {
      const mic = $("#bMic");
      if (S.listening) { S.finishListening(); return; }
      if (window.speechSynthesis) speechSynthesis.cancel();
      mic.classList.add("on"); mic.innerHTML = ICON.micBig; $("#heard").textContent = "聆聽中…";
      try {
        S.listen((t) => { $("#heard").textContent = t.trim() || "聆聽中…"; },
          (alts) => {
            mic.classList.remove("on"); mic.innerHTML = ICON.mic;
            if (!alts.length) { if (!$("#heard").dataset.err) $("#heard").textContent = "沒有聽到聲音，再按一次試試"; return; }
            finish(alts);
          },
          (err) => {
            const h = $("#heard"); h.dataset.err = 1;
            if (err === "not-allowed" || err === "service-not-allowed") { h.textContent = "麥克風權限被拒絕，已切換成打字作答"; $("#typeRow").hidden = false; }
            else if (err === "no-speech") h.textContent = "沒有聽到聲音，靠近手機再試一次";
            else if (err === "network") h.textContent = "語音辨識需要網路連線";
            else h.textContent = "辨識出錯（" + err + "），再試一次";
            setTimeout(() => delete h.dataset.err, 50);
          });
      } catch (e) { mic.classList.remove("on"); mic.innerHTML = ICON.mic; $("#heard").textContent = "無法啟動麥克風"; }
    });

    function finish(alts) {
      let r = null, heard = "";
      alts.forEach((a) => { const g = S.grade(words, a); if (!r || g.pct > r.pct) { r = g; heard = a; } });
      let scoreLine, pct;
      if (shadow) {
        pct = r.pct;
        scoreLine = `<div class="score ${pct >= 85 ? "good" : pct >= 60 ? "mid" : "low"}"><b>${pct}%</b><span class="muted">發音準確度</span></div>`;
      } else {
        const okB = words.reduce((s, w, i) => s + (w.blank && r.state[i] === "ok" ? 1 : 0), 0);
        const nearB = words.reduce((s, w, i) => s + (w.blank && r.state[i] === "near" ? 1 : 0), 0);
        pct = Math.round(((okB + nearB * 0.5) / blanks) * 100);
        scoreLine = `<div class="score ${pct >= 85 ? "good" : pct >= 50 ? "mid" : "low"}"><b>${okB}/${blanks}</b><span class="muted">個空格答對${nearB ? `（${nearB} 個接近）` : ""} · 整句 ${r.pct}%</span></div>`;
      }
      L.results[L.idx] = { type: st.type, pct, zh: it.zh };
      const chips = words.map((w, i) => `<button class="w ${r.state[i]} ${!shadow && w.blank ? "blank" : ""}" data-w="${esc(w.text)}">${esc(w.text)}</button>`).join("");
      const res = $("#result"); res.hidden = false;
      res.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;border-top:1px dashed var(--line);padding-top:14px">
        ${scoreLine}
        <div class="words">${chips}</div>
        <div class="legend"><span><i style="background:var(--ok)"></i>正確</span><span><i style="background:var(--near)"></i>接近</span><span><i style="background:var(--miss)"></i>沒聽到／錯誤</span>${!shadow ? "<span>外框＝填空字</span>" : ""}</div>
        <div class="muted" style="font-size:.9rem">系統聽到：「${esc(heard)}」</div>
        <div class="row"><button class="btn btn-ghost" id="bAgain">再試一次</button><button class="btn btn-ghost" id="bModel">${ICON.play}正確示範</button><button class="btn btn-primary" id="bNext">${L.idx + 1 < L.steps.length ? "下一題" : "看成績"}</button></div>
      </div>`;
      if (!shadow) $("#enLine").innerHTML = words.map(tokHtml).join(" ");
      if ($("#heard")) $("#heard").textContent = "";
      $("#bAgain").onclick = renderStep;
      $("#bModel").onclick = () => S.speak(plain, 0.9);
      $("#bNext").onclick = () => { L.idx++; L.idx < L.steps.length ? renderStep() : summary(); };
      $("#bNext").focus({ preventScroll: true });
      res.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function summary() {
    const R = L.results.filter(Boolean);
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x.pct, 0) / arr.length) : 0);
    const sh = R.filter((x) => x.type === "shadow"), cl = R.filter((x) => x.type === "cloze");
    const total = avg(R);
    const key = App.profile.level + "_" + L.unit.id;
    if (best[key] == null || total > best[key]) { best[key] = total; App.store.set("speaking.best", best); }
    const weak = [...R].sort((a, b) => a.pct - b.pct).slice(0, 3).filter((x) => x.pct < 85);
    $("#sumCard").innerHTML = `
      <div class="label">Lesson complete · ${esc(L.unit.en)}</div>
      <h2>${esc(L.unit.zh)} 完成！</h2>
      <div class="score ${total >= 85 ? "good" : total >= 60 ? "mid" : "low"}" style="justify-content:flex-start"><b>${total}%</b><span class="muted">本課總分</span></div>
      <div>
        <div class="sumrow"><span>Part 1 跟讀發音</span><span class="n">${avg(sh)}%</span></div>
        <div class="sumrow"><span>Part 2 填空口說</span><span class="n">${avg(cl)}%</span></div>
        <div class="sumrow"><span>本單元最佳紀錄</span><span class="n">${best[key]}%</span></div>
      </div>
      ${weak.length ? `<div><div class="label" style="margin-bottom:6px">建議再練</div>${weak.map((w) => `<div class="sumrow"><span>${esc(w.zh)}</span><span class="n">${w.pct}%</span></div>`).join("")}</div>` : `<p style="margin:0">每一句都達到 85% 以上，可以挑戰下一個情境或更高程度。</p>`}
      <div class="row"><button class="btn btn-ghost" id="bRetry">再練一次</button><button class="btn btn-primary" id="bBack">回課程</button></div>`;
    $("#bRetry").onclick = () => startLesson(L.unit);
    $("#bBack").onclick = buildCourse;
    show("spSummary");
  }

  /* ---------- 單元選單 ---------- */
  function unitRow(u, n, isExtra) {
    const b = best[App.profile.level + "_" + u.id];
    const current = L && !$("#spLesson").hidden && L.unit.id === u.id;
    return `<div class="m-unit ${current ? "current" : ""}">
      <div class="m-top">
        <span class="no">${isExtra ? "＋" : String(n).padStart(2, "0")}</span>
        <span class="m-title"><b>${esc(u.zh)}</b><small>${esc(u.en)} · ${u.items.length} 句${current ? " · 練習中" : ""}</small></span>
        <span class="badge ${b != null ? "done" : ""}">${b != null ? b + "%" : "未練"}</span>
      </div>
      <div class="row">
        <button class="btn btn-primary" data-go="${u.id}" style="padding:9px 12px">${b != null ? "再練一次" : "開始練習"}</button>
        <button class="btn btn-ghost" data-list="${u.id}" aria-expanded="false" style="padding:9px 12px">看句子</button>
      </div>
      <ol class="m-sents" hidden>
        ${u.items.map((it) => { const ws = App.speech.parse(it.raw); const plain = ws.map((w) => w.text).join(" ");
          return `<li><button class="m-play" data-say="${esc(plain)}" aria-label="播放">${ICON.play}</button>
            <div><div class="m-zh">${esc(it.zh)}</div><div class="m-en">${ws.map((w) => `<button class="tok" data-w="${esc(w.text)}">${esc(w.text)}</button>`).join(" ")}</div></div></li>`; }).join("")}
      </ol></div>`;
  }
  function openMenu() {
    $("#menuBody").innerHTML = `<div class="label" style="margin:4px 0 8px">我的課程</div>` + course.map((u, i) => unitRow(u, i + 1, false)).join("") +
      (extra.length ? `<div class="label" style="margin:18px 0 8px">其他情境 · 加練</div>` + extra.map((u) => unitRow(u, 0, true)).join("") : "");
    $("#menu").hidden = false; $("#menuBack").hidden = false;
    $("#menuClose").focus({ preventScroll: true });
  }
  function closeMenu() { const m = $("#menu"); if (m) { m.hidden = true; $("#menuBack").hidden = true; } }

  /* ---------- 模組介面 ---------- */
  App.registerModule({
    id: "speaking", title: "旅遊口說", tab: "口說", icon: ICON.speak, order: 1,
    mount(el) {
      prefs = App.store.get("speaking.prefs", null);
      best = App.store.get("speaking.best", {});
      el.innerHTML = TEMPLATE;
      draft = { level: App.profile.level, accent: App.profile.accent,
        topics: prefs ? [...prefs.topics] : ["directions", "airport", "hotel", "restaurant"], size: prefs ? prefs.size : 6 };
      $("#btnBuild").onclick = () => {
        prefs = { topics: [...draft.topics], size: draft.size };
        App.store.set("speaking.prefs", prefs);
        App.saveProfile({ level: draft.level, accent: draft.accent });
        buildCourse();
      };
      $("#btnReset").onclick = () => { draft = { level: App.profile.level, accent: App.profile.accent, topics: [...prefs.topics], size: prefs.size }; renderSetup(); headerMenu(false); show("spSetup"); };
      $("#btnExit").onclick = () => { App.speech.stop(); buildCourse(); };
      $("#menuClose").onclick = closeMenu; $("#menuBack").onclick = closeMenu;
      $("#menuBody").addEventListener("click", (e) => {
        const go = e.target.closest("[data-go]"); if (go) { startLesson([...course, ...extra].find((u) => u.id === go.dataset.go)); return; }
        const li = e.target.closest("[data-list]"); if (li) { const ol = li.closest(".m-unit").querySelector(".m-sents"); ol.hidden = !ol.hidden; li.setAttribute("aria-expanded", !ol.hidden); li.textContent = ol.hidden ? "看句子" : "收起句子"; return; }
        const say = e.target.closest("[data-say]"); if (say) App.speech.speak(say.dataset.say, 0.9);
      });
      renderSetup();
      if (prefs) buildCourse(); else { headerMenu(false); show("spSetup"); }
    },
    unmount() { L = null; $("#hdrAction").hidden = true; },
  });
})();
