import { useCallback, useEffect, useMemo, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Button, Layout, Select, Space, Tag, Tooltip, Typography } from "antd";
import {
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
import type { CodeTemplate, RunStatus, VariableRow } from "./types";
import { usePythonStore } from "./store/usePythonStore";
import "./App.css";

const IDX_CMD = 0;
const CMD_RUN = 1;
const CMD_STEP = 3;

function RunControls(props: {
  isRunning: boolean;
  isPaused: boolean;
  isReady: boolean;
  hasBreakpoints: boolean;
  runStatus: RunStatus;
  onRun: () => void;
  onContinue: () => void;
  onStep: () => void;
  onStop: () => void;
}) {
  if (!props.isRunning) {
    return (
      <Tooltip
        title={props.isReady ? "开始运行" : "加载中..."}
        placement="bottom"
      >
        <span>
          <Button
            size="small"
            type="primary"
            shape="circle"
            onClick={props.onRun}
            disabled={!props.isReady}
            aria-label={props.isReady ? "开始运行" : "加载中"}
            icon={
              props.isReady ? (
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

  if (
    !props.hasBreakpoints &&
    !props.isPaused &&
    props.runStatus === "running"
  ) {
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
            disabled={!props.isPaused}
            aria-label="继续运行"
            icon={<Play size={14} />}
          />
        </span>
      </Tooltip>
      <Tooltip title="单步执行" placement="bottom">
        <span>
          <Button
            size="small"
            shape="circle"
            onClick={props.onStep}
            disabled={!props.isPaused}
            aria-label="单步执行"
            icon={<StepForward size={14} />}
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

const PINNED_VARIABLES = [
  "i",
  "x",
  "y",
  "total",
  "avg",
  "counter",
  "score",
  "level",
  "numbers",
  "squares",
  "evens",
  "text",
];

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
];

function App() {
  const {
    code,
    selectedTemplateId,
    breakpoints,
    isReady,
    isRunning,
    isPaused,
    runStatus,
    currentLine,
    hoverLine,
    output,
    variables,
    outputDurationMs,
    setCode,
    setSelectedTemplateId,
    toggleBreakpoint,
    setIsReady,
    setIsRunning,
    setIsPaused,
    setRunStatus,
    setCurrentLine,
    setHoverLine,
    setOutput,
    setVariables,
    setOutputDurationMs,
    resetExecution,
  } = usePythonStore();

  const workerRef = useRef<Worker | null>(null);
  const sabRef = useRef<Int32Array | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const runIdRef = useRef(0);
  const minEndAtRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const hadErrorRef = useRef(false);
  const runStartedAtRef = useRef<number | null>(null);

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

  const initWorker = useCallback((): Worker => {
    const worker = new PyodideWorker();
    workerRef.current = worker;

    const sab = new SharedArrayBuffer(1024);
    const int32 = new Int32Array(sab);
    sabRef.current = int32;

    worker.postMessage({ type: "INIT_SAB", payload: sab });

    worker.onmessage = (event: MessageEvent) => {
      const { type, message, lineno, variables: vars } = event.data;

      if (type === "READY") {
        setIsReady(true);
      } else if (type === "STDOUT") {
        setOutput((prev) => [...prev, message]);
      } else if (type === "PAUSED") {
        setIsPaused(true);
        setCurrentLine(lineno);
        setVariables(vars || {});
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
        setOutput((prev) => [...prev, `错误：${message}`]);
        hadErrorRef.current = true;
      }
    };

    return worker;
  }, [
    clearFinishTimer,
    setCurrentLine,
    setIsPaused,
    setIsReady,
    setIsRunning,
    setOutput,
    setOutputDurationMs,
    setRunStatus,
    setVariables,
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
        payload: breakpoints,
      });
    }
  }, [breakpoints]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const newDecorations: MonacoEditor.IModelDeltaDecoration[] = [];

    for (const line of breakpoints) {
      newDecorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: false,
          glyphMarginClassName: "my-glyph-margin-breakpoint",
          glyphMarginHoverMessage: { value: "断点" },
        },
      });
    }

    if (hoverLine !== null && !breakpoints.includes(hoverLine)) {
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
  }, [breakpoints, currentLine, hoverLine]);

  const handleEditorMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, "python");

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
    [toggleBreakpoint, setHoverLine],
  );

  const runCode = useCallback(() => {
    runIdRef.current += 1;
    clearFinishTimer();
    hadErrorRef.current = false;
    runStartedAtRef.current = performance.now();
    minEndAtRef.current =
      performance.now() + (breakpoints.length === 0 ? 100 : 0);
    setOutput([]);
    setIsRunning(true);
    setIsPaused(false);
    setRunStatus("running");
    setOutputDurationMs(null);
    setCurrentLine(null);
    setVariables({});

    workerRef.current?.postMessage({
      type: "RUN_CODE",
      payload: { code, breakpoints },
    });
  }, [
    breakpoints,
    clearFinishTimer,
    code,
    setCurrentLine,
    setIsPaused,
    setIsRunning,
    setOutput,
    setOutputDurationMs,
    setRunStatus,
    setVariables,
  ]);

  const step = useCallback(() => {
    if (!sabRef.current) return;
    workerRef.current?.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: breakpoints,
    });
    Atomics.store(sabRef.current, IDX_CMD, CMD_STEP);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, [breakpoints, setIsPaused]);

  const continueExec = useCallback(() => {
    if (!sabRef.current) return;
    workerRef.current?.postMessage({
      type: "UPDATE_BREAKPOINTS",
      payload: breakpoints,
    });
    Atomics.store(sabRef.current, IDX_CMD, CMD_RUN);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, [breakpoints, setIsPaused]);

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
      payload: breakpoints,
    });
  }, [
    breakpoints,
    clearFinishTimer,
    initWorker,
    resetExecution,
    setIsReady,
    setOutput,
  ]);

  const selectedTemplate =
    CODE_TEMPLATES.find((template) => template.id === selectedTemplateId) ??
    CODE_TEMPLATES[0];

  const applyTemplate = useCallback(() => {
    setCode(selectedTemplate.code);
    setVariables({});
    setCurrentLine(null);
    setIsPaused(false);
  }, [
    selectedTemplate.code,
    setCode,
    setCurrentLine,
    setIsPaused,
    setVariables,
  ]);

  const handleTemplateChange = useCallback(
    (id: string) => {
      setSelectedTemplateId(id);
      setVariables({});
      setCurrentLine(null);
      setIsPaused(false);
    },
    [setCurrentLine, setIsPaused, setSelectedTemplateId, setVariables],
  );

  const status = useMemo(() => {
    if (!isReady) return "加载中";
    if (isRunning && isPaused) return "已暂停";
    if (isRunning) return "运行中";
    return "就绪";
  }, [isPaused, isReady, isRunning]);

  const templateVariables = useMemo(() => {
    const names: string[] = [];
    const add = (name: string) => {
      if (!names.includes(name)) names.push(name);
    };

    const lines = selectedTemplate.code.split("\n");
    for (const line of lines) {
      const assignMatch = line.match(/^\s*([A-Za-z_]\w*)\s*=/);
      if (assignMatch) add(assignMatch[1]);
      const forMatch = line.match(/^\s*for\s+([A-Za-z_]\w*)\s+in\s+/);
      if (forMatch) add(forMatch[1]);
      const defMatch = line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/);
      if (defMatch) add(defMatch[1]);
      const classMatch = line.match(/^\s*class\s+([A-Za-z_]\w*)\s*[:(]/);
      if (classMatch) add(classMatch[1]);
    }

    return names;
  }, [selectedTemplate.code]);

  const priorityOrder = useMemo(() => {
    const order: string[] = [];
    for (const name of templateVariables) {
      if (!order.includes(name)) order.push(name);
    }
    for (const name of PINNED_VARIABLES) {
      if (!order.includes(name)) order.push(name);
    }
    return order;
  }, [templateVariables]);

  const variableRows = useMemo<VariableRow[]>(() => {
    const priorityIndex = new Map<string, number>(
      priorityOrder.map((name, index) => [name, index]),
    );
    const sorted = Object.entries(variables).sort(([a], [b]) => {
      const pa = priorityIndex.get(a) ?? Number.POSITIVE_INFINITY;
      const pb = priorityIndex.get(b) ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
    return sorted.map(([name, value]) => ({
      key: name,
      name,
      value,
    }));
  }, [priorityOrder, variables]);

  return (
    <Layout className="flex flex-col h-full">
      <Layout.Header className="flex items-center px-2 h-12! bg-transparent!">
        <Space size={6} align="center" className="min-w-0">
          <Typography.Text strong className="text-[13px]">
            Python 调试器
          </Typography.Text>
          <Tag className="ml-1 text-xs w-14 text-center!">{status}</Tag>
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
          <Button size="small" onClick={applyTemplate} disabled={isRunning}>
            加载模板
          </Button>
        </Space>
        <div className="flex-1" />
        <div className="flex items-center justify-end shrink-0 min-w-[120px]">
          <RunControls
            isRunning={isRunning}
            isPaused={isPaused}
            isReady={isReady}
            hasBreakpoints={breakpoints.length > 0}
            runStatus={runStatus}
            onRun={runCode}
            onContinue={continueExec}
            onStep={step}
            onStop={stopExec}
          />
        </div>
      </Layout.Header>

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
              <RightPanelStack
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
                variableRows={variableRows}
                output={output}
                outputStatus={runStatus}
                outputDurationMs={outputDurationMs}
              />
            </div>
          </Pane>
        </SplitPane>
      </div>
    </Layout>
  );
}

export default App;
