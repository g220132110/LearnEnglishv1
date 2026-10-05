/* =========================================================================
 * App.speech — 朗讀（TTS）、語音辨識、逐字評分
 * 使用瀏覽器內建 Web Speech API。之後若改接雲端發音評測（例如 Azure
 * Pronunciation Assessment），只要替換這個檔案，模組程式不用改。
 * ========================================================================= */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;

  function pickVoice(lang) {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return vs.find((v) => v.lang === lang && /Google|Samantha|Daniel|Karen|Natural|Premium/i.test(v.name))
      || vs.find((v) => v.lang === lang) || vs.find((v) => v.lang.startsWith("en")) || null;
  }

  /* ---------- 文字正規化與比對 ---------- */
  const CONTR = { "i'm": "i am", "it's": "it is", "what's": "what is", "where's": "where is", "that's": "that is", "there's": "there is",
    "can't": "can not", "cannot": "can not", "don't": "do not", "didn't": "did not", "doesn't": "does not", "isn't": "is not", "aren't": "are not",
    "i'll": "i will", "i'd": "i would", "you're": "you are", "we're": "we are", "let's": "let us", "wifi": "wi fi", "okay": "ok" };
  const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  function norm(word) {
    const w = word.toLowerCase().replace(/[’‘]/g, "'").replace(/-/g, " ").replace(/[^a-z0-9' ]/g, "").trim();
    if (!w) return [];
    return w.split(/\s+/).flatMap((p) => {
      p = p.replace(/^'+|'+$/g, "");
      if (/^\d+$/.test(p) && +p <= 20) return [NUM[+p]];
      return (CONTR[p] || p).split(" ");
    }).filter(Boolean);
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
    let prev = [...Array(n + 1).keys()];
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }

  App.speech = {
    canListen: !!SR,
    micBlocked: false,

    speak(text, rate = 0.95, onEnd) {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = App.profile.accent; u.rate = rate; u.voice = pickVoice(App.profile.accent);
      if (onEnd) u.onend = onEnd;
      speechSynthesis.speak(u);
    },
    stop() {
      if (window.speechSynthesis) speechSynthesis.cancel();
      if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    },
    get listening() { return !!rec; },

    /* 語音辨識：onInterim(文字)、onDone([候選句…])、onErr(錯誤碼) */
    listen(onInterim, onDone, onErr) {
      rec = new SR();
      rec.lang = App.profile.accent; rec.interimResults = true; rec.maxAlternatives = 4; rec.continuous = false;
      let alts = [], interim = "";
      rec.onresult = (e) => {
        interim = "";
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const r = e.results[k];
          if (r.isFinal) alts = alts.length ? alts.map((a, x) => a + " " + (r[x] || r[0]).transcript) : Array.from(r).map((x) => x.transcript);
          else interim += r[0].transcript;
        }
        onInterim((alts[0] || "") + " " + interim);
      };
      rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") App.speech.micBlocked = true; onErr(e.error); };
      rec.onend = () => { rec = null; onDone(alts.length ? alts : interim ? [interim] : []); };
      rec.start();
    },
    finishListening() { if (rec) rec.stop(); },

    /* 把句子拆成顯示用的字：[{text, blank, toks}]；[方括號] 標示填空字 */
    parse(raw) {
      return raw.split(/\s+/).map((tok) => {
        const blank = /\[.+\]/.test(tok);
        const text = tok.replace(/[\[\]]/g, "");
        return { text, blank, toks: norm(text) };
      });
    },

    /* 逐字評分：回傳每個字的狀態 ok / near / miss，以及整句百分比 */
    grade(words, heardText) {
      const T = []; words.forEach((w, wi) => w.toks.forEach((t) => T.push({ t, wi })));
      const H = norm(heardText);
      const sim = (a, b) => (a === b ? 1 : a.length >= 4 && lev(a, b) <= 1 ? 0.5 : 0);
      const m = T.length, n = H.length, D = Array.from({ length: m + 1 }, () => new Float32Array(n + 1));
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        const s = sim(T[i - 1].t, H[j - 1]);
        D[i][j] = Math.max(D[i - 1][j], D[i][j - 1], s ? D[i - 1][j - 1] + s : -1);
      }
      const got = new Array(m).fill(0); let i = m, j = n;
      while (i > 0 && j > 0) {
        const s = sim(T[i - 1].t, H[j - 1]);
        if (s && D[i][j] === D[i - 1][j - 1] + s) { got[i - 1] = s; i--; j--; }
        else if (D[i - 1][j] >= D[i][j - 1]) i--; else j--;
      }
      const state = words.map((w, wi) => {
        const idx = T.map((x, k) => (x.wi === wi ? k : -1)).filter((k) => k >= 0);
        if (!idx.length) return "ok";
        const v = idx.reduce((s, k) => s + got[k], 0) / idx.length;
        return v >= 1 ? "ok" : v >= 0.5 ? "near" : "miss";
      });
      return { state, pct: m ? Math.round((got.reduce((a, b) => a + b, 0) / m) * 100) : 0 };
    },
  };
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
})();
