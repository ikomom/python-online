import type { VariableRow } from "../../types";

type VariablePanelProps = {
  rows: VariableRow[];
};

export default function VariablePanel({ rows }: VariablePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-2 py-1.5 border-b border-black/12 font-semibold text-xs">
        <div className="w-20">变量</div>
        <div className="flex-1">值</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <div className="p-2 text-black/45 text-xs">暂无变量</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-2 px-2 py-1.5 border-b border-black/[0.08] text-xs"
            >
              <div className="w-20">{row.name}</div>
              <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {row.value}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
