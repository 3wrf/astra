// What the "Wanna talk?" card says about the voice tone model (Wav2Vec2,
// backend/services/emotion.py), by its status. It's an OPTIONAL add-on (PyTorch +
// Transformers, ~1 GB, plus a ~378 MB model that isn't in git), so when it's missing the card
// says exactly what to run, the same way Face and Pose Analysis do -- "not set up" alone left
// people thinking it was broken.

const PY = ".venv\\Scripts\\python.exe"; // Windows; Linux/Mac: .venv/bin/python

/** { tone: "ready"|"wait"|"setup", text, steps? } */
export function toneSetupMessage(status) {
  const d = status?.data || status || {};
  switch (d.state) {
    case "ready":
      return { tone: "ready", text: "Voice tone estimates are on for this talk." };
    case "loading":
    case "idle":
      return { tone: "wait", text: "The voice tone model is still loading… (it takes a few seconds after app.py starts)." };
    case "missing-deps":
      return {
        tone: "setup",
        text: "Voice tone estimates need PyTorch and Transformers, which aren’t installed in this app’s Python. The talk itself works without them. To turn them on (about 1.4 GB in total), run these in the project folder, then restart app.py:",
        steps: [`${PY} -m pip install -r requirements-emotion.txt`, `${PY} -m backend.services.emotion download`],
      };
    case "missing-model":
      return {
        tone: "setup",
        text: "PyTorch is installed, but the Wav2Vec2 model (about 378 MB) hasn’t been downloaded yet. Run this in the project folder, then restart app.py:",
        steps: [`${PY} -m backend.services.emotion download`],
      };
    case "disabled":
      return { tone: "setup", text: `Voice tone estimates are turned off on this laptop (${d.reason || "ASTRO_NO_EMOTION=1"}).` };
    case "error":
      return { tone: "setup", text: `The voice tone model couldn’t start: ${d.reason || "unknown error"}. Check the app.py terminal.` };
    default:
      return { tone: "wait", text: "Checking the voice tone model…" };
  }
}
