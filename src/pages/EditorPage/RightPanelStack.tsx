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

function canResizeDivider(
  panelDefs: PanelDef[],
  openByKey: Record<PanelKey, boolean>,
  dividerIndex: number,
): boolean {
  const left = panelDefs[dividerIndex]?.key;
  const right = panelDefs[dividerIndex + 1]?.key;
  if (!left || !right) return false;
  return openByKey[left] || openByKey[right];
}

function PanelDivider(props: DividerProps & { isEnabled: boolean }) {
  const isEnabled = props.isEnabled && !props.disabled;
  const ariaOrientation =
    props.direction === "horizontal" ? "vertical" : "horizontal";
  const cursor =
    props.direction === "horizontal"
      ? isEnabled
        ? "col-resize"
        : "default"
      : isEnabled
        ? "row-resize"
        : "default";
  const baseStyle: CSSProperties = {
    flex: "none",
    position: "relative",
    userSelect: "none",
    touchAction: "none",
    ...(props.direction === "horizontal"
      ? { width: "1px" }
      : { height: "1px" }),
    cursor: props.isDragging
      ? props.direction === "horizontal"
        ? "col-resize"
        : "row-resize"
      : cursor,
    ...(props.style ?? {}),
  };

  return (
    <div
      className={clsx(
        "split-pane-divider",
        props.direction,
        props.isDragging && "dragging",
        props.className,
        isEnabled ? "" : "opacity-40",
      )}
      style={baseStyle}
      role="separator"
      aria-orientation={ariaOrientation}
      aria-disabled={!isEnabled}
      aria-valuenow={props.currentSize}
      aria-valuemin={props.minSize}
      aria-valuemax={props.maxSize}
      tabIndex={isEnabled ? 0 : -1}
      onPointerDown={isEnabled ? props.onPointerDown : undefined}
      onMouseDown={isEnabled ? props.onMouseDown : undefined}
      onTouchStart={isEnabled ? props.onTouchStart : undefined}
      onTouchEnd={isEnabled ? props.onTouchEnd : undefined}
      onKeyDown={isEnabled ? props.onKeyDown : undefined}
    >
      {props.children}
    </div>
  );
}

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
