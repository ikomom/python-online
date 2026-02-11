import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { OnMount } from "@monaco-editor/react";
import { Button, Space } from "antd";
import { EditorSurface } from "./EditorSurface";
import type { EditorPlugin, EditorXMode, EditorXTheme } from "./types";
import { useEditorCommands } from "./hooks/useEditorCommands";
import { useEditorHistory } from "./hooks/useEditorHistory";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import styles from "./EditorX.module.scss";

export type EditorXProps = {
  value: string;
  onChange: (v: string) => void;
  mode: EditorXMode;
  theme: EditorXTheme;
  readonly: boolean;
  plugins: EditorPlugin[];
  title?: string;
};

export function EditorX(props: EditorXProps) {
  const [editor, setEditor] =
    useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const pluginsRef = useRef<EditorPlugin[]>(props.plugins);
  useEffect(() => {
    pluginsRef.current = props.plugins;
  }, [props.plugins]);

  const { exec } = useEditorCommands({
    editor,
    plugins: props.plugins,
  });
  const history = useEditorHistory(editor);

  const onMount = useCallback<OnMount>((editor, monaco) => {
    setEditor(editor);
    for (const plugin of pluginsRef.current) {
      plugin.onMount?.({ editor, monaco });
    }
  }, []);

  const emitChange = useCallback(
    (value: string) => {
      props.onChange(value);
      for (const plugin of pluginsRef.current) {
        plugin.onChange?.(value);
      }
    },
    [props],
  );

  useEditorShortcuts({
    editor,
    onCommand: (cmd) => {
      if (cmd.type === "save") {
        for (const plugin of pluginsRef.current) {
          plugin.onCommand?.(cmd);
          plugin.onAutoSave?.(props.value);
        }
        return;
      }
      exec(cmd);
    },
  });

  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      for (const plugin of pluginsRef.current) {
        plugin.onAutoSave?.(props.value);
      }
    }, 600);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [props.value]);

  const onUndo = useCallback(() => exec({ type: "undo" }), [exec]);
  const onRedo = useCallback(() => exec({ type: "redo" }), [exec]);
  const onFormat = useCallback(() => exec({ type: "format" }), [exec]);

  const onSave = useCallback(() => {
    for (const plugin of pluginsRef.current) {
      plugin.onCommand?.({ type: "save" });
      plugin.onAutoSave?.(props.value);
    }
  }, [props.value]);

  const toolbarNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (const plugin of props.plugins) {
      const node = plugin.renderToolbar?.({
        value: props.value,
        mode: props.mode,
        theme: props.theme,
        readonly: props.readonly,
      });
      if (node)
        nodes.push(<React.Fragment key={plugin.id}>{node}</React.Fragment>);
    }
    return nodes;
  }, [props.plugins, props.mode, props.readonly, props.theme, props.value]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.title}>
          {props.title ?? "编辑器"} · {props.mode.toUpperCase()}
        </div>
        {toolbarNodes.length > 0 ? (
          <Space size={8}>{toolbarNodes}</Space>
        ) : null}
        <div style={{ flex: 1 }} />
        <Space size={8}>
          <Button onClick={onSave} type="primary">
            保存
          </Button>
          <Button onClick={onUndo} disabled={!history.canUndo}>
            撤销
          </Button>
          <Button onClick={onRedo} disabled={!history.canRedo}>
            重做
          </Button>
          <Button onClick={onFormat}>格式化</Button>
        </Space>
      </div>
      <div className={styles.surface}>
        <EditorSurface
          value={props.value}
          onChange={emitChange}
          mode={props.mode}
          theme={props.theme}
          readonly={props.readonly}
          onMount={onMount}
        />
      </div>
    </div>
  );
}
