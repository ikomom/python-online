import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Button,
  Layout,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CornerDownRight,
  CornerUpLeft,
  LoaderCircle,
  Play,
  PlayCircle,
  SquareStop,
  StepForward,
} from "lucide-react";
import type { editor as MonacoEditor } from "monaco-editor";
import { Pane, SplitPane } from "react-split-pane";
import PyodideWorker from "./worker/pyodide.worker?worker";
import RightPanelStack from "./pages/EditorPage/RightPanelStack";
import ExtraDepsModal from "./components/ExtraDepsModal";
import type { CodeTemplate } from "./types";
import { usePythonStore } from "./store/usePythonStore";
import "./App.css";

const IDX_CMD = 0;
const IDX_BASE_DEPTH = 1;
const CMD_RUN = 1;
const CMD_STEP_OVER = 3;
const CMD_STEP_IN = 4;
const CMD_STEP_OUT = 5;

function RunControls(props: {
  onRun: () => void;
  onContinue: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onStop: () => void;
}) {
  const { isRunning, isPaused, isReady, hasBreakpoints, runStatus } =
    usePythonStore((s) => ({
      isRunning: s.isRunning,
      isPaused: s.isPaused,
      isReady: s.isReady,
      hasBreakpoints: s.breakpoints.some((b) => b.enabled),
      runStatus: s.runStatus,
    }));

  if (!isRunning) {
    return (
      <Tooltip title={isReady ? "开始运行" : "加载中..."} placement="bottom">
        <span>
          <Button
            size="small"
            type="primary"
            shape="circle"
            onClick={props.onRun}
            disabled={!isReady}
            aria-label={isReady ? "开始运行" : "加载中"}
            icon={
              isReady ? (
                <PlayCircle size={14} />
              ) : (
                <LoaderCircle size={14} className="animate-spin" />
              )
            }
          />
        </span>
      </Tooltip>
    );
  }

  if (!hasBreakpoints && !isPaused && runStatus === "running") {
    return (
      <Space size={4}>
        <Tooltip title="运行中" placement="bottom">
          <span>
            <Button
              size="small"
              type="primary"
              shape="circle"
              disabled
              aria-label="运行中"
              icon={<LoaderCircle size={14} className="animate-spin" />}
            />
          </span>
        </Tooltip>
        <Tooltip title="结束运行" placement="bottom">
          <span>
            <Button
              size="small"
              shape="circle"
              danger
              onClick={props.onStop}
              aria-label="结束运行"
              icon={<SquareStop size={14} />}
            />
          </span>
        </Tooltip>
      </Space>
    );
  }

  return (
    <Space size={4}>
      <Tooltip title="继续运行" placement="bottom">
        <span>
          <Button
            size="small"
            shape="circle"
            onClick={props.onContinue}
            disabled={!isPaused}
            aria-label="继续运行"
            icon={<Play size={14} />}
          />
        </span>
      </Tooltip>
      <Tooltip title="单步（跳过函数）" placement="bottom">
        <span>
          <Button
            size="small"
            shape="circle"
            onClick={props.onStepOver}
            disabled={!isPaused}
            aria-label="单步（跳过函数）"
            icon={<StepForward size={14} />}
          />
        </span>
      </Tooltip>
      <Tooltip title="运行进函数" placement="bottom">
        <span>
          <Button
            size="small"
            shape="circle"
            onClick={props.onStepInto}
            disabled={!isPaused}
            aria-label="运行进函数"
            icon={<CornerDownRight size={14} />}
          />
        </span>
      </Tooltip>
      <Tooltip title="运行出函数" placement="bottom">
        <span>
          <Button
            size="small"
            shape="circle"
            onClick={props.onStepOut}
            disabled={!isPaused}
            aria-label="运行出函数"
            icon={<CornerUpLeft size={14} />}
          />
        </span>
      </Tooltip>
      <Tooltip title="结束运行" placement="bottom">
        <span>
          <Button
            size="small"
            shape="circle"
            danger
            onClick={props.onStop}
            aria-label="结束运行"
            icon={<SquareStop size={14} />}
          />
        </span>
      </Tooltip>
    </Space>
  );
}

