# English Pass 英語通行證：系統架構

> 版本 0.2（2026-09-25）
> 目前功能：口說（旅遊情境）、英文新聞閱讀、生字本
> 規劃中：測驗、情境對話

---

## 1. 設計原則

1. **核心和功能分開。** 發音、單字卡、音標、生字本、儲存、路由這些「每個功能都會用到的東西」放在 `js/core/`，只寫一次。
2. **一個功能＝一個模組檔。** 新功能只要在 `js/modules/` 加一個檔案、在 `index.html` 加一行 `<script>`，底部分頁就會自動出現。
3. **程式和內容分開。** 句子、新聞、單字解說都放在 `data/` 的「內容包」，不寫死在程式裡。之後換成 AI 自動產生，只是換掉產生內容包的方式，前端不用改。
4. **先能用，再變聰明。** 現在是純前端靜態網站，放上任何 https 空間就能用；需要 AI 的部分（每日新聞、對話、進階發音評分）由第 6 節的後端逐步接上。

---

## 2. 資料夾結構

```
english-pass/
├─ index.html              ← 外殼：標頭、畫面掛載點、單字卡、底部分頁、載入順序
├─ css/app.css             ← 共用樣式（色彩 tokens、元件），模組樣式在後段分區
├─ js/
│  ├─ core/                ← 共用核心（所有模組都能用）
│  │  ├─ app.js            ← App 命名空間、儲存、設定、內容包與模組註冊、路由、分頁
│  │  ├─ speech.js         ← 朗讀 TTS、語音辨識、逐字評分
│  │  └─ dict.js           ← 字典、KK／IPA 音標、單字卡、生字本
│  └─ modules/             ← 功能模組（彼此獨立）
│     ├─ speaking.js       ← 口說：跟讀＋填空口說＋單元選單
│     ├─ reading.js        ← 新聞閱讀：選領域、文章列表、閱讀器
│     ├─ wordbook.js       ← 生字本
│     └─ soon.js           ← 測驗、對話的預留分頁
├─ data/                   ← 內容包（純資料）
│  ├─ speaking/travel.js   ← 旅遊口說句庫＋單字解說
│  └─ news/2026-09-25.js   ← 一期新聞（6 篇）＋重點單字
└─ ARCHITECTURE.md
```

所有檔案都用一般的 `<script>` 載入，不需要打包工具，直接開檔案也能跑（麥克風除外，見第 7 節）。

---

## 3. 分層關係

```
┌────────────────────────────── index.html（外殼）──────────────────────────────┐
│  標頭 #hdrTitle／#hdrAction     畫面 #view     單字卡 #wordSheet     分頁 #tabs │
└───────────────────────────────────────────────────────────────────────────────┘
        ▲ mount(el, params)                     ▲ App.dict.open(word)
┌───────┴──────────── 功能模組 js/modules/ ─────┴───────────────────────────────┐
│   speaking      reading      wordbook      (quiz)      (dialogue)             │
└───────┬───────────────────────────────────────────────────────────────────────┘
        │ 只透過 App.* 呼叫
┌───────┴──────────── 共用核心 js/core/ ────────────────────────────────────────┐
│ App.store  App.profile  App.go()  App.ui   App.speech   App.dict   App.words  │
└───────┬───────────────────────────────────────────────────────────────────────┘
        │ App.registerContent() / App.dict.add()
┌───────┴──────────── 內容包 data/ ──────────────────────────────────────────────┐
│   speaking/*.js          news/YYYY-MM-DD.js          （未來）quiz/*.js          │
└────────────────────────────────────────────────────────────────────────────────┘
```

規則：**模組之間不互相呼叫。** 要共用的東西往下放到核心，例如生字本是 `App.words`，閱讀和口說都往這裡存，測驗從這裡讀。

---

## 4. 核心 API（App.*）

