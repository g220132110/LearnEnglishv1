/* Say It Better — 說好話 AI 語氣教練（v0.5 必做第 1 項）
 *
 * 流程：選情境 → 說出或打出一句英文 → AI 分析 → 跟讀更好的說法 → Try Again → 前後對照
 * 依賴：App.ai、App.virtue、App.speech、App.ui.tokens（若沒有就用純文字）
 */
(function () {
  const SOURCE = "saybetter";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- 語音轉接：把 App.speech 的實際介面集中在這裡 ----------
  // 如果你的 speech.js 參數不同，只改這三個函式。
  const voice = {
    speak(text) {
      if (App.speech && App.speech.speak) App.speech.speak(text, 0.9);
    },
    canListen() {
      return Boolean(App.speech && App.speech.listen);
    },
    // onText(最終辨識文字)、onEnd()
    listen(onText, onEnd) {
      return App.speech.listen({ onText, onEnd, onError: onEnd });
    },
    grade(target, said) {
      return App.speech && App.speech.grade ? App.speech.grade(target, said) : null;
    },
  };

  const tokens = (en, keys) =>
    App.ui && App.ui.tokens ? App.ui.tokens(en, { keys: keys || [] }) : esc(en);

  const TONE_CLASS = { 直接: "direct", 中性: "neutral", 禮貌: "polite", 溫暖: "warm", 可能冒犯: "harsh", 無法分析: "neutral" };

  // ---------- 狀態 ----------
  let root = null;
  let stopListen = null;
  const st = { ctx: null, first: "", result: null, demo: false, retryText: "", retryResult: null };

  function contexts() {
    const pack = App.content && App.content.saybetter;
    const list = Array.isArray(pack) ? pack.flatMap((p) => p.contexts) : (pack && pack.contexts) || [];
    return list;
  }

  // 連不到 AI 時：用內容包的示範結果
  function offlineResult(text, retry) {
    const ctx = contexts().find((c) => c.id === st.ctx) || contexts()[0];
    const r = structuredClone(ctx.demo.result);
    if (retry) {
      const polite = /\b(please|could|would|thank|thanks|sorry|excuse me|let me|i can help)\b/i.test(text);
      r.compare = polite
        ? { improved: true, note: "進步了！這次的說法更禮貌、更體貼。" }
        : { improved: false, note: "再試試看，用上面任何一句更好的說法當參考。" };
    }
    return r;
  }

  async function analyze(text, previous) {
    const r = await App.ai.call("rewrite", { text, context: st.ctx, previous: previous || undefined });
    if (r.ok) return { data: r.data, demo: r.demo };
    if (r.quota || r.offline) return { data: offlineResult(text, Boolean(previous)), demo: true, note: r.message };
    return { error: r.message };
  }

  // ---------- 共用片段 ----------
  function micButton(id) {
    if (!voice.canListen()) return "";
    return `<button class="sb-mic" data-mic="${id}" type="button" aria-label="用說的">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2Z"/></svg>
    </button>`;
  }

  function goodPoints(res) {
    const items = [...res.acts, ...res.givings];
    if (!items.length) return "";
    return `<section class="sb-card sb-good">
      <h3>這句話做得好的地方</h3>
      ${items.map((x) => `<div class="sb-point">${App.virtue.badge(x.name)}<p>${esc(x.evidence)}</p></div>`).join("")}
    </section>`;
  }

  function demoBanner(note) {
    return `<div class="sb-demo">示範模式：${esc(note || "目前顯示的是預先準備的示範結果，不是 AI 即時分析。")}</div>`;
  }

  // ---------- 畫面 ----------
  function renderInput() {
    const list = contexts();
    if (!st.ctx) st.ctx = list[0].id;
    const ctx = list.find((c) => c.id === st.ctx);
    const count = App.virtue.stats().sources[SOURCE] || 0;

    root.innerHTML = `
      <div class="sb">
        <header class="sb-hero">
          <p class="sb-eyebrow">Speak Well · 說好話</p>
          <h2>英文不只要說得對，<br>也要說得好。</h2>
          <p class="sb-lead">說出或打出一句英文，AI 會告訴你聽起來的感覺，再示範更好的說法。</p>
        </header>

        <section class="sb-card">
          <h3>選一個情境</h3>
          <div class="sb-chips" role="radiogroup">
            ${list.map((c) => `<button type="button" role="radio" aria-checked="${c.id === st.ctx}" class="sb-chip${c.id === st.ctx ? " on" : ""}" data-ctx="${c.id}">${esc(c.zh)}<small>${esc(c.en)}</small></button>`).join("")}
          </div>

          <label class="sb-label" for="sb-text">你會怎麼說？</label>
          <div class="sb-field">
            <textarea id="sb-text" rows="2" maxlength="300" placeholder="例如：${esc(ctx.examples[0])}">${esc(st.first)}</textarea>
            ${micButton("sb-text")}
          </div>
          <div class="sb-examples">
            <span>試試看：</span>
            ${ctx.examples.map((e) => `<button type="button" class="sb-example" data-example="${esc(e)}">${esc(e)}</button>`).join("")}
          </div>
          <button type="button" class="sb-primary" data-act="analyze">分析這句話</button>
          <p class="sb-error" hidden></p>
        </section>

        ${count ? `<p class="sb-passport">你已經完成 ${count} 次說好話練習</p>` : ""}
      </div>`;
  }

  function renderLoading(msg) {
    const btn = root.querySelector("[data-act=analyze], [data-act=retry]");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="sb-spin"></span>${esc(msg)}`;
    }
  }

  function renderResult() {
    const r = st.result;
    root.innerHTML = `
      <div class="sb">
        <button type="button" class="sb-back" data-act="restart">← 換一句</button>
        ${st.demo ? demoBanner(st.demoNote) : ""}

        <section class="sb-card">
          <p class="sb-said">「${esc(st.first)}」</p>
          <div class="sb-tone sb-tone-${TONE_CLASS[r.tone.label] || "neutral"}">
            <span class="sb-tone-label">${esc(r.tone.label)}</span>
            <p>${esc(r.tone.note)}</p>
          </div>
          ${r.fixes.length ? `<ul class="sb-fixes">${r.fixes.map((f) => `<li><s>${esc(f.from)}</s> → <b>${esc(f.to)}</b><span>${esc(f.note)}</span></li>`).join("")}</ul>` : ""}
        </section>

        ${goodPoints(r)}

        ${r.better.length ? `<section class="sb-card">
          <h3>更好的說法</h3>
          <ol class="sb-better">
            ${r.better.map((b, i) => `
              <li>
                <p class="sb-en" data-from="說好話">${tokens(b.en, r.keys)}</p>
                <p class="sb-zh">${esc(b.zh)}</p>
                <p class="sb-why">${esc(b.why)}${b.giving ? " " + App.virtue.badge(b.giving) : ""}</p>
                <div class="sb-row">
                  <button type="button" class="sb-ghost" data-speak="${i}">▶ 聽</button>
                  ${voice.canListen() ? `<button type="button" class="sb-ghost" data-shadow="${i}">跟讀</button>` : ""}
                  <span class="sb-grade" data-grade="${i}"></span>
                </div>
              </li>`).join("")}
          </ol>
        </section>

        <section class="sb-card sb-try">
          <h3>Try Again：換你再說一次</h3>
          <p class="sb-lead">不用照抄，用你自己的話，把剛剛那句說得更好。</p>
          <div class="sb-field">
            <textarea id="sb-retry" rows="2" maxlength="300" placeholder="用說的或打字">${esc(st.retryText)}</textarea>
            ${micButton("sb-retry")}
          </div>
          <button type="button" class="sb-primary" data-act="retry">送出第二次</button>
          <p class="sb-error" hidden></p>
        </section>` : ""}
      </div>`;
  }

  function renderCompare() {
    const r = st.retryResult;
    const c = r.compare || { improved: false, note: "" };
    root.innerHTML = `
      <div class="sb">
        ${st.demo ? demoBanner(st.demoNote) : ""}
        <section class="sb-card sb-compare ${c.improved ? "up" : ""}">
          <h3>${c.improved ? "你進步了！" : "再接再厲"}</h3>
          <div class="sb-pair">
            <div><span>第一次</span><p>${esc(st.first)}</p><em>${esc(st.result.tone.label)}</em></div>
            <div class="after"><span>第二次</span><p>${esc(st.retryText)}</p><em>${esc(r.tone.label)}</em></div>
          </div>
          <p class="sb-note">${esc(c.note)}</p>
        </section>
        ${goodPoints(r)}
        <div class="sb-row sb-end">
          <button type="button" class="sb-ghost" data-act="again">再試一次</button>
          <button type="button" class="sb-primary" data-act="restart">練習下一句</button>
        </div>
      </div>`;
  }

  // ---------- 事件 ----------
  function showError(msg) {
    const p = root.querySelector(".sb-error");
    if (p) {
      p.textContent = msg;
      p.hidden = false;
    }
  }

  function startListen(btn) {
    const ta = root.querySelector("#" + btn.dataset.mic);
    if (stopListen) {
      stopListen();
      return;
    }
    btn.classList.add("rec");
    stopListen = voice.listen(
      (text) => {
        ta.value = text;
      },
      () => {
        btn.classList.remove("rec");
        stopListen = null;
      },
    ) || null;
  }

  function shadow(btn, i) {
    const target = st.result.better[i].en;
    const out = root.querySelector(`[data-grade="${i}"]`);
    btn.classList.add("rec");
    out.textContent = "請說…";
    voice.listen(
      (said) => {
        const g = voice.grade(target, said);
        const score = g && typeof g.score === "number" ? Math.round(g.score) : null;
        out.textContent = score === null ? `聽到：${said}` : `發音 ${score} 分`;
        out.className = "sb-grade " + (score === null ? "" : score >= 80 ? "good" : "ok");
      },
      () => btn.classList.remove("rec"),
    );
  }

  async function onClick(e) {
    const t = e.target.closest("button");
    if (!t || !root.contains(t)) return;

    if (t.dataset.ctx) {
      st.ctx = t.dataset.ctx;
      st.first = root.querySelector("#sb-text").value;
      renderInput();
    } else if (t.dataset.example) {
      root.querySelector("#sb-text").value = t.dataset.example;
    } else if (t.dataset.mic) {
      startListen(t);
    } else if (t.dataset.speak) {
      voice.speak(st.result.better[t.dataset.speak].en);
    } else if (t.dataset.shadow) {
      shadow(t, Number(t.dataset.shadow));
    } else if (t.dataset.act === "analyze") {
      const text = root.querySelector("#sb-text").value.trim();
      if (!text) return showError("請先輸入或說出一句英文。");
      st.first = text;
      renderLoading("AI 分析中…");
      const r = await analyze(text);
      if (r.error) {
        renderInput();
        return showError(r.error);
      }
      Object.assign(st, { result: r.data, demo: r.demo, demoNote: r.note, retryText: "", retryResult: null });
      renderResult();
    } else if (t.dataset.act === "retry") {
      const text = root.querySelector("#sb-retry").value.trim();
      if (!text) return showError("請再說一次，或打出你的第二次說法。");
      st.retryText = text;
      renderLoading("比較兩次說法…");
      const r = await analyze(text, st.first);
      if (r.error) {
        renderResult();
        return showError(r.error);
      }
      st.retryResult = r.data;
      st.demo = st.demo || r.demo;
      st.demoNote = st.demoNote || r.note;
      App.virtue.log("說好話", SOURCE);
      [...r.data.acts, ...r.data.givings].forEach((x) => x.name !== "說好話" && App.virtue.log(x.name));
      renderCompare();
    } else if (t.dataset.act === "again") {
      st.retryText = "";
      renderResult();
    } else if (t.dataset.act === "restart") {
      Object.assign(st, { first: "", result: null, retryText: "", retryResult: null, demo: false, demoNote: "" });
      renderInput();
    }
  }

  App.registerModule({
    id: "saybetter",
    title: "Say It Better",
    tab: "說好話",
    icon: (App.ui && App.ui.ICON && App.ui.ICON.speak) || "",
    order: 1,
    mount(el) {
      root = el;
      App.setHeader && App.setHeader("Say It Better", "說好話 AI 語氣教練");
      el.addEventListener("click", onClick);
      st.result ? (st.retryResult ? renderCompare() : renderResult()) : renderInput();
    },
    unmount() {
      if (stopListen) stopListen();
      stopListen = null;
      if (root) root.removeEventListener("click", onClick);
      root = null;
    },
  });
})();
