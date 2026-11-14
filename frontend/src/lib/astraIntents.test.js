import { describe, expect, it } from "vitest";
import { editDistance, isAbilitiesQuestion, isProjectQuestion, localAnswer, normalizeAsk } from "./astraIntents.js";

const content = { astra: { project_summary: "PROJECT SUMMARY", abilities: "ABILITIES" } };

describe("questions Astra answers without the AI", () => {
  it("hears questions about the project", () => {
    for (const t of [
      "what do you think about our project", "Astra, what do you think about our project?", "what do you think of this app",
      "tell me about the project", "tell the judges about ASTRA", "summarize our project", "give me a summary of the project",
      "pitch our project", "explain this project", "what is this project", "what's Astro Health", "introduce yourself",
      "describe the app", "do you like our project",
    ]) expect(isProjectQuestion(t), t).toBe(true);
  });
  it("understands it typed the way people chat (u, ur, wat, abt, typos)", () => {
    for (const t of [
      "what do u think about of our project", "what do u think of our project", "wat do you think about our project",
      "what you think about our project", "What do u thnk about our projct?", "whats ur opinion on our project",
      "what do ya think abt our project",
    ]) expect(isProjectQuestion(t), t).toBe(true);
    expect(isAbilitiesQuestion("wat can u do")).toBe(true);
    expect(normalizeAsk("what do u think about of our project")).toBe("what do you think about our project");
  });
  it("fixes any small typo and repeated words", () => {
    for (const t of [
      "what do u think of of our proejct", "what do you think about our porject", "wat u think abt our projcet",
      "what do you thnik of our project", "whats ur opnion on our project", "your review of our projetc",
      "what do you think of the the project",
    ]) expect(isProjectQuestion(t), t).toBe(true);
    expect(normalizeAsk("what do u think of of our proejct")).toBe("what do you think of our project");
  });
  it("hears other ways of asking about it", () => {
    for (const t of [
      "how do you find our project", "rate our project", "how do you rate our project", "give me your feedback on our project",
      "is our project good", "how is our project", "how's our app", "what are your thoughts on our project",
      "what is your opinion about our project",
    ]) expect(isProjectQuestion(t), t).toBe(true);
  });
  it("'who are you' and friends get the same introduction", () => {
    for (const t of [
      "who are you", "Astra who are you", "who r u", "hu r u", "what are you", "whats ur name", "what is your name",
      "tell me about yourself", "tell me about urself", "introduce yourself", "who am i talking to", "who is astra",
      "are you an AI", "are u human", "what kind of ai are you",
    ]) expect(isProjectQuestion(t), t).toBe(true);
    for (const t of ["who are you going to alert", "who are you calling", "what are you doing", "who is the flight surgeon", "what is my name"])
      expect(isProjectQuestion(t), t).toBe(false);
  });
  it("leaves health and app-usage questions to the AI", () => {
    for (const t of [
      "what is my heart rate on the app", "how am I doing", "open the project page", "what's my sleep score",
      "explain my blood pressure", "tell me about my sleep", "what do you think about my mood", "what do u think about my mood",
      "what thing should I do", "thank you", "rate my sleep", "how is my heart rate", "what do you think I should eat", "review my journal",
    ]) expect(isProjectQuestion(t), t).toBe(false);
  });
  it("edit distance counts a swap of two letters as one typo", () => {
    expect(editDistance("proejct", "project")).toBe(1);
    expect(editDistance("porject", "project")).toBe(1);
    expect(editDistance("project", "project")).toBe(0);
  });
  it("hears 'what can you do'", () => {
    for (const t of ["what can you do", "what else can you do?", "what are your abilities", "how can you help me"]) expect(isAbilitiesQuestion(t), t).toBe(true);
    for (const t of ["can you do a breathing exercise", "what should I do"]) expect(isAbilitiesQuestion(t), t).toBe(false);
  });
  it("answers from config/content.json, with a fallback", () => {
    expect(localAnswer("what do you think about our project?", content)).toEqual({ text: "PROJECT SUMMARY" });
    expect(localAnswer("what can you do?", content)).toEqual({ text: "ABILITIES" });
    expect(localAnswer("how am I doing?", content)).toBeNull();
    expect(localAnswer("what do you think about our project?", {}).text).toMatch(/AI assistant for astronauts/);
  });
});
