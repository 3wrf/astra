// Exercises page · "Pose Analysis": a 12 s webcam posture check before (or after) a workout,
// analysed on THIS laptop by MediaPipe Pose Landmarker (backend/services/pose.py), and its
// report. Moved here from the Mind page: posture and form belong with the training.
// Separate from Face Analysis and voice tone: its own camera session, routes and table.
// What it reports are camera-based observations in the picture -- shoulder and hip
// alignment, side-to-side lean, head position, left/right asymmetry, movement, landmark
// visibility -- never a diagnosis of any spinal, neurological, muscular or balance condition.
//
// poseReportView() turns the API answer into loading | empty | error | unavailable | success
// and PoseReportView draws it (both pure, tested in PoseAnalysis.test.jsx). PoseAnalysis holds
// the camera: opened only on request (video only), claimed from Face Analysis if that had it,
// and turned off when the window ends, on Stop, and when the section unmounts.
import { useEffect, useRef, useState } from "react";
import { cameraBlocker, cameraErrorMessage, captureFrame, openCamera, runPoseObservation, stopCamera } from "../../../../lib/poseCamera.js";
import { claimCamera, releaseCamera } from "../../../../lib/cameraClaim.js";
import { useLatestPose, usePoseStatus } from "../../../../lib/queries.js";
import { fmtTime } from "../../../../lib/format.js";
import { Button, Card, cx } from "../../../../components/ui/index.jsx";
import { Icon } from "../../../../components/ui/Icon.jsx";

export const TITLE = "Pose Analysis";
export const POSE_DISCLAIMER = "Camera-based observations of posture and movement, not a medical diagnosis. They can’t detect or rule out any spinal, neurological, muscular or balance condition.";
export const POSE_PRIVACY = "The camera is used only while you analyse. Frames go to this laptop’s own backend, are measured and thrown away; no video or images are stored or sent anywhere, and no audio is recorded.";
export const BACKEND_OUTDATED = "The backend that’s running doesn’t include Pose Analysis yet. Restart it from this version of the app (stop app.py, start it again), then reload this page.";

const RELIABILITY = {
  high: "border-good/40 bg-good-bg/40 text-good-fg", medium: "border-accent-text/40 bg-accent-soft text-accent-text",
  low: "border-check/40 bg-check-bg/40 text-check-fg", inconclusive: "border-line text-subtle",
};
const QUALITY_TEXT = { good: "Good", fair: "Fair", poor: "Poor", "no body": "No body found" };
const QUALITY_TONE = { good: "text-good-fg", fair: "text-accent-text", poor: "text-check-fg", "no body": "text-alert-fg" };
const REGION_TEXT = { head: "Head", shoulders: "Shoulders", arms: "Arms", hips: "Hips", legs: "Legs" };
const isMissingRoute = (err) => err?.status === 404;

// What the check measures, shown before the first session (matches backend/logic/pose_metrics.py).
const MEASURES = [
  { name: "Shoulders level", hint: "left vs right height" },
  { name: "Hips level", hint: "needs hips in view" },
  { name: "Side lean", hint: "torso tilt left/right" },
  { name: "Head position", hint: "over the shoulders?" },
  { name: "Left/right balance", hint: "body symmetry" },
  { name: "Stillness", hint: "sway while standing" },
];
const HOW_TO = [
  "Stand about 2 m from the laptop, facing it.",
  "Keep your head, shoulders and hips in the picture.",
  "Press Start and stand naturally for 12 seconds.",
];

/** The Pose Analysis status query -> "" when ready, else why it can't run (plain words). */
export function poseSetupMessage(status) {
  if (status?.isError) return isMissingRoute(status.error) ? BACKEND_OUTDATED : "Couldn’t reach this laptop’s backend to check pose analysis. Is app.py running?";
  const d = status?.data;
  if (!d || status?.isLoading || d.state === "loading" || d.state === "idle") return "Checking the pose analysis model…";
  if (d.state === "ready") return "";
  if (d.state === "missing-deps") return `MediaPipe isn’t installed in this Python environment: ${d.reason}.`;
  if (d.state === "missing-model") return "The Pose Landmarker model is missing: run scripts/pose_analysis/download_model.py.";
  if (d.state === "disabled") return "Pose analysis is turned off on this laptop (ASTRO_NO_POSE=1).";
  return `Pose analysis couldn’t start: ${d.reason || d.state}.`;
}

