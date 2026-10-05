// 示範模式：沒有 AI 金鑰時（本機開發、或評審期間額度用完），回傳固定的示範分析。
// 回傳格式與真的 AI 完全相同，前端不用分辨。

const GENERIC = {
  tone: { label: "直接", note: "意思清楚，但語氣比較像命令。加上禮貌用語會更好。" },
  fixes: [],
  better: [
    { en: "Could you help me with this, please?", zh: "可以請你幫我一下嗎？", why: "用 Could you 詢問，最常用的禮貌說法", giving: "" },
    { en: "Would you mind helping me with this?", zh: "你介意幫我一下嗎？", why: "更客氣，給對方說不的空間", giving: "給人方便" },
    { en: "Thanks so much! Could you give me a hand?", zh: "太感謝了！可以幫我一下嗎？", why: "先道謝，讓對方感到被重視", giving: "給人歡喜" },
  ],
  acts: [],
  givings: [],
  keys: ["Would you mind", "give me a hand"],
};

const SAMPLES = [
  {
    match: /menu/i,
    result: {
      tone: { label: "直接", note: "文法正確，但少了 please，聽起來像在下命令。" },
      fixes: [],
      better: [
        { en: "Can I have the menu?", zh: "可以給我菜單嗎？", why: "用問句代替命令，自然又不失禮", giving: "" },
        { en: "Excuse me, could I have the menu, please?", zh: "不好意思，可以給我菜單嗎？", why: "先說 Excuse me 引起注意，再加 please", giving: "" },
        { en: "Hi! Could we see the menu when you have a moment?", zh: "嗨！你方便時可以給我們看菜單嗎？", why: "體諒店員正在忙", giving: "給人方便" },
      ],
      acts: [],
      givings: [],
      keys: ["could I have", "when you have a moment"],
    },
  },
  {
    match: /(stupid|failed|fail).*(again|always)|you always fail/i,
    result: {
      tone: { label: "可能冒犯", note: "朋友正在難過，這句話可能讓他更受傷。" },
      fixes: [],
      better: [
        { en: "I'm sorry. That must be hard.", zh: "我很遺憾，那一定很難受。", why: "先接住對方的感受", giving: "" },
        { en: "Don't give up. You've improved a lot.", zh: "別放棄，你已經進步很多了。", why: "肯定對方的努力", giving: "給人信心" },
        { en: "Let's study together next time. I can help you.", zh: "下次我們一起讀，我可以幫你。", why: "提出具體的協助", giving: "給人希望" },
      ],
      acts: [],
      givings: [],
      keys: ["That must be hard", "give up"],
    },
  },
];

export function mockRewrite({ text, previous }) {
  const hit = SAMPLES.find((s) => s.match.test(text));
  const base = structuredClone(hit ? hit.result : GENERIC);
  const polite = /\b(please|could|would|thank|thanks|sorry|excuse me)\b/i.test(text);
  if (polite) {
    base.tone = { label: "禮貌", note: "很好！你用了禮貌用語，聽起來尊重又自然。" };
    base.acts = [{ name: "說好話", evidence: "你用了禮貌的說法，讓對方感到被尊重。" }];
  }
  if (previous) {
    base.compare = polite
      ? { improved: true, note: "進步了！這次你加上了禮貌用語，語氣從命令變成請求。" }
      : { improved: false, note: "意思一樣清楚。下一次試著在句子裡加上 please 或 Could you。" };
  }
  return base;
}
