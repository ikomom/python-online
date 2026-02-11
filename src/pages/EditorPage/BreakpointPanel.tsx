import { useMemo } from "react";
import { Button, Typography } from "antd";

type BreakpointRow = { key: number; line: number };

type BreakpointPanelProps = {
  breakpoints: number[];
  onToggleBreakpoint: (line: number) => void;
};

export default function BreakpointPanel({
  breakpoints,
  onToggleBreakpoint,
}: BreakpointPanelProps) {
  const rows = useMemo<BreakpointRow[]>(
    () =>
      [...breakpoints]
        .sort((a, b) => a - b)
        .map((line) => ({ key: line, line })),
    [breakpoints],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-2 py-1.5 border-b border-black/12 font-semibold text-xs">
        <div className="w-16">行号</div>
        <div className="flex-1">操作</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <Typography.Text type="secondary" className="block p-2">
            暂无断点
          </Typography.Text>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-2 px-2 py-1.5 border-b border-black/[0.08] text-xs"
            >
              <div className="w-16">{row.line}</div>
              <div className="flex-1">
                <Button
                  size="small"
                  onClick={() => onToggleBreakpoint(row.line)}
                >
                  移除
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
