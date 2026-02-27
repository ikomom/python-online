import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Button,
  Layout,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
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
import { useNavigate } from "react-router-dom";
import type { editor as MonacoEditor } from "monaco-editor";
import { Pane, SplitPane } from "react-split-pane";
import { CHALLENGES } from "./challenges";
import type { TestResult } from "./useChallengeRunner";
import { usePythonStore } from "../../store/usePythonStore";
import { usePyodideWorkerRuntime } from "../../features/pythonRunner";
import ExtraDepsModal from "../../components/ExtraDepsModal";
import ContextCodeModal from "../../components/ContextCodeModal";
import RightPanelStack from "../EditorPage/RightPanelStack";
import TestCasesPanel from "../../components/TestCasesPanel";
import { generateGraph } from "../../utils/generateGraph";
import { generatePositioningData } from "../../utils/generatePositioning";

const DIFFICULTY_COLOR = { 简单: "success", 中等: "warning", 困难: "error" } as const;

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
      <Tooltip title={isReady ? "运行" : "加载中..."} placement="bottom">
        <span>
          <Button
            size="small"
            type="primary"
            shape="circle"
            onClick={props.onRun}
            disabled={!isReady}
            icon={isReady ? <PlayCircle size={14} /> : <LoaderCircle size={14} className="animate-spin" />}
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
            <Button size="small" type="primary" shape="circle" disabled
              icon={<LoaderCircle size={14} className="animate-spin" />} />
          </span>
        </Tooltip>
        <Tooltip title="结束运行" placement="bottom">
          <span>
            <Button size="small" shape="circle" danger onClick={props.onStop}
              icon={<SquareStop size={14} />} />
          </span>
        </Tooltip>
      </Space>
    );
  }

  return (
    <Space size={4}>
      <Tooltip title="继续运行" placement="bottom">
        <span>
          <Button size="small" shape="circle" onClick={props.onContinue}
            disabled={!isPaused} icon={<Play size={14} />} />
        </span>
      </Tooltip>
      <Tooltip title="单步（跳过函数）" placement="bottom">
        <span>
          <Button size="small" shape="circle" onClick={props.onStepOver}
            disabled={!isPaused} icon={<StepForward size={14} />} />
        </span>
      </Tooltip>
      <Tooltip title="运行进函数" placement="bottom">
        <span>
          <Button size="small" shape="circle" onClick={props.onStepInto}
            disabled={!isPaused} icon={<CornerDownRight size={14} />} />
        </span>
      </Tooltip>
      <Tooltip title="运行出函数" placement="bottom">
        <span>
          <Button size="small" shape="circle" onClick={props.onStepOut}
            disabled={!isPaused} icon={<CornerUpLeft size={14} />} />
        </span>
      </Tooltip>
      <Tooltip title="结束运行" placement="bottom">
        <span>
          <Button size="small" shape="circle" danger onClick={props.onStop}
            icon={<SquareStop size={14} />} />
        </span>
      </Tooltip>
    </Space>
  );
}

