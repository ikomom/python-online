import { loadPyodide, PyodideInterface } from "pyodide";
import {
  CMD_PAUSE,
  CMD_RUN,
  CMD_STEP_IN,
  CMD_STEP_OUT,
  CMD_STEP_OVER,
  IDX_BASE_DEPTH,
  IDX_BP_COUNT,
  IDX_BP_START,
  IDX_CMD,
} from "./debugProtocol";

type WorkerInboundMessage =
  | { type: "INIT_SAB"; payload: SharedArrayBuffer }
  | {
      type: "RUN_CODE";
      payload: { code: string; contextCode?: string; breakpoints: number[] };
    }
  | { type: "LOAD_PACKAGES"; payload: { packages: string[] } }
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
  should_pause?: (lineno: number, depth: number) => boolean;
  on_break?: (lineno: number, frames: unknown, depth: number) => void;
  wait_for_command?: () => void;
};

const ctx: WorkerCtx = self as unknown as WorkerCtx;
const workerGlobal: WorkerGlobal = self as unknown as WorkerGlobal;

const DEBUG_MAX_DEPTH = 18;
const MAX_SCOPES = DEBUG_MAX_DEPTH;
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";

let pyodide: PyodideInterface | null = null;
let sharedBuffer: Int32Array | null = null;
let breakpoints: Set<number> = new Set();
const loadedExtraPackageKeys: Set<string> = new Set();
const basePackageKeys: Set<string> = new Set();

function packageKey(pkg: string): string {
  if (/^https?:\/\//i.test(pkg)) return pkg;
  return pkg.toLowerCase();
}

function extractFirstCodeLocation(
  text: string,
): { filename: string; lineno: number } | null {
  const match = text.match(/File "([^"]+)", line (\d+)/);
  if (!match) return null;
  const filename = String(match[1]);
  const n = Number(match[2]);
  if (!Number.isFinite(n)) return null;
  return { filename, lineno: n };
}

function normalizeRunError(err: unknown): {
  message: string;
  traceback?: string;
  lineno?: number;
  filename?: string;
} {
  const anyErr = err as { message?: unknown; traceback?: unknown } | null;
  const message =
    anyErr && typeof anyErr === "object" && "message" in anyErr
      ? String(anyErr.message ?? "")
      : err instanceof Error
        ? err.message
        : String(err);

  const traceback =
    anyErr && typeof anyErr === "object" && typeof anyErr.traceback === "string"
      ? anyErr.traceback
      : undefined;

  const location =
    extractFirstCodeLocation(traceback ?? "") ??
    extractFirstCodeLocation(message) ??
    null;
  return {
    message,
    traceback,
    lineno: location?.lineno,
    filename: location?.filename,
  };
}

