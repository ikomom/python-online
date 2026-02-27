import { useMemo } from "react";
import { Tag } from "antd";
import DebugPanelStack, { type DebugPanel } from "../../components/DebugPanelStack";
import BreakpointPanel from "./BreakpointPanel";
import OutputPanel from "./OutputPanel";
import VariablePanel from "./VariablePanel";
import GraphPanel from "../../components/GraphPanel";
import PositioningPanel from "../../components/PositioningPanel";
import type { RunStatus } from "../../types";
import { usePythonStore } from "../../store/usePythonStore";

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function OutputPanelTitle({ status, durationMs }: { status: RunStatus; durationMs: number | null }) {
  const statusNode =
    status === "running" ? <Tag color="processing" className="text-xs">运行中</Tag>
    : status === "success" ? <Tag color="success" className="text-xs">成功</Tag>
    : status === "error" ? <Tag color="error" className="text-xs">失败</Tag>
    : null;
  const durationText = status === "success" && durationMs !== null ? formatDurationMs(durationMs) : "";
  return (
    <>
      <span className="shrink-0">输出</span>
      {statusNode}
      {durationText && <span className="text-[11px] text-black/45 whitespace-nowrap">{durationText}</span>}
    </>
  );
}

type Props = {
  activeTab: "debugger" | "graph" | "graph-debug" | "positioning-debug";
  extraPanels?: DebugPanel[];
};

export default function RightPanelStack({ activeTab, extraPanels }: Props) {
  const {
    code, breakpoints, setBreakpointEnabled, removeBreakpoint,
    output, runStatus, outputDurationMs, variableScopes,
  } = usePythonStore((s) => ({
    code: s.code,
    breakpoints: s.breakpoints,
    setBreakpointEnabled: s.setBreakpointEnabled,
    removeBreakpoint: s.removeBreakpoint,
    output: s.output,
    runStatus: s.runStatus,
    outputDurationMs: s.outputDurationMs,
    variableScopes: s.variableScopes,
  }));

  const basePanels = useMemo((): DebugPanel[] => {
    const panels: DebugPanel[] = [];
    if (activeTab !== "graph") {
      panels.push({
        key: "variables",
        title: "变量",
        content: <VariablePanel scopes={variableScopes} />,
      });
      panels.push({
        key: "breakpoints",
        title: "断点",
        content: (
          <BreakpointPanel
            breakpoints={breakpoints}
            code={code}
            onSetBreakpointEnabled={setBreakpointEnabled}
            onRemoveBreakpoint={removeBreakpoint}
          />
        ),
      });
    }
    panels.push({
      key: "output",
      title: <OutputPanelTitle status={runStatus} durationMs={outputDurationMs} />,
      content: <OutputPanel output={output} />,
    });
    return panels;
  }, [activeTab, variableScopes, breakpoints, code, setBreakpointEnabled, removeBreakpoint, runStatus, outputDurationMs, output]);

  const allPanels = useMemo(
    () => [...basePanels, ...(extraPanels ?? [])],
    [basePanels, extraPanels],
  );

  const debugStack = <DebugPanelStack key={activeTab} panels={allPanels} />;

  if (activeTab === "graph" || activeTab === "graph-debug") {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 border-b border-black/8" style={{ height: "50%" }}>
          <GraphPanel />
        </div>
        <div className="flex-1 min-h-0">{debugStack}</div>
      </div>
    );
  }

  if (activeTab === "positioning-debug") {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 border-b border-black/8" style={{ height: "50%" }}>
          <PositioningPanel />
        </div>
        <div className="flex-1 min-h-0">{debugStack}</div>
      </div>
    );
  }

  return debugStack;
}