export default function ChallengePage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(CHALLENGES[0].id);
  const challenge = CHALLENGES.find((c) => c.id === selectedId)!;
  const testCasesRef = useRef(challenge.testCases);

  const {
    code, setCode,
    contextCode, setContextCode,
    breakpoints, toggleBreakpoint, setBreakpoints,
    isRunning,
    currentLine, hoverLine, setHoverLine,
    pausedDepth,
    output,
    graphData, setGraphData, setGraphResult,
    setVariableScopes, setCurrentLine, setIsPaused,
    setPositioningData, setPositioningResult,
  } = usePythonStore();

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const hasRunErrorMarkerRef = useRef(false);
  const decorationsRef = useRef<string[]>([]);

  const [depsModalOpen, setDepsModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [contextDraft, setContextDraft] = useState("");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();

  // On mount: load first challenge code into store
  useEffect(() => {
    setCode(CHALLENGES[0].starterCode);
    setBreakpoints([]);
    setVariableScopes([]);
    setCurrentLine(null);
    setIsPaused(false);
    setContextCode("");
    setGraphData(null);
    setGraphResult(null);
    setPositioningData(null);
    setPositioningResult(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset when challenge changes
  useEffect(() => {
    setCode(challenge.starterCode);
    setBreakpoints([]);
    setResults(null);
    setVariableScopes([]);
    setCurrentLine(null);
    setIsPaused(false);
    testCasesRef.current = challenge.testCases;
    if (editorRef.current) editorRef.current.setValue(challenge.starterCode);
    if (challenge.id === "shortest-path") {
      setGraphData(generateGraph());
      setGraphResult(null);
      setPositioningData(null);
      setPositioningResult(null);
    } else if (challenge.id === "bearing-positioning") {
      setPositioningData(generatePositioningData());
      setPositioningResult(null);
      setGraphData(null);
      setGraphResult(null);
    } else {
      setGraphData(null);
      setGraphResult(null);
      setPositioningData(null);
      setPositioningResult(null);
    }
  }, [challenge.id, challenge.starterCode, challenge.testCases, setBreakpoints, setCode, setCurrentLine, setGraphData, setGraphResult, setIsPaused, setPositioningData, setPositioningResult, setVariableScopes]);

  // Build effective context: test setup + optional road network + user context
  const effectiveContextCode = useMemo(() => {
    const tcJson = JSON.stringify(
      challenge.testCases.map((tc) => ({ args: tc.args, expected: tc.expected, tolerance: tc.tolerance, checkIsPosition: tc.checkIsPosition }))
    ).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const testSetup = `import json as __json__\n__TEST_CASES__ = __json__.loads('${tcJson}')`;

    let graphSetup = "";
    if (challenge.id === "shortest-path") {
      // Build graph in Python using same LCG algorithm — avoids serializing nodes as JSON
      graphSetup = `
# --- Road network (25x20 grid, seeded LCG, deterministic) ---
def __build_graph__():
    COLS, ROWS = 25, 20
    s = 0xdeadbeef
    def rng():
        nonlocal s
        s = (1664525 * s + 1013904223) & 0xFFFFFFFF
        return s / 0x100000000
    def is_outer(r, c): return r==0 or r==ROWS-1 or c==0 or c==COLS-1
    def is_cong(r, c): return 7<=r<=13 and 7<=c<=17 and not (r==10 or c==10 or c==14)
    def is_exp(r, c): return r in (4,10,16) or c in (5,12,20)
    def is_cross(r, c): return r in (7,13) or c in (8,17)
    def weight(r1,c1,r2,c2):
        if is_cong(r1,c1) or is_cong(r2,c2): return int(rng()*9)+10
        if is_outer(r1,c1) and is_outer(r2,c2): return int(rng()*2)+1
        if (is_exp(r1,c1) and is_exp(r2,c2)) or (is_cross(r1,c1) and is_cross(r2,c2)): return int(rng()*3)+2
        return int(rng()*5)+5
    def prob(r1,c1,r2,c2):
        if is_outer(r1,c1) and is_outer(r2,c2): return 1.0
        if is_cong(r1,c1) or is_cong(r2,c2): return 0.55
        if is_exp(r1,c1) or is_exp(r2,c2): return 0.92
        if is_cross(r1,c1) or is_cross(r2,c2): return 0.88
        return 0.55
    g = {str(i): {} for i in range(ROWS*COLS)}
    def add(a, b, w=None):
        ra,ca = divmod(int(a),COLS); rb,cb = divmod(int(b),COLS)
        ww = w if w is not None else weight(ra,ca,rb,cb)
        g[a][b] = ww; g[b][a] = ww
    idx = lambda r,c: str(r*COLS+c)
    for r in range(ROWS):
        for c in range(COLS-1):
            if rng()<prob(r,c,r,c+1): add(idx(r,c),idx(r,c+1))
    for r in range(ROWS-1):
        for c in range(COLS):
            if rng()<prob(r,c,r+1,c): add(idx(r,c),idx(r+1,c))
    for c in range(COLS-2):
        add(idx(0,c),idx(0,c+2),int(rng()*2)+2)
        add(idx(ROWS-1,c),idx(ROWS-1,c+2),int(rng()*2)+2)
    for r in range(ROWS-2):
        add(idx(r,0),idx(r+2,0),int(rng()*2)+2)
        add(idx(r,COLS-1),idx(r+2,COLS-1),int(rng()*2)+2)
    for er in (4,10,16):
        for c in range(COLS-2): add(idx(er,c),idx(er,c+2),int(rng()*2)+1)
    for ec in (5,12,20):
        for r in range(ROWS-2): add(idx(r,ec),idx(r+2,ec),int(rng()*2)+1)
    return g
graph = __build_graph__()
start = "0"
end   = str(25*20-1)
import heapq as __hq__
def __path_solve__(g, s, e):
    dist = {n: float('inf') for n in g}
    dist[s] = 0
    prev = {}
    pq = [(0, s)]
    while pq:
        cost, u = __hq__.heappop(pq)
        if cost > dist[u]: continue
        for v, w in g[u].items():
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                __hq__.heappush(pq, (dist[v], v))
    path, node = [], e
    while node in prev:
        path.append(node)
        node = prev[node]
    path.append(s)
    path.reverse()
    w = dist[e]
    return path, (w if w != float('inf') else -1)`;
    }

    let positioningSetup = "";
    if (challenge.id === "bearing-positioning") {
      const pd = generatePositioningData();
      const stationsJson = JSON.stringify(pd.stations).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const measurementsJson = JSON.stringify(pd.measurements).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      positioningSetup = `import json as __pjson__
stations = __pjson__.loads('${stationsJson}')
measurements = __pjson__.loads('${measurementsJson}')`;
    }

    const parts = [testSetup, graphSetup, positioningSetup, contextCode].filter(Boolean);
    return parts.join("\n");
  }, [challenge.id, challenge.testCases, contextCode]);

  const enabledBreakpointLines = useMemo(
    () => breakpoints.filter((b) => b.enabled).map((b) => b.line),
    [breakpoints],
  );
  const allBreakpointLines = useMemo(() => breakpoints.map((b) => b.line), [breakpoints]);

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
      const rawLine = typeof args.lineno === "number" && Number.isFinite(args.lineno) ? args.lineno : null;
      const line = args.filename === "<user_code>"
        ? Math.min(Math.max(1, rawLine ?? 1), model.getLineCount()) : 1;
      monaco.editor.setModelMarkers(model, "python-run", [{
        severity: monaco.MarkerSeverity.Error,
        message: args.filename && args.filename !== "<user_code>"
          ? `上下文代码错误：${args.message}` : args.message,
        startLineNumber: line, startColumn: 1,
        endLineNumber: line, endColumn: model.getLineMaxColumn(line),
      }]);
      hasRunErrorMarkerRef.current = true;
      editor.revealLineInCenter(line);
    },
    [],
  );

  const {
    depsLoading, basePackages, loadedPackages, loadExtraPackages,
    runCode, continueExec, stepOver, stepInto, stepOut, stopExec,
  } = usePyodideWorkerRuntime({
    code,
    contextCode: effectiveContextCode,
    enabledBreakpointLines,
    clearEditorRunError,
    showEditorRunError,
    messageApi,
  });

  // Parse test results from output
  useEffect(() => {
    const resultLine = output.find((l) => l.startsWith("__RESULTS__:"));
    if (!resultLine) return;
    try {
      const parsed: { passed: boolean; actual: string; expected: string }[] =
        JSON.parse(resultLine.slice("__RESULTS__:".length));
      setResults(
        parsed.map((r, i) => ({
          ...r,
          description: testCasesRef.current[i]?.description ?? `测试 ${i + 1}`,
        })),
      );
    } catch { /* ignore */ }
  }, [output]);

  // Editor decorations
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
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: {
          isWholeLine: false,
          glyphMarginClassName: isCurrent
            ? isEnabled ? "my-glyph-margin-current-breakpoint" : "my-glyph-margin-current-breakpoint-disabled"
            : isEnabled ? "my-glyph-margin-breakpoint" : "my-glyph-margin-breakpoint-disabled",
          glyphMarginHoverMessage: { value: isEnabled ? "断点" : "断点（停用）" },
        },
      });
    }
    if (hoverLine !== null && hoverLine !== currentLine && !anySet.has(hoverLine)) {
      newDecorations.push({
        range: { startLineNumber: hoverLine, startColumn: 1, endLineNumber: hoverLine, endColumn: 1 },
        options: { isWholeLine: false, glyphMarginClassName: "my-glyph-margin-breakpoint-hover" },
      });
    }
    if (currentLine !== null) {
      if (!anySet.has(currentLine)) {
        newDecorations.push({
          range: { startLineNumber: currentLine, startColumn: 1, endLineNumber: currentLine, endColumn: 1 },
          options: { isWholeLine: false, glyphMarginClassName: "my-glyph-margin-current", glyphMarginHoverMessage: { value: "当前执行行" } },
        });
      }
      newDecorations.push({
        range: { startLineNumber: currentLine, startColumn: 1, endLineNumber: currentLine, endColumn: 1 },
        options: { isWholeLine: true, className: "my-content-execution-line" },
      });
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [allBreakpointLines, breakpoints, currentLine, enabledBreakpointLines, hoverLine]);

  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
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
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) toggleBreakpoint(lineNumber);
      }
    });
    editor.onMouseMove((e) => {
      const isGutter =
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
      if (!isGutter) { setHoverLine(null); return; }
      setHoverLine(e.target.position?.lineNumber ?? null);
    });
    editor.onMouseLeave(() => setHoverLine(null));
  }, [clearEditorRunError, toggleBreakpoint, setHoverLine]);

  const baseDepth = Math.max(1, pausedDepth);
  const handleStepOver = useCallback(() => stepOver(baseDepth), [baseDepth, stepOver]);
  const handleStepInto = useCallback(() => stepInto(baseDepth), [baseDepth, stepInto]);
  const handleStepOut = useCallback(() => stepOut(baseDepth), [baseDepth, stepOut]);

  const handleChallengeChange = useCallback((id: string) => {
    setSelectedId(id);
    setResults(null);
    clearEditorRunError();
  }, [clearEditorRunError]);

  const consoleOutput = useMemo(
    () => output.filter((l) => !l.startsWith("__RESULTS__:")),
    [output],
  );
  const passedCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;
  const allPassed = results !== null && totalCount > 0 && passedCount === totalCount;
  const hasContext = contextCode.trim().length > 0;

