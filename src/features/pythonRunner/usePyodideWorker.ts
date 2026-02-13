import { useCallback, useEffect, useRef, useState } from "react";
import PyodideWorker from "../../worker/pyodide.worker?worker";
import {
  CMD_RUN,
  CMD_STEP_IN,
  CMD_STEP_OUT,
  CMD_STEP_OVER,
  IDX_BASE_DEPTH,
  IDX_BP_COUNT,
  IDX_BP_START,
  IDX_CMD,
  SAB_INT_LENGTH,
} from "../../worker/debugProtocol";
import { usePythonStore } from "../../store/usePythonStore";

type MessageApi = {
  loading: (content: string, duration?: number) => void;
  success: (content: string, duration?: number) => void;
  error: (content: string, duration?: number) => void;
  info: (content: string, duration?: number) => void;
};

type ShowEditorRunError = (args: {
  message: string;
  lineno?: number | null;
  filename?: string;
}) => void;

export function usePyodideWorkerRuntime(args: {
  code: string;
  contextCode: string;
  enabledBreakpointLines: number[];
  clearEditorRunError: () => void;
  showEditorRunError: ShowEditorRunError;
  messageApi: MessageApi;
}) {
  const {
    code,
    contextCode,
    enabledBreakpointLines,
    clearEditorRunError,
    showEditorRunError,
    messageApi,
  } = args;
  const {
    setIsReady,
    setIsRunning,
    setIsPaused,
    setRunStatus,
    setCurrentLine,
    setPausedDepth,
    setOutput,
    setVariableScopes,
    setOutputDurationMs,
    resetExecution,
  } = usePythonStore();

  const workerRef = useRef<Worker | null>(null);
  const sabRef = useRef<Int32Array | null>(null);
  const enabledBreakpointLinesRef = useRef<number[]>(enabledBreakpointLines);

  const syncSharedBreakpoints = useCallback((lines: number[]) => {
    const sab = sabRef.current;
    if (!sab) return;
    const maxCount = Math.max(0, sab.length - IDX_BP_START);
    const limited = lines.slice(0, maxCount);
    Atomics.store(sab, IDX_BP_COUNT, limited.length);
    for (let i = 0; i < limited.length; i += 1) {
      Atomics.store(sab, IDX_BP_START + i, limited[i]);
    }
  }, []);

  const finishTimerRef = useRef<number | null>(null);
  const hadErrorRef = useRef(false);
  const runStartedAtRef = useRef<number | null>(null);
  const minEndAtRef = useRef(0);
  const runIdRef = useRef(0);

  const basePackagesRef = useRef<string[]>([]);
  const loadedPackagesRef = useRef<string[]>([]);
  const [basePackages, setBasePackages] = useState<string[]>([]);
  const [loadedPackages, setLoadedPackages] = useState<string[]>([]);
  const [depsLoading, setDepsLoading] = useState(false);

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current === null) return;
    window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = null;
  }, []);

  const initWorker = useCallback((): Worker => {
    const worker = new PyodideWorker();
    workerRef.current = worker;

    const sab = new SharedArrayBuffer(SAB_INT_LENGTH * 4);
    const int32 = new Int32Array(sab);
    sabRef.current = int32;

    worker.postMessage({ type: "INIT_SAB", payload: sab });
    syncSharedBreakpoints(enabledBreakpointLinesRef.current);

    worker.onmessage = (event: MessageEvent) => {
      const {
        type,
        message,
        lineno,
        filename,
        scopes,
        packages,
        traceback,
        depth,
      } = event.data;

      if (type === "BASE_PACKAGES") {
        if (Array.isArray(packages)) {
          const uniq: string[] = [];
          const seen = new Set<string>();
          for (const p of packages) {
            const key = String(p).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            uniq.push(String(p));
          }
          basePackagesRef.current = uniq;
          setBasePackages(uniq);
        } else {
          basePackagesRef.current = [];
          setBasePackages([]);
        }
      } else if (type === "READY") {
        setIsReady(true);
        if (loadedPackagesRef.current.length > 0) {
          workerRef.current?.postMessage({
            type: "LOAD_PACKAGES",
            payload: { packages: loadedPackagesRef.current },
          });
        }
      } else if (type === "STDOUT") {
        setOutput((prev) => [...prev, message]);
      } else if (type === "PAUSED") {
        setIsPaused(true);
        setCurrentLine(lineno);
        if (typeof depth === "number" && Number.isFinite(depth)) {
          setPausedDepth(depth);
        }
        setVariableScopes(Array.isArray(scopes) ? scopes : []);
      } else if (type === "PACKAGES_LOADING") {
        setDepsLoading(true);
        const text = Array.isArray(packages) ? packages.join(", ") : "";
        if (text) messageApi.loading(`正在加载依赖：${text}`, 1.2);
      } else if (type === "PACKAGES_LOADED") {
        setDepsLoading(false);
        if (Array.isArray(packages) && packages.length > 0) {
          setLoadedPackages((prev) => {
            const uniq = [...prev];
            const seen = new Set<string>(prev.map((p) => String(p)));
            for (const p of packages) {
              const key = String(p);
              if (seen.has(key)) continue;
              seen.add(key);
              uniq.push(key);
            }
            loadedPackagesRef.current = uniq;
            return uniq;
          });
          const text = packages.join(", ");
          messageApi.success(`依赖加载成功：${text}`, 1.5);
        }
      } else if (type === "PACKAGES_ERROR") {
        setDepsLoading(false);
        const text = Array.isArray(packages) ? packages.join(", ") : "";
        messageApi.error(
          `依赖加载失败${text ? `（${text}）` : ""}：${String(message ?? "")}`,
        );
      } else if (type === "DONE") {
        const runId = runIdRef.current;
        const now = performance.now();
        const delayMs = Math.max(0, minEndAtRef.current - now);
        const hadError = hadErrorRef.current;
        const startedAt = runStartedAtRef.current;
        const durationMs =
          !hadError && startedAt !== null
            ? Math.max(0, Math.round(now - startedAt))
            : null;

        const finalize = () => {
          if (runIdRef.current !== runId) return;
          setIsRunning(false);
          setIsPaused(false);
          setCurrentLine(null);
          setRunStatus(hadError ? "error" : "success");
          if (!hadError) setOutputDurationMs(durationMs);
          setOutput((prev) => [
            ...prev,
            hadError ? "—— 执行失败 ——" : "—— 执行成功 ——",
          ]);
        };

        if (delayMs > 0) {
          clearFinishTimer();
          finishTimerRef.current = window.setTimeout(finalize, delayMs);
        } else {
          finalize();
        }
      } else if (type === "ERROR") {
        const details =
          typeof traceback === "string" && traceback.trim().length > 0
            ? traceback
            : String(message ?? "");
        setOutput((prev) => [...prev, `错误：${String(message ?? "")}`]);
        showEditorRunError({ message: details, lineno, filename });
        hadErrorRef.current = true;
      }
    };

    return worker;
  }, [
    clearFinishTimer,
    enabledBreakpointLinesRef,
    messageApi,
    setCurrentLine,
    setIsPaused,
    setIsReady,
    setIsRunning,
    setOutput,
    setOutputDurationMs,
    setPausedDepth,
    setRunStatus,
    setVariableScopes,
    showEditorRunError,
    syncSharedBreakpoints,
  ]);

  useEffect(() => {
    initWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, [initWorker]);

  useEffect(() => {
    enabledBreakpointLinesRef.current = enabledBreakpointLines;
    syncSharedBreakpoints(enabledBreakpointLines);
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: "UPDATE_BREAKPOINTS",
        payload: enabledBreakpointLines,
      });
    }
  }, [enabledBreakpointLines, syncSharedBreakpoints]);

  const runCode = useCallback(() => {
    runIdRef.current += 1;
    clearFinishTimer();
    hadErrorRef.current = false;
    runStartedAtRef.current = performance.now();
    minEndAtRef.current =
      performance.now() + (enabledBreakpointLines.length === 0 ? 100 : 0);
    setOutput([]);
    setIsRunning(true);
    setIsPaused(false);
    setRunStatus("running");
    setOutputDurationMs(null);
    setCurrentLine(null);
    setVariableScopes([]);
    clearEditorRunError();

    workerRef.current?.postMessage({
      type: "RUN_CODE",
      payload: {
        code,
        contextCode,
        breakpoints: enabledBreakpointLines,
      },
    });
  }, [
    clearEditorRunError,
    code,
    clearFinishTimer,
    contextCode,
    enabledBreakpointLines,
    setCurrentLine,
    setIsPaused,
    setIsRunning,
    setOutput,
    setOutputDurationMs,
    setRunStatus,
    setVariableScopes,
  ]);

  const continueExec = useCallback(() => {
    if (!sabRef.current) return;
    workerRef.current?.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: enabledBreakpointLines,
    });
    Atomics.store(sabRef.current, IDX_BASE_DEPTH, 0);
    Atomics.store(sabRef.current, IDX_CMD, CMD_RUN);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, [enabledBreakpointLines, setIsPaused]);

  const stepOver = useCallback(
    (baseDepth: number) => {
      if (!sabRef.current) return;
      workerRef.current?.postMessage({
        type: "UPDATE_BREAKPOINTS",
        payload: enabledBreakpointLines,
      });
      Atomics.store(sabRef.current, IDX_BASE_DEPTH, baseDepth);
      Atomics.store(sabRef.current, IDX_CMD, CMD_STEP_OVER);
      Atomics.notify(sabRef.current, IDX_CMD);
      setIsPaused(false);
    },
    [enabledBreakpointLines, setIsPaused],
  );

  const stepInto = useCallback(
    (baseDepth: number) => {
      if (!sabRef.current) return;
      workerRef.current?.postMessage({
        type: "UPDATE_BREAKPOINTS",
        payload: enabledBreakpointLines,
      });
      Atomics.store(sabRef.current, IDX_BASE_DEPTH, baseDepth);
      Atomics.store(sabRef.current, IDX_CMD, CMD_STEP_IN);
      Atomics.notify(sabRef.current, IDX_CMD);
      setIsPaused(false);
    },
    [enabledBreakpointLines, setIsPaused],
  );

  const stepOut = useCallback(
    (baseDepth: number) => {
      if (!sabRef.current) return;
      workerRef.current?.postMessage({
        type: "UPDATE_BREAKPOINTS",
        payload: enabledBreakpointLines,
      });
      Atomics.store(sabRef.current, IDX_BASE_DEPTH, baseDepth);
      Atomics.store(sabRef.current, IDX_CMD, CMD_STEP_OUT);
      Atomics.notify(sabRef.current, IDX_CMD);
      setIsPaused(false);
    },
    [enabledBreakpointLines, setIsPaused],
  );

  const stopExec = useCallback(() => {
    runIdRef.current += 1;
    clearFinishTimer();
    workerRef.current?.terminate();
    workerRef.current = null;
    sabRef.current = null;
    resetExecution();
    setIsReady(false);
    setOutput((prev) => [...prev, "—— 已终止 ——"]);
    const worker = initWorker();
    worker.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: enabledBreakpointLines,
    });
  }, [
    clearFinishTimer,
    enabledBreakpointLines,
    initWorker,
    resetExecution,
    setIsReady,
    setOutput,
  ]);

  const loadExtraPackages = useCallback(
    (packagesToLoad: string[]) => {
      if (!workerRef.current) return;
      const loadedSet = new Set<string>();
      for (const p of basePackagesRef.current) {
        const key = /^https?:\/\//i.test(p) ? p : p.toLowerCase();
        loadedSet.add(key);
      }
      for (const p of loadedPackagesRef.current) {
        const key = /^https?:\/\//i.test(p) ? p : p.toLowerCase();
        loadedSet.add(key);
      }
      const packages = packagesToLoad
        .map((p) => p.trim())
        .filter(Boolean)
        .filter((p) => {
          const key = /^https?:\/\//i.test(p) ? p : p.toLowerCase();
          return !loadedSet.has(key);
        });
      if (packages.length === 0) {
        messageApi.info("这些依赖已加载");
        return;
      }
      workerRef.current.postMessage({
        type: "LOAD_PACKAGES",
        payload: { packages },
      });
    },
    [messageApi],
  );

  return {
    depsLoading,
    basePackages,
    loadedPackages,
    setLoadedPackages,
    loadedPackagesRef,
    loadExtraPackages,
    runCode,
    continueExec,
    stepOver,
    stepInto,
    stepOut,
    stopExec,
  };
}
