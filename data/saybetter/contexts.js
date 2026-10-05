/* Say It Better 內容包：情境、範例句，以及連不到 AI 時使用的示範結果。
 * 情境 id 必須和後端 worker/src/prompts.js 的 REWRITE_CONTEXTS 一致。
 * 示範結果與 AI 回傳格式相同，人工撰寫、人工審核。
 */
App.registerContent("saybetter", {
  contexts: [
    {
      id: "restaurant", zh: "點餐購物", en: "At a restaurant",
      examples: ["Give me the menu.", "I want a coffee.", "Where is the toilet?"],
      demo: {
        text: "Give me the menu.",
        result: {
          tone: { label: "直接", note: "文法正確，但少了 please，聽起來像在下命令。" },
          fixes: [],
          better: [
            { en: "Can I have the menu?", zh: "可以給我菜單嗎？", why: "用問句代替命令，自然又不失禮", giving: "" },
            { en: "Excuse me, could I have the menu, please?", zh: "不好意思，可以給我菜單嗎？", why: "先說 Excuse me 引起注意，再加 please", giving: "" },
            { en: "Hi! Could we see the menu when you have a moment?", zh: "嗨！你方便時可以給我們看菜單嗎？", why: "體諒店員正在忙", giving: "給人方便" },
          ],
          acts: [], givings: [], keys: ["could I have", "when you have a moment"],
        },
      },
    },
    {
      id: "colleague", zh: "請人幫忙", en: "Asking for help",
      examples: ["Do this for me now.", "Help me fix my computer.", "You need to finish the report today."],
      demo: {
        text: "Do this for me now.",
        result: {
          tone: { label: "直接", note: "意思很清楚，但像在下命令，對方可能覺得不被尊重。" },
          fixes: [],
          better: [
            { en: "Could you help me with this?", zh: "你可以幫我處理這個嗎？", why: "把命令改成請求", giving: "" },
            { en: "Would you mind helping me with this when you're free?", zh: "你有空時介意幫我一下嗎？", why: "尊重對方的時間", giving: "給人方便" },
            { en: "I'd really appreciate your help with this. Thank you!", zh: "如果你能幫忙我會很感激，謝謝！", why: "先表達感謝，讓對方感到被重視", giving: "給人歡喜" },
          ],
          acts: [], givings: [], keys: ["Would you mind", "appreciate"],
        },
      },
    },
    {
      id: "comfort", zh: "安慰鼓勵", en: "Comforting a friend",
      examples: ["You failed again? That's bad.", "Stop crying. It's not a big deal.", "I told you to study harder."],
      demo: {
        text: "You failed again? That's bad.",
        result: {
          tone: { label: "可能冒犯", note: "朋友正在難過，「again」和「That's bad」可能讓他更受傷。" },
          fixes: [],
          better: [
            { en: "I'm sorry. That must be hard.", zh: "我很遺憾，那一定很難受。", why: "先接住對方的感受", giving: "" },
            { en: "Don't give up. You've improved a lot.", zh: "別放棄，你已經進步很多了。", why: "肯定對方的努力", giving: "給人信心" },
            { en: "Let's study together next time. I can help you.", zh: "下次我們一起讀，我可以幫你。", why: "提出具體的下一步", giving: "給人希望" },
          ],
          acts: [], givings: [], keys: ["That must be hard", "give up"],
        },
      },
    },
    {
      id: "complaint", zh: "回應抱怨", en: "Replying to a complaint",
      examples: ["That's your problem.", "Why are you always complaining?", "I don't care."],
      demo: {
        text: "That's your problem.",
        result: {
          tone: { label: "可能冒犯", note: "這句話會讓對方覺得被推開，關係容易變緊張。" },
          fixes: [],
          better: [
            { en: "That sounds frustrating.", zh: "聽起來真讓人沮喪。", why: "先表示理解", giving: "" },
            { en: "I see. What happened?", zh: "我懂了，發生什麼事？", why: "願意聽對方說", giving: "" },
            { en: "That sounds hard. Is there anything I can do?", zh: "聽起來不容易，有什麼我能幫忙的嗎？", why: "表達關心並提供協助", giving: "給人方便" },
          ],
          acts: [], givings: [], keys: ["frustrating", "Is there anything I can do"],
        },
      },
    },
    {
      id: "decline", zh: "婉拒邀請", en: "Saying no politely",
      examples: ["No, I don't want to go.", "I'm busy. No.", "Your party sounds boring."],
      demo: {
        text: "No, I don't want to go.",
        result: {
          tone: { label: "直接", note: "誠實表達很好，但少了感謝和理由，對方可能覺得被拒絕得很突然。" },
          fixes: [],
          better: [
            { en: "Thanks, but I can't make it.", zh: "謝謝，但我沒辦法去。", why: "先道謝再婉拒", giving: "" },
            { en: "Thank you for inviting me. I'm afraid I'm busy that day.", zh: "謝謝你邀請我，那天我恐怕有事。", why: "I'm afraid 讓拒絕更柔和", giving: "" },
            { en: "That sounds fun! I can't go this time, but maybe next time?", zh: "聽起來很好玩！這次不行，下次好嗎？", why: "肯定對方的邀請，也留下下次的可能", giving: "給人歡喜" },
          ],
          acts: [], givings: [], keys: ["I'm afraid", "make it"],
        },
      },
    },
    {
      id: "directions", zh: "幫人指路", en: "Helping a visitor",
      examples: ["Go there.", "Station? That way.", "I don't know. Ask someone else."],
      demo: {
        text: "Go there.",
        result: {
          tone: { label: "直接", note: "願意回答很好！但太簡短，遊客可能還是找不到。" },
          fixes: [],
          better: [
            { en: "It's that way. Go straight.", zh: "在那個方向，直走就到了。", why: "說清楚方向", giving: "給人方便" },
            { en: "Go straight and turn left. It's about five minutes.", zh: "直走再左轉，大約五分鐘。", why: "給出路線和時間", giving: "給人方便" },
            { en: "I'm going that way too. Let me show you!", zh: "我也往那邊走，我帶你去！", why: "直接陪對方走一段", giving: "給人歡喜" },
          ],
          acts: [{ name: "做好事", evidence: "你願意停下來回答陌生人的問題。" }],
          givings: [], keys: ["Go straight", "Let me show you"],
        },
      },
    },
  ],
});