/** query: { isLoading, isError, error, data: { analysis } } -> what to show. */
export function poseReportView(query) {
  if (query?.isLoading) return { state: "loading" };
  if (query?.isError) {
    return isMissingRoute(query.error) ? { state: "unavailable", message: BACKEND_OUTDATED } : { state: "error", message: "Couldn’t load the last pose analysis." };
  }
  const a = query?.data?.analysis;
  if (!a) return { state: "empty", message: "No pose analysis yet. Open the camera and start one above." };
  const q = a.quality || {};
  const obs = a.observations || [];
  return {
    state: "success",
    when: a.ts,
    quality: { rating: q.rating, label: QUALITY_TEXT[q.rating] || q.rating, issues: q.issues || [], usable: q.usable_frames, frames: q.frames, fps: q.fps, duration: q.duration_s, visibility: q.visibility || {} },
    posture: obs.filter((o) => !["landmark_visibility", "movement"].includes(o.id)),
    movement: obs.filter((o) => o.id === "movement"),
    visibility: obs.filter((o) => o.id === "landmark_visibility"),
    measured: obs.filter((o) => o.status === "measured" && o.id !== "landmark_visibility").length,
    limitations: a.limitations || [],
    disclaimer: a.disclaimer || POSE_DISCLAIMER,
  };
}

function Observation({ o }) {
  const measured = o.status === "measured";
  return (
    <li className={cx("flex flex-col gap-1.5 rounded-2xl border p-3.5", measured ? "border-line bg-raised/50" : "border-dashed border-line bg-transparent")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className={cx("h-2 w-2 rounded-full", measured ? "bg-accent-text shadow-[0_0_8px_rgba(143,166,255,.7)]" : "bg-line-strong")} />
          {o.name}
        </span>
        <span data-testid={`pose-rel-${o.id}`} className={cx("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", RELIABILITY[o.reliability] || RELIABILITY.inconclusive)}>
          {o.reliability === "inconclusive" ? "Inconclusive" : `${o.reliability} reliability`}
        </span>
      </div>
      <p data-testid={`pose-val-${o.id}`} className={cx("m-0 text-[15px] font-medium", measured ? "text-ink" : "text-subtle")}>{o.display}</p>
      {o.description && <p className="m-0 text-xs text-muted">{o.description}</p>}
      <details className="text-xs text-subtle">
        <summary className="cursor-pointer select-none hover:text-ink-2">Why this reliability, and limitations</summary>
        <p className="m-0 mt-1">{o.reliability_reason}</p>
        <ul className="m-0 mt-1 list-disc pl-4">{(o.limitations || []).map((l) => <li key={l}>{l}</li>)}</ul>
      </details>
    </li>
  );
}

function Group({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="ah-eyebrow">{title}</div>
      <ul className="m-0 grid list-none gap-2.5 p-0 md:grid-cols-2 xl:grid-cols-3">{items.map((o) => <Observation key={o.id} o={o} />)}</ul>
    </div>
  );
}

export function PoseReportView({ view, onRetry }) {
  if (view.state === "loading") return <p role="status" className="m-0 text-sm text-muted">Loading the last pose analysis…</p>;
  if (view.state === "empty") return <p className="m-0 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">{view.message}</p>;
  if (view.state === "unavailable") return null; // the setup line above already says what to do
  if (view.state === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-alert-fg">
        <span>{view.message}</span>{onRetry && <Button className="min-h-9 px-3 text-[13px]" onClick={onRetry}>Try again</Button>}
      </div>
    );
  }
  const q = view.quality;
  return (
    <div className="flex flex-col gap-4" aria-label="Last pose analysis report">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-raised/40 px-3.5 py-2.5">
          <div className="ah-eyebrow">Last check</div>
          <div data-testid="pose-when" className="mt-0.5 text-sm font-semibold text-ink">Session · {fmtTime(view.when)}</div>
        </div>
        <div className="rounded-2xl border border-line bg-raised/40 px-3.5 py-2.5">
          <div className="ah-eyebrow">Camera view</div>
          <div className="mt-0.5 text-sm text-ink-2" data-testid="pose-quality">Detection quality: <span className={cx("font-semibold", QUALITY_TONE[q.rating] || "text-ink")}>{q.label}</span>{q.issues.length ? ` (${q.issues.join(", ")})` : ""}</div>
        </div>
        <div className="rounded-2xl border border-line bg-raised/40 px-3.5 py-2.5">
          <div className="ah-eyebrow">Measured</div>
          <div data-testid="pose-frames" className="mt-0.5 text-sm text-ink-2">{q.usable} of {q.frames} frames usable · {q.fps} fps · {q.duration} s</div>
        </div>
      </div>
      <Group title="Observed posture" items={view.posture} />
      <Group title="Movement" items={view.movement} />
      <Group title="Confidence and visibility" items={view.visibility} />
      <details className="text-xs text-subtle">
        <summary className="cursor-pointer select-none hover:text-ink-2">Limitations of this analysis</summary>
        <ul className="m-0 mt-1 list-disc pl-4">{view.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
      </details>
      <p data-testid="pose-disclaimer" className="m-0 text-xs text-subtle">{view.disclaimer}</p>
    </div>
  );
}

/** The live status line while recording. */
export function liveStatus(live) {
  if (!live) return { text: "Starting…", regions: [] };
  const regions = Object.entries(live.visible || {}).map(([k, v]) => ({ name: REGION_TEXT[k] || k, seen: !!v }));
  if (live.guidance?.length) return { text: live.guidance.join(" · "), regions };
  return { text: live.usable ? "Body found, looking good" : "Looking for your body…", regions };
}

const PHASE_TEXT = {
  preview: "Camera on. Stand facing the camera with your head and shoulders in view (hips too, if you can), then start.",
  recording: "Analysing… stand naturally and keep still.",
  processing: "Putting the report together…",
};
const OWNER = "pose";

// The camera "stage" before the camera is on: a posture figure with the level lines the
// check measures (shoulders, hips) and the centre line (lean, head position).
function PostureFigure() {
  return (
    <svg viewBox="0 0 240 180" className="h-full w-full" role="img" aria-label="Posture check: shoulders, hips, lean and head position">
      <defs>
        <radialGradient id="pose-glow" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="rgba(143,166,255,.22)" /><stop offset="1" stopColor="rgba(143,166,255,0)" /></radialGradient>
      </defs>
      <rect width="240" height="180" fill="url(#pose-glow)" />
      <line x1="120" y1="14" x2="120" y2="170" stroke="rgba(143,166,255,.35)" strokeDasharray="3 4" />
      <line x1="62" y1="62" x2="178" y2="62" stroke="#8fa6ff" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1="74" y1="110" x2="166" y2="110" stroke="#8fa6ff" strokeWidth="1.2" strokeDasharray="4 3" />
      <g fill="none" stroke="rgba(230,235,255,.85)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="120" cy="34" r="13" />
        <path d="M120 47 V62 M92 62 H148 M120 62 V110 M100 110 H140 M92 62 L80 92 L76 116 M148 62 L160 92 L164 116 M104 110 L100 140 L98 168 M136 110 L140 140 L142 168" />
      </g>
      {[[120, 34], [92, 62], [148, 62], [100, 110], [140, 110], [80, 92], [160, 92], [100, 140], [140, 140]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.6" fill="#8fa6ff" stroke="#0b1020" strokeWidth="1.5" />
      ))}
      <text x="182" y="65" fill="#8fa6ff" fontSize="9" fontWeight="600">SHOULDERS</text>
      <text x="170" y="113" fill="#8fa6ff" fontSize="9" fontWeight="600">HIPS</text>
      <text x="125" y="176" fill="rgba(143,166,255,.8)" fontSize="8">CENTRE · LEAN</text>
    </svg>
  );
}