const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: "basic",
    label: "基础输出",
    description: "变量、函数与循环的基础示例",
    code: 'print("你好，Python")\n\ndef add(a, b):\n    return a + b\n\nfor i in range(5):\n    x = i * 2\n    y = add(x, 1)\n    print(f"i={i}, x={x}, y={y}")\n\nprint("结束")',
  },
  {
    id: "branch",
    label: "条件分支",
    description: "if/elif/else 与逻辑判断",
    code: 'score = 78\n\nif score >= 90:\n    level = "优秀"\nelif score >= 75:\n    level = "良好"\nelif score >= 60:\n    level = "及格"\nelse:\n    level = "不及格"\n\nprint("成绩等级:", level)',
  },
  {
    id: "list",
    label: "列表推导",
    description: "过滤与转换列表的方式",
    code: 'numbers = list(range(1, 11))\n\nsquares = [n * n for n in numbers]\nevens = [n for n in numbers if n % 2 == 0]\n\nprint("原始:", numbers)\nprint("平方:", squares)\nprint("偶数:", evens)',
  },
  {
    id: "dict",
    label: "字典统计",
    description: "统计字符出现频次",
    code: 'text = "python_debugger"\n\ncounter = {}\nfor ch in text:\n    counter[ch] = counter.get(ch, 0) + 1\n\nprint(counter)',
  },
  {
    id: "recursion",
    label: "递归计算",
    description: "递归函数与调用栈演示",
    code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint("5! =", factorial(5))',
  },
  {
    id: "class",
    label: "类与对象",
    description: "类、方法与实例状态",
    code: 'class Counter:\n    def __init__(self):\n        self.value = 0\n\n    def inc(self, step=1):\n        self.value += step\n\ncounter = Counter()\nfor _ in range(3):\n    counter.inc()\n\nprint("当前计数:", counter.value)',
  },
  {
    id: "debug",
    label: "断点演示",
    description: "适合在循环内打断点观察变量",
    code: 'total = 0\n\nfor i in range(1, 6):\n    total += i\n    avg = total / i\n    print(i, total, avg)\n\nprint("汇总:", total)',
  },
  {
    id: "httpbin",
    label: "HTTP 请求",
    description: "requests + httpbin.org 获取 JSON 并打印",
    deps: ["requests"],
    code: 'import requests\nimport json\n\n\ndef getRaw():\n    res = requests.get("https://httpbin.org/get")\n    obj = res.json()\n    print(json.dumps(obj, ensure_ascii=False, indent=2))\n\n\ngetRaw()\n',
  },
];

