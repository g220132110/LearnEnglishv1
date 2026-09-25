/* =========================================================================
 * 模組：英文新聞閱讀
 * 路由：#/reading（列表）、#/reading/setup（選領域）、#/reading/a/<文章id>
 * 資料：App.content.news（data/news/*.js，一個檔案＝一期新聞包）
 * 儲存：reading.prefs（興趣領域）、reading.read（已讀紀錄）、reading.zh（是否顯示中文）
 * ========================================================================= */
(function () {
  const { $, esc } = App;
  const ICON = App.ui.ICON;

  const CATS = [
    { id: "tech", zh: "科技", sub: "Technology" },
    { id: "education", zh: "教育", sub: "Education" },
    { id: "world", zh: "時事", sub: "World" },
    { id: "finance", zh: "投資理財", sub: "Finance" },
    { id: "health", zh: "健康", sub: "Health" },
    { id: "environment", zh: "環境", sub: "Environment" },
    { id: "sports", zh: "體育", sub: "Sports" },
    { id: "culture", zh: "文化", sub: "Culture" },
  ];
  const catOf = (id) => CATS.find((c) => c.id === id) || { id, zh: id, sub: id };

  let prefs, readMap, filter = "mine", reader = null;

  /* 所有文章（最新一期在前） */
  function articles() {
    return App.content.news
      .slice().sort((a, b) => (a.date < b.date ? 1 : -1))
      .flatMap((p) => p.articles.map((a) => Object.assign({ pack: p.id }, a)));
  }
  const latestPack = () => App.content.news.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const wordCount = (a) => a.paragraphs.reduce((n, p) => n + p.en.split(/\s+/).length, 0);

  /* ---------- 選興趣 ---------- */
  function renderSetup(el) {
    App.setHeader("英文新聞閱讀", "選擇有興趣的領域");
    let sel = prefs ? [...prefs.cats] : ["tech", "world", "finance"];
    let lvl = App.profile.level;
    el.innerHTML = `
      <section class="stack">
        <div class="panel"><div class="label">Step 1</div><h2>你想讀哪些領域的新聞？（可複選）</h2><div class="chips" id="catChips"></div></div>
        <div class="panel"><div class="label">Step 2</div><h2>你的英文程度？</h2><p class="muted" style="margin:0">和口說共用同一個設定，會用來標示「適合你」的文章。</p><div class="chips" id="lvChips"></div></div>
        <button class="btn btn-primary" id="rdSave">開始閱讀</button>
      </section>`;
    const draw = () => {
      $("#catChips").innerHTML = App.ui.chips(CATS, (id) => sel.includes(id));
      $("#lvChips").innerHTML = App.ui.chips(App.LEVELS, (id) => lvl == id);
      $("#rdSave").disabled = !sel.length;
      $("#rdSave").textContent = sel.length ? "開始閱讀" : "請至少選一個領域";
    };
    $("#catChips").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; const id = b.dataset.id; sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]; draw(); };
    $("#lvChips").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; lvl = +b.dataset.id; draw(); };
    $("#rdSave").onclick = () => { prefs = { cats: sel }; App.store.set("reading.prefs", prefs); App.saveProfile({ level: lvl }); filter = "mine"; App.go("reading"); };
    draw();
  }

  /* ---------- 文章卡片 ---------- */
  function card(a, small) {
    const c = catOf(a.category);
    const fit = a.level === App.level().code;
    const mins = Math.max(1, Math.round(wordCount(a) / 80));
    return `<button class="news-card${small ? " small" : ""}" data-open="${a.id}">
      <span class="nc-meta"><span class="cat cat-${esc(a.category)}">${esc(c.zh)}</span><span>${esc(a.level)}${fit ? " · 適合你" : ""}</span><span>${mins} 分鐘</span>${readMap[a.id] ? `<span class="read-mark">✓ 已讀</span>` : ""}</span>
      <span class="nc-title">${esc(a.title.en)}</span>
      <span class="nc-zh">${esc(a.title.zh)}</span>
      <span class="nc-src">${esc(a.source.name)} · ${esc(a.date)}</span>
    </button>`;
  }

  /* ---------- 列表 ---------- */
  function renderList(el) {
    const pack = latestPack();
    App.setHeader("英文新聞閱讀", pack ? "本期 " + pack.date : "");
    const all = articles();
    const mine = all.filter((a) => prefs.cats.includes(a.category));
    const others = all.filter((a) => !prefs.cats.includes(a.category));
    const shown = filter === "mine" ? mine : all.filter((a) => a.category === filter);
    const emptyCats = prefs.cats.filter((c) => !all.some((a) => a.category === c));
    const unread = mine.filter((a) => !readMap[a.id]).length;
    el.innerHTML = `
      <section class="stack" style="gap:14px">
        <div class="section-head">
          <div><div class="label">News · ${esc(pack ? pack.date : "")}</div><h2>今天讀什麼？</h2></div>
          <button class="linkbtn" id="rdSetup">調整興趣</button>
        </div>
        <p class="muted" style="margin:0">依你的興趣挑出 ${mine.length} 篇，還有 ${unread} 篇沒讀。每篇都是依真實新聞改寫的學習版英文，附中文翻譯、重點單字與句型。</p>
        <div class="chips" id="rdFilter">
          ${App.ui.chips([{ id: "mine", zh: "我的興趣" }, ...prefs.cats.map(catOf)], (id) => filter === id)}
        </div>
        <div class="news-list">${shown.length ? shown.map((a) => card(a)).join("") : `<div class="notice">這一期還沒有「${esc(catOf(filter).zh)}」的新聞。</div>`}</div>
        ${filter === "mine" && emptyCats.length ? `<p class="muted" style="margin:0;font-size:.85rem">這一期沒有：${emptyCats.map((c) => catOf(c).zh).join("、")}。</p>` : ""}
        ${filter === "mine" && others.length ? `<div class="label" style="margin-top:8px">其他領域</div><div class="news-list">${others.map((a) => card(a, true)).join("")}</div>` : ""}
      </section>`;
    $("#rdSetup").onclick = () => App.go("reading/setup");
    $("#rdFilter").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; filter = b.dataset.id; renderList(el); };
    el.onclick = (e) => { const b = e.target.closest("[data-open]"); if (b) App.go("reading/a/" + b.dataset.open); };
  }

  /* ---------- 文章閱讀 ---------- */
  function renderArticle(el, id) {
    const all = articles();
    const a = all.find((x) => x.id === id);
    if (!a) { App.go("reading"); return; }
    const c = catOf(a.category);
    const keys = new Set(a.vocab);
    let showZh = App.store.get("reading.zh", false);
    App.setHeader(c.zh + "新聞", a.date);
    el.onclick = null;
    const tok = (t) => App.ui.tokens(t, { keys });
    const vocabRows = a.vocab.map((w) => {
      const e = App.dict.get(w); if (!e) return "";
      const [ipa, pos, zh] = e.split("|");
      return `<button class="vocab" data-w="${esc(w)}"><b>${esc(w)}</b><span class="v-ph">[${esc(App.dict.toKK(ipa))}] /${esc(ipa)}/</span><span class="v-zh"><i>${esc(pos)}</i> ${esc(zh.split("；")[0])}</span></button>`;
    }).join("");
    el.innerHTML = `
      <article class="stack reader" data-from="新聞：${esc(a.title.zh)}" style="gap:16px">
        <button class="linkbtn" id="rdBack" style="align-self:flex-start">← 新聞列表</button>
        <div class="nc-meta"><span class="cat cat-${esc(a.category)}">${esc(c.zh)}</span><span>${esc(a.level)}</span><span>${wordCount(a)} 字</span><span>${esc(a.date)}</span></div>
        <h1 class="r-title">${tok(a.title.en)}</h1>
        <p class="r-title-zh">${esc(a.title.zh)}</p>
        <div class="r-tools">
          <button class="btn btn-dark" id="rdPlay">${ICON.play}朗讀全文</button>
          <button class="btn btn-ghost" id="rdZh" aria-pressed="${showZh}">${showZh ? "隱藏中文" : "顯示中文"}</button>
        </div>
        <p class="tip" style="margin:0">點任何單字看 KK／IPA 音標與解說；<span class="key-sample">黃色底線</span>是本篇重點單字。</p>
        <div class="r-body">
          ${a.paragraphs.map((p, i) => `
            <div class="para" data-i="${i}">
              <p class="p-en">${tok(p.en)}</p>
              <div class="p-tools"><button class="mini" data-say="${i}" aria-label="朗讀這段">${ICON.play}</button><button class="mini" data-zh="${i}" aria-label="這段的中文">中</button></div>
              <p class="p-zh" ${showZh ? "" : "hidden"}>${esc(p.zh)}</p>
            </div>`).join("")}
        </div>
        <section class="panel">
          <div class="label">Key words · 重點單字</div>
          <div class="vocab-list">${vocabRows}</div>
        </section>
        ${a.patterns && a.patterns.length ? `<section class="panel">
          <div class="label">Patterns · 句型解析</div>
          ${a.patterns.map((p) => `<div class="pattern"><div class="pt-en">${tok(p.en)}</div><div class="pt-zh">${esc(p.zh)}</div></div>`).join("")}
        </section>` : ""}
        <div class="source-note">
          本文依據公開報導改寫為學習用英文，事實與最新進展請以原始報導為準。<br>
          原始報導：<a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.name)} ↗</a>
        </div>
        <button class="btn btn-primary" id="rdDone">${readMap[a.id] ? "已讀過 · 回列表" : "讀完了，標記已讀"}</button>
      </article>`;

    $("#rdBack").onclick = () => App.go("reading");
    $("#rdZh").onclick = () => {
      showZh = !showZh; App.store.set("reading.zh", showZh);
      App.$$(".p-zh").forEach((p) => (p.hidden = !showZh));
      $("#rdZh").textContent = showZh ? "隱藏中文" : "顯示中文"; $("#rdZh").setAttribute("aria-pressed", showZh);
    };
    el.querySelector(".r-body").onclick = (e) => {
      const z = e.target.closest("[data-zh]"); if (z) { const p = el.querySelector(`.para[data-i="${z.dataset.zh}"] .p-zh`); p.hidden = !p.hidden; return; }
      const s = e.target.closest("[data-say]"); if (s) { stopReader(); highlight(+s.dataset.say); App.speech.speak(a.paragraphs[+s.dataset.say].en, 0.9, () => highlight(-1)); }
    };
    // 朗讀全文：一段接一段，正在唸的段落會標示出來
    $("#rdPlay").onclick = () => {
      if (reader) { stopReader(); return; }
      const run = { i: 0 }; reader = run;
      $("#rdPlay").innerHTML = ICON.stop + "停止朗讀";
      const next = () => {
        if (reader !== run) return;
        if (run.i >= a.paragraphs.length) { stopReader(); return; }
        highlight(run.i);
        el.querySelector(`.para[data-i="${run.i}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
        App.speech.speak(a.paragraphs[run.i].en, 0.9, () => { run.i++; next(); });
      };
      next();
    };
    $("#rdDone").onclick = () => {
      readMap[a.id] = Date.now(); App.store.set("reading.read", readMap);
      App.go("reading");
    };
  }
  function highlight(i) { App.$$(".para").forEach((p) => p.classList.toggle("speaking", +p.dataset.i === i)); }
  function stopReader() {
    reader = null; App.speech.stop(); highlight(-1);
    const b = $("#rdPlay"); if (b) b.innerHTML = ICON.play + "朗讀全文";
  }

  App.registerModule({
    id: "reading", title: "英文新聞閱讀", tab: "閱讀", icon: ICON.read, order: 2,
    mount(el, params) {
      prefs = App.store.get("reading.prefs", null);
      readMap = App.store.get("reading.read", {});
      if (params[0] === "setup" || !prefs) return renderSetup(el);
      if (params[0] === "a" && params[1]) return renderArticle(el, params[1]);
      renderList(el);
    },
    unmount() { stopReader(); },
  });
})();
