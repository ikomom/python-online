import { Collapse } from "antd";
import { useMemo } from "react";
import type { VariableScope } from "../../types";

type VariablePanelProps = {
  scopes: VariableScope[];
};

export default function VariablePanel({ scopes }: VariablePanelProps) {
  const items = useMemo(
    () =>
      scopes.map((scope) => {
        const entries = Object.entries(scope.variables).sort(([a], [b]) =>
          a.localeCompare(b),
        );

        const body =
          entries.length === 0 ? (
            <div className="p-2 text-black/45 text-xs">暂无变量</div>
          ) : (
            <div className="flex flex-col">
              <div className="flex gap-2 px-2 py-1.5 border-b border-black/12 font-semibold text-xs">
                <div className="w-20">变量</div>
                <div className="flex-1">值</div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {entries.map(([name, value]) => (
                  <div
                    key={`${scope.id}:${name}`}
                    className="flex items-center gap-2 px-2 py-1.5 border-b border-black/[0.08] text-xs"
                  >
                    <div
                      title={name}
                      className="w-20  overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {name}
                    </div>
                    <div
                      title={value}
                      className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

        const label =
          scope.name === "<module>"
            ? `全局  ·  L${scope.lineno}`
            : `${scope.name}  ·  L${scope.lineno}`;

        return {
          key: scope.id,
          label,
          children: body,
        };
      }),
    [scopes],
  );
  const topKey = items[0]?.key;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto">
        {scopes.length === 0 ? (
          <div className="p-2 text-black/45 text-xs">暂无变量</div>
        ) : (
          <Collapse
            key={topKey}
            items={items}
            defaultActiveKey={topKey ? [topKey] : []}
            size="small"
            bordered={false}
          />
        )}
      </div>
    </div>
  );
}