| API | 用途 |
|---|---|
| `App.store.get(key, 預設)` / `set(key, 值)` | 本機儲存，自動加 `ep.` 前綴。鍵名慣例：`模組id.項目`，例如 `reading.read` |
| `App.profile` / `App.saveProfile({...})` | 共用設定：`level`（1–3）、`accent`（en-US／en-GB／en-AU） |
| `App.level()` | 目前程度物件 `{id, zh, code:"A2"/"B1"/"B2"}` |
| `App.registerModule(模組)` | 註冊功能模組（第 5 節） |
| `App.registerContent(類型, 內容包)` | 註冊內容包，存到 `App.content[類型]` |
| `App.go("reading/a/文章id")` | 切換畫面（網址會變成 `#/reading/a/文章id`） |
| `App.setHeader(標題, 副標)` | 改頂部標題；`#hdrAction` 按鈕可給模組放一個動作 |
| `App.ui.tokens(英文, {keys})` | 把英文變成可點的單字；`keys` 內的字會標成重點單字 |
| `App.ui.chips(...)`、`App.ui.ICON` | 共用選項按鈕、圖示 |
| `App.speech.speak(文字, 速度, 結束時)` / `stop()` | 朗讀 |
| `App.speech.listen(...)`、`parse()`、`grade()` | 語音辨識、句子拆字、逐字評分 |
| `App.dict.add({...})` / `lookup(字)` / `open(字)` / `toKK(ipa)` | 字典、原形還原、單字卡、IPA 轉 KK |
| `App.words.add/remove/has/all` | 生字本 |

任何元素只要有 `data-w="單字"`，點了就會自動打開單字卡；外層元素加 `data-from="來源"`，存進生字本時會記下是從哪裡來的。

---

## 5. 模組介面

```js
App.registerModule({
  id: "quiz",            // 路由用：#/quiz
  title: "測驗",
  tab: "測驗",           // 底部分頁文字（不給就不出現在分頁）
  icon: App.ui.ICON.quiz,
  order: 4,              // 分頁順序
  soon: false,           // true＝只佔位、顯示「即將推出」
  mount(el, params) {},  // 進入畫面：把畫面畫進 el；params 是網址後面的參數
  unmount() {},          // 離開畫面：停止錄音、計時器等
});
```

**新增一個功能的步驟**
1. 建立 `js/modules/xxx.js`，呼叫 `App.registerModule`。
2. 需要內容就建立 `data/xxx/*.js`，呼叫 `App.registerContent("xxx", {...})`。
3. 在 `index.html` 的「3. 功能模組」加一行 `<script>`。
4. 樣式加在 `css/app.css` 末端，用 `/* ===== xxx 模組 ===== */` 分區。

---

## 6. 內容包格式

### 6.1 單字條目（全部模組共用）

```js
App.dict.add({
  "suitcase": "ˈsuːtkeɪs|n.|行李箱|suit 套裝 ＋ case 箱子 → 原本是裝一套西裝的箱子",
  //           └ 美式 IPA ┘└詞性┘└ 意思 ┘└──── 字的組成（選填，用 ＋ 與 → ）────┘
});
```
- KK 音標由 `App.dict.toKK()` 從 IPA 自動轉換，不用另外寫。
- 查字時會自動還原原形：climbed→climb、tariffs→tariff、estimated→estimate。
- 後載入的內容包可以覆蓋先前的條目，所以新聞包可以用「新聞語境」重新解釋同一個字。

### 6.2 口說內容包 `data/speaking/*.js`

```js
App.registerContent("speaking", {
  id: "travel", title: "旅遊口說",
  topics: [{ id: "hotel", zh: "飯店", en: "At the hotel",
    items: [[1, "What time is [breakfast]?", "早餐是幾點？"]] }],  // [難度1-3, 英文（[ ]＝填空字）, 中文]
});
```

### 6.3 新聞內容包 `data/news/YYYY-MM-DD.js`

