// 瀏覽器實測：node dev/e2e.mjs（需先執行 node dev/server.mjs）
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "playwright");

const OUT = process.env.OUT || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("http://localhost:8787/dev/");
await page.waitForSelector(".sb-chip");
await page.screenshot({ path: `${OUT}/1-input.png`, fullPage: true });

// 選「點餐購物」，點範例句，分析
await page.click('[data-ctx="restaurant"]');
await page.click('[data-example="Give me the menu."]');
await page.click('[data-act="analyze"]');
await page.waitForSelector(".sb-tone");
const tone = await page.textContent(".sb-tone-label");
const betterCount = await page.locator(".sb-better li").count();
await page.screenshot({ path: `${OUT}/2-result.png`, fullPage: true });

// Try Again
await page.fill("#sb-retry", "Excuse me, could I have the menu, please?");
await page.click('[data-act="retry"]');
await page.waitForSelector(".sb-compare");
const heading = await page.textContent(".sb-compare h3");
await page.screenshot({ path: `${OUT}/3-compare.png`, fullPage: true });

// 回到輸入畫面，Passport 次數出現
await page.click('[data-act="restart"]');
const passport = await page.textContent(".sb-passport");

// 空白輸入的錯誤訊息
await page.fill("#sb-text", "");
await page.click('[data-act="analyze"]');
const err = await page.textContent(".sb-error");

console.log(JSON.stringify({ tone, betterCount, heading, passport, err, errors }, null, 2));
await browser.close();