const extraPanels = useMemo(() => [{
    key: "test-cases",
    title: results !== null
      ? <><span>测试用例</span><span className={`ml-1 font-normal ${allPassed ? "text-green-600" : "text-red-500"}`}>{passedCount}/{totalCount}</span></>
      : "测试用例",
    content: (
      <TestCasesPanel
        testCases={challenge.testCases}
        results={results}
        consoleOutput={consoleOutput}
        allPassed={allPassed}
      />
    ),
  }], [results, allPassed, passedCount, totalCount, challenge.testCases, consoleOutput]);

  return (
    <Layout className="flex flex-col h-full">
      {messageContextHolder}
      <Layout.Header className="flex items-center px-3 h-12! bg-white! border-b border-black/8 shrink-0">
        <Space size={8} align="center" className="min-w-0">
          <Segmented
            size="small"
            value="challenge"
            options={[
              { label: "调试器", value: "debugger" },
              { label: "编程挑战", value: "challenge" },
            ]}
            onChange={(v) => { if (v === "debugger") navigate("/"); }}
          />
          <Select
            value={selectedId}
            size="small"
            popupMatchSelectWidth={false}
            disabled={isRunning}
            options={CHALLENGES.map((c) => ({ value: c.id, label: c.title, difficulty: c.difficulty }))}
            optionRender={(opt) => (
              <div className="flex items-center gap-2">
                <span>{opt.data.label}</span>
                <Tag color={DIFFICULTY_COLOR[opt.data.difficulty as keyof typeof DIFFICULTY_COLOR]} className="text-[11px]">
                  {opt.data.difficulty}
                </Tag>
              </div>
            )}
            onChange={handleChallengeChange}
          />
          <Tag color={DIFFICULTY_COLOR[challenge.difficulty]}>{challenge.difficulty}</Tag>
          {hasContext && <Tag color="blue" className="text-xs">上下文</Tag>}
          <Tooltip title="加载额外依赖" placement="bottom">
            <span>
              <Button size="small" onClick={() => setDepsModalOpen(true)}
                disabled={isRunning || depsLoading}>加载依赖</Button>
            </span>
          </Tooltip>
          <Tooltip title="添加隐藏上下文代码" placement="bottom">
            <span>
              <Button size="small" onClick={() => { setContextDraft(contextCode); setContextModalOpen(true); }}
                disabled={isRunning}>上下文</Button>
            </span>
          </Tooltip>
        </Space>
        <div className="flex-1" />
        <Space size={8} align="center">
          {results !== null && (
            <span className={`text-xs font-medium ${allPassed ? "text-green-600" : "text-red-500"}`}>
              {passedCount}/{totalCount} 通过
            </span>
          )}
          <RunControls
            onRun={runCode}
            onContinue={continueExec}
            onStepOver={handleStepOver}
            onStepInto={handleStepInto}
            onStepOut={handleStepOut}
            onStop={stopExec}
          />
        </Space>
      </Layout.Header>

      <ExtraDepsModal
        open={depsModalOpen}
        loading={depsLoading}
        basePackages={basePackages}
        loadedPackages={loadedPackages}
        onClose={() => setDepsModalOpen(false)}
        onLoad={loadExtraPackages}
      />
      <ContextCodeModal
        open={contextModalOpen}
        value={contextDraft}
        onChange={setContextDraft}
        onClose={() => setContextModalOpen(false)}
        onSave={() => { setContextCode(contextDraft); setContextModalOpen(false); }}
      />

      <div className="flex-1 min-h-0">
        <SplitPane direction="horizontal" dividerClassName="thick" className="h-full">
          {/* Left: description + editor */}
          <Pane minSize={400} defaultSize="58%" className="min-h-0">
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-black/8 bg-[#fafafa] overflow-y-auto shrink-0" style={{ maxHeight: 180 }}>
                <div className="text-[13px] font-semibold mb-1">{challenge.title}</div>
                <pre className="text-xs text-black/70 whitespace-pre-wrap font-sans leading-5 m-0">
                  {challenge.description}
                </pre>
              </div>
              <div className="px-3 py-1.5 border-b border-black/8 bg-white shrink-0 flex items-center gap-2">
                <span className="text-xs text-black/45">查看解法：</span>
                <Select
                  size="small"
                  placeholder="选择解法"
                  popupMatchSelectWidth={false}
                  style={{ minWidth: 120 }}
                  options={challenge.solutions.map((s, i) => ({ value: i, label: s.label }))}
                  onChange={(idx: number) => {
                    const sol = challenge.solutions[idx];
                    if (!sol) return;
                    setCode(sol.code);
                    if (editorRef.current) editorRef.current.setValue(sol.code);
                  }}
                  value={null}
                />
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs"
                  value={code}
                  onChange={(v) => setCode(v ?? "")}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    glyphMargin: true,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    fontSize: 13,
                    renderLineHighlight: "line",
                  }}
                />
              </div>
            </div>
          </Pane>
          {/* Right: debug panels (graph on top) + test results */}
          <Pane minSize={280} className="min-h-0">
            <div className="h-full">
              <RightPanelStack
                activeTab={
                  challenge.id === "shortest-path" ? "graph-debug"
                  : challenge.id === "bearing-positioning" ? "positioning-debug"
                  : "debugger"
                }
                extraPanels={extraPanels}
              />
            </div>
          </Pane>
        </SplitPane>
      </div>
    </Layout>
  );
}