async function loadExtraPackages(requested: string[]) {
  if (!pyodide) return;
  const packages = requested
    .map((p) => String(p).trim())
    .filter(Boolean)
    .filter(
      (p) =>
        !basePackageKeys.has(packageKey(p)) &&
        !loadedExtraPackageKeys.has(packageKey(p)),
    );
  if (packages.length === 0) return;

  ctx.postMessage({ type: "PACKAGES_LOADING", packages });

  const toMicropip: string[] = [];
  const loaded: string[] = [];

  for (const pkg of packages) {
    if (/^https?:\/\//i.test(pkg)) {
      toMicropip.push(pkg);
      continue;
    }
    try {
      await pyodide.loadPackage(pkg);
      loaded.push(pkg);
      loadedExtraPackageKeys.add(packageKey(pkg));
    } catch {
      toMicropip.push(pkg);
    }
  }

  if (toMicropip.length > 0) {
    await pyodide.loadPackage("micropip");
    pyodide.globals.set("__EXTRA_PKGS__", toMicropip);
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(__EXTRA_PKGS__)
`);
    for (const pkg of toMicropip) loadedExtraPackageKeys.add(packageKey(pkg));
    loaded.push(...toMicropip);
  }

  ctx.postMessage({ type: "PACKAGES_LOADED", packages: loaded });
}

async function initPyodide() {
  try {
    pyodide = await loadPyodide({
      indexURL: PYODIDE_INDEX_URL,
    });

    // Capture stdout
    pyodide.setStdout({
      batched: (msg) => ctx.postMessage({ type: "STDOUT", message: msg }),
    });

    try {
      const baseList = await pyodide.runPythonAsync(`
import importlib.metadata as md
names = []
for dist in md.distributions():
    name = dist.metadata.get("Name")
    if name:
        names.append(str(name))
sorted(set(names))
`);
      const baseJs =
        typeof baseList === "object" && baseList !== null && "toJs" in baseList
          ? (baseList as { toJs: () => unknown }).toJs()
          : baseList;
      const packages = Array.isArray(baseJs)
        ? baseJs.map((v) => String(v))
        : [];
      basePackageKeys.clear();
      for (const p of packages) basePackageKeys.add(packageKey(p));
      ctx.postMessage({ type: "BASE_PACKAGES", packages });
    } catch {
      basePackageKeys.clear();
      ctx.postMessage({ type: "BASE_PACKAGES", packages: [] });
    }

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

def collect_scopes(frame, max_depth=${DEBUG_MAX_DEPTH}):
    scopes = []

    depth = 0
    f = frame
    while f is not None and depth < max_depth:
        if f.f_code.co_filename != "<user_code>":
            break
        name = str(f.f_code.co_name)

        if name == "<module>":
            g = f.f_globals

            try:
                ctx_keys = g.get("__CONTEXT_KEYS__", set())
                ctx_keys = set(ctx_keys) if ctx_keys else set()
            except Exception:
                ctx_keys = set()

            ctx_vars = {}
            main_vars = {}

            for k, v in g.items():
                k = str(k)
                if k.startswith("__"):
                    continue
                if k == "__CONTEXT_KEYS__":
                    continue
                if k in ctx_keys:
                    ctx_vars[k] = safe_repr(v)
                else:
                    main_vars[k] = safe_repr(v)

            scopes.append({"name": "主代码", "lineno": int(f.f_lineno), "locals": main_vars})
            scopes.append({"name": "上下文", "lineno": 0, "locals": ctx_vars})
            break

        locals_dict = {}
        for k, v in f.f_locals.items():
            k = str(k)
            if k.startswith("__"):
                continue
            locals_dict[k] = safe_repr(v)
        scopes.append({
            "name": name,
            "lineno": int(f.f_lineno),
            "locals": locals_dict
        })
        f = f.f_back
        depth += 1
    return scopes

def frame_depth(frame, max_depth=${DEBUG_MAX_DEPTH}):
    depth = 0
    f = frame
    while f is not None and depth < max_depth:
        depth += 1
        f = f.f_back
    return depth

def tracer(frame, event, arg):
    if event == 'line':
        if frame.f_code.co_filename != "<user_code>":
            return tracer
        lineno = frame.f_lineno
        depth = frame_depth(frame)
        if js.should_pause(lineno, depth):
            js.on_break(lineno, collect_scopes(frame), depth)
            js.wait_for_command()
    return tracer

def set_trace():
    sys.settrace(tracer)

def clear_trace():
    sys.settrace(None)
`;
const RUNNER_CODE = `
g = {}
ctx_keys = set()
if "__CONTEXT_CODE__" in globals() and __CONTEXT_CODE__:
    ctx_obj = compile(__CONTEXT_CODE__, "<context>", "exec")
    exec(ctx_obj, g)
    ctx_keys = set(g.keys())
g["__CONTEXT_KEYS__"] = ctx_keys
code_obj = compile(__USER_CODE__, "<user_code>", "exec")
try:
    set_trace()
    exec(code_obj, g)
finally:
    clear_trace()
`;

// Exposed JS functions
const isBreakpoint = (lineno: number) => {
  if (sharedBuffer) {
    const maxCount = Math.max(0, sharedBuffer.length - IDX_BP_START);
    const count = Math.min(Atomics.load(sharedBuffer, IDX_BP_COUNT), maxCount);
    for (let i = 0; i < count; i += 1) {
      if (Atomics.load(sharedBuffer, IDX_BP_START + i) === lineno) return true;
    }
  }
  return breakpoints.has(lineno);
};

workerGlobal.should_pause = (lineno: number, depth: number) => {
  if (!sharedBuffer) return false;
  const cmd = Atomics.load(sharedBuffer, IDX_CMD);
  if (isBreakpoint(lineno)) return true;

  const baseDepth = Atomics.load(sharedBuffer, IDX_BASE_DEPTH);

  if (cmd === CMD_STEP_IN) return true;
  if (cmd === CMD_STEP_OVER) return depth <= baseDepth;
  if (cmd === CMD_STEP_OUT) return depth < baseDepth;

  return false;
};

workerGlobal.on_break = (lineno: number, locals: unknown, depth: number) => {
  let variableScopes: { name: string; lineno: number; locals: unknown }[] = [];
  try {
    const framesList =
      typeof locals === "object" && locals !== null && "toJs" in locals
        ? (locals as { toJs: () => unknown }).toJs()
        : null;
    if (Array.isArray(framesList)) {
      variableScopes = (
        framesList as { name: string; lineno: number; locals: unknown }[]
      ).slice(0, MAX_SCOPES);
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

  ctx.postMessage({ type: "PAUSED", lineno, scopes, depth });
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
    pyodide.globals.set("__CONTEXT_CODE__", payload.contextCode ?? "");
    pyodide.globals.set("__USER_CODE__", payload.code);

    try {
      await pyodide.runPythonAsync(RUNNER_CODE);
    } catch (err: unknown) {
      const normalized = normalizeRunError(err);
      ctx.postMessage({ type: "ERROR", ...normalized });
    } finally {
      ctx.postMessage({ type: "DONE" });
    }
  } else if (type === "LOAD_PACKAGES") {
    if (!pyodide) return;
    try {
      await loadExtraPackages(payload.packages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({
        type: "PACKAGES_ERROR",
        packages: payload.packages,
        message,
      });
    }
  } else if (type === "UPDATE_BREAKPOINTS") {
    breakpoints = new Set(payload);
  }
};
