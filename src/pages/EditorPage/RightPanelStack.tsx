import clsx from "clsx";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tag } from "antd";
import {
  Pane,
  SplitPane,
  type DividerProps,
  type Size,
} from "react-split-pane";
import CollapsiblePanel from "../../components/CollapsiblePanel";
import BreakpointPanel from "./BreakpointPanel";
import OutputPanel from "./OutputPanel";
import VariablePanel from "./VariablePanel";
import type { Breakpoint, RunStatus, VariableScope } from "../../types";
import { usePythonStore } from "../../store/usePythonStore";

type PanelKey = "breakpoints" | "variables" | "output";

const COLLAPSED_PANE_PX = 34;

type PanelDef = {
  key: PanelKey;
  title: string;
  minOpenPx: number;
  defaultOpenSize?: Size;
  render: (ctx: {
    breakpoints: Breakpoint[];
    onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
    onRemoveBreakpoint: (line: number) => void;
    variableScopes: VariableScope[];
    output: string[];
  }) => React.ReactNode;
};

const PANEL_DEFS: PanelDef[] = [
  {
    key: "variables",
    title: "变量",
    minOpenPx: 140,
    defaultOpenSize: "47%",
    render: (ctx) => <VariablePanel scopes={ctx.variableScopes} />,
  },
  {
    key: "breakpoints",
    title: "断点",
    minOpenPx: 120,
    defaultOpenSize: "25%",
    render: (ctx) => (
      <BreakpointPanel
        breakpoints={ctx.breakpoints}
        onSetBreakpointEnabled={ctx.onSetBreakpointEnabled}
        onRemoveBreakpoint={ctx.onRemoveBreakpoint}
      />
    ),
  },
  {
    key: "output",
    title: "输出",
    minOpenPx: 140,
    render: (ctx) => <OutputPanel output={ctx.output} />,
  },
];

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function OutputPanelTitle(props: {
  status: RunStatus;
  durationMs: number | null;
}) {
  const statusNode =
    props.status === "running" ? (
      <Tag color="processing" className="text-xs">
        运行中
      </Tag>
    ) : props.status === "success" ? (
      <Tag color="success" className="text-xs">
        成功
      </Tag>
    ) : props.status === "error" ? (
      <Tag color="error" className="text-xs">
        失败
      </Tag>
    ) : null;

  const durationText =
    props.status === "success" && props.durationMs !== null
      ? formatDurationMs(props.durationMs)
      : "";

  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="shrink-0">输出</span>
      {statusNode}
      {durationText ? (
        <span className="text-[11px] text-black/45 whitespace-nowrap">
          {durationText}
        </span>
      ) : null}
    </span>
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
      onMouseDown={isEnabled ? props.onMouseDown : undefined}
      onTouchStart={isEnabled ? props.onTouchStart : undefined}
      onTouchEnd={isEnabled ? props.onTouchEnd : undefined}
      onKeyDown={isEnabled ? props.onKeyDown : undefined}
    >
      {props.children}
    </div>
  );
}

export default function RightPanelStack() {
  const {
    breakpoints,
    setBreakpointEnabled,
    removeBreakpoint,
    output,
    runStatus,
    outputDurationMs,
    variableScopes,
  } = usePythonStore((s) => ({
    breakpoints: s.breakpoints,
    setBreakpointEnabled: s.setBreakpointEnabled,
    removeBreakpoint: s.removeBreakpoint,
    output: s.output,
    runStatus: s.runStatus,
    outputDurationMs: s.outputDurationMs,
    variableScopes: s.variableScopes,
  }));

  const panelDefs = useMemo(() => PANEL_DEFS, []);
  const [openByKey, setOpenByKey] = useState<Record<PanelKey, boolean>>(() => {
    const next = {} as Record<PanelKey, boolean>;
    for (const panel of panelDefs) next[panel.key] = true;
    return next;
  });

  const sizesRef = useRef<number[] | null>(null);
  const [overrideSizeByKey, setOverrideSizeByKey] = useState<
    Partial<Record<PanelKey, Size>>
  >({});

  useEffect(() => {
    if (Object.keys(overrideSizeByKey).length === 0) return;
    const id = requestAnimationFrame(() => setOverrideSizeByKey({}));
    return () => cancelAnimationFrame(id);
  }, [overrideSizeByKey]);

  const setPanelOpen = useCallback((key: PanelKey, nextOpen: boolean) => {
    setOpenByKey((prev) => ({ ...prev, [key]: nextOpen }));
  }, []);

  const onTogglePanel = useCallback(
    (key: PanelKey, nextOpen: boolean) => {
      if (nextOpen) {
        const index = panelDefs.findIndex((p) => p.key === key);
        const maybeSize = sizesRef.current?.[index];
        const fallback =
          panelDefs.find((p) => p.key === key)?.defaultOpenSize ?? undefined;
        setOverrideSizeByKey((prev) => ({
          ...prev,
          [key]: maybeSize ?? fallback,
        }));
      }
      setPanelOpen(key, nextOpen);
    },
    [panelDefs, setPanelOpen],
  );

  const makePaneSizeProps = useCallback(
    (panel: PanelDef) => {
      const isOpen = openByKey[panel.key];
      const minSize = isOpen ? panel.minOpenPx : COLLAPSED_PANE_PX;
      const size = isOpen ? overrideSizeByKey[panel.key] : COLLAPSED_PANE_PX;
      const paneProps: {
        minSize: Size;
        size?: Size;
        defaultSize?: Size;
      } = { minSize };

      if (!isOpen) {
        paneProps.size = size;
        return paneProps;
      }

      if (size !== undefined) {
        paneProps.size = size;
        return paneProps;
      }

      if (panel.defaultOpenSize !== undefined) {
        paneProps.defaultSize = panel.defaultOpenSize;
      }

      return paneProps;
    },
    [openByKey, overrideSizeByKey],
  );

  const onResizeEnd = useCallback((sizes: number[]) => {
    sizesRef.current = sizes;
  }, []);

  const dividerImpl = useMemo(() => {
    return (dividerProps: DividerProps) => (
      <PanelDivider
        {...dividerProps}
        isEnabled={canResizeDivider(panelDefs, openByKey, dividerProps.index)}
      />
    );
  }, [openByKey, panelDefs]);

  return (
    <SplitPane
      direction="vertical"
      dividerClassName="thin"
      className="h-full"
      divider={dividerImpl}
      onResizeEnd={onResizeEnd}
    >
      {panelDefs.map((panel) => {
        const paneSizeProps = makePaneSizeProps(panel);
        return (
          <Pane
            key={panel.key}
            className="min-h-0"
            style={{ overflow: "hidden" }}
            {...paneSizeProps}
          >
            <div className="h-full">
              <CollapsiblePanel
                title={
                  panel.key === "output" ? (
                    <OutputPanelTitle
                      status={runStatus}
                      durationMs={outputDurationMs}
                    />
                  ) : (
                    panel.title
                  )
                }
                isOpen={openByKey[panel.key]}
                onToggle={(nextOpen) => onTogglePanel(panel.key, nextOpen)}
              >
                {panel.render({
                  breakpoints,
                  onSetBreakpointEnabled: setBreakpointEnabled,
                  onRemoveBreakpoint: removeBreakpoint,
                  variableScopes,
                  output,
                })}
              </CollapsiblePanel>
            </div>
          </Pane>
        );
      })}
    </SplitPane>
  );
}
