import { describe, expect, it } from "vitest";
import { isAbilitiesQuestion, isProjectQuestion, localAnswer } from "./astraIntents.js";

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
  it("leaves health and app-usage questions to the AI", () => {
    for (const t of [
      "what is my heart rate on the app", "how am I doing", "open the project page", "what's my sleep score",
      "explain my blood pressure", "tell me about my sleep", "what do you think about my mood",
    ]) expect(isProjectQuestion(t), t).toBe(false);
  });
  it("hears 'what can you do'", () => {
    for (const t of ["what can you do", "what else can you do?", "what are your abilities", "how can you help me"]) expect(isAbilitiesQuestion(t), t).toBe(true);
    for (const t of ["can you do a breathing exercise", "what should I do"]) expect(isAbilitiesQuestion(t), t).toBe(false);
  });
  it("answers from config/content.json, with a fallback", () => {
    expect(localAnswer("what do you think about our project?", content)).toEqual({ text: "PROJECT SUMMARY" });
    expect(localAnswer("what can you do?", content)).toEqual({ text: "ABILITIES" });
    expect(localAnswer("how am I doing?", content)).toBeNull();
    expect(localAnswer("what do you think about our project?", {}).text).toMatch(/ASTRA/);
  });
});
