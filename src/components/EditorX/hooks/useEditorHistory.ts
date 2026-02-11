import { useMemo } from "react";
import type { editor as MonacoEditor } from "monaco-editor";

export function useEditorHistory(editor: MonacoEditor.IStandaloneCodeEditor | null) {
  return useMemo(
    () => ({
      canUndo: Boolean(editor),
      canRedo: Boolean(editor),
    }),
    [editor],
  );
}

