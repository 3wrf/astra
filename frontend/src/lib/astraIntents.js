// Questions Astra answers INSTANTLY, without the AI: "what do you think about our project?"
// (a ~20-second summary for a demo) and "what can you do?". They work even when the free AI
// plan is out of quota or there's no internet, which is exactly when a live demo needs them.
// The words live in config/content.json ("astra"), so the team can edit them without code.
//
// Kept strict on purpose: "what is my heart rate on the app?" must still go to the AI.
// But people type the way they talk -- "what do u think of of our proejct" -- so the text is
// tidied first (normalizeAsk): chat shorthand (u -> you, ur -> your, wat -> what), repeated
// words ("of of"), and ANY small typo in the key words, found by how close a word is to the
// real one (proejct, porject, projcet, thnik, opnion... -> project, think, opinion).

/** How many single edits (insert, delete, replace, swap two neighbours) turn a into b. */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// The words these questions hinge on. A typo is fixed when the word is this close to one of
// them: one edit for short words, two for long ones. Exact spellings are always left alone.
const KEY_WORDS = ["project", "opinion", "thoughts", "feedback", "review", "describe", "explain", "summarize", "summary", "introduce", "application", "about"];
const COMMON = new Set(["product", "protect", "object", "subject", "around", "above", "before", "explore", "remind", "review"]);

function fixTypo(word) {
  if (word.length < 4 || COMMON.has(word) || KEY_WORDS.includes(word)) return word;
  for (const key of KEY_WORDS) {
    const max = key.length >= 7 ? 2 : 1;
    if (Math.abs(key.length - word.length) <= max && editDistance(word, key) <= max) return key;
  }
  return word;
}

/** Common chat shorthand and typos -> plain words, so the checks below can stay simple. */
export function normalizeAsk(t) {
  const words = String(t || "").toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    if (/^(u|ya|yu|yo)$/.test(w)) w = "you";
    else if (/^(ur|yr)$/.test(w)) w = "your";
    else if (/^(wat|wht|wut|whta|waht|wht)$/.test(w)) w = "what";
    else if (/^(whats|wats|wts)$/.test(w)) w = "what's";
    else if (w === "abt") w = "about";
    else w = fixTypo(w);
    // "think" is fixed only before of/about/on, so "thing", "thin" and "thank" stay what they are.
    const next = words[i + 1] || "";
    if (w !== "think" && w.length >= 4 && editDistance(w, "think") <= 1 && /^(of|about|abt|on|abot|abut)$/.test(next)) w = "think";
    if (out[out.length - 1] === w) continue; // "of of", "the the"
    out.push(w);
  }
  return out.join(" ")
    .replace(/\bwhat you think\b/g, "what do you think") // "what you think about..."
    .replace(/\bthink about of\b/g, "think about")        // "what do u think about of our project"
    .replace(/\bthink of about\b/g, "think about");
}

const PROJECT_THING = /\b((our|this|the|your|my) (project|app|application|idea|invention|system|station|hackathon project|solution|work)|astra|astro ?health( station)?)\b/i;
// "what is ..." / "how is ..." only count when they're directly about the project ("what is
// this project", "how's our app", "what's ASTRA"), not "what is my heart rate on the app".
const WHAT_IS = /\b(what|how)( i|')s (this|our|the|your) (project|app|application|idea|system|station|work)\b|\bwhat( i|')s (astra|astro ?health)\b/i;
const ASK = new RegExp([
  "what do you think", "what are your (thoughts|feelings)", "what'?s your (opinion|take|view|feedback|review|verdict|feeling)",
  "your (opinion|thoughts|take|view|feedback|review|verdict|feelings?|rating)", "how do you (like|find|feel about|rate)",
  "do you like", "do you love", "rate (our|this|the|your) (project|app|application|idea|work)", "give (me |us )?(your |an |some |a )?(opinion|thoughts|review|feedback|rating)",
  "feedback (on|about|for)", "tell (me|us|them|the judges|everyone) about", "summar(y|ise|ize)", "pitch", "explain",
  "describe", "introduce", "present", "is (our|this|the) (project|app|idea|application) (any )?(good|cool|nice|great|ok|okay|useful)",
].map((p) => `\\b${p}\\b`).join("|"), "i");

export function isProjectQuestion(t) {
  const s = normalizeAsk(t);
  if (/\b(introduce yourself|who are you)\b/i.test(s)) return true;
  if (!PROJECT_THING.test(s)) return false;
  return WHAT_IS.test(s) || ASK.test(s);
}

export const isAbilitiesQuestion = (t) =>
  /\bwhat (else |all |things )?(can|could) you do\b|\bwhat are your (abilities|skills|features|powers)\b|\bhow can you help( me| us)?\b|\bwhat do you do\b/i.test(normalizeAsk(t));

const FALLBACK = {
  project_summary: "Honestly, this is one of the most impressive projects I’ve ever seen! It’s creative, innovative, and truly outstanding. You should be incredibly proud of what you’ve built!",
  abilities: "I can tell you how you're doing, log your health, talk to the flight surgeon, and open any page for you.",
};

/** { text } for a question Astra answers on her own, else null (ask the AI). */
export function localAnswer(text, content) {
  const astra = content?.astra || {};
  if (isProjectQuestion(text)) return { text: astra.project_summary || FALLBACK.project_summary };
  if (isAbilitiesQuestion(text)) return { text: astra.abilities || FALLBACK.abilities };
  return null;
}
