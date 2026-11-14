// 3D safety net. Some browsers have WebGL switched off (hardware acceleration disabled,
// GPU blocklisted, sandboxed/remote sessions): three.js then throws while creating its
// renderer, which would take the whole page down. hasWebGL() checks up front, and
// <WebGLBoundary> catches anything that still fails (e.g. a lost GPU context), so the
// rest of the page keeps working and the user sees how to turn 3D on.
import { Component } from "react";

let cached = null;
export function hasWebGL() {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    cached = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

// A 3D file that couldn't be loaded (missing from this copy of the app, a network error) is
// NOT the same as WebGL being off -- telling people to switch on graphics acceleration then
// sent them the wrong way (the 3D body's anatomy.glb was once missing from the repo).
const isLoadError = (err) => /could not load|failed to fetch|404|unexpected token '<'|not valid json/i.test(String(err?.message || err || ""));

export function NoWebGL({ title = "3D view unavailable", reason = "webgl", onRetry }) {
  if (reason === "load") {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="rounded-full border border-check-edge bg-check-bg px-3 py-1 text-xs font-bold text-check-fg">3D model couldn’t load</span>
        <p className="m-0 max-w-sm text-sm text-ink-2">
          3D graphics work in this browser, but the 3D model file couldn’t be loaded, so the digital twin can’t be drawn.
          Everything else on this page still works — use the region chips above to pick a body part.
        </p>
        <p className="m-0 max-w-sm text-xs text-muted">
          Usually a file is missing from this copy of the app: run <code>git pull</code> (or download the project again) and restart <code>app.py</code>.
        </p>
        {onRetry && (
          <button onClick={onRetry} className="min-h-9 cursor-pointer rounded-lg border border-line-strong bg-control px-3 text-[13px] font-semibold text-ink-2 hover:text-ink">
            Try again
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="rounded-full border border-check-edge bg-check-bg px-3 py-1 text-xs font-bold text-check-fg">{title}</span>
      <p className="m-0 max-w-sm text-sm text-ink-2">
        This browser has 3D graphics (WebGL) turned off, so the digital twin can't be drawn. Everything else on this page still works —
        use the region chips above to pick a body part.
      </p>
      <p className="m-0 max-w-sm text-xs text-muted">
        To turn it on in Chrome: Settings → System → enable “Use graphics acceleration when available”, then restart Chrome.
        Check chrome://gpu — “WebGL” should say “Hardware accelerated”.
      </p>
    </div>
  );
}

export class WebGLBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, loadError: false };
  }
  static getDerivedStateFromError(err) {
    return { failed: true, loadError: isLoadError(err) };
  }
  componentDidCatch(err) {
    console.error("3D view failed, showing the fallback instead:", err);
  }
  render() {
    if (!hasWebGL()) return this.props.fallback ?? <NoWebGL />;
    if (this.state.failed) {
      if (this.props.fallback) return this.props.fallback;
      return <NoWebGL reason={this.state.loadError ? "load" : "webgl"} onRetry={() => this.setState({ failed: false, loadError: false })} />;
    }
    return this.props.children;
  }
}