```js
App.registerContent("news", {
  id: "2026-09-25", date: "2026-09-25",
  articles: [{
    id: "treasury-yields-2007-high",
    category: "finance",          // tech / education / world / finance / health / environment / sports / culture
    level: "B2",                  // A2 / B1 / B2，對應使用者程度顯示「適合你」
    date: "2026-09-24",
    title: { en: "...", zh: "..." },
    source: { name: "TheStreet", url: "https://..." },
    paragraphs: [{ en: "...", zh: "..." }],   // 一段英文配一段中文
    vocab: ["bond", "yield", ...],             // 重點單字（字典裡要有條目）
    patterns: [{ en: "...", zh: "..." }],      // 句型解析
  }],
});
App.dict.add({ "yield": "jiːld|n.|殖利率、收益率", ... });
```

**新增一期新聞：** 複製這個檔案、改日期與內容，在 `index.html` 的「2. 內容包」加一行。
**版權：** 文章必須是依報導事實**重新改寫**的學習版英文，不能轉貼原文；一定要附原始報導連結。

---

## 7. 部署

- **麥克風一定要 https。** 放到 GitHub Pages、Netlify 或學校的 https 主機都可以。直接開本機檔案只能打字作答。
- 支援：Android Chrome、iOS Safari 14.5 以上、電腦版 Chrome／Edge。
- 學習紀錄存在各自裝置的瀏覽器裡（localStorage），換手機不會跟著走，要跨裝置同步需要第 8 節的後端。

---

## 8. 後端與 AI 的擴充路線

現在的前端只讀「內容包」。之後加後端，也只是讓內容包自動產生，前端不用重寫。

```
 新聞來源（新聞 API／RSS）
        │ 每天定時抓標題與摘要
        ▼
 ┌───────────── 內容產生管線（排程） ─────────────┐
 │ 1. 依領域挑選新聞                               │
 │ 2. AI 改寫成 A2／B1／B2 三種程度的學習版英文     │
 │ 3. AI 逐段翻譯中文、挑重點單字、寫句型解析       │
 │ 4. 單字：IPA、詞性、語境意思、字的組成           │
 │ 5. 自動檢查：事實比對原文、單字都有條目          │
 └────────────────┬───────────────────────────────┘
                  ▼
  data/news/YYYY-MM-DD.js（或 JSON API）→ 前端照舊讀取
```

| 階段 | 做什麼 | 需要什麼 |
|---|---|---|
| **A（現在）** | 純前端＋人工或 Claude 協助產生的內容包 | 靜態網站空間 |
| **B** | 排程每日自動產生新聞包，推到 GitHub，網站自動更新 | GitHub 儲存庫、新聞來源、AI API 金鑰 |
| **C** | 小型後端 API：帳號登入、跨裝置同步學習紀錄與生字本 | 伺服器或 Firebase／Supabase 這類服務 |
| **D** | 情境對話（AI 扮演店員、海關）、進階發音評分（音素層級） | AI 對話 API、發音評測服務（如 Azure Pronunciation Assessment） |

**要換成雲端服務時要改哪裡**
- 發音評分：只改 `js/core/speech.js` 的 `grade()`，模組不用動。
- 查不到的單字要即時 AI 解說：在 `js/core/dict.js` 的 `open()` 查不到時呼叫後端，拿到條目後 `App.dict.add()`。
- 跨裝置同步：把 `App.store` 改成「本機＋雲端」雙寫，所有模組自動受惠。

---

## 9. 功能規劃

| 模組 | 狀態 | 內容 |
|---|---|---|
| 口說 speaking | ✅ 已完成 | 旅遊 8 情境、跟讀評分、填空口說、單元選單 |
| 閱讀 reading | ✅ 已完成 | 8 個領域、中英對照、重點單字、句型、朗讀全文 |
| 生字本 words | ✅ 已完成 | 從任何模組收藏單字，記錄來源 |
| 測驗 quiz | 🔜 下一步 | 生字本出題（聽音選字、KK 選讀音、拼字）、新聞讀後理解題、錯題回收 |
| 對話 dialogue | 🔜 規劃中 | AI 角色扮演對話，依程度調整，結束後給建議 |
| 口說擴充 | 🔜 | 商務、校園、面試等新情境：只要新增 `data/speaking/*.js` |
