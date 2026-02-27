import { Typography } from "antd";

type OutputPanelProps = {
  output: string[];
};

const INTERNAL_PREFIXES = ["__RESULTS__:", "__GRAPH_RESULT__:"];

function isInternalLine(line: string): boolean {
  return INTERNAL_PREFIXES.some((p) => line.startsWith(p));
}

export default function OutputPanel({ output }: OutputPanelProps) {
  const visible = output.filter((l) => !isInternalLine(l));
  return (
    <div className="p-2 flex flex-col h-full min-h-0">
      {visible.length === 0 ? (
        <Typography.Text type="secondary">等待输出...</Typography.Text>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto pr-1">
          {visible.map((line, idx) => (
            <Typography.Paragraph
              key={idx}
              className="mb-1.5 whitespace-pre-wrap break-words"
            >
              {line}
            </Typography.Paragraph>
          ))}
        </div>
      )}
    </div>
  );
}
