import { describe, expect, it } from "vitest";
import { toneSetupMessage } from "./toneSetup.js";

describe("toneSetupMessage (the 'Wanna talk?' card)", () => {
  it("gives the exact commands when PyTorch is missing", () => {
    const m = toneSetupMessage({ data: { state: "missing-deps", reason: "install requirements-emotion.txt (torch)" } });
    expect(m.tone).toBe("setup");
    expect(m.steps).toEqual([
      String.raw`.venv\Scripts\python.exe -m pip install -r requirements-emotion.txt`,
      String.raw`.venv\Scripts\python.exe -m backend.services.emotion download`,
    ]);
  });
  it("only the download when PyTorch is there but the model isn't", () => {
    const m = toneSetupMessage({ data: { state: "missing-model" } });
    expect(m.steps).toEqual([String.raw`.venv\Scripts\python.exe -m backend.services.emotion download`]);
  });
  it("ready, loading and errors read plainly", () => {
    expect(toneSetupMessage({ data: { state: "ready" } }).tone).toBe("ready");
    expect(toneSetupMessage({ data: { state: "loading" } }).text).toMatch(/loading/);
    expect(toneSetupMessage({ data: { state: "error", reason: "OSError: bad file" } }).text).toMatch(/OSError: bad file/);
    expect(toneSetupMessage({}).tone).toBe("wait");
  });
});
