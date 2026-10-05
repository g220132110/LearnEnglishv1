# Good English, Good Life — 第一階段程式

v0.5 規格的第一階段：**後端代理、App.ai、App.virtue、Say It Better（語氣教練＋Try Again）**。
寫法沿用 English Pass v0.3 的架構（核心／模組／內容包），可以直接放進現有專案。

## 檔案

```
worker/                     後端代理（Cloudflare Workers）
├─ src/index.js             路由、來源限制、用量上限、/api/rewrite
├─ src/prompts.js           系統提示詞與情境（只在後端）
├─ src/rubric.js            三好四給名稱與 Goodness Rubric、倫理界線
├─ src/schema.js            檢查並整理 AI 回傳的 JSON
├─ src/providers.js         模型轉接：Claude / Gemini
├─ src/mock.js              沒有金鑰或 AI 失敗時的示範結果
├─ test/worker.test.mjs     後端測試（8 項）
└─ wrangler.toml            部署設定
js/core/ai.js               ★ App.ai：呼叫後端、逾時、降級、用量
js/core/virtue.js           ★ App.virtue：三好四給徽章、Passport 紀錄
js/modules/saybetter.js     ★ Say It Better 模組
css/saybetter.css           ★ 模組樣式＋三好四給徽章樣式
data/saybetter/contexts.js  ★ 6 個情境、範例句、離線示範結果
dev/                        測試頁（不要放進正式專案）
├─ shim.js                  模擬 v0.3 的 App 核心
├─ index.html / server.mjs  本機測試頁與伺服器
└─ e2e.mjs                  瀏覽器實測
```

## 本機試用

```bash
node dev/server.mjs                      # 示範模式，不需金鑰
ANTHROPIC_API_KEY=sk-... node dev/server.mjs   # 真的呼叫 Claude
# 開啟 http://localhost:8787/dev/
node --test worker/test/*.mjs            # 後端測試
```

## 放進 English Pass

1. 複製 `js/core/ai.js`、`js/core/virtue.js`、`js/modules/saybetter.js`、`data/saybetter/`、`css/saybetter.css`。
2. 在 `index.html` 依序加入：
   ```html
   <link rel="stylesheet" href="css/saybetter.css">
   <script>window.EP_AI_ENDPOINT = "https://你的-worker網址";</script>
   <!-- 核心 app.js、speech.js、dict.js 之後 -->
   <script src="js/core/virtue.js"></script>
   <script src="js/core/ai.js"></script>
   <!-- 內容包 -->
   <script src="data/saybetter/contexts.js"></script>
   <!-- 模組 -->
   <script src="js/modules/saybetter.js"></script>
   ```
3. **要對照你的程式確認的三個地方**（我沒有你的原始碼，這裡依 v0.3 文件推測）：
   - `saybetter.js` 最上面的 `voice` 物件：`App.speech.listen()` 的參數、`grade()` 的回傳格式。實際簽名不同時，只改這裡。
   - `App.content.saybetter`：模組同時接受「陣列」或「單一物件」兩種存法。
   - `App.ui.tokens()`：假設回傳 HTML 字串。

## 部署後端

```bash
cd worker
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY        # 或 GEMINI_API_KEY，並把 AI_PROVIDER 改成 gemini
npx wrangler kv namespace create QUOTA           # 把 id 填進 wrangler.toml
# wrangler.toml：ALLOWED_ORIGINS 填正式網站網址
npx wrangler deploy
```

## 設計重點

- **金鑰與提示詞只在後端**；前端只送情境 id 和使用者文字。
- **四給不打分數**：只列出這次回應展現的元素，並附上引用原句的證據。名稱不在固定清單裡的，後端直接丟掉。
- **AI 永遠不會讓畫面壞掉**：格式錯誤時重試一次，再失敗就回傳示範結果；連不到後端時，前端改用內容包。兩種情況都會標示「示範模式」。
- **用量上限**：每台裝置、每個 IP、全站每天的次數都有上限，在 `wrangler.toml` 設定。
- **隱私**：只送文字，不送錄音；後端不儲存內容，只記次數。