function App() {
  const {
    code,
    contextCode,
    selectedTemplateId,
    breakpoints,
    isReady,
    isRunning,
    isPaused,
    currentLine,
    hoverLine,
    variableScopes,
    setCode,
    setContextCode,
    setSelectedTemplateId,
    toggleBreakpoint,
    setIsReady,
    setIsRunning,
    setIsPaused,
    setRunStatus,
    setCurrentLine,
    setHoverLine,
    setOutput,
    setVariableScopes,
    setOutputDurationMs,
    resetExecution,
  } = usePythonStore();

  const workerRef = useRef<Worker | null>(null);
  const sabRef = useRef<Int32Array | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const hasRunErrorMarkerRef = useRef(false);
  const decorationsRef = useRef<string[]>([]);
  const runIdRef = useRef(0);
  const minEndAtRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const hadErrorRef = useRef(false);
  const runStartedAtRef = useRef<number | null>(null);

  const [depsModalOpen, setDepsModalOpen] = useState(false);
  const [depsLoading, setDepsLoading] = useState(false);
  const [basePackages, setBasePackages] = useState<string[]>([]);
  const [loadedPackages, setLoadedPackages] = useState<string[]>([]);
  const basePackagesRef = useRef<string[]>([]);
  const loadedPackagesRef = useRef<string[]>([]);

  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [contextDraft, setContextDraft] = useState("");

  const [messageApi, messageContextHolder] = message.useMessage();

  const enabledBreakpointLines = useMemo(
    () => breakpoints.filter((b) => b.enabled).map((b) => b.line),
    [breakpoints],
  );

  const allBreakpointLines = useMemo(
    () => breakpoints.map((b) => b.line),
    [breakpoints],
  );

  // Initialize code from default template on first load
  useEffect(() => {
    if (!code) {
      setCode(CODE_TEMPLATES[0].code);
    }
  }, [code, setCode]);

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current === null) return;
    window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = null;
  }, []);

  const clearEditorRunError = useCallback(() => {
    hasRunErrorMarkerRef.current = false;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, "python-run", []);
  }, []);

  const showEditorRunError = useCallback(
    (args: { message: string; lineno?: number | null; filename?: string }) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;
      const model = editor.getModel();
      if (!model) return;

      const rawLine =
        typeof args.lineno === "number" && Number.isFinite(args.lineno)
          ? args.lineno
          : null;
      const line =
        args.filename === "<user_code>"
          ? Math.min(Math.max(1, rawLine ?? 1), model.getLineCount())
          : 1;

      monaco.editor.setModelMarkers(model, "python-run", [
        {
          severity: monaco.MarkerSeverity.Error,
          message:
            args.filename && args.filename !== "<user_code>"
              ? `上下文代码错误：${args.message}`
              : args.message,
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: model.getLineMaxColumn(line),
        },
      ]);

      hasRunErrorMarkerRef.current = true;
      editor.revealLineInCenter(line);
    },
    [],
  );

  const initWorker = useCallback((): Worker => {
    const worker = new PyodideWorker();
    workerRef.current = worker;

    const sab = new SharedArrayBuffer(1024);
    const int32 = new Int32Array(sab);
    sabRef.current = int32;

    worker.postMessage({ type: "INIT_SAB", payload: sab });

    worker.onmessage = (event: MessageEvent) => {
      const { type, message, lineno, filename, scopes, packages, traceback } =
        event.data;

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
        setVariableScopes(Array.isArray(scopes) ? scopes : []);
      } else if (type === "PACKAGES_LOADING") {
        setDepsLoading(true);
        const text = Array.isArray(packages) ? packages.join(", ") : "";
        if (text) messageApi.loading(`正在加载依赖：${text}`, 1.2);
      } else if (type === "PACKAGES_LOADED") {
        setDepsLoading(false);
        if (Array.isArray(packages) && packages.length > 0) {
          setLoadedPackages((prev) => {
            const merged = [...prev, ...packages];
            const uniq: string[] = [];
            const seen = new Set<string>();
            for (const p of merged) {
              const lowered = String(p).toLowerCase();
              if (seen.has(lowered)) continue;
              seen.add(lowered);
              uniq.push(String(p));
            }
            loadedPackagesRef.current = uniq;
            return uniq;
          });
          messageApi.success(`依赖加载成功：${packages.join(", ")}`);
        } else {
          messageApi.success("依赖加载成功");
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
    messageApi,
    setCurrentLine,
    setIsPaused,
    setIsReady,
    setIsRunning,
    setOutput,
    setOutputDurationMs,
    setRunStatus,
    setVariableScopes,
    showEditorRunError,
  ]);

  useEffect(() => {
    initWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, [initWorker]);

  // Sync breakpoints with worker
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: "UPDATE_BREAKPOINTS",
        payload: enabledBreakpointLines,
      });
    }
  }, [enabledBreakpointLines]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const newDecorations: MonacoEditor.IModelDeltaDecoration[] = [];

    const enabledSet = new Set(enabledBreakpointLines);
    const anySet = new Set(allBreakpointLines);

    for (const bp of breakpoints) {
      const line = bp.line;
      const isCurrent = currentLine === line;
      const isEnabled = enabledSet.has(line);
      newDecorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: false,
          glyphMarginClassName: isCurrent
            ? isEnabled
              ? "my-glyph-margin-current-breakpoint"
              : "my-glyph-margin-current-breakpoint-disabled"
            : isEnabled
              ? "my-glyph-margin-breakpoint"
              : "my-glyph-margin-breakpoint-disabled",
          glyphMarginHoverMessage: {
            value: isEnabled ? "断点" : "断点（停用）",
          },
        },
      });
    }

    if (
      hoverLine !== null &&
      hoverLine !== currentLine &&
      !anySet.has(hoverLine)
    ) {
      newDecorations.push({
        range: {
          startLineNumber: hoverLine,
          startColumn: 1,
          endLineNumber: hoverLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: false,
          glyphMarginClassName: "my-glyph-margin-breakpoint-hover",
        },
      });
    }

    if (currentLine !== null) {
      if (!anySet.has(currentLine)) {
        newDecorations.push({
          range: {
            startLineNumber: currentLine,
            startColumn: 1,
            endLineNumber: currentLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: false,
            glyphMarginClassName: "my-glyph-margin-current",
            glyphMarginHoverMessage: { value: "当前执行行" },
          },
        });
      }

      newDecorations.push({
        range: {
          startLineNumber: currentLine,
          startColumn: 1,
          endLineNumber: currentLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "my-content-execution-line",
        },
      });
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  }, [
    allBreakpointLines,
    breakpoints,
    currentLine,
    enabledBreakpointLines,
    hoverLine,
  ]);

  const handleEditorMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, "python");
      clearEditorRunError();

      editor.onDidChangeModelContent(() => {
        if (!hasRunErrorMarkerRef.current) return;
        clearEditorRunError();
      });

      editor.onMouseDown((e) => {
        if (
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        ) {
          const lineNumber = e.target.position?.lineNumber;
          if (lineNumber) toggleBreakpoint(lineNumber);
        }
      });

      editor.onMouseMove((e) => {
        const isGutter =
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
        if (!isGutter) {
          setHoverLine(null);
          return;
        }
        const lineNumber = e.target.position?.lineNumber ?? null;
        setHoverLine(lineNumber);
      });

      editor.onMouseLeave(() => {
        setHoverLine(null);
      });
    },
    [clearEditorRunError, toggleBreakpoint, setHoverLine],
  );

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
      payload: { code, contextCode, breakpoints: enabledBreakpointLines },
    });
  }, [
    enabledBreakpointLines,
    clearFinishTimer,
    clearEditorRunError,
    code,
    contextCode,
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

  const baseDepth = Math.max(1, variableScopes.length);

  const stepOver = useCallback(() => {
    if (!sabRef.current) return;
    workerRef.current?.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: enabledBreakpointLines,
    });
    Atomics.store(sabRef.current, IDX_BASE_DEPTH, baseDepth);
    Atomics.store(sabRef.current, IDX_CMD, CMD_STEP_OVER);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, [baseDepth, enabledBreakpointLines, setIsPaused]);

  const stepInto = useCallback(() => {
    if (!sabRef.current) return;
    workerRef.current?.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: enabledBreakpointLines,
    });
    Atomics.store(sabRef.current, IDX_BASE_DEPTH, baseDepth);
    Atomics.store(sabRef.current, IDX_CMD, CMD_STEP_IN);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, [baseDepth, enabledBreakpointLines, setIsPaused]);

  const stepOut = useCallback(() => {
    if (!sabRef.current) return;
    workerRef.current?.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: enabledBreakpointLines,
    });
    Atomics.store(sabRef.current, IDX_BASE_DEPTH, baseDepth);
    Atomics.store(sabRef.current, IDX_CMD, CMD_STEP_OUT);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, [baseDepth, enabledBreakpointLines, setIsPaused]);

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
      if (!workerRef.current || !isReady) return;
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
    [isReady, messageApi],
  );

  const handleTemplateChange = useCallback(
    (id: string) => {
      setSelectedTemplateId(id);
      const nextTemplate =
        CODE_TEMPLATES.find((t) => t.id === id) ?? CODE_TEMPLATES[0];
      setCode(nextTemplate.code);
      if (nextTemplate.deps && nextTemplate.deps.length > 0) {
        loadExtraPackages(nextTemplate.deps);
      }
      setVariableScopes([]);
      setCurrentLine(null);
      setIsPaused(false);
      clearEditorRunError();
    },
    [
      clearEditorRunError,
      loadExtraPackages,
      setCode,
      setCurrentLine,
      setIsPaused,
      setSelectedTemplateId,
      setVariableScopes,
    ],
  );

  const status = useMemo(() => {
    if (!isReady) return "加载中";
    if (isRunning && isPaused) return "已暂停";
    if (isRunning) return "运行中";
    return "就绪";
  }, [isPaused, isReady, isRunning]);

  const hasContext = contextCode.trim().length > 0;

  return (
    <Layout className="flex flex-col h-full">
      {messageContextHolder}
      <Layout.Header className="flex items-center px-2 h-12! bg-transparent!">
        <Space size={6} align="center" className="min-w-0">
          <Typography.Text strong className="text-[13px]">
            Python 调试器
          </Typography.Text>
          <Tag className="ml-1 text-xs w-14 text-center!">{status}</Tag>
          {hasContext ? (
            <Tag className="ml-1 text-xs" color="blue">
              上下文
            </Tag>
          ) : null}
          <Select
            value={selectedTemplateId}
            size="small"
            className="min-w-0"
            popupMatchSelectWidth={false}
            disabled={isRunning}
            options={CODE_TEMPLATES.map((t) => ({
              value: t.id,
              label: `${t.label}`,
              rawLabel: t.label,
              description: t.description,
            }))}
            optionRender={(option) => (
              <div className="flex flex-col w-full max-w-full">
                <div className="text-[13px] leading-5 break-words whitespace-normal">
                  {String(option.data.rawLabel ?? option.label)}
                </div>
                <div className="text-xs text-black/45 leading-4 break-words whitespace-normal">
                  {String(option.data.description ?? "")}
                </div>
              </div>
            )}
            onChange={handleTemplateChange}
          />
          <Tooltip title="加载额外依赖（优先 CDN）" placement="bottom">
            <span>
              <Button
                size="small"
                onClick={() => setDepsModalOpen(true)}
                disabled={!isReady || isRunning || depsLoading}
              >
                加载依赖
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="添加隐藏上下文代码" placement="bottom">
            <span>
              <Button
                size="small"
                onClick={() => {
                  setContextDraft(contextCode);
                  setContextModalOpen(true);
                }}
                disabled={isRunning}
              >
                上下文
              </Button>
            </span>
          </Tooltip>
        </Space>
        <div className="flex-1" />
        <div className="flex items-center justify-end shrink-0 min-w-[120px]">
          <RunControls
            onRun={runCode}
            onContinue={continueExec}
            onStepOver={stepOver}
            onStepInto={stepInto}
            onStepOut={stepOut}
            onStop={stopExec}
          />
        </div>
      </Layout.Header>

      <ExtraDepsModal
        open={depsModalOpen}
        loading={depsLoading}
        basePackages={basePackages}
        loadedPackages={loadedPackages}
        onClose={() => setDepsModalOpen(false)}
        onLoad={(pkgs) => loadExtraPackages(pkgs)}
      />

      <Modal
        title="上下文代码"
        open={contextModalOpen}
        onCancel={() => setContextModalOpen(false)}
        onOk={() => {
          setContextCode(contextDraft);
          setContextModalOpen(false);
        }}
        okText="保存"
        cancelText="取消"
        destroyOnClose={false}
      >
        <div className="flex flex-col gap-2">
          <Typography.Text type="secondary" className="text-xs">
            这里的代码不会显示在主编辑器里，但每次运行都会先执行，可在主代码中直接使用。
          </Typography.Text>
          <div className="h-[360px] border border-black/10 rounded overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="python"
              language="python"
              theme="vs"
              value={contextDraft}
              onChange={(val) => setContextDraft(val || "")}
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                renderLineHighlight: "line",
                fontSize: 13,
                padding: { top: 12 },
                automaticLayout: true,
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setContextDraft("")}
              disabled={contextDraft.length === 0}
            >
              清空
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex-1 min-h-0">
        <SplitPane
          direction="horizontal"
          dividerClassName="thick"
          className="h-full"
        >
          <Pane minSize={520} defaultSize="68%" className="min-h-0">
            <div className="h-full">
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs"
                value={code}
                onChange={(val) => setCode(val || "")}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  glyphMargin: true,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "line",
                }}
              />
            </div>
          </Pane>
          <Pane minSize={280} className="min-h-0">
            <div className="h-full">
              <RightPanelStack />
            </div>
          </Pane>
        </SplitPane>
      </div>
    </Layout>
  );
}

export default App;