export function PoseAnalysis({ astroId, own }) {
  const status = usePoseStatus();
  const latest = useLatestPose(astroId);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const abortRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | opening | preview | recording | processing | done
  const [error, setError] = useState("");
  const [live, setLive] = useState(null);
  const [progress, setProgress] = useState(0);

  const blocked = cameraBlocker();
  const why = !own ? "Only the astronaut can analyse their own posture, from their own sign-in."
    : blocked ? cameraErrorMessage({ name: blocked })
    : poseSetupMessage(status);

  const closeCamera = () => {
    abortRef.current?.abort();
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    releaseCamera(OWNER);
  };
  useEffect(() => () => closeCamera(), []); // leaving the page always turns the camera off

  function stop() {
    closeCamera();
    setPhase("idle");
    setLive(null);
  }

  async function open() {
    setError("");
    setLive(null);
    setProgress(0);
    setPhase("opening");
    claimCamera(OWNER, stop); // Face Analysis lets go of the camera first, if it had it
    try {
      streamRef.current = await openCamera(videoRef.current);
      setPhase("preview");
    } catch (err) {
      releaseCamera(OWNER);
      setError(err.message);
      setPhase("idle");
    }
  }

  async function analyse() {
    const ac = new AbortController();
    abortRef.current = ac;
    setError("");
    setLive(null);
    setProgress(0);
    setPhase("recording");
    try {
      await runPoseObservation({
        astroId, windowS: status.data?.window_s, fps: status.data?.fps, signal: ac.signal,
        capture: () => captureFrame(videoRef.current, canvasRef.current),
        onLive: setLive, onProgress: setProgress,
      });
      setPhase("processing");
      await latest.refetch();
      setPhase("done");
    } catch (err) {
      if (err?.name !== "AbortError") setError(err?.status === 503 ? "Pose analysis isn’t available on this laptop." : "The analysis didn’t finish. Try again.");
      setPhase(streamRef.current ? "preview" : "idle");
      return;
    } finally {
      abortRef.current = null;
    }
    closeCamera(); // the window is over: release the camera
  }

  const cameraOn = ["opening", "preview", "recording", "processing"].includes(phase);
  const ls = liveStatus(live);
  const ready = !why;
  return (
    <Card aria-label={TITLE} className="flex w-full flex-col gap-5 overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Icon name="user" size={22} /></span>
          <div>
            <span className="ah-eyebrow">Form check · camera, analysed on this laptop</span>
            <h2 className="m-0 mt-0.5 font-display text-xl font-semibold">{TITLE}: posture check</h2>
            <p className="m-0 mt-1 max-w-2xl text-sm text-ink-2">
              Check your stance before (or after) a workout. In 12 seconds the camera measures shoulder and hip level, side-to-side lean, head position, left/right balance and how still you stood.
            </p>
          </div>
        </div>
        <span className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide",
          ready ? "border-good/40 text-good-fg" : "border-line text-muted")}>
          <span className={cx("h-2 w-2 rounded-full", ready ? "bg-good-fg" : "bg-line-strong")} />{ready ? "READY" : "SETUP NEEDED"}
        </span>
      </div>

      {/* camera stage + controls */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-[#070b18]">
          <video ref={videoRef} playsInline muted aria-label="Pose camera preview"
            className={cx("block aspect-[4/3] w-full -scale-x-100 object-cover", !cameraOn && "hidden")} />
          {!cameraOn && (
            <div className="aspect-[4/3] w-full p-4"><PostureFigure /></div>
          )}
          <span className="pointer-events-none absolute top-3 left-3 rounded-full ah-glass px-3 py-1 text-[11px] font-semibold tracking-wide text-ink-2">
            {phase === "recording" ? "● ANALYSING" : cameraOn ? "CAMERA ON" : "CAMERA OFF"}
          </span>
          {phase === "recording" && (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-accent-text transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
              <div className="mt-1.5 text-xs text-white" data-testid="pose-live">{ls.text}</div>
              {ls.regions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1" data-testid="pose-regions">
                  {ls.regions.map((r) => (
                    <span key={r.name} className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold", r.seen ? "bg-white/25 text-white" : "bg-black/40 text-white/60 line-through")}>{r.name}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        <div className="flex flex-col gap-4">
          {cameraOn ? (
            <p className="m-0 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink" role="status">{PHASE_TEXT[phase] || "Opening the camera…"}</p>
          ) : (
            <>
              <div>
                <div className="ah-eyebrow mb-2">What it measures</div>
                <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
                  {MEASURES.map((m) => (
                    <li key={m.name} className="rounded-xl border border-line bg-raised/40 px-3 py-2">
                      <span className="block text-[13px] font-semibold text-ink">{m.name}</span>
                      <span className="block text-[11px] text-muted">{m.hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                {HOW_TO.map((s, i) => (
                  <li key={s} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-control text-[11px] font-bold text-muted">{i + 1}</span>{s}
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {(phase === "idle" || phase === "done") && (
              <Button variant="primary" onClick={open} disabled={!!why}>
                <Icon name="video" size={16} /> {phase === "done" ? "Check again" : "Open camera"}
              </Button>
            )}
            {phase === "preview" && <Button variant="primary" onClick={analyse}>Start posture check (12 s)</Button>}
            {cameraOn && <Button onClick={stop}>Stop camera</Button>}
          </div>
          {why && phase === "idle" && (
            <p className="m-0 rounded-xl border border-check/30 bg-check-bg/30 px-3 py-2 text-[13px] text-check-fg">{why}</p>
          )}
          {error && <p role="alert" className="m-0 text-sm text-alert-fg">{error}</p>}
          <p className="m-0 mt-auto text-xs text-subtle">{POSE_PRIVACY}</p>
        </div>
      </div>

      {/* the last report */}
      <div className="border-t border-divider pt-5">
        <PoseReportView view={poseReportView(latest)} onRetry={() => latest.refetch()} />
      </div>
    </Card>
  );
}
