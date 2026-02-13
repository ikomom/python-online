import Editor from "@monaco-editor/react";
import { Button, Modal, Typography } from "antd";
import { useCallback } from "react";

export default function ContextCodeModal(props: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const handleSave = useCallback(() => {
    props.onSave();
  }, [props]);

  return (
    <Modal
      title="上下文代码"
      open={props.open}
      onCancel={props.onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnClose={false}
    >
      <div className="flex flex-col gap-2">
        <Typography.Text type="secondary" className="text-xs">
          这里的代码不会显示在主编辑器里，但每次运行都会先执行，可在主代码中直接使用。
        </Typography.Text>
        <div className="h-[360px] border border-black/10 rounded overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="python"
            language="python"
            theme="vs"
            value={props.value}
            onChange={(val) => props.onChange(val || "")}
            options={{
              minimap: { enabled: false },
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              renderLineHighlight: "line",
              fontSize: 13,
              padding: { top: 12 },
              automaticLayout: true,
            }}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => props.onChange("")}
            disabled={props.value.length === 0}
          >
            清空
          </Button>
        </div>
      </div>
    </Modal>
  );
}
