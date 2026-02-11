import { memo, useMemo } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { EditorXMode, EditorXTheme } from "./types";

function getLanguage(mode: EditorXMode): string {
  if (mode === "json") return "json";
  if (mode === "markdown") return "markdown";
  return "plaintext";
}

export type EditorSurfaceProps = {
  value: string;
  onChange: (value: string) => void;
  mode: EditorXMode;
  theme: EditorXTheme;
  readonly: boolean;
  onMount: OnMount;
};

function EditorSurfaceImpl(props: EditorSurfaceProps) {
  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      lineNumbers: "on" as const,
      scrollBeyondLastLine: false,
      fontFamily: "var(--ds-font-family-mono)",
      fontSize: 14,
      padding: { top: 16 },
      smoothScrolling: true,
      cursorBlinking: "phase" as const,
      cursorSmoothCaretAnimation: "on" as const,
      renderLineHighlight: "line" as const,
      guides: {
        indentation: true,
        bracketPairs: true,
      },
      readOnly: props.readonly,
      glyphMargin: true,
    }),
    [props.readonly],
  );

  return (
    <Editor
      height="100%"
      defaultLanguage={getLanguage(props.mode)}
      language={getLanguage(props.mode)}
      theme={props.theme === "dark" ? "vs-dark" : "vs"}
      value={props.value}
      onChange={(val) => props.onChange(val || "")}
      onMount={props.onMount}
      options={options}
    />
  );
}

export const EditorSurface = memo(EditorSurfaceImpl);
