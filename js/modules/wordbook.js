/* =========================================================================
 * 模組：生字本（所有模組共用的收藏單字）
 * 路由：#/words
 * 資料來源：App.words（在單字卡按「加入生字本」）
 * 之後的「測驗」模組會直接用這份清單出題。
 * ========================================================================= */
(function () {
  const { $, esc } = App;
  const ICON = App.ui.ICON;

  function render(el) {
    const list = App.words.all();
    App.setHeader("生字本", list.length ? `${list.length} 個單字` : "");
    el.innerHTML = `
      <section class="stack" style="gap:14px">
        <div class="section-head"><div><div class="label">Word book</div><h2>我的生字本</h2></div></div>
        ${list.length ? `
          <p class="muted" style="margin:0">從口說練習或新聞閱讀收藏的單字都在這裡。點單字可以再看一次解說。</p>
          <div class="wb-list">
            ${list.map((x) => {
              const e = App.dict.get(x.w); const [ipa, pos, zh] = e ? e.split("|") : ["", "", ""];
              return `<div class="wb-row">
                <button class="m-play" data-say="${esc(x.w)}" aria-label="播放 ${esc(x.w)}">${ICON.play}</button>
                <button class="wb-main" data-w="${esc(x.w)}">
                  <b>${esc(x.w)}</b>
                  <span class="v-ph">${ipa ? `[${esc(App.dict.toKK(ipa))}] /${esc(ipa)}/` : ""}</span>
                  <span class="v-zh"><i>${esc(pos)}</i> ${esc((zh || "").split("；")[0])}</span>
                  ${x.from ? `<span class="wb-from">來自 ${esc(x.from)}</span>` : ""}
                </button>
                <button class="wb-del" data-del="${esc(x.w)}" aria-label="從生字本移除 ${esc(x.w)}">✕</button>
              </div>`;
            }).join("")}
          </div>` : `
          <div class="panel">
            <h3>還沒有收藏的單字</h3>
            <p class="muted" style="margin:0">在口說或新聞裡點任何單字，單字卡上按「＋ 加入生字本」，就會出現在這裡。之後的測驗功能會用這份清單幫你複習。</p>
            <div class="row"><button class="btn btn-primary" id="wbGoRead">去讀新聞</button><button class="btn btn-ghost" id="wbGoSpeak">去練口說</button></div>
          </div>`}
      </section>`;
    el.onclick = (e) => {
      const s = e.target.closest("[data-say]"); if (s) { App.speech.speak(s.dataset.say, 0.85); return; }
      const d = e.target.closest("[data-del]"); if (d) { App.words.remove(d.dataset.del); render(el); return; }
      if (e.target.closest("#wbGoRead")) App.go("reading");
      if (e.target.closest("#wbGoSpeak")) App.go("speaking");
    };
  }

  let viewEl = null;
  document.addEventListener("words:changed", () => { if (viewEl && viewEl.isConnected && App.$(".wb-list, #wbGoRead")) render(viewEl); });

  App.registerModule({
    id: "words", title: "生字本", tab: "生字本", icon: ICON.words, order: 3,
    mount(el) { viewEl = el; render(el); },
    unmount() { viewEl = null; },
  });
})();
