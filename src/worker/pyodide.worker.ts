import { loadPyodide, PyodideInterface } from "pyodide";

type WorkerInboundMessage =
  | { type: "INIT_SAB"; payload: SharedArrayBuffer }
  | {
      type: "RUN_CODE";
      payload: { code: string; breakpoints: number[] };
    }
  | { type: "UPDATE_BREAKPOINTS"; payload: number[] };

type WorkerCtx = {
  postMessage: (message: unknown) => void;
  onmessage:
    | ((
        this: unknown,
        ev: MessageEvent<WorkerInboundMessage>,
      ) => void | Promise<void>)
    | null;
};

type WorkerGlobal = WorkerCtx & {
  should_pause?: (lineno: number) => boolean;
  on_break?: (lineno: number, frames: unknown) => void;
  wait_for_command?: () => void;
};

const ctx: WorkerCtx = self as unknown as WorkerCtx;
const workerGlobal: WorkerGlobal = self as unknown as WorkerGlobal;

// Shared Buffer Indices
const IDX_CMD = 0;
// Commands
const CMD_RUN = 1;
const CMD_PAUSE = 2; // Worker waits on this
const CMD_STEP = 3;
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";

let pyodide: PyodideInterface | null = null;
let sharedBuffer: Int32Array | null = null;
let breakpoints: Set<number> = new Set();

async function initPyodide() {
  try {
    pyodide = await loadPyodide({
      indexURL: PYODIDE_INDEX_URL,
    });

    // Capture stdout
    pyodide.setStdout({
      batched: (msg) => ctx.postMessage({ type: "STDOUT", message: msg }),
    });

    ctx.postMessage({ type: "READY" });
  } catch (err) {
    console.error("Failed to load Pyodide", err);
  }
}

initPyodide();

// Python Tracer Code
const TRACER_CODE = `
import sys
import js

def safe_repr(value):
    try:
        return repr(value)
    except Exception:
        try:
            return str(value)
        except Exception:
            return "<unprintable>"

def collect_frames(frame, max_depth=20):
    frames = []
    depth = 0
    f = frame
    while f is not None and depth < max_depth:
        locals_dict = {}
        for k, v in f.f_locals.items():
            locals_dict[str(k)] = safe_repr(v)
        frames.append({
            "name": str(f.f_code.co_name),
            "lineno": int(f.f_lineno),
            "locals": locals_dict
        })
        f = f.f_back
        depth += 1
    return frames

def tracer(frame, event, arg):
    if event == 'line':
        lineno = frame.f_lineno
        if js.should_pause(lineno):
            js.on_break(lineno, collect_frames(frame))
            js.wait_for_command()
    return tracer

def set_trace():
    sys.settrace(tracer)

def clear_trace():
    sys.settrace(None)
`;
const RUNNER_CODE = `
code_obj = compile(__USER_CODE__, "<user_code>", "exec")
try:
    set_trace()
    exec(code_obj, {})
finally:
    clear_trace()
`;

// Exposed JS functions
workerGlobal.should_pause = (lineno: number) => {
  if (!sharedBuffer) return false;
  // Pause if breakpoint exists OR if previous command was STEP
  // Note: If we are just RUNning, CMD is RUN. If we STEPped, CMD is STEP.
  const cmd = Atomics.load(sharedBuffer, IDX_CMD);
  return breakpoints.has(lineno) || cmd === CMD_STEP;
};

workerGlobal.on_break = (lineno: number, locals: unknown) => {
  let variableScopes: { name: string; lineno: number; locals: unknown }[] = [];
  try {
    const framesList =
      typeof locals === "object" && locals !== null && "toJs" in locals
        ? (locals as { toJs: () => unknown }).toJs()
        : null;
    if (Array.isArray(framesList)) {
      variableScopes = framesList as { name: string; lineno: number; locals: unknown }[];
    } else if (framesList) {
      variableScopes = [
        framesList as { name: string; lineno: number; locals: unknown },
      ];
    }
  } catch {
    variableScopes = [
      { name: "<error>", lineno, locals: { error: "无法解析变量" } },
    ];
  }
  const scopes = variableScopes.map((frame, index) => {
    const variables: Record<string, string> = {};
    const localsObject = frame.locals;
    if (localsObject && typeof localsObject === "object") {
      for (const [key, value] of Object.entries(
        localsObject as Record<string, unknown>,
      )) {
        variables[key] = String(value);
      }
    }
    return {
      id: `${index}:${frame.name}:${frame.lineno}`,
      name: frame.name,
      lineno: frame.lineno,
      variables,
    };
  });

  ctx.postMessage({ type: "PAUSED", lineno, scopes });
};

workerGlobal.wait_for_command = () => {
  if (!sharedBuffer) return;

  // Set status to PAUSED and wait
  Atomics.store(sharedBuffer, IDX_CMD, CMD_PAUSE);
  Atomics.wait(sharedBuffer, IDX_CMD, CMD_PAUSE);

  // Woken up!
};

ctx.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const { type, payload } = event.data;

  if (type === "INIT_SAB") {
    sharedBuffer = new Int32Array(payload);
  } else if (type === "RUN_CODE") {
    if (!pyodide) return;

    breakpoints = new Set(payload.breakpoints);

    // Reset command to RUN if it was idle, unless we want to start paused?
    // Usually we start running.
    if (sharedBuffer) Atomics.store(sharedBuffer, IDX_CMD, CMD_RUN);

    await pyodide.runPythonAsync(TRACER_CODE);
    pyodide.globals.set("__USER_CODE__", payload.code);

    try {
      await pyodide.runPythonAsync(RUNNER_CODE);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({ type: "ERROR", message });
    } finally {
      ctx.postMessage({ type: "DONE" });
    }
  } else if (type === "UPDATE_BREAKPOINTS") {
    breakpoints = new Set(payload);
  }
};
