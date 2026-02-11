import type { editor as MonacoEditor } from "monaco-editor";
import type React from "react";
import type { OnMount } from "@monaco-editor/react";

export type EditorXMode = "markdown" | "json" | "plaintext";
export type EditorXTheme = "light" | "dark";

export type EditorCommand =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "save" }
  | { type: "format" };

export type EditorPlugin = {
  id: string;
  onMount?: (ctx: {
    editor: MonacoEditor.IStandaloneCodeEditor;
    monaco: Parameters<OnMount>[1];
  }) => void;
  onChange?: (value: string) => void;
  onCommand?: (cmd: EditorCommand) => void;
  onAutoSave?: (value: string) => void;
  renderToolbar?: (ctx: {
    value: string;
    mode: EditorXMode;
    theme: EditorXTheme;
    readonly: boolean;
  }) => React.ReactNode;
};
