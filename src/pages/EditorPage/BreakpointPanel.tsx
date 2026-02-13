import { useMemo } from "react";
import { Button, Checkbox, Typography } from "antd";
import { Trash2 } from "lucide-react";
import type { Breakpoint } from "../../types";

type BreakpointRow = Breakpoint & { key: number; content: string };

type BreakpointPanelProps = {
  breakpoints: Breakpoint[];
  code: string;
  onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
  onRemoveBreakpoint: (line: number) => void;
};

export default function BreakpointPanel({
  breakpoints,
  code,
  onSetBreakpointEnabled,
  onRemoveBreakpoint,
}: BreakpointPanelProps) {
  const codeLines = useMemo(() => code.split(/\r?\n/), [code]);
  const rows = useMemo<BreakpointRow[]>(
    () =>
      [...breakpoints]
        .sort((a, b) => a.line - b.line)
        .map((bp) => ({
          ...bp,
          key: bp.line,
          content: (codeLines[bp.line - 1] ?? "").trimEnd(),
        })),
    [breakpoints, codeLines],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-2 py-1.5 border-b border-black/12 font-semibold text-xs">
        <div className="w-20">行号</div>
        <div className="flex-1">内容</div>
        <div className="w-10 text-right">操作</div>
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
              className={`flex items-center gap-2 px-2 py-1.5 border-b border-black/[0.08] text-xs ${
                row.enabled ? "" : "text-black/45"
              }`}
            >
              <div className="w-20 flex items-center gap-2">
                <Checkbox
                  checked={row.enabled}
                  onChange={(e) =>
                    onSetBreakpointEnabled(row.line, e.target.checked)
                  }
                />
                <span className={row.enabled ? "" : "line-through"}>
                  {row.line}
                </span>
              </div>

              <div
                title={row.content}
                className={`flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] ${
                  row.enabled ? "" : "line-through"
                }`}
              >
                {row.content.length > 0 ? (
                  row.content
                ) : (
                  <span className="text-black/35">（空行）</span>
                )}
              </div>

              <div className="w-10 flex justify-end">
                <Button
                  size="small"
                  type="text"
                  danger
                  aria-label="删除断点"
                  icon={<Trash2 size={14} />}
                  onClick={() => onRemoveBreakpoint(row.line)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
