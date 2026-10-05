/* =========================================================================
 * 預留模組：測驗、對話（尚未開發）
 * 在底部分頁先佔位，點下去顯示規劃說明（路由 #/soon/<id>）。
 * 正式開發時：新增 js/modules/quiz.js，註冊同樣 id 並拿掉 soon: true 即可。
 * ========================================================================= */
(function () {
  const { esc } = App;
  const PLANS = {
    quiz: { title: "測驗", lines: ["用生字本的單字出題：聽音選字、看中文拼字、KK 音標選讀音", "新聞讀後理解題：每篇 3 題選擇題", "口說單元的句子重組與聽寫", "錯題自動回到生字本，依遺忘曲線安排複習"] },
    dialogue: { title: "情境對話", lines: ["和 AI 扮演的店員、櫃檯人員、海關對話", "依你的程度調整對方說話速度與用字", "對話結束後給文法與用字建議"] },
  };

  App.registerModule({ id: "quiz", title: "測驗", tab: "測驗", icon: App.ui.ICON.quiz, order: 4, soon: true, mount() {} });

  App.registerModule({
    id: "soon", title: "即將推出", order: 99,
    mount(el) {
      App.setHeader("即將推出", "Roadmap");
      el.innerHTML = `<section class="stack" style="gap:14px">
        ${Object.values(PLANS).map((p) => `<div class="panel"><div class="label">Coming soon</div><h2>${esc(p.title)}</h2>
          <ul class="plan">${p.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`).join("")}
      </section>`;
    },
  });
})();
