import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Button, Layout, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { editor as MonacoEditor } from "monaco-editor";
import PyodideWorker from "./worker/pyodide.worker?worker";

const IDX_CMD = 0;
const CMD_RUN = 1;
const CMD_STEP = 3;

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

type CodeTemplate = {
  id: string;
  label: string;
  description: string;
  code: string;
};

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

type VariableRow = { key: string; name: string; value: string };

function App() {
  const [code, setCode] = useState<string>(CODE_TEMPLATES[0].code);
  const [output, setOutput] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    CODE_TEMPLATES[0].id,
  );

  const workerRef = useRef<Worker | null>(null);
  const sabRef = useRef<Int32Array | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    const worker = new PyodideWorker();
    workerRef.current = worker;

    // Create SharedArrayBuffer
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
        setVariables(vars);
      } else if (type === "DONE") {
        setIsRunning(false);
        setIsPaused(false);
        setCurrentLine(null);
        setOutput((prev) => [...prev, "—— 执行结束 ——"]);
      } else if (type === "ERROR") {
        setOutput((prev) => [...prev, `错误：${message}`]);
        setIsRunning(false);
        setIsPaused(false);
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

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

  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => {
      return prev.includes(line)
        ? prev.filter((l) => l !== line)
        : [...prev, line];
    });
  }, []);

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
    [toggleBreakpoint],
  );

  const runCode = useCallback(() => {
    setOutput([]);
    setIsRunning(true);
    setIsPaused(false);
    setCurrentLine(null);
    setVariables({});

    workerRef.current?.postMessage({
      type: "RUN_CODE",
      payload: { code, breakpoints },
    });
  }, [breakpoints, code]);

  const step = useCallback(() => {
    if (!sabRef.current) return;
    Atomics.store(sabRef.current, IDX_CMD, CMD_STEP);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, []);

  const continueExec = useCallback(() => {
    if (!sabRef.current) return;
    Atomics.store(sabRef.current, IDX_CMD, CMD_RUN);
    Atomics.notify(sabRef.current, IDX_CMD);
    setIsPaused(false);
  }, []);

  const selectedTemplate =
    CODE_TEMPLATES.find((template) => template.id === selectedTemplateId) ??
    CODE_TEMPLATES[0];

  const applyTemplate = useCallback(() => {
    setCode(selectedTemplate.code);
    setVariables({});
    setCurrentLine(null);
    setIsPaused(false);
  }, [selectedTemplate.code]);

  const handleTemplateChange = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setVariables({});
    setCurrentLine(null);
    setIsPaused(false);
  }, []);

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

  const variableColumns = useMemo<ColumnsType<VariableRow>>(
    () => [
      { title: "变量", dataIndex: "name", width: 160 },
      { title: "值", dataIndex: "value" },
    ],
    [],
  );

  return (
    <Layout style={{ height: "100%" }}>
      <Layout.Header style={{ background: "transparent", padding: "8px 12px" }}>
        <Space wrap size={8}>
          <Typography.Text strong>Python 调试器</Typography.Text>
          <Tag>{status}</Tag>
          <Select
            value={selectedTemplateId}
            style={{ width: 160 }}
            options={CODE_TEMPLATES.map((t) => ({
              value: t.id,
              label: t.label,
            }))}
            onChange={handleTemplateChange}
          />
          <Button onClick={applyTemplate}>加载模板</Button>
          <Typography.Text type="secondary">
            {selectedTemplate.description}
          </Typography.Text>
          {!isRunning ? (
            <Button type="primary" onClick={runCode} disabled={!isReady}>
              {isReady ? "开始运行" : "加载中..."}
            </Button>
          ) : (
            <>
              <Button onClick={continueExec} disabled={!isPaused}>
                继续运行
              </Button>
              <Button onClick={step} disabled={!isPaused}>
                单步执行
              </Button>
            </>
          )}
        </Space>
      </Layout.Header>

      <Layout>
        <Layout.Content style={{ minWidth: 0 }}>
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
        </Layout.Content>

        <Layout.Sider
          width={420}
          style={{
            background: "transparent",
            borderLeft: "1px solid rgba(0,0,0,0.15)",
            padding: 12,
          }}
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <div style={{ border: "1px solid rgba(0,0,0,0.15)" }}>
              <div
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <Typography.Text strong>变量</Typography.Text>
              </div>
              <div style={{ maxHeight: "40vh", overflow: "auto" }}>
                <Table
                  size="small"
                  pagination={false}
                  columns={variableColumns}
                  dataSource={variableRows}
                />
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,0,0,0.15)" }}>
              <div
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <Typography.Text strong>输出</Typography.Text>
              </div>
              <div style={{ padding: 10, maxHeight: "40vh", overflow: "auto" }}>
                {output.length === 0 ? (
                  <Typography.Text type="secondary">
                    等待输出...
                  </Typography.Text>
                ) : (
                  output.map((line, idx) => (
                    <Typography.Paragraph
                      key={idx}
                      style={{ marginBottom: 6, whiteSpace: "pre-wrap" }}
                    >
                      {line}
                    </Typography.Paragraph>
                  ))
                )}
              </div>
            </div>
          </Space>
        </Layout.Sider>
      </Layout>
    </Layout>
  );
}

export default App;
