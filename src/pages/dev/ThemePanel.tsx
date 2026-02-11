import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ThemeMode } from "@/theme/antd.theme.config";
import styles from "./ThemePanel.module.scss";

type TokenKind = "color" | "px" | "string";

type EditableToken = {
  name: string;
  label: string;
  kind: TokenKind;
};

const DEFAULT_TOKENS: EditableToken[] = [
  { name: "color-primary", label: "主色", kind: "color" },
  { name: "color-bg", label: "页面背景", kind: "color" },
  { name: "color-surface", label: "容器背景", kind: "color" },
  { name: "color-text", label: "正文文字", kind: "color" },
  { name: "color-border", label: "边框颜色", kind: "color" },
  { name: "radius-base", label: "圆角", kind: "px" },
  { name: "font-size-base", label: "基础字号", kind: "px" },
  { name: "motion-ease", label: "动画曲线", kind: "string" },
];

function readCssVar(name: string): string {
  return getComputedStyle(document.body)
    .getPropertyValue(`--ds-${name}`)
    .trim();
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ThemePanel(props: {
  mode: ThemeMode;
  toggleTheme: () => void;
  setCssToken: (tokenName: string, value: string) => void;
  onBack: () => void;
}) {
  const [tokens, setTokens] = useState<EditableToken[]>(DEFAULT_TOKENS);
  const [newTokenName, setNewTokenName] = useState("");
  const [revision, setRevision] = useState(0);

  const dataSource = useMemo(() => {
    void props.mode;
    void revision;
    return tokens.map((t) => ({
      key: t.name,
      ...t,
      value: readCssVar(t.name),
    }));
  }, [tokens, props.mode, revision]);

  const updateToken = useCallback(
    (name: string, value: string) => {
      props.setCssToken(name, value);
      setRevision((v) => v + 1);
    },
    [props],
  );

  const columns = useMemo<ColumnsType<EditableToken & { value: string }>>(
    () => [
      {
        title: "Token",
        dataIndex: "name",
        width: 220,
        render: (name) => (
          <span style={{ fontFamily: "var(--ds-font-family-mono)" }}>
            {name}
          </span>
        ),
      },
      {
        title: "说明",
        dataIndex: "label",
        width: 160,
      },
      {
        title: "类型",
        dataIndex: "kind",
        width: 100,
        render: (kind) => <Tag>{kind}</Tag>,
      },
      {
        title: "值",
        dataIndex: "value",
        render: (_value, record) => {
          if (record.kind === "color") {
            return (
              <ColorPicker
                value={record.value || "#000000"}
                onChange={(_, hex) => updateToken(record.name, hex)}
                showText
              />
            );
          }

          if (record.kind === "px") {
            const parsed = Number.parseFloat(record.value);
            const num = Number.isFinite(parsed) ? parsed : 0;
            return (
              <Space>
                <InputNumber
                  value={num}
                  min={0}
                  onChange={(v) => updateToken(record.name, `${v ?? 0}px`)}
                />
                <span style={{ color: "var(--ds-color-text-secondary)" }}>
                  px
                </span>
              </Space>
            );
          }

          return (
            <Input
              value={record.value}
              onChange={(e) => updateToken(record.name, e.target.value)}
            />
          );
        },
      },
    ],
    [updateToken],
  );

  const onAddToken = useCallback(() => {
    const name = newTokenName.trim();
    if (!name) return;
    if (tokens.some((t) => t.name === name)) return;

    setTokens((prev) => [
      ...prev,
      { name, label: "自定义", kind: "string" as const },
    ]);
    setNewTokenName("");
  }, [newTokenName, tokens]);

  const onExportSnapshot = useCallback(() => {
    const snapshot: Record<string, string> = {};
    for (const token of tokens) snapshot[token.name] = readCssVar(token.name);
    downloadJson(`theme-snapshot.${props.mode}.json`, {
      mode: props.mode,
      tokens: snapshot,
    });
  }, [props.mode, tokens]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>主题调试面板</div>
        <Tag color={props.mode === "dark" ? "blue" : "gold"}>
          {props.mode === "dark" ? "暗色" : "亮色"}
        </Tag>
        <div style={{ flex: 1 }} />
        <Space>
          <Button onClick={props.toggleTheme}>切换主题</Button>
          <Button onClick={onExportSnapshot} type="primary">
            导出 JSON 快照
          </Button>
          <Button onClick={props.onBack}>返回</Button>
        </Space>
      </div>

      <div className={styles.content}>
        <Space style={{ marginBottom: 12 }}>
          <Input
            value={newTokenName}
            placeholder="新增 token 名称，例如 color-accent"
            onChange={(e) => setNewTokenName(e.target.value)}
            style={{ width: 320 }}
          />
          <Button onClick={onAddToken}>添加</Button>
        </Space>

        <Table
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={dataSource}
        />
      </div>
    </div>
  );
}
