// 三好四給的固定名稱與 Rubric。提示詞與驗證共用這一份，避免 AI 自創名稱。

export const ACTS = ["說好話", "做好事", "存好心"];
export const GIVINGS = ["給人信心", "給人歡喜", "給人希望", "給人方便"];
export const TONES = ["直接", "中性", "禮貌", "溫暖", "可能冒犯", "無法分析"];
export const LEVELS = ["A2", "B1", "B2"];

export const RUBRIC = `
Goodness Rubric (judge ONLY what this one response shows):
- 說好話 Speak Good Words: respectful, no insult or shaming, encouraging, empathetic, grateful.
- 做好事 Do Good Deeds: offers concrete help, willing to act, solves a real difficulty.
- 存好心 Think Good Thoughts: takes the other person's perspective, avoids quick negative labels, sees a way to improve.
- 給人信心 Confidence: affirms the other person's ability or effort.
- 給人歡喜 Joy: brings warmth, thanks, or a positive feeling.
- 給人希望 Hope: points to a future possibility or a next step.
- 給人方便 Convenience: actually reduces the other person's difficulty.

Ethics (never break these):
- Evaluate the RESPONSE, never the learner's personality, morality, religion, or mental state.
- Never say the learner is a good or bad person. Never give scores for kindness.
- List an act or giving ONLY if the response clearly shows it, and quote the exact words as evidence.
- If something is missing, suggest what they could try; never say "you did not ...".
`;
