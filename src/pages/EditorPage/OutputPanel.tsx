import { Typography } from "antd";

type OutputPanelProps = {
  output: string[];
};

export default function OutputPanel({ output }: OutputPanelProps) {
  return (
    <div className="p-2 flex flex-col h-full min-h-0">
      {output.length === 0 ? (
        <Typography.Text type="secondary">等待输出...</Typography.Text>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto pr-1">
          {output.map((line, idx) => (
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
