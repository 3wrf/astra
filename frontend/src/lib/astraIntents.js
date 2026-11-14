// Questions Astra answers INSTANTLY, without the AI: "what do you think about our project?"
// (a ~20-second summary for a demo) and "what can you do?". They work even when the free AI
// plan is out of quota or there's no internet, which is exactly when a live demo needs them.
// The words live in config/content.json ("astra"), so the team can edit them without code.
//
// Kept strict on purpose: "what is my heart rate on the app?" must still go to the AI.

const PROJECT_THING = /\b((our|this|the|your|my) (project|app|application|idea|invention|system|station|hackathon project|solution)|astra|astro ?health( station)?)\b/i;
const PROJECT_ASK = /\b(what do you think|what'?s your (opinion|take)|your (opinion|thoughts|take)|how do you (like|feel about)|do you like|tell (me|us|them|the judges|everyone) about|summar(y|ise|ize)|pitch|explain|describe|introduce|present|what is|what'?s)\b/i;
// "what is ..." only counts when it is directly about the project ("what is this project",
// "what's ASTRA"), not "what is my heart rate on the app".
const WHAT_IS = /\bwhat( i|')s (this|our|the|your) (project|app|application|idea|system|station)\b|\bwhat( i|')s (astra|astro ?health)\b/i;
const OTHER_ASK = /\b(what do you think|what'?s your (opinion|take)|your (opinion|thoughts|take)|how do you (like|feel about)|do you like|tell (me|us|them|the judges|everyone) about|summar(y|ise|ize)|pitch|explain|describe|introduce|present)\b/i;

export function isProjectQuestion(t) {
  const s = String(t || "");
  if (/\b(introduce yourself|who are you)\b/i.test(s)) return true;
  if (!PROJECT_THING.test(s) || !PROJECT_ASK.test(s)) return false;
  return WHAT_IS.test(s) || OTHER_ASK.test(s);
}

export const isAbilitiesQuestion = (t) =>
  /\bwhat (else |all |things )?(can|could) you do\b|\bwhat are your (abilities|skills|features|powers)\b|\bhow can you help( me| us)?\b|\bwhat do you do\b/i.test(String(t || ""));

const FALLBACK = {
  project_summary: "I love it! ASTRA helps astronauts check their own health far from Earth, and tells them what to do next.",
  abilities: "I can tell you how you're doing, log your health, talk to the flight surgeon, and open any page for you.",
};

/** { text } for a question Astra answers on her own, else null (ask the AI). */
export function localAnswer(text, content) {
  const astra = content?.astra || {};
  if (isProjectQuestion(text)) return { text: astra.project_summary || FALLBACK.project_summary };
  if (isAbilitiesQuestion(text)) return { text: astra.abilities || FALLBACK.abilities };
  return null;
}
